import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'
import { logAudit } from '@/lib/audit'
import {
  antragsfrist, tageBisFrist, fristAbgelaufen, schwelleErreicht,
  LEISTUNGSSATZ_MIT_KIND, LEISTUNGSSATZ_OHNE_KIND,
} from '@/lib/kurzarbeit'
import { abrechnungsliste } from '@/lib/kurzarbeit-lauf'

export const dynamic = 'force-dynamic'

/**
 * §157 Kurzarbeit: die Anzeige, die Monatswerte und die Abrechnungsliste.
 *
 * WER HIER HEREINKOMMT
 * Anlegen und ändern darf die Unternehmensebene. Kurzarbeit ist eine
 * Entscheidung des Betriebs, keine der Standortleitung — und sie hängt an
 * einer Anzeige bei der Agentur, die jemand namentlich verantwortet.
 *
 * Die Standortleitung liest mit: Sie muss wissen, wer in ihrem Haus in
 * Kurzarbeit ist, sonst kann sie nicht planen. Der Beschäftigte sieht seine
 * eigenen Zahlen; sie stehen ohnehin auf seiner Abrechnung.
 *
 * WARUM DIE FRIST MITGELIEFERT WIRD
 * Weil sie eine Ausschlussfrist ist. §109 Abs. 1 SGB III: drei Monate nach
 * Ablauf des Kalendermonats. Danach ist das Geld weg — nicht gestundet,
 * sondern weg. Eine Oberfläche, die das erst nach Ablauf zeigt, ist wertlos.
 */

const ANZEIGE_FELDER = {
  id: true, customerId: true, locationId: true, bezeichnung: true,
  grund: true, angezeigtAm: true, aktenzeichen: true, von: true, bis: true,
  aktiv: true, notiz: true, createdAt: true,
} as const

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ anzeigen: [], monate: [] })

  const p = req.nextUrl.searchParams
  const jahr = Number(p.get('jahr') ?? new Date().getFullYear())
  const monat = Number(p.get('monat') ?? new Date().getMonth() + 1)

  // Die Abrechnungsliste ist die Anlage zum Leistungsantrag. Sie steht der
  // Unternehmensebene zu — sie stellt den Antrag.
  if (p.get('liste') === '1') {
    if (session.role !== 'company' && session.role !== 'okun') {
      return NextResponse.json(
        { error: 'Die Abrechnungsliste stellt die Unternehmensebene.' },
        { status: 403 })
    }
    const liste = await abrechnungsliste(
      customerId, jahr, monat, p.get('kurzarbeitId') ?? undefined)
    return NextResponse.json({
      ...liste,
      jahr, monat,
      frist: antragsfrist(jahr, monat),
      tageBisFrist: tageBisFrist(jahr, monat),
      fristAbgelaufen: fristAbgelaufen(jahr, monat),
      // §96 Abs. 1 Nr. 4 SGB III — gerechnet über die Personen dieser Liste.
      schwelle: schwelleErreicht(liste.zeilen.map(z => z.ausfallProzent)),
    })
  }

  const anzeigen = await prisma.kurzarbeit.findMany({
    where: { customerId }, orderBy: [{ aktiv: 'desc' }, { von: 'desc' }],
    select: ANZEIGE_FELDER,
  })

  let wo: Record<string, unknown> = { customerId, jahr, monat }
  if (session.role === 'employee') {
    if (!session.employeeId) return NextResponse.json({ anzeigen: [], monate: [] })
    wo = { ...wo, employeeId: session.employeeId }
  } else if (session.role === 'admin') {
    const leute = await prisma.employee.findMany({
      where: { customerId, locationId: session.locationId ?? undefined },
      select: { id: true },
    })
    wo = { ...wo, employeeId: { in: leute.map(l => l.id) } }
  }

  const monate = await prisma.kurzarbeitMonat.findMany({ where: wo })
  const namen = new Map<string, string>()
  if (monate.length > 0 && session.role !== 'employee') {
    const leute = await prisma.employee.findMany({
      where: { id: { in: Array.from(new Set(monate.map(m => m.employeeId))) } },
      select: { id: true, name: true },
    })
    for (const l of leute) namen.set(l.id, l.name)
  }

  return NextResponse.json({
    anzeigen,
    monate: monate.map(m => ({ ...m, personName: namen.get(m.employeeId) ?? null })),
    jahr, monat,
    frist: antragsfrist(jahr, monat),
    tageBisFrist: tageBisFrist(jahr, monat),
    fristAbgelaufen: fristAbgelaufen(jahr, monat),
    leistungssaetze: {
      mitKind: LEISTUNGSSATZ_MIT_KIND, ohneKind: LEISTUNGSSATZ_OHNE_KIND,
    },
  })
}

