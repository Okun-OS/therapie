import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { allowedLocationScope } from '@/lib/scope'
import { logAudit } from '@/lib/audit'
import {
  dateiSpeichern, pruefeDatei, sichererDateiname,
} from '@/lib/file-storage'
import {
  STANDARDTEXT, STAENDE, WIEDERHOLUNGEN, pruefsumme, stand, fehltZumVerteilen,
} from '@/lib/belehrung'

export const dynamic = 'force-dynamic'

/**
 * §150 Belehrungen — die Liste und das Anlegen.
 *
 * ZWEI SICHTEN
 *   Rolle employee   nur das, was an sie verteilt wurde (siehe unten)
 *   Leitung/Betrieb  die Runden mit dem Stand: wer fehlt noch
 *
 * WARUM DER BETRIEB HIER KEINE STANDORTGRENZE SIEHT
 * Eine Belehrung gilt für das Haus. Sie je Standort zu führen hieße, dieselben
 * vier Seiten fünfmal hochzuladen — genau das, was hier abgeschafft werden
 * soll. Die Leitung sieht deshalb alle Runden ihres Betriebs, aber in der
 * Namensliste nur ihre eigenen Leute.
 */

const FELDER = {
  id: true, customerId: true, titel: true, beschreibung: true,
  dateiId: true, dateiname: true, pruefsumme: true, bestaetigungstext: true,
  status: true, fristBis: true, wiederholung: true, vorlageVon: true,
  oeffnenNoetig: true, verteiltAm: true, geschlossenAm: true,
  erstelltVonName: true, createdAt: true,
} as const

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ belehrungen: [] })

  // Der Mitarbeiter sieht seine eigene Liste — und nur die.
  if (session.role === 'employee') {
    if (!session.employeeId) return NextResponse.json({ belehrungen: [] })
    const belege = await prisma.belehrungBestaetigung.findMany({
      where: { employeeId: session.employeeId },
      orderBy: { zugestelltAm: 'desc' },
    })
    if (belege.length === 0) return NextResponse.json({ belehrungen: [] })
    const runden = await prisma.belehrung.findMany({
      where: { id: { in: belege.map(b => b.belehrungId) }, status: { not: 'entwurf' } },
      select: FELDER,
    })
    const jeId = new Map(runden.map(r => [r.id, r]))
    return NextResponse.json({
      belehrungen: belege
        .filter(b => jeId.has(b.belehrungId))
        .map(b => {
          const r = jeId.get(b.belehrungId)!
          return {
            id: r.id, titel: r.titel, beschreibung: r.beschreibung,
            dateiname: r.dateiname, bestaetigungstext: r.bestaetigungstext,
            status: r.status, fristBis: r.fristBis,
            oeffnenNoetig: r.oeffnenNoetig, verteiltAm: r.verteiltAm,
            belegId: b.id,
            angesehenAm: b.angesehenAm, bestaetigtAm: b.bestaetigtAm,
          }
        }),
      offen: belege.filter(b => !b.bestaetigtAm && jeId.get(b.belehrungId)?.status === 'verteilt').length,
    })
  }

  const session2 = requireRole(req, ['admin', 'company', 'okun'])
  if (session2 instanceof NextResponse) return session2

  const runden = await prisma.belehrung.findMany({
    where: { customerId },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    select: FELDER,
  })
  if (runden.length === 0) {
    return NextResponse.json({
      belehrungen: [], staende: STAENDE, wiederholungen: WIEDERHOLUNGEN,
      standardtext: STANDARDTEXT,
    })
  }

  // Die Zahlen nur über die Leute, die diese Leitung sehen darf — sonst
  // verriete ein „12 von 40" die Größe des ganzen Trägers.
  const scope = await allowedLocationScope(session2)
  const belege = await prisma.belehrungBestaetigung.findMany({
    where: {
      belehrungId: { in: runden.map(r => r.id) },
      ...(scope.kind === 'all' ? {} : { locationId: { in: scope.ids } }),
    },
    select: {
      belehrungId: true, personName: true, bestaetigtAm: true, angesehenAm: true,
    },
  })
  const jeRunde = new Map<string, typeof belege>()
  for (const b of belege) {
    const liste = jeRunde.get(b.belehrungId) ?? []
    liste.push(b)
    jeRunde.set(b.belehrungId, liste)
  }

  return NextResponse.json({
    belehrungen: runden.map(r => ({
      ...r,
      stand: stand(jeRunde.get(r.id) ?? []),
    })),
    staende: STAENDE,
    wiederholungen: WIEDERHOLUNGEN,
    standardtext: STANDARDTEXT,
  })
}

