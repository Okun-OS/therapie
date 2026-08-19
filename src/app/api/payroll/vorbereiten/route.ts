import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { allowedLocationScope } from '@/lib/scope'

export const dynamic = 'force-dynamic'

// §102 POST /api/payroll/vorbereiten  { year, month, locationId? }
//
// Erzeugt Abrechnungsentwürfe aus den Lohn-Stammdaten der Mitarbeiter.
// Ohne das müsste jemand Steuerklasse, Versicherung und Lohn bei jeder
// Abrechnung neu eintippen — genau der Grund, warum die Stammdaten am
// Mitarbeiter hängen und nicht am einzelnen Abrechnungslauf.
export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 })

  const { year, month, locationId } = await req.json().catch(() => ({})) as {
    year?: number; month?: number; locationId?: string
  }
  if (!year || !month) {
    return NextResponse.json({ error: 'Jahr und Monat sind erforderlich' }, { status: 400 })
  }

  const scope = await allowedLocationScope(session)
  const standortFilter = locationId
    ? (scope.kind === 'all' || scope.ids.includes(locationId)
        ? { locationId }
        : null)
    : (scope.kind === 'all' ? {} : { locationId: { in: scope.ids } })
  if (standortFilter === null) {
    return NextResponse.json({ error: 'Keine Berechtigung für diesen Standort' }, { status: 403 })
  }

  const mitarbeiter = await prisma.employee.findMany({
    where: { customerId, active: true, ...standortFilter },
    select: { id: true, name: true, locationId: true },
  })
  const profile = await prisma.employeePayrollProfile.findMany({
    where: { employeeId: { in: mitarbeiter.map(m => m.id) } },
  })
  const profilVon = new Map(profile.map(p => [p.employeeId, p]))

  const angelegt: string[] = []
  const unvollstaendig: { name: string; fehlt: string[] }[] = []

  for (const m of mitarbeiter) {
    const p = profilVon.get(m.id)

    // Ohne diese Angaben ist keine Abrechnung möglich — das soll auffallen,
    // bevor jemand ein falsches Ergebnis in der Hand hält.
    const fehlt: string[] = []
    if (!p) fehlt.push('Lohn-Stammdaten fehlen vollständig')
    else {
      if (!p.steuerklasse) fehlt.push('Steuerklasse')
      if (!p.versicherungsart) fehlt.push('Versicherungsart')
      if (!p.lohnart) fehlt.push('Lohnart')
      if (p.lohnart === 'stunde' && !p.stundenlohn) fehlt.push('Stundenlohn')
      if (p.lohnart === 'monat' && !p.monatsgehalt) fehlt.push('Monatsgehalt')
      if (!p.bundesland) fehlt.push('Bundesland')
    }
    if (fehlt.length > 0) {
      unvollstaendig.push({ name: m.name, fehlt })
      continue
    }

    await prisma.payrollEntry.upsert({
      where: { employeeId_year_month: { employeeId: m.id, year, month } },
      create: {
        employeeId: m.id, employeeName: m.name, locationId: m.locationId, customerId,
        year, month, status: 'draft',
        hourlyWage: p!.stundenlohn ?? null,
        monthlyWage: p!.monatsgehalt ?? null,
        taxClass: p!.steuerklasse ?? 1,
        childCount: p!.kinderfreibetraege ?? 0,
        insuranceType: p!.versicherungsart ?? 'GKV',
        pkv: p!.pkvBeitrag ?? null,
        churchTax: !!p!.konfession && p!.konfession !== 'keine',
        bundesland: p!.bundesland,
      },
      // Bereits geprüfte oder freigegebene Abrechnungen werden nicht überschrieben
      update: {},
    })
    angelegt.push(m.name)
  }

  return NextResponse.json({
    angelegt: angelegt.length,
    unvollstaendig,
    hinweis: unvollstaendig.length > 0
      ? `${unvollstaendig.length} Mitarbeiter konnten nicht vorbereitet werden — bei ihnen fehlen Lohn-Stammdaten.`
      : `${angelegt.length} Abrechnungen aus den Stammdaten vorbereitet.`,
  })
}