/**
 * Eine Anzeige anlegen — oder einen Monatswert dazu.
 *
 * Beides über denselben Weg, unterschieden durch `was`. Ein Monatswert ohne
 * Anzeige wird abgelehnt: Ohne Anzeige gibt es keinen Anspruch (§99 SGB III),
 * und eine Zeile, die niemand beantragen kann, hilft niemandem.
 */
export async function POST(req: NextRequest) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))

  if (body.was === 'monat') return monatAnlegen(session, customerId, body)

  const bezeichnung = String(body.bezeichnung ?? '').trim()
  const angezeigtAm = String(body.angezeigtAm ?? '').slice(0, 10)
  const von = String(body.von ?? '').slice(0, 10)

  if (!bezeichnung) {
    return NextResponse.json(
      { error: 'Wie heißt der Betriebsteil, der kurzarbeitet?' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(angezeigtAm)) {
    return NextResponse.json(
      {
        error: 'Wann ist die Anzeige bei der Agentur eingegangen? Aus diesem '
          + 'Datum folgt, ab welchem Monat es überhaupt Geld gibt '
          + '(§99 Abs. 2 SGB III).',
      },
      { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(von)) {
    return NextResponse.json({ error: 'Ab wann wird kurzgearbeitet?' }, { status: 400 })
  }

  const anzeige = await prisma.kurzarbeit.create({
    data: {
      customerId,
      locationId: String(body.locationId ?? '').trim() || null,
      bezeichnung,
      grund: body.grund === 'unabwendbar' ? 'unabwendbar' : 'wirtschaftlich',
      angezeigtAm,
      aktenzeichen: String(body.aktenzeichen ?? '').trim() || null,
      von,
      bis: String(body.bis ?? '').slice(0, 10) || null,
      notiz: String(body.notiz ?? '').slice(0, 2000).trim() || null,
      angelegtVon: session.email,
    },
    select: ANZEIGE_FELDER,
  })

  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'create', entityType: 'Kurzarbeit', entityId: anzeige.id,
    customerId, details: { bezeichnung, angezeigtAm, von },
  })

  const hinweise = [
    'Der Leistungsantrag muss innerhalb von drei Monaten nach Ablauf des '
    + 'jeweiligen Abrechnungsmonats gestellt sein (§109 Abs. 1 SGB III). Das '
    + 'ist eine Ausschlussfrist — danach ist der Anspruch erloschen.',
  ]
  if (!anzeige.aktenzeichen) {
    hinweise.push(
      'Das Kug-Aktenzeichen der Agentur fehlt noch. Ohne es lässt sich später '
      + 'kein Antrag zuordnen — es gehört nachgetragen, sobald es da ist.',
    )
  }

  return NextResponse.json({ anzeige, hinweise })
}

async function monatAnlegen(
  session: { userId: string; email: string; role: string },
  customerId: string,
  body: Record<string, unknown>,
) {
  const kurzarbeitId = String(body.kurzarbeitId ?? '')
  const employeeId = String(body.employeeId ?? '')
  const jahr = Number(body.jahr ?? 0)
  const monat = Number(body.monat ?? 0)
  const sollEntgelt = Number(body.sollEntgelt ?? 0)
  const istEntgelt = Number(body.istEntgelt ?? 0)

  if (!employeeId) return NextResponse.json({ error: 'Für wen?' }, { status: 400 })
  if (!(jahr >= 2000 && monat >= 1 && monat <= 12)) {
    return NextResponse.json({ error: 'Jahr oder Monat fehlen.' }, { status: 400 })
  }
  if (!(sollEntgelt > 0)) {
    return NextResponse.json(
      {
        error: 'Das Sollentgelt fehlt. Es ist das Entgelt OHNE den '
          + 'Arbeitsausfall und ohne Mehrarbeit (§106 Abs. 1 SGB III) — es '
          + 'lässt sich aus der Zeiterfassung nicht ableiten, weil die gerade '
          + 'den Ausfall zeigt.',
      },
      { status: 400 })
  }

  const anzeige = await prisma.kurzarbeit.findFirst({
    where: { id: kurzarbeitId, customerId },
  })
  if (!anzeige) {
    return NextResponse.json(
      {
        error: 'Zu diesem Monat gehört keine Anzeige über Arbeitsausfall. '
          + 'Ohne sie besteht kein Anspruch (§99 SGB III).',
      },
      { status: 400 })
  }

  const verweigert = await assertEmployeeAccess(
    session as Parameters<typeof assertEmployeeAccess>[0], employeeId)
  if (verweigert) return verweigert

  const daten = {
    kurzarbeitId, employeeId, customerId, jahr, monat,
    sollStunden: Math.max(0, Number(body.sollStunden ?? 0)),
    istStunden: Math.max(0, Number(body.istStunden ?? 0)),
    sollEntgelt,
    istEntgelt: Math.max(0, istEntgelt),
    kugAusTabelle: body.kugAusTabelle != null && body.kugAusTabelle !== ''
      ? Math.max(0, Number(body.kugAusTabelle)) : null,
  }

  const eintrag = await prisma.kurzarbeitMonat.upsert({
    where: { employeeId_jahr_monat: { employeeId, jahr, monat } },
    create: daten,
    update: daten,
  })

  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'update', entityType: 'KurzarbeitMonat', entityId: eintrag.id,
    customerId, details: { jahr, monat, sollEntgelt, istEntgelt },
  })

  const hinweise: string[] = []
  if (fristAbgelaufen(jahr, monat)) {
    hinweise.push(
      `Die Ausschlussfrist für ${monat}/${jahr} ist am `
      + `${antragsfrist(jahr, monat)} abgelaufen (§109 Abs. 1 SGB III). Der `
      + 'Eintrag wird gespeichert, aber die Agentur erstattet voraussichtlich '
      + 'nicht mehr.')
  } else {
    const tage = tageBisFrist(jahr, monat)
    if (tage <= 30) {
      hinweise.push(
        `Noch ${tage} Tage bis zur Ausschlussfrist am `
        + `${antragsfrist(jahr, monat)} (§109 Abs. 1 SGB III).`)
    }
  }
  if (istEntgelt >= sollEntgelt) {
    hinweise.push(
      'Das Istentgelt liegt nicht unter dem Sollentgelt — es entsteht kein '
      + 'Kurzarbeitergeld. Falls Mehrarbeit angefallen ist: Sie gehört ins '
      + 'Istentgelt, nicht ins Sollentgelt.')
  }
  hinweise.push(
    'Gerechnet wird beim nächsten Lohnlauf. Erst dann stehen die Zahlen fest '
    + 'und erst dann stimmen Beleg und Abrechnungsliste überein.')

  return NextResponse.json({ monat: eintrag, hinweise })
}

