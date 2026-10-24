import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { allowedLocationScope, assertEmployeeAccess } from '@/lib/scope'
import { calculatePayroll, type PayrollInput } from '@/lib/payroll-engine'

export const dynamic = 'force-dynamic'

/**
 * §118 Abrechnungen lesen, anlegen und freigeben.
 *
 * Zwei Dinge waren hier falsch und sind behoben:
 *
 * 1. PATCH hat eine Abrechnung allein über ihre Kennung geändert. Wer eine
 *    fremde Kennung kannte, konnte eine fremde Abrechnung freigeben — über
 *    Mandantengrenzen hinweg. Jetzt wird geprüft, wem sie gehört.
 *
 * 2. POST hat den ganzen Anfragekörper in die Datenbank geschrieben, samt
 *    Brutto und Netto. Damit bestimmte der Browser, was ausgezahlt wird.
 *    Jetzt liefert er nur noch die Bemessungsgrundlagen; gerechnet wird hier.
 */

/** Die Abrechnung samt Prüfung, dass der Aufrufer sie überhaupt sehen darf. */
async function abrechnungImZugriff(
  session: Exclude<ReturnType<typeof requireRole>, NextResponse>,
  customerId: string,
  id: string,
) {
  const eintrag = await prisma.payrollEntry.findUnique({ where: { id } })
  // Bewusst dieselbe Antwort für "gibt es nicht" und "gehört jemand anderem":
  // sonst verrät der Unterschied, dass es die Abrechnung gibt.
  if (!eintrag || eintrag.customerId !== customerId) return null
  const scope = await allowedLocationScope(session)
  if (scope.kind !== 'all' && eintrag.locationId && !scope.ids.includes(eintrag.locationId)) {
    return null
  }
  return eintrag
}

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'customerId fehlt' }, { status: 400 })

  const yearParam = req.nextUrl.searchParams.get('year')
  const monthParam = req.nextUrl.searchParams.get('month')
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear()
  const month = monthParam ? parseInt(monthParam) : new Date().getMonth() + 1

  // Eine Standortleitung sieht die Abrechnungen ihrer Standorte, nicht alle
  const scope = await allowedLocationScope(session)
  const standortFilter = scope.kind === 'all' ? {} : { locationId: { in: scope.ids } }

  const entries = await prisma.payrollEntry.findMany({
    where: { customerId, year, month, ...standortFilter },
    orderBy: { employeeName: 'asc' },
  })

  return NextResponse.json({ entries, year, month })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'customerId fehlt' }, { status: 400 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const employeeId = typeof body.employeeId === 'string' ? body.employeeId : ''
  const year = Number(body.year)
  const month = Number(body.month)

  if (!employeeId || !year || !month || month < 1 || month > 12) {
    return NextResponse.json(
      { error: 'employeeId, year und month sind erforderlich' },
      { status: 400 },
    )
  }

  const verweigert = await assertEmployeeAccess(session, employeeId)
  if (verweigert) return verweigert

  const mitarbeiter = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, name: true, locationId: true, customerId: true, hasChildren: true },
  })
  if (!mitarbeiter || mitarbeiter.customerId !== customerId) {
    return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 })
  }

  // Eine freigegebene Abrechnung wird nicht über diesen Weg überschrieben —
  // dafür gibt es die Aufrollung, die den Unterschied festhält.
  const vorhanden = await prisma.payrollEntry.findUnique({
    where: { employeeId_year_month: { employeeId, year, month } },
    select: { status: true },
  })
  if (vorhanden && vorhanden.status !== 'draft') {
    return NextResponse.json({
      error: 'Diese Abrechnung ist bereits freigegeben und kann nicht überschrieben werden. '
        + 'Für nachträgliche Änderungen die Aufrollung verwenden.',
    }, { status: 409 })
  }

  const zahl = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? n : 0
  }
  const profil = await prisma.employeePayrollProfile.findUnique({ where: { employeeId } })

  // Der Browser liefert nur die Bemessungsgrundlagen. Was daraus wird,
  // entscheidet der Rechenkern — nicht der Absender.
  const eingabe: PayrollInput = {
    jahr: year,
    hourlyWage: body.hourlyWage != null ? zahl(body.hourlyWage) : undefined,
    monthlyWage: body.monthlyWage != null ? zahl(body.monthlyWage) : undefined,
    regularHours: zahl(body.regularHours),
    overtimeHours: zahl(body.overtimeHours),
    nightHours: zahl(body.nightHours),
    sundayHours: zahl(body.sundayHours),
    holidayHours: zahl(body.holidayHours),
    saturdayHours: zahl(body.saturdayHours),
    vacationDays: zahl(body.vacationDays),
    sickDays: zahl(body.sickDays),
    nightSurcharge: body.nightSurcharge != null ? zahl(body.nightSurcharge) : undefined,
    sundaySurcharge: body.sundaySurcharge != null ? zahl(body.sundaySurcharge) : undefined,
    holidaySurcharge: body.holidaySurcharge != null ? zahl(body.holidaySurcharge) : undefined,
    saturdaySurcharge: body.saturdaySurcharge != null ? zahl(body.saturdaySurcharge) : undefined,
    taxClass: ([1, 2, 3, 4, 5, 6].includes(Number(body.taxClass))
      ? Number(body.taxClass) : 1) as PayrollInput['taxClass'],
    childCount: zahl(body.childCount),
    hasChildren: profil?.hatKinder ?? mitarbeiter.hasChildren ?? undefined,
    childrenUnder25: profil?.kinderUnter25 ?? undefined,
    insuranceType: body.insuranceType === 'PKV' ? 'PKV' : 'GKV',
    pkvMonthly: body.pkv != null ? zahl(body.pkv) : (profil?.pkvBeitrag ?? undefined),
    zusatzbeitragPercent: profil?.zusatzbeitrag ?? undefined,
    rvExempt: profil?.rentenversicherungspflichtig === false,
    freibetragMonat: profil?.freibetragMonat ?? undefined,
    hinzurechnungMonat: profil?.hinzurechnungMonat ?? undefined,
    faktor: profil?.faktor ?? undefined,
    churchTax: body.churchTax === true,
    bundesland: typeof body.bundesland === 'string' ? body.bundesland : (profil?.bundesland ?? undefined),
  }

  let r
  try {
    r = calculatePayroll(eingabe)
  } catch (fehler) {
    return NextResponse.json(
      { error: fehler instanceof Error ? fehler.message : 'Berechnung nicht möglich' },
      { status: 400 },
    )
  }

  const daten = {
    employeeName: mitarbeiter.name,
    locationId: mitarbeiter.locationId,
    customerId,
    status: 'draft',
    hourlyWage: eingabe.hourlyWage ?? null,
    monthlyWage: eingabe.monthlyWage ?? null,
    regularHours: eingabe.regularHours,
    overtimeHours: eingabe.overtimeHours,
    nightHours: eingabe.nightHours,
    sundayHours: eingabe.sundayHours,
    holidayHours: eingabe.holidayHours,
    saturdayHours: eingabe.saturdayHours,
    vacationDays: Math.round(eingabe.vacationDays),
    sickDays: Math.round(eingabe.sickDays),
    taxClass: eingabe.taxClass,
    childCount: eingabe.childCount,
    insuranceType: eingabe.insuranceType,
    pkv: eingabe.pkvMonthly ?? null,
    churchTax: eingabe.churchTax,
    bundesland: eingabe.bundesland ?? null,
    brutto: r.brutto,
    surchargesTotal: r.surchargesTotal,
    steuerfreieZuschlaege: r.steuerfreieZuschlaege,
    svfreieZuschlaege: r.svfreieZuschlaege,
    steuerBrutto: r.steuerBrutto,
    svBrutto: r.svBrutto,
    lohnsteuer: r.lohnsteuerMonthly,
    kirchensteuer: r.kirchensteuerMonthly,
    soli: r.soliMonthly,
    rvAN: r.rvAN, kvAN: r.kvAN, pvAN: r.pvAN, avAN: r.avAN,
    totalDeductions: r.totalDeductions,
    netto: r.netto,
    rvAG: r.rvAG, kvAG: r.kvAG, pvAG: r.pvAG, avAG: r.avAG,
    totalAgCost: r.totalAgCost,
    grundlage: r.grundlage,
    auszahlungsbetrag: r.netto,
  }

  const entry = await prisma.payrollEntry.upsert({
    where: { employeeId_year_month: { employeeId, year, month } },
    create: { employeeId, year, month, ...daten },
    update: daten,
  })

  return NextResponse.json({ entry, warnings: r.warnings })
}

export async function PATCH(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'customerId fehlt' }, { status: 400 })

  const body = await req.json().catch(() => ({})) as {
    id?: string; status?: string; notes?: string; approvedBy?: string; approvedAt?: string
  }
  if (!body.id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const eintrag = await abrechnungImZugriff(session, customerId, body.id)
  if (!eintrag) return NextResponse.json({ error: 'Abrechnung nicht gefunden' }, { status: 404 })

  const ERLAUBTE_STATUS = ['draft', 'approved', 'paid']
  if (body.status && !ERLAUBTE_STATUS.includes(body.status)) {
    return NextResponse.json({ error: 'Unbekannter Status' }, { status: 400 })
  }

  const updated = await prisma.payrollEntry.update({
    where: { id: eintrag.id },
    data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      // Wer freigibt, steht fest — der Absender bestimmt das nicht selbst.
      ...(body.status === 'approved'
        ? { approvedBy: session.name ?? session.userId, approvedAt: new Date().toISOString() }
        : {}),
    },
  })
  return NextResponse.json({ entry: updated })
}
