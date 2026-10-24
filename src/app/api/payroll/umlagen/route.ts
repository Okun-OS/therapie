import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import {
  betriebsgroesse, U1_GRENZE, saetzeFuerMonat, standZumMonat,
  type Katalogeintrag, type Kassenwahl,
} from '@/lib/umlagen'
import { lohnjahr } from '@/lib/lohnjahre'

export const dynamic = 'force-dynamic'

/**
 * §159/§175 Die Umlagesätze der Krankenkassen.
 *
 * WAS HIER GEPFLEGT WIRD — UND WAS NICHT
 * U1 und U2 stehen nicht im Gesetz, sondern in der Satzung jeder einzelnen
 * Kasse. Die SÄTZE stehen deshalb im Katalog (`UmlageKatalog`), einmal fürs
 * ganze System und mit Quelle. Der Betrieb pflegt hier nur seine WAHL: welche
 * Erstattungsstufe er bei welcher Kasse genommen hat.
 *
 * Für Kassen, die (noch) nicht im Katalog stehen, bleibt die Handeingabe —
 * ein Betrieb mit einer kleinen BKK soll nicht warten müssen.
 *
 * Die Liste zeigt außerdem, welche Kassen bei den eigenen Beschäftigten
 * vorkommen und für welche davon noch nichts hinterlegt ist. Eine
 * Einstellung, die man erst suchen muss, wird nicht gepflegt.
 */

const FELDER = {
  id: true, kasse: true, u1Satz: true, u1Erstattung: true, u2Satz: true,
  gueltigAb: true, notiz: true, updatedAt: true,
} as const