/**
 * Eine Belehrung anlegen — mit dem Dokument in einem Zug.
 *
 * Bewusst zusammen: Ein Entwurf ohne Dokument ist ein leeres Blatt, und ein
 * zweiter Schritt dafür wäre die Stelle, an der es liegen bliebe. Der
 * Fingerabdruck entsteht dabei sofort — er gehört zur Datei und nicht zum
 * Verteilen.
 */
export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }

  let felder: Record<string, string> = {}
  let anhang: { name: string; typ: string; daten: Buffer } | null = null

  if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
    const form = await req.formData().catch(() => null)
    if (!form) {
      return NextResponse.json({ error: 'Der Upload kam nicht an.' }, { status: 400 })
    }
    form.forEach((v, k) => { if (typeof v === 'string') felder[k] = v })
    const datei = form.get('datei')
    if (datei instanceof File && datei.size > 0) {
      const puffer = Buffer.from(await datei.arrayBuffer())
      const geprueft = pruefeDatei(datei.name, datei.type, puffer.length)
      if (!geprueft.ok) {
        return NextResponse.json({ error: geprueft.fehler }, { status: 400 })
      }
      anhang = { name: datei.name, typ: datei.type, daten: puffer }
    }
  } else {
    felder = (await req.json().catch(() => ({}))) as Record<string, string>
  }

  const titel = String(felder.titel ?? '').trim()
  if (!titel) {
    return NextResponse.json({ error: 'Ein Titel fehlt.' }, { status: 400 })
  }

  let dateiId: string | null = null
  let dateiname: string | null = null
  let summe: string | null = null
  if (anhang) {
    const gespeichert = await dateiSpeichern({
      customerId,
      ownerType: 'belehrung' as never,
      // Die Datei gehört der Runde, nicht einem Menschen — anders als eine
      // Bescheinigung, die in eine Personalakte gehört.
      ownerId: 'neu',
      kategorie: 'bescheinigung',
      dateiname: sichererDateiname(anhang.name),
      mimeType: anhang.typ,
      daten: anhang.daten,
      hochgeladenVon: session.userId,
      hochgeladenVonName: session.name ?? session.email,
      notiz: `Belehrung: ${titel}`,
      sichtbarFuerMitarbeiter: false,
    })
    dateiId = gespeichert.id
    dateiname = gespeichert.dateiname
    summe = pruefsumme(anhang.daten)
  }

  const belehrung = await prisma.belehrung.create({
    data: {
      customerId, titel,
      beschreibung: String(felder.beschreibung ?? '').slice(0, 5000).trim() || null,
      dateiId, dateiname, pruefsumme: summe,
      bestaetigungstext:
        String(felder.bestaetigungstext ?? '').slice(0, 2000).trim() || STANDARDTEXT,
      fristBis: felder.fristBis ? new Date(String(felder.fristBis)) : null,
      wiederholung: felder.wiederholung in WIEDERHOLUNGEN
        ? String(felder.wiederholung) : null,
      oeffnenNoetig: String(felder.oeffnenNoetig ?? 'true') !== 'false',
      vorlageVon: felder.vorlageVon ? String(felder.vorlageVon) : null,
      erstelltVon: session.userId,
      erstelltVonName: session.name ?? session.email,
    },
    select: FELDER,
  })

  // Die Datei der Runde zuordnen — vorher gab es die Kennung noch nicht.
  if (dateiId) {
    await prisma.storedFile.update({
      where: { id: dateiId }, data: { ownerId: belehrung.id },
    })
  }

  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'create', entityType: 'Belehrung', entityId: belehrung.id,
    customerId, details: { titel },
  })

  return NextResponse.json({
    belehrung, fehlt: fehltZumVerteilen(belehrung),
  })
}
