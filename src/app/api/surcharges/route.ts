import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId, resolveLocationId } from '@/lib/session'
import { allowedLocationScope } from '@/lib/scope'
import { aggregateWithRules, DEFAULT_SURCHARGE_RULES } from '@/lib/surcharge-engine'
import type {
  ConfiguredSurchargeRule, EmployeeSurchargeRow, RuleResult,
} from '@/lib/surcharge-engine'

export const dynamic = 'force-dynamic'

/**
 * §275 Zuschläge je Mitarbeiter und Monat.
 *
 * WARUM DAS HIER UMGEBAUT WURDE
 * Diese Route verlangte EINEN Standort: `resolveLocationId(session)`, und
 * ohne Treffer HTTP 400. Eine Geschäftsführung hängt aber an keinem
 * Standort — sie bekam „locationId nicht gefunden", und die Seite zeigte
 * „0 Mitarbeiter · Keine Einträge".
 *
 * Das war mehr als ein leerer Bildschirm: Die Beträge sind ausdrücklich der
 * Unternehmensebene vorbehalten (die Tabelle schreibt „Nur
 * Unternehmensebene" in die Spaltenüberschrift). Genau diese Rolle konnte
 * die Seite nicht laden. Gemessen am 01.11.2026, als der Beispielbetrieb
 * seinen ersten Zugang auf Unternehmensebene bekam — vorher hatte ihn
 * niemand geöffnet.
 *
 * Gerechnet wird jetzt über alle Standorte, die die Rolle sehen darf, aber
 * JE STANDORT: Bundesland und Regelwerk hängen am Standort, und ein
 * Feiertagszuschlag für Fronleichnam gilt in Köln und nicht in Hannover.
 * Erst danach werden die Zeilen je Mensch zusammengelegt.
 */