/** Der Monat, für den die Maske rechnet: der laufende. */
function jetzt() {
  const d = new Date()
  return { jahr: d.getFullYear(), monat: d.getMonth() + 1 }
}

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ saetze: [], kassen: [], katalog: [] })

  const { jahr, monat } = jetzt()

  const [wahlen, katalogRoh, profile, beschaeftigte] = await Promise.all([
    prisma.krankenkassensatz.findMany({
      where: { customerId }, orderBy: [{ kasse: 'asc' }, { gueltigAb: 'desc' }],
      select: FELDER,
    }),
    prisma.umlageKatalog.findMany({ orderBy: [{ kasse: 'asc' }, { u1Erstattung: 'asc' }] }),
    prisma.employeePayrollProfile.findMany({
      where: { customerId }, select: { krankenkasse: true },
    }),
    prisma.employee.findMany({
      where: { customerId, active: true }, select: { weeklyHours: true },
    }),
  ])

  const katalog: Katalogeintrag[] = katalogRoh.map(k => ({
    kasse: k.kasse, u1Erstattung: k.u1Erstattung, u1Satz: k.u1Satz,
    u2Satz: k.u2Satz, gueltigAb: k.gueltigAb, geprueft: k.geprueft,
  }))

  /**
   * §175 Die Stufen, die dieser Monat zur Wahl stellt.
   *
   * Nicht alle Zeilen des Katalogs: Ändert eine Kasse ihre Sätze zum
   * 1. September, stehen im Katalog beide Stände. Zur Auswahl gehört der, der
   * heute gilt — sonst wählt jemand eine Stufe zum Satz des Vorjahres.
   */
  const stufenJeKasse = new Map<string, { erstattung: number; satz: number; u2: number | null; geprueft: boolean }[]>()
  for (const eintrag of katalog) {
    const alleStaendeDieserStufe = katalog.filter(k =>
      k.kasse === eintrag.kasse
      && Math.abs(k.u1Erstattung - eintrag.u1Erstattung) < 1e-9)
    const gueltig = standZumMonat(alleStaendeDieserStufe, jahr, monat)
    if (!gueltig || gueltig.gueltigAb !== eintrag.gueltigAb) continue
    const liste = stufenJeKasse.get(eintrag.kasse) ?? []
    liste.push({
      erstattung: eintrag.u1Erstattung, satz: eintrag.u1Satz,
      u2: eintrag.u2Satz, geprueft: eintrag.geprueft,
    })
    stufenJeKasse.set(eintrag.kasse, liste)
  }

  const katalogKassen = Array.from(stufenJeKasse.entries())
    .map(([kasse, stufen]) => ({
      kasse,
      stufen: stufen.sort((a, b) => a.erstattung - b.erstattung),
      // Kommt für diese Kasse noch ein Wechsel in diesem Jahr?
      kommenderWechsel: katalog
        .filter(k => k.kasse === kasse
          && k.gueltigAb > `${jahr}-${String(monat).padStart(2, '0')}-01`)
        .map(k => k.gueltigAb)
        .sort()[0] ?? null,
    }))
    .sort((a, b) => a.kasse.localeCompare(b.kasse, 'de'))

  // Welche Kassen kommen tatsächlich vor — und für welche fehlt der Satz?
  const wahlListe: Kassenwahl[] = wahlen.map(w => ({
    kasse: w.kasse, u1Erstattung: w.u1Erstattung, u1Satz: w.u1Satz,
    u2Satz: w.u2Satz, gueltigAb: w.gueltigAb,
  }))
  const kassen = Array.from(new Set(
    profile.map(p => (p.krankenkasse ?? '').trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'de'))
    .map(k => {
      const s = saetzeFuerMonat(k, wahlListe, katalog, jahr, monat)
      return {
        kasse: k,
        hinterlegt: s.u1 != null || s.u2 != null,
        quelle: s.quelle,
        imKatalog: stufenJeKasse.has(k),
      }
    })

  // Was heute für jede gewählte Kasse wirklich gilt — aufgelöst, nicht roh.
  const aufgeloest = Array.from(new Set(wahlen.map(w => w.kasse))).map(k => {
    const s = saetzeFuerMonat(k, wahlListe, katalog, jahr, monat)
    const eigene = wahlen.filter(w => w.kasse === k)
    return {
      id: standZumMonat(eigene, jahr, monat)?.id ?? eigene[0].id,
      kasse: k,
      u1Satz: s.u1,
      u2Satz: s.u2,
      u1Erstattung: s.u1Erstattung ?? null,
      quelle: s.quelle,
      geprueft: s.geprueft,
      gueltigAb: standZumMonat(eigene, jahr, monat)?.gueltigAb ?? eigene[0].gueltigAb,
      staende: eigene.length,
      /**
       * §175 Alle Stände dieser Kasse, jeder mit eigener Kennung.
       *
       * Sonst gibt es eine Falle, die beim Umbau aufgefallen ist: Wer im
       * September einen Satz einträgt, den Vertipper bemerkt und ihn mit
       * Stichtag 1. Januar neu einträgt, hat danach ZWEI Stände — und der
       * falsche vom September ist der jüngere und gilt weiter. Gerechnet
       * wird dann richtig, nur mit dem falschen Satz. Man muss die Stände
       * also sehen und einzeln wegräumen können.
       */
      alleStaende: eigene
        .map(e => ({
          id: e.id, gueltigAb: e.gueltigAb, u1Satz: e.u1Satz,
          u2Satz: e.u2Satz, u1Erstattung: e.u1Erstattung,
          gilt: standZumMonat(eigene, jahr, monat)?.id === e.id,
        }))
        .sort((a, b) => b.gueltigAb.localeCompare(a.gueltigAb)),
    }
  }).sort((a, b) => a.kasse.localeCompare(b.kasse, 'de'))

  const groesse = betriebsgroesse(
    beschaeftigte.map(e => ({ wochenstunden: e.weeklyHours ?? 0 })))

  const j = lohnjahr(jahr)

  return NextResponse.json({
    saetze: aufgeloest,
    kassen,
    katalog: katalogKassen,
    monat: { jahr, monat },
    fehlend: kassen.filter(k => !k.hinterlegt).map(k => k.kasse),
    betriebsgroesse: groesse,
    u1Grenze: U1_GRENZE,
    insolvenzgeld: j
      ? { satz: j.insolvenzgeldUmlage, geprueft: j.insolvenzgeldUmlageGeprueft }
      : null,
  })
}