export async function PATCH(req: NextRequest) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const vorhanden = await prisma.kurzarbeit.findFirst({ where: { id, customerId } })
  if (!vorhanden) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const daten: Record<string, unknown> = {}
  if (body.bezeichnung !== undefined) {
    const b = String(body.bezeichnung).trim()
    if (!b) return NextResponse.json({ error: 'Bezeichnung fehlt.' }, { status: 400 })
    daten.bezeichnung = b
  }
  if (body.aktenzeichen !== undefined) {
    daten.aktenzeichen = String(body.aktenzeichen ?? '').trim() || null
  }
  if (body.angezeigtAm !== undefined) {
    const d = String(body.angezeigtAm).slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      return NextResponse.json({ error: 'Datum der Anzeige fehlt.' }, { status: 400 })
    }
    daten.angezeigtAm = d
  }
  if (body.bis !== undefined) daten.bis = String(body.bis ?? '').slice(0, 10) || null
  if (body.grund !== undefined) {
    daten.grund = body.grund === 'unabwendbar' ? 'unabwendbar' : 'wirtschaftlich'
  }
  if (body.notiz !== undefined) {
    daten.notiz = String(body.notiz ?? '').slice(0, 2000).trim() || null
  }
  if (body.aktiv !== undefined) daten.aktiv = body.aktiv === true

  const anzeige = await prisma.kurzarbeit.update({
    where: { id }, data: daten, select: ANZEIGE_FELDER,
  })
  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'update', entityType: 'Kurzarbeit', entityId: id,
    customerId, details: { felder: Object.keys(daten) },
  })
  return NextResponse.json({ anzeige })
}

