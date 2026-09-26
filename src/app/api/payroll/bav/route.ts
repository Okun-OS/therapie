import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'
import { logAudit } from '@/lib/audit'
import {
  WEGE, grenzen, anspruchJahr, PFLICHTZUSCHUSS, type Durchfuehrungsweg,
} from '@/lib/bav'
import { lohnjahr } from '@/lib/lohnjahre'

export const dynamic = 'force-dynamic'

/**
 * §156 Verträge zur betrieblichen Altersvorsorge.
 *
 * WER HIER HEREINKOMMT
 * Die Unternehmensebene verwaltet, die Standortleitung sieht mit. Anders als
 * bei einer Pfändung (§155) ist eine Entgeltumwandlung nichts Belastendes —
 * sie ist ein Anspruch (§1a BetrAVG) und für die Personalplanung sichtbar,
 * weil sie das Bruttoentgelt verändert.
 *
 * Der Beschäftigte sieht seinen eigenen Vertrag. Er hat ihn schließlich
 * geschlossen, und der Beitrag steht ohnehin auf seiner Abrechnung.
 *
 * WARUM DIE GRENZEN MITGELIEFERT WERDEN
 * Damit die Oberfläche beim Eintragen sagen kann, was passiert: ob der Betrag
 * noch ganz frei ist, ob er in den Bereich zwischen 4 % und 8 % rutscht, oder
 * ob er darüber hinausgeht. Wer erst auf der Abrechnung sieht, dass Beiträge
 * fällig werden, hat den Vertrag schon unterschrieben.
 */

