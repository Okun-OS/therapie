import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { ARTEN, tabelleFuer, type Pfaendungsart } from '@/lib/pfaendung'

export const dynamic = 'force-dynamic'

/**
 * §155 Lohnpfändungen verwalten.
 *
 * WER HIER HEREINKOMMT — UND WER NICHT
 * Nur die Unternehmensebene. Die Standortleitung NICHT, obwohl sie sonst die
 * Entgeltabrechnung ihres Standorts sieht.
 *
 * Der Grund: Eine Pfändung sagt etwas über die wirtschaftliche Lage eines
 * Menschen, das mit seiner Arbeit nichts zu tun hat. In einer Einrichtung mit
 * zwölf Leuten weiß die Leitung sonst, wer Schulden hat — und das ändert den
 * Blick auf jemanden, ob man will oder nicht. Der Kreis der Mitwissenden
 * gehört so klein wie möglich gehalten; das ist dieselbe Überlegung wie beim
 * Eingliederungsmanagement (§147).
 *
 * WAS HIER NICHT ENTSCHIEDEN WIRD
 * Ob die Pfändung wirksam ist, ob der Betrag richtig tituliert wurde, ob eine
 * Abtretung vorgeht. Das steht im Beschluss. Das Programm rechnet aus, was
 * davon einbehalten werden darf — den Beschluss liest ein Mensch.
 */

const FELDER = {
  id: true, employeeId: true, art: true, glaeubiger: true,
  aktenzeichen: true, zugestelltAm: true, forderung: true, getilgt: true,
  notwendigerUnterhalt: true, unterhaltspflichten: true, aktiv: true,
  erledigtAm: true, notiz: true, createdAt: true,
} as const

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ pfaendungen: [] })

  const employeeId = req.nextUrl.searchParams.get('employeeId')
  const pfaendungen = await prisma.pfaendung.findMany({
    where: { customerId, ...(employeeId ? { employeeId } : {}) },
    orderBy: [{ aktiv: 'desc' }, { zugestelltAm: 'asc' }],
    select: FELDER,
  })

  const namen = new Map<string, string>()
  if (pfaendungen.length > 0) {
    const leute = await prisma.employee.findMany({
      where: { id: { in: Array.from(new Set(pfaendungen.map(p => p.employeeId))) } },
      select: { id: true, name: true },
    })
    for (const l of leute) namen.set(l.id, l.name)
  }

  // Die Abzüge der letzten zwölf Monate — daraus sieht man, ob etwas läuft.
  const abzuege = await prisma.pfaendungsAbzug.findMany({
    where: { customerId, ...(employeeId ? { employeeId } : {}) },
    orderBy: [{ jahr: 'desc' }, { monat: 'desc' }],
    take: 200,
    select: {
      pfaendungId: true, jahr: true, monat: true, betrag: true, hinweis: true,
    },
  })
  const jePfaendung = new Map<string, typeof abzuege>()
  for (const a of abzuege) {
    const liste = jePfaendung.get(a.pfaendungId) ?? []
    liste.push(a)
    jePfaendung.set(a.pfaendungId, liste)
  }

  return NextResponse.json({
    pfaendungen: pfaendungen.map(p => ({
      ...p,
      personName: namen.get(p.employeeId) ?? null,
      abzuege: jePfaendung.get(p.id) ?? [],
    })),
    arten: ARTEN,
    // Damit die Oberfläche warnen kann, bevor jemand eine Abrechnung startet.
    tabelleVorhanden: !!tabelleFuer(new Date()),
  })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const employeeId = String(body.employeeId ?? '')
  const glaeubiger = String(body.glaeubiger ?? '').trim()
  const zugestelltAm = String(body.zugestelltAm ?? '').slice(0, 10)
  const art = (String(body.art ?? 'normal') in ARTEN
    ? String(body.art) : 'normal') as Pfaendungsart

  if (!employeeId) {
    return NextResponse.json({ error: 'Für wen?' }, { status: 400 })
  }
  if (!glaeubiger) {
    return NextResponse.json(
      { error: 'Wer ist der Gläubiger? Ohne ihn ist der Abzug auf dem Beleg '
        + 'nicht erklärbar.' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(zugestelltAm)) {
    return NextResponse.json(
      {
        error: 'Der Tag der Zustellung fehlt. Aus ihm folgt der Rang gegenüber '
          + 'anderen Pfändungen (§804 Abs. 3 ZPO) — nicht aus dem Tag, an dem '
          + 'hier jemand etwas einträgt.',
      },
      { status: 400 },
    )
  }

  const person = await prisma.employee.findFirst({
    where: { id: employeeId, customerId }, select: { id: true },
  })
  if (!person) {
    return NextResponse.json({ error: 'Person nicht gefunden' }, { status: 404 })
  }

  const notwendigerUnterhalt = body.notwendigerUnterhalt != null
    && body.notwendigerUnterhalt !== ''
    ? Number(body.notwendigerUnterhalt) : null

  if (art === 'unterhalt' && !notwendigerUnterhalt) {
    return NextResponse.json(
      {
        error: 'Bei einer Unterhaltspfändung muss der notwendige Unterhalt aus '
          + 'dem Beschluss eingetragen werden (§850d Abs. 1 Satz 2 ZPO). Das '
          + 'Gericht setzt ihn fest — das Programm darf ihn nicht raten, und '
          + 'ohne ihn wird nichts einbehalten.',
      },
      { status: 400 },
    )
  }

  const pfaendung = await prisma.pfaendung.create({
    data: {
      employeeId, customerId, art, glaeubiger,
      aktenzeichen: String(body.aktenzeichen ?? '').trim() || null,
      zugestelltAm,
      forderung: body.forderung != null && body.forderung !== ''
        ? Number(body.forderung) : null,
      notwendigerUnterhalt,
      unterhaltspflichten: body.unterhaltspflichten != null
        && body.unterhaltspflichten !== ''
        ? Math.max(0, Math.floor(Number(body.unterhaltspflichten))) : null,
      notiz: String(body.notiz ?? '').slice(0, 2000).trim() || null,
      angelegtVon: session.name ?? session.email,
    },
    select: FELDER,
  })

  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'create', entityType: 'Pfaendung', entityId: pfaendung.id,
    customerId, details: { art, glaeubiger },
  })

  return NextResponse.json({ pfaendung })
}

