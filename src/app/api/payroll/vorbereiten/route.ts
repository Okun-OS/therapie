import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { allowedLocationScope } from '@/lib/scope'
import { monatsGrundlagen, abrechnungRechnen, abrechnungsFelder } from '@/lib/payroll-monat'
import { elstamStandBewerten } from '@/lib/elstam'

export const dynamic = 'force-dynamic'

// §102 POST /api/payroll/vorbereiten  { year, month, locationId? }
//
// Erzeugt Abrechnungsentwürfe aus den Lohn-Stammdaten der Mitarbeiter.
// Ohne das müsste jemand Steuerklasse, Versicherung und Lohn bei jeder
// Abrechnung neu eintippen — genau der Grund, warum die Stammdaten am
// Mitarbeiter hängen und nicht am einzelnen Abrechnungslauf.
//
// §115 Vorbereiten heißt auch rechnen: Stunden aus der Zeiterfassung,
// Abwesenheiten und Zuschläge fließen ein, Brutto und Netto stehen danach am
// Entwurf. Eine Abrechnung ohne Beträge ist keine Abrechnung.
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
    select: { id: true, name: true, locationId: true, weeklyHours: true, hasChildren: true },
  })
  const profile = await prisma.employeePayrollProfile.findMany({
    where: { employeeId: { in: mitarbeiter.map(m => m.id) } },
  })
  const profilVon = new Map(profile.map(p => [p.employeeId, p]))

  // Stunden, Abwesenheiten und Zuschläge des Monats — ein Durchlauf für alle
  const grundlagen = await monatsGrundlagen(customerId, year, month, mitarbeiter.map(m => {
    const p = profilVon.get(m.id)
    return {
      employeeId: m.id, weeklyHours: m.weeklyHours, locationId: m.locationId,
      bundesland: p?.bundesland, lohnart: p?.lohnart,
      stundenlohn: p?.stundenlohn, monatsgehalt: p?.monatsgehalt,
    }
  }))

  const angelegt: string[] = []
  const unvollstaendig: { name: string; fehlt: string[] }[] = []
  const gesperrt: string[] = []
  const hinweise: { name: string; text: string }[] = []
  // §117 Veraltete Steuermerkmale sind der teuerste stille Fehler in der
  // Abrechnung — deshalb werden sie eigens gemeldet und nicht unter die
  // uebrigen Hinweise gemischt.
  const veralteteMerkmale: { name: string; text: string }[] = []

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

    // Eine bereits freigegebene Abrechnung wird nicht neu gerechnet — sonst
    // ändert sich still, was jemand geprüft und unterschrieben hat.
    const vorhanden = await prisma.payrollEntry.findUnique({
      where: { employeeId_year_month: { employeeId: m.id, year, month } },
      select: { id: true, status: true },
    })
    if (vorhanden && vorhanden.status !== 'draft') {
      gesperrt.push(m.name)
      continue
    }

    const stand = elstamStandBewerten(p!.elstamStand, year, month)
    if (!stand.aktuell && stand.hinweis) {
      veralteteMerkmale.push({ name: m.name, text: stand.hinweis })
    }

    const grundlage = grundlagen.get(m.id)!
    // Fuer die Pflegeversicherung zaehlt, ob jemand Kinder hat — die Angabe am
    // Lohnprofil geht vor, sonst das Merkmal am Mitarbeiter.
    let ergebnis
    try {
      ergebnis = abrechnungRechnen(
        { ...p!, hatKinder: p!.hatKinder ?? m.hasChildren },
        grundlage,
        year,
      ).ergebnis
    } catch (fehler) {
      // Ein unbekanntes Abrechnungsjahr ist kein Serverfehler, sondern eine
      // Sache, die jemand entscheiden muss.
      return NextResponse.json(
        { error: fehler instanceof Error ? fehler.message : 'Berechnung nicht moeglich' },
        { status: 400 },
      )
    }
    for (const w of ergebnis.warnings) hinweise.push({ name: m.name, text: w })

    const stammFelder = {
      employeeName: m.name, locationId: m.locationId, customerId,
      hourlyWage: p!.stundenlohn ?? null,
      monthlyWage: p!.monatsgehalt ?? null,
      taxClass: p!.steuerklasse ?? 1,
      childCount: p!.kinderfreibetraege ?? 0,
      insuranceType: p!.versicherungsart ?? 'GKV',
      pkv: p!.pkvBeitrag ?? null,
      churchTax: !!p!.konfession && p!.konfession !== 'keine',
      bundesland: p!.bundesland,
    }
    const gerechnet = abrechnungsFelder(grundlage, ergebnis)

    await prisma.payrollEntry.upsert({
      where: { employeeId_year_month: { employeeId: m.id, year, month } },
      create: { employeeId: m.id, year, month, status: 'draft', ...stammFelder, ...gerechnet },
      update: { ...stammFelder, ...gerechnet },
    })
    angelegt.push(m.name)
  }

  const teile: string[] = []
  if (angelegt.length > 0) teile.push(`${angelegt.length} Abrechnungen berechnet`)
  if (gesperrt.length > 0) teile.push(`${gesperrt.length} bereits freigegeben und unverändert`)
  if (unvollstaendig.length > 0) teile.push(`${unvollstaendig.length} ohne vollständige Lohn-Stammdaten`)
  if (veralteteMerkmale.length > 0) {
    teile.push(`${veralteteMerkmale.length} mit veraltetem ELStAM-Stand`)
  }

  return NextResponse.json({
    angelegt: angelegt.length,
    gesperrt,
    unvollstaendig,
    veralteteMerkmale,
    hinweise,
    hinweis: teile.length > 0 ? teile.join(' · ') + '.' : 'Keine Mitarbeiter zum Abrechnen gefunden.',
  })
}