const FELDER = {
  id: true, employeeId: true, weg: true, anbieter: true,
  vertragsnummer: true, monatsbetrag: true, zuschussSatz: true,
  zuschussAufGesamt: true, beginn: true, ende: true, aktiv: true,
  notiz: true, createdAt: true,
} as const

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ vertraege: [] })

  const gefragt = req.nextUrl.searchParams.get('employeeId')

  let wo: Record<string, unknown>
  if (session.role === 'employee') {
    if (!session.employeeId) return NextResponse.json({ vertraege: [] })
    wo = { customerId, employeeId: session.employeeId }
  } else if (gefragt) {
    const verweigert = await assertEmployeeAccess(session, gefragt)
    if (verweigert) return verweigert
    wo = { customerId, employeeId: gefragt }
  } else if (session.role === 'admin') {
    // Die Leitung sieht ihren Standort — dieselbe Grenze wie überall.
    const leute = await prisma.employee.findMany({
      where: { customerId, locationId: session.locationId ?? undefined },
      select: { id: true },
    })
    wo = { customerId, employeeId: { in: leute.map(l => l.id) } }
  } else {
    wo = { customerId }
  }

  const vertraege = await prisma.bavVertrag.findMany({
    where: wo, orderBy: [{ aktiv: 'desc' }, { beginn: 'asc' }], select: FELDER,
  })

  const namen = new Map<string, string>()
  if (vertraege.length > 0 && session.role !== 'employee') {
    const leute = await prisma.employee.findMany({
      where: { id: { in: Array.from(new Set(vertraege.map(v => v.employeeId))) } },
      select: { id: true, name: true },
    })
    for (const l of leute) namen.set(l.id, l.name)
  }

  const j = lohnjahr(new Date().getFullYear())
  return NextResponse.json({
    vertraege: vertraege.map(v => ({
      ...v, personName: namen.get(v.employeeId) ?? null,
    })),
    wege: WEGE,
    pflichtzuschuss: PFLICHTZUSCHUSS,
    // Ohne Lohnjahr keine Grenzen — dann sagt die Oberfläche das, statt
    // falsche Zahlen anzuzeigen.
    grenzen: j ? grenzen(j) : null,
    anspruchJahr: j ? anspruchJahr(j) : null,
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
  const anbieter = String(body.anbieter ?? '').trim()
  const monatsbetrag = Number(body.monatsbetrag ?? 0)
  const beginn = String(body.beginn ?? '').slice(0, 10)
  const weg = (String(body.weg ?? 'direktversicherung') in WEGE
    ? String(body.weg) : 'direktversicherung') as Durchfuehrungsweg

  if (!employeeId) return NextResponse.json({ error: 'Für wen?' }, { status: 400 })
  if (!anbieter) {
    return NextResponse.json(
      { error: 'Wer ist der Anbieter? Er steht später auf der Abrechnung.' },
      { status: 400 })
  }
  if (!(monatsbetrag > 0)) {
    return NextResponse.json(
      { error: 'Der Monatsbetrag fehlt oder ist null.' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(beginn)) {
    return NextResponse.json({ error: 'Der Beginn fehlt.' }, { status: 400 })
  }

  const verweigert = await assertEmployeeAccess(session, employeeId)
  if (verweigert) return verweigert

  const satz = body.zuschussSatz != null && body.zuschussSatz !== ''
    ? Math.max(0, Number(body.zuschussSatz)) : PFLICHTZUSCHUSS

  const vertrag = await prisma.bavVertrag.create({
    data: {
      employeeId, customerId, weg, anbieter,
      vertragsnummer: String(body.vertragsnummer ?? '').trim() || null,
      monatsbetrag,
      zuschussSatz: satz,
      zuschussAufGesamt: body.zuschussAufGesamt === true,
      beginn,
      ende: String(body.ende ?? '').slice(0, 10) || null,
      notiz: String(body.notiz ?? '').slice(0, 2000).trim() || null,
    },
    select: FELDER,
  })

  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'create', entityType: 'BavVertrag', entityId: vertrag.id,
    customerId, details: { weg, anbieter, monatsbetrag },
  })

  // §1a Abs. 1a BetrAVG: Wer weniger als 15 % zuschießt, bekommt es gesagt —
  // beim Anlegen, nicht erst auf der Abrechnung.
  const hinweise: string[] = []
  if (satz + 0.0001 < PFLICHTZUSCHUSS && weg !== 'altvertrag_40b') {
    hinweise.push(
      'Der vereinbarte Zuschuss liegt unter 15 %. §1a Abs. 1a BetrAVG '
      + 'verpflichtet den Arbeitgeber, 15 % des umgewandelten Betrags '
      + 'weiterzugeben, soweit er dadurch Sozialversicherungsbeiträge '
      + 'einspart — seit dem 1. Januar 2022 auch für ältere Vereinbarungen.')
  }

  return NextResponse.json({ vertrag, hinweise })
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

  const vorhanden = await prisma.bavVertrag.findFirst({ where: { id, customerId } })
  if (!vorhanden) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const daten: Record<string, unknown> = {}
  if (body.anbieter !== undefined) {
    const a = String(body.anbieter).trim()
    if (!a) return NextResponse.json({ error: 'Anbieter fehlt.' }, { status: 400 })
    daten.anbieter = a
  }
  if (body.vertragsnummer !== undefined) {
    daten.vertragsnummer = String(body.vertragsnummer ?? '').trim() || null
  }
  if (body.monatsbetrag !== undefined) {
    const b = Number(body.monatsbetrag)
    if (!(b > 0)) {
      return NextResponse.json({ error: 'Der Monatsbetrag muss größer als null sein.' },
        { status: 400 })
    }
    daten.monatsbetrag = b
  }
  if (body.zuschussSatz !== undefined) {
    daten.zuschussSatz = Math.max(0, Number(body.zuschussSatz))
  }
  if (body.zuschussAufGesamt !== undefined) {
    daten.zuschussAufGesamt = body.zuschussAufGesamt === true
  }
  if (body.weg !== undefined && String(body.weg) in WEGE) daten.weg = String(body.weg)
  if (body.ende !== undefined) {
    daten.ende = String(body.ende ?? '').slice(0, 10) || null
  }
  if (body.notiz !== undefined) {
    daten.notiz = String(body.notiz ?? '').slice(0, 2000).trim() || null
  }
  if (body.aktiv !== undefined) daten.aktiv = body.aktiv === true

  const vertrag = await prisma.bavVertrag.update({
    where: { id }, data: daten, select: FELDER,
  })
  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'update', entityType: 'BavVertrag', entityId: id,
    customerId, details: { felder: Object.keys(daten) },
  })
  return NextResponse.json({ vertrag })
}

/**
 * Löschen — nur, solange nichts abgerechnet wurde.
 *
 * Danach wird der Vertrag beendet. An ihm hängen abgerechnete Monate, und ein
 * Beleg, der eine Umwandlung ausweist, deren Vertrag es nicht mehr gibt, ist
 * bei der nächsten Prüfung nicht zu erklären.
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

  const vorhanden = await prisma.bavVertrag.findFirst({ where: { id, customerId } })
  if (!vorhanden) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const abgerechnet = await prisma.payrollEntry.count({
    where: { employeeId: vorhanden.employeeId, bavUmwandlung: { gt: 0 } },
  })
  if (abgerechnet > 0) {
    return NextResponse.json(
      {
        error: `Für diese Person wurden bereits ${abgerechnet} Monate mit `
          + 'Entgeltumwandlung abgerechnet. Der Vertrag wird beendet, nicht '
          + 'gelöscht — sonst weist ein Beleg eine Umwandlung aus, deren '
          + 'Vertrag es nicht mehr gibt.',
      },
      { status: 409 },
    )
  }

  await prisma.bavVertrag.delete({ where: { id } })
  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'delete', entityType: 'BavVertrag', entityId: id,
    customerId, details: { anbieter: vorhanden.anbieter },
  })
  return NextResponse.json({ ok: true })
}
