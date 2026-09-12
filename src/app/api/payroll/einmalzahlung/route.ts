import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { allowedLocationScope, assertEmployeeAccess } from '@/lib/scope'

export const dynamic = 'force-dynamic'

/**
 * §120 Einmalzahlungen erfassen: Weihnachtsgeld, Urlaubsgeld, Prämien,
 * Abfindungen.
 *
 * Sie werden nicht sofort gerechnet — sie stehen bereit, und der nächste
 * Abrechnungslauf nimmt sie auf. So ist die Reihenfolge dieselbe wie bei allem
 * anderen: erfassen, rechnen, prüfen, freigeben.
 *
 * Eine Einmalzahlung an einem bereits freigegebenen Monat wird abgelehnt. Wer
 * sie nachträglich braucht, trägt sie im nächsten offenen Monat ein oder rollt
 * den Monat auf — beides sichtbar, keines still.
 */

const ARTEN = ['weihnachtsgeld', 'urlaubsgeld', 'praemie', 'abfindung', 'sonstiges'] as const
type Art = typeof ARTEN[number]

const STANDARD_BEZEICHNUNG: Record<Art, string> = {
  weihnachtsgeld: 'Weihnachtsgeld',
  urlaubsgeld: 'Urlaubsgeld',
  praemie: 'Prämie',
  abfindung: 'Abfindung',
  sonstiges: 'Einmalzahlung',
}

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 })

  const p = req.nextUrl.searchParams
  const jahr = Number(p.get('jahr')) || new Date().getFullYear()
  const monat = p.get('monat') ? Number(p.get('monat')) : null

  const scope = await allowedLocationScope(session)
  const standortFilter = scope.kind === 'all' ? {} : { locationId: { in: scope.ids } }

  const zahlungen = await prisma.payrollBonus.findMany({
    where: { customerId, jahr, ...(monat ? { monat } : {}), ...standortFilter },
    orderBy: [{ monat: 'asc' }, { employeeName: 'asc' }],
  })
  return NextResponse.json({ zahlungen })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 })

  const body = await req.json().catch(() => ({})) as {
    employeeId?: string; jahr?: number; monat?: number
    art?: string; bezeichnung?: string; betrag?: number; notiz?: string
  }
  const employeeId = body.employeeId ?? ''
  const jahr = Number(body.jahr)
  const monat = Number(body.monat)
  const betrag = Number(body.betrag)

  if (!employeeId || !jahr || !monat || monat < 1 || monat > 12) {
    return NextResponse.json(
      { error: 'Mitarbeiter, Jahr und Monat sind erforderlich' }, { status: 400 })
  }
  if (!Number.isFinite(betrag) || betrag <= 0) {
    return NextResponse.json({ error: 'Der Betrag muss größer als null sein' }, { status: 400 })
  }
  const art = (ARTEN as readonly string[]).includes(body.art ?? '')
    ? body.art as Art
    : 'sonstiges'

  const verweigert = await assertEmployeeAccess(session, employeeId)
  if (verweigert) return verweigert

  const mitarbeiter = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, name: true, locationId: true, customerId: true },
  })
  if (!mitarbeiter || mitarbeiter.customerId !== customerId) {
    return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 })
  }

  // Ein freigegebener Monat wird nicht nachträglich um eine Zahlung ergänzt —
  // sonst stimmt die Abrechnung nicht mehr mit dem überein, was ausgezahlt wurde.
  const abrechnung = await prisma.payrollEntry.findUnique({
    where: { employeeId_year_month: { employeeId, year: jahr, month: monat } },
    select: { status: true },
  })
  if (abrechnung && abrechnung.status !== 'draft') {
    return NextResponse.json({
      error: 'Die Abrechnung dieses Monats ist bereits freigegeben. Die Zahlung im '
        + 'nächsten offenen Monat erfassen oder den Monat aufrollen.',
    }, { status: 409 })
  }

  const zahlung = await prisma.payrollBonus.create({
    data: {
      employeeId, employeeName: mitarbeiter.name,
      customerId, locationId: mitarbeiter.locationId,
      jahr, monat, art,
      bezeichnung: body.bezeichnung?.trim() || STANDARD_BEZEICHNUNG[art],
      betrag: Math.round(betrag * 100) / 100,
      // Eine echte Abfindung ist beitragsfrei — sie ist Entschädigung für den
      // Verlust des Arbeitsplatzes, kein Arbeitsentgelt.
      beitragsfrei: art === 'abfindung',
      notiz: body.notiz?.trim() || null,
      erstelltVon: session.name ?? session.userId,
    },
  })

  return NextResponse.json({
    zahlung,
    hinweis: 'Erfasst. Sie wird beim nächsten Abrechnungslauf dieses Monats gerechnet.',
  })
}

export async function DELETE(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const zahlung = await prisma.payrollBonus.findUnique({ where: { id } })
  // Gleiche Antwort für "gibt es nicht" und "gehört jemand anderem"
  if (!zahlung || zahlung.customerId !== customerId) {
    return NextResponse.json({ error: 'Einmalzahlung nicht gefunden' }, { status: 404 })
  }
  const scope = await allowedLocationScope(session)
  if (scope.kind !== 'all' && zahlung.locationId && !scope.ids.includes(zahlung.locationId)) {
    return NextResponse.json({ error: 'Einmalzahlung nicht gefunden' }, { status: 404 })
  }

  const abrechnung = await prisma.payrollEntry.findUnique({
    where: {
      employeeId_year_month: {
        employeeId: zahlung.employeeId, year: zahlung.jahr, month: zahlung.monat,
      },
    },
    select: { status: true },
  })
  if (abrechnung && abrechnung.status !== 'draft') {
    return NextResponse.json({
      error: 'Die Abrechnung dieses Monats ist bereits freigegeben — die Zahlung ist '
        + 'ausgezahlt und kann nicht mehr gelöscht werden. Dafür den Monat aufrollen.',
    }, { status: 409 })
  }

  await prisma.payrollBonus.delete({ where: { id } })
  return NextResponse.json({ hinweis: 'Einmalzahlung gelöscht.' })
}