export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const yearParam = req.nextUrl.searchParams.get('year')
  const monthParam = req.nextUrl.searchParams.get('month')
  const locationIdParam = req.nextUrl.searchParams.get('locationId')

  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear()
  const month = monthParam ? parseInt(monthParam) : new Date().getMonth() + 1

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'customerId fehlt' }, { status: 400 })

  // ── Welche Standorte ──────────────────────────────────────────────────────
  const scope = await allowedLocationScope(session)
  let standortIds: string[]
  if (locationIdParam) {
    if (scope.kind !== 'all' && !scope.ids.includes(locationIdParam)) {
      return NextResponse.json({ error: 'Keine Berechtigung für diesen Standort' }, { status: 403 })
    }
    standortIds = [locationIdParam]
  } else if (scope.kind === 'all') {
    const alle = await prisma.location.findMany({
      where: { customerId }, select: { id: true },
    })
    standortIds = alle.map(l => l.id)
  } else {
    standortIds = scope.ids
  }

  /*
   * Der Rückfall für eine Rolle, die an genau einem Standort hängt. Er stand
   * vorher am Anfang und war die einzige Quelle; jetzt ist er die letzte.
   */
  if (standortIds.length === 0) {
    const eigener = await resolveLocationId(session)
    if (eigener) standortIds = [eigener]
  }
  if (standortIds.length === 0) {
    return NextResponse.json({
      rows: [], ruleSet: null, usingDefaults: false, year, month,
      locationId: null, bundesland: undefined,
      hinweis: 'Für diesen Zugang ist kein Standort hinterlegt.',
    })
  }

  const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`
  const dateTo = `${year}-${String(month).padStart(2, '0')}-31`

  const [standorte, regelwerke, logs] = await Promise.all([
    prisma.location.findMany({
      where: { id: { in: standortIds } },
      select: { id: true, bundesland: true },
    }),
    prisma.surchargeRuleSet.findMany({
      where: { customerId },
      include: { rules: { orderBy: { sortOrder: 'asc' } }, wageConfigs: true },
    }),
    prisma.timeLog.findMany({
      where: {
        locationId: { in: standortIds },
        date: { gte: dateFrom, lte: dateTo },
        clockOut: { not: null },
      },
      orderBy: { date: 'asc' },
    }),
  ])

  const employeeIds = Array.from(new Set(logs.map(l => l.employeeId)))
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true, name: true },
  })
  const nameVon = Object.fromEntries(employees.map(e => [e.id, e.name]))

  /*
   * Das Regelwerk eines Standorts: zuerst sein eigenes, sonst das des
   * Unternehmens (locationId null), sonst die gesetzlichen Standardwerte.
   */
  const regelwerkFuer = (standortId: string) =>
    regelwerke.find(r => r.locationId === standortId)
    ?? regelwerke.find(r => r.locationId === null)
    ?? null

  const zeilenJeMensch = new Map<string, EmployeeSurchargeRow>()
  let irgendwoStandard = false
  let einRegelwerk: (typeof regelwerke)[number] | null = null

  for (const standort of standorte) {
    const eigene = logs.filter(l => l.locationId === standort.id)
    if (eigene.length === 0) continue

    const regelwerk = regelwerkFuer(standort.id)
    einRegelwerk ??= regelwerk
    const regeln: ConfiguredSurchargeRule[] = (regelwerk?.rules ?? []).length > 0
      ? (regelwerk!.rules as unknown as ConfiguredSurchargeRule[])
      : DEFAULT_SURCHARGE_RULES
    if ((regelwerk?.rules ?? []).length === 0) irgendwoStandard = true

    const lohnJeMensch: Record<string, number> = {}
    for (const wc of regelwerk?.wageConfigs ?? []) {
      if (wc.employeeId) lohnJeMensch[wc.employeeId] = wc.hourlyWage
    }

    const gebuendelt = new Map<string, {
      employeeId: string; employeeName: string
      entries: { date: string; clockIn: string; clockOut: string; totalMinutes: number }[]
    }>()
    for (const log of eigene) {
      if (!log.clockOut) continue
      if (!gebuendelt.has(log.employeeId)) {
        gebuendelt.set(log.employeeId, {
          employeeId: log.employeeId,
          employeeName: nameVon[log.employeeId] ?? log.employeeId,
          entries: [],
        })
      }
      gebuendelt.get(log.employeeId)!.entries.push({
        date: log.date, clockIn: log.clockIn, clockOut: log.clockOut,
        totalMinutes: log.totalMinutes ?? 0,
      })
    }

    const zeilen = aggregateWithRules(
      Array.from(gebuendelt.values()),
      regeln,
      standort.bundesland ?? undefined,
      lohnJeMensch,
      regelwerk?.defaultHourlyWage ?? undefined,
    )

    /*
     * Zusammenlegen, wer an mehreren Standorten gearbeitet hat. Zwei Zeilen
     * für denselben Menschen wären im Lohnbüro zwei Personen — und die
     * Jahresgrenzen gelten je Mensch, nicht je Haus.
     */
    for (const z of zeilen) {
      const vorhanden = zeilenJeMensch.get(z.employeeId)
      if (!vorhanden) {
        zeilenJeMensch.set(z.employeeId, { ...z, byRule: z.byRule.map(r => ({ ...r })) })
        continue
      }
      vorhanden.totalWorkedMinutes += z.totalWorkedMinutes
      for (const regel of z.byRule) {
        const schon = vorhanden.byRule.find((r: RuleResult) => r.ruleId === regel.ruleId)
        if (schon) {
          schon.minutes += regel.minutes
          schon.euros += regel.euros
        } else {
          vorhanden.byRule.push({ ...regel })
        }
      }
    }
  }

  const rows = Array.from(zeilenJeMensch.values())
  rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'de'))

  // Ein Bundesland wird nur genannt, wenn es eindeutig ist. „Feiertage nach
  // Bundesland X" über drei Länder hinweg wäre eine Behauptung, die für zwei
  // davon falsch ist.
  const laender = Array.from(new Set(standorte.map(s => s.bundesland).filter(Boolean)))
  const bundesland = laender.length === 1 ? (laender[0] as string) : undefined

  return NextResponse.json({
    rows,
    ruleSet: einRegelwerk ?? null,
    usingDefaults: irgendwoStandard,
    year,
    month,
    locationId: standortIds.length === 1 ? standortIds[0] : null,
    standorte: standortIds.length,
    bundesland,
  })
}