export async function PUT(req: NextRequest) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const kasse = String(body.kasse ?? '').trim()
  if (!kasse) {
    return NextResponse.json({ error: 'Welche Krankenkasse?' }, { status: 400 })
  }

  // Ein Satz wird als Prozentzahl eingetragen und als Anteil gespeichert —
  // „2,1" heißt 2,1 %, nicht 210 %. Ein Vertipper um den Faktor hundert wäre
  // sonst erst auf der Abrechnung zu sehen.
  const prozent = (wert: unknown): number | null => {
    if (wert == null || wert === '') return null
    const z = Number(wert)
    if (!Number.isFinite(z) || z < 0 || z > 100) return null
    return Math.round(z * 1000) / 100000
  }

  const u1Satz = prozent(body.u1Satz)
  const u2Satz = prozent(body.u2Satz)
  const u1Erstattung = prozent(body.u1Erstattung)

  if (body.u1Satz != null && body.u1Satz !== '' && u1Satz == null) {
    return NextResponse.json(
      { error: 'Der U1-Satz gehört als Prozentzahl eingetragen, etwa 2,1.' },
      { status: 400 })
  }
  if (body.u2Satz != null && body.u2Satz !== '' && u2Satz == null) {
    return NextResponse.json(
      { error: 'Der U2-Satz gehört als Prozentzahl eingetragen, etwa 0,65.' },
      { status: 400 })
  }

  const gueltigAb = /^\d{4}-\d{2}-\d{2}$/.test(String(body.gueltigAb ?? ''))
    ? String(body.gueltigAb)
    // Voreinstellung ist der Monatserste, nicht heute: Eine Wahl gilt für
    // ganze Abrechnungsmonate, und der 17. wäre ein Datum, das nie greift.
    : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`

  const hinweise: string[] = []

  // §175 Steht die Kasse im Katalog, gilt die gewählte Stufe — und der Satz
  // kommt aus der Satzung, nicht aus dem Eingabefeld. Wer eine Stufe wählt,
  // die es bei dieser Kasse nicht gibt, bekommt das gesagt statt still einen
  // falschen Satz.
  const katalogEintraege = await prisma.umlageKatalog.findMany({
    where: { kasse: { equals: kasse, mode: 'insensitive' } },
  })
  const imKatalog = katalogEintraege.length > 0

  if (imKatalog && u1Erstattung != null && u1Satz == null) {
    const passt = katalogEintraege.some(k =>
      Math.abs(k.u1Erstattung - u1Erstattung) < 1e-9)
    if (!passt) {
      const stufen = Array.from(new Set(katalogEintraege.map(k => k.u1Erstattung)))
        .sort((a, b) => a - b)
        .map(e => `${(e * 100).toLocaleString('de-DE')} %`)
        .join(', ')
      return NextResponse.json({
        error: `Diese Erstattungsstufe bietet ${kasse} nicht an. Zur Wahl `
          + `stehen: ${stufen}.`,
      }, { status: 400 })
    }
  }

  const daten = {
    customerId, kasse, u1Satz, u2Satz, u1Erstattung, gueltigAb,
    notiz: String(body.notiz ?? '').slice(0, 1000).trim() || null,
  }

  const satz = await prisma.krankenkassensatz.upsert({
    where: { customerId_kasse_gueltigAb: { customerId, kasse, gueltigAb } },
    create: daten,
    update: daten,
    select: FELDER,
  })

  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'update', entityType: 'Krankenkassensatz', entityId: satz.id,
    customerId, details: { kasse, u1Satz, u2Satz, u1Erstattung, gueltigAb },
  })

  if (u1Erstattung == null && u1Satz == null) {
    hinweise.push(
      imKatalog
        ? 'Es fehlt die Erstattungsstufe. Ohne sie steht nicht fest, welchen '
          + 'Satz diese Kasse berechnet und was sie bei Entgeltfortzahlung '
          + 'zurückzahlt — sie wird vom Betrieb gewählt.'
        : 'Die Erstattungsstufe der U1 fehlt. Ohne sie lässt sich nicht '
          + 'rechnen, was die Kasse bei Entgeltfortzahlung zurückzahlt — sie '
          + 'steht in der Satzung und wird vom Betrieb gewählt.')
  }
  if (!imKatalog && u2Satz == null && u1Satz != null) {
    hinweise.push(
      'Der U2-Satz fehlt. Die Umlage für Mutterschaft gilt für ALLE '
      + 'Arbeitgeber, unabhängig von der Betriebsgröße (§1 Abs. 2 AAG).')
  }
  // Ein U1-Satz über 5 % oder unter 0,5 % ist unüblich — meist ein Vertipper.
  if (u1Satz != null && (u1Satz > 0.05 || u1Satz < 0.005)) {
    hinweise.push(
      `Ein U1-Satz von ${(u1Satz * 100).toLocaleString('de-DE')} % ist `
      + 'unüblich; die Kassen liegen meist zwischen 1 % und 3 %. Lohnt einen '
      + 'zweiten Blick in die Satzung.')
  }
  if (imKatalog && u1Satz != null) {
    hinweise.push(
      `Für ${kasse} liegen Sätze im Katalog. Ihr eigener Eintrag gilt trotzdem `
      + 'und schlägt den Katalog — wenn das nicht gewollt ist, das Feld leer '
      + 'lassen und nur die Stufe wählen.')
  }

  return NextResponse.json({ satz, hinweise })
}

export async function DELETE(req: NextRequest) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const vorhanden = await prisma.krankenkassensatz.findFirst({
    where: { id, customerId },
  })
  if (!vorhanden) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  await prisma.krankenkassensatz.delete({ where: { id } })
  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'delete', entityType: 'Krankenkassensatz', entityId: id,
    customerId, details: { kasse: vorhanden.kasse },
  })
  return NextResponse.json({
    ok: true,
    hinweis: 'Gelöscht. Ohne hinterlegte Wahl wird für diese Kasse keine '
      + 'Umlage mehr gerechnet — der Lohnlauf sagt es dann bei jedem Durchgang.',
  })
}