/**
 * Ändern — mit einer festen Grenze.
 *
 * Der Tag der Zustellung lässt sich nicht ändern, sobald etwas einbehalten
 * wurde. Er bestimmt den Rang; ihn nachträglich zu verschieben hieße, die
 * Reihenfolge zwischen mehreren Gläubigern rückwirkend umzuschreiben — und
 * die schon abgeführten Beträge wären dann falsch zugeordnet.
 */
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

  const vorhanden = await prisma.pfaendung.findFirst({ where: { id, customerId } })
  if (!vorhanden) {
    return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  }

  const abzuege = await prisma.pfaendungsAbzug.count({ where: { pfaendungId: id } })

  if (body.zugestelltAm !== undefined
      && String(body.zugestelltAm).slice(0, 10) !== vorhanden.zugestelltAm
      && abzuege > 0) {
    return NextResponse.json(
      {
        error: 'Der Tag der Zustellung lässt sich nicht mehr ändern — es wurde '
          + 'bereits etwas einbehalten. Aus ihm folgt der Rang gegenüber '
          + 'anderen Gläubigern; ihn zu verschieben würde die schon '
          + 'abgeführten Beträge rückwirkend falsch zuordnen.',
      },
      { status: 409 },
    )
  }

  const daten: Record<string, unknown> = {}
  if (body.glaeubiger !== undefined) {
    const g = String(body.glaeubiger).trim()
    if (!g) return NextResponse.json({ error: 'Gläubiger fehlt.' }, { status: 400 })
    daten.glaeubiger = g
  }
  if (body.aktenzeichen !== undefined) {
    daten.aktenzeichen = String(body.aktenzeichen ?? '').trim() || null
  }
  if (body.zugestelltAm !== undefined && abzuege === 0) {
    daten.zugestelltAm = String(body.zugestelltAm).slice(0, 10)
  }
  if (body.forderung !== undefined) {
    daten.forderung = body.forderung === '' || body.forderung == null
      ? null : Number(body.forderung)
  }
  if (body.notwendigerUnterhalt !== undefined) {
    daten.notwendigerUnterhalt =
      body.notwendigerUnterhalt === '' || body.notwendigerUnterhalt == null
        ? null : Number(body.notwendigerUnterhalt)
  }
  if (body.unterhaltspflichten !== undefined) {
    daten.unterhaltspflichten =
      body.unterhaltspflichten === '' || body.unterhaltspflichten == null
        ? null : Math.max(0, Math.floor(Number(body.unterhaltspflichten)))
  }
  if (body.notiz !== undefined) {
    daten.notiz = String(body.notiz ?? '').slice(0, 2000).trim() || null
  }
  if (body.aktiv !== undefined) {
    daten.aktiv = body.aktiv === true
    daten.erledigtAm = body.aktiv === true ? null : new Date()
  }

  const pfaendung = await prisma.pfaendung.update({
    where: { id }, data: daten, select: FELDER,
  })

  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'update', entityType: 'Pfaendung', entityId: id,
    customerId, details: { felder: Object.keys(daten) },
  })

  return NextResponse.json({ pfaendung })
}

/**
 * Löschen — nur, solange nichts einbehalten wurde.
 *
 * Danach wird sie beendet, nicht gelöscht: An ihr hängen die Abzüge, und die
 * sind der Nachweis gegenüber dem Gläubiger (§840 ZPO) und gegenüber dem
 * Beschäftigten. Sie wegzuwerfen hieße, eine Zahlung ohne Beleg dastehen zu
 * lassen.
 */
export async function DELETE(req: NextRequest) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const vorhanden = await prisma.pfaendung.findFirst({ where: { id, customerId } })
  if (!vorhanden) {
    return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  }

  const abzuege = await prisma.pfaendungsAbzug.count({ where: { pfaendungId: id } })
  if (abzuege > 0) {
    return NextResponse.json(
      {
        error: `An dieser Pfändung hängen ${abzuege} Abzüge. Sie wird beendet, `
          + 'nicht gelöscht — die Abzüge sind der Nachweis gegenüber dem '
          + 'Gläubiger (§840 ZPO) und gegenüber dem Beschäftigten.',
      },
      { status: 409 },
    )
  }

  await prisma.pfaendung.delete({ where: { id } })
  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'delete', entityType: 'Pfaendung', entityId: id,
    customerId, details: { glaeubiger: vorhanden.glaeubiger },
  })
  return NextResponse.json({ ok: true })
}