/**
 * Löschen — nur, solange nichts abgerechnet wurde.
 *
 * Danach wird die Anzeige beendet. An ihr hängen Monate, die bei der Agentur
 * beantragt sind; eine Abrechnungsliste ohne die zugehörige Anzeige ließe sich
 * bei der nächsten Prüfung nicht erklären.
 */
export async function DELETE(req: NextRequest) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }

  const monatId = req.nextUrl.searchParams.get('monatId')
  if (monatId) {
    const m = await prisma.kurzarbeitMonat.findFirst({
      where: { id: monatId, customerId },
    })
    if (!m) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    if (m.kug > 0) {
      return NextResponse.json(
        {
          error: `Für ${m.monat}/${m.jahr} wurden bereits `
            + `${m.kug.toFixed(2)} € Kurzarbeitergeld abgerechnet. Die Zeile `
            + 'wird korrigiert, nicht gelöscht — sonst weist ein Beleg eine '
            + 'Leistung aus, die in keiner Abrechnungsliste steht.',
        },
        { status: 409 })
    }
    await prisma.kurzarbeitMonat.delete({ where: { id: monatId } })
    await logAudit({
      userId: session.userId, userEmail: session.email, userRole: session.role,
      action: 'delete', entityType: 'KurzarbeitMonat', entityId: monatId,
      customerId, details: { jahr: m.jahr, monat: m.monat },
    })
    return NextResponse.json({ ok: true })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const vorhanden = await prisma.kurzarbeit.findFirst({ where: { id, customerId } })
  if (!vorhanden) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const abgerechnet = await prisma.kurzarbeitMonat.count({
    where: { kurzarbeitId: id, kug: { gt: 0 } },
  })
  if (abgerechnet > 0) {
    return NextResponse.json(
      {
        error: `Zu dieser Anzeige sind bereits ${abgerechnet} Monate `
          + 'abgerechnet. Sie wird beendet, nicht gelöscht — sonst stehen '
          + 'Abrechnungen da, zu denen es keine Anzeige mehr gibt.',
      },
      { status: 409 })
  }

  await prisma.kurzarbeitMonat.deleteMany({ where: { kurzarbeitId: id } })
  await prisma.kurzarbeit.delete({ where: { id } })
  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'delete', entityType: 'Kurzarbeit', entityId: id,
    customerId, details: { bezeichnung: vorhanden.bezeichnung },
  })
  return NextResponse.json({ ok: true })
}
