/**
 * §115 Die Grundlage einer Monatsabrechnung aus den echten Daten des Monats.
 *
 * Vorher hat "Abrechnung vorbereiten" nur die Stammdaten übertragen — Brutto und
 * Netto blieben null. Damit war die Lohnabrechnung leer, der DATEV-Export ohne
 * Lohnarten und die SEPA-Datei ohne Zahlung.
 *
 * Hier werden deshalb die Zahlen zusammengetragen, die eine Abrechnung braucht:
 * geleistete Stunden aus der Zeiterfassung, Urlaub und Krankheit aus den
 * Abwesenheiten, Zuschläge aus dem Regelwerk des Kunden. Gerechnet wird
 * anschließend in der Lohn-Engine — hier wird nichts geschätzt.
 */

import { prisma } from './prisma'
import { calculatePayroll, type PayrollInput, type PayrollResult } from './payroll-engine'
import {
  computeWithRules, DEFAULT_SURCHARGE_RULES,
  type ConfiguredSurchargeRule,
} from './surcharge-engine'

export interface MonatsGrundlage {
  regularHours: number
  overtimeHours: number
  nightHours: number
  saturdayHours: number
  sundayHours: number
  holidayHours: number
  vacationDays: number
  sickDays: number
  nightSurcharge: number
  saturdaySurcharge: number
  sundaySurcharge: number
  holidaySurcharge: number
  overtimeSurcharge: number
  otherSurcharge: number
  /** Stundensatz, mit dem die prozentualen Zuschläge gerechnet wurden. */
  zuschlagsStundenlohn: number | null
}

const leer = (): MonatsGrundlage => ({
  regularHours: 0, overtimeHours: 0,
  nightHours: 0, saturdayHours: 0, sundayHours: 0, holidayHours: 0,
  vacationDays: 0, sickDays: 0,
  nightSurcharge: 0, saturdaySurcharge: 0, sundaySurcharge: 0,
  holidaySurcharge: 0, overtimeSurcharge: 0, otherSurcharge: 0,
  zuschlagsStundenlohn: null,
})

/** Erster und letzter Tag des Monats als YYYY-MM-DD. */
export function monatsGrenzen(year: number, month: number): { von: string; bis: string } {
  const mm = String(month).padStart(2, '0')
  const letzter = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { von: `${year}-${mm}-01`, bis: `${year}-${mm}-${String(letzter).padStart(2, '0')}` }
}

/**
 * Der Stundensatz für prozentuale Zuschläge.
 *
 * Bei Monatsgehalt gibt es keinen Stundenlohn — §3b EStG rechnet Zuschläge aber
 * auf den Grundlohn je Stunde. Der wird aus Gehalt und Wochenstunden abgeleitet
 * (13 Wochen je Quartal / 3 Monate = 4,3333 Wochen je Monat).
 */
export function zuschlagsStundenlohn(
  lohnart: string | null | undefined,
  stundenlohn: number | null | undefined,
  monatsgehalt: number | null | undefined,
  wochenstunden: number | null | undefined,
): number | null {
  if (lohnart === 'stunde' && stundenlohn) return stundenlohn
  if (monatsgehalt && wochenstunden && wochenstunden > 0) {
    return monatsgehalt / (wochenstunden * (13 / 3))
  }
  return stundenlohn ?? null
}

/** Das aktive Zuschlagsregelwerk des Kunden; ohne eigenes gelten die gesetzlichen Vorgaben. */
export async function zuschlagsregelnLaden(
  customerId: string,
  locationId?: string | null,
): Promise<ConfiguredSurchargeRule[]> {
  const regelwerke = await prisma.surchargeRuleSet.findMany({
    where: { customerId },
    include: { rules: true },
  })
  // Ein Regelwerk für den Standort geht vor, sonst das Regelwerk des Unternehmens
  const passend = regelwerke.find(r => locationId && r.locationId === locationId)
    ?? regelwerke.find(r => !r.locationId)
    ?? regelwerke[0]

  const regeln = (passend?.rules ?? []).filter(r => r.isActive)
  if (regeln.length === 0) return DEFAULT_SURCHARGE_RULES

  return regeln.map(r => ({
    id: r.id, name: r.name, description: r.description ?? undefined, type: r.type,
    timeStart: r.timeStart ?? undefined, timeEnd: r.timeEnd ?? undefined,
    daysOfWeek: r.daysOfWeek, includeHolidays: r.includeHolidays, excludeHolidays: r.excludeHolidays,
    rateType: r.rateType as ConfiguredSurchargeRule['rateType'], rateValue: r.rateValue,
    priority: r.priority, roundingMinutes: r.roundingMinutes,
    maxMinutesPerDay: r.maxMinutesPerDay, isActive: r.isActive, sortOrder: r.sortOrder,
  }))
}

/** Zuschlagsart einer Regel — bestimmt, in welcher Zeile sie auf der Abrechnung landet. */
function kategorie(typ: string, name: string): 'night' | 'saturday' | 'sunday' | 'holiday' | 'overtime' | 'other' {
  const t = `${typ} ${name}`.toLowerCase()
  if (t.includes('night') || t.includes('nacht')) return 'night'
  if (t.includes('holiday') || t.includes('feiertag')) return 'holiday'
  if (t.includes('sunday') || t.includes('sonntag')) return 'sunday'
  if (t.includes('saturday') || t.includes('samstag')) return 'saturday'
  if (t.includes('overtime') || t.includes('überstunde') || t.includes('ueberstunde')) return 'overtime'
  return 'other'
}

export interface MitarbeiterMonat {
  employeeId: string
  weeklyHours: number
  locationId?: string | null
  bundesland?: string | null
  lohnart?: string | null
  stundenlohn?: number | null
  monatsgehalt?: number | null
}

/**
 * Stunden, Abwesenheiten und Zuschläge des Monats je Mitarbeiter.
 *
 * Ein Durchlauf für alle Mitarbeiter, damit ein Abrechnungslauf nicht pro Person
 * die Datenbank befragt.
 */
export async function monatsGrundlagen(
  customerId: string,
  year: number,
  month: number,
  mitarbeiter: MitarbeiterMonat[],
): Promise<Map<string, MonatsGrundlage>> {
  const ergebnis = new Map<string, MonatsGrundlage>()
  for (const m of mitarbeiter) ergebnis.set(m.employeeId, leer())
  if (mitarbeiter.length === 0) return ergebnis

  const { von, bis } = monatsGrenzen(year, month)
  const ids = mitarbeiter.map(m => m.employeeId)

  const [zeiten, abwesenheiten] = await Promise.all([
    prisma.timeLog.findMany({
      where: { employeeId: { in: ids }, date: { gte: von, lte: bis }, clockOut: { not: null } },
    }),
    prisma.absence.findMany({
      where: { employeeId: { in: ids }, startDate: { lte: bis }, endDate: { gte: von } },
    }),
  ])

  // Regelwerke je Standort nur einmal laden
  const regelnJeStandort = new Map<string, ConfiguredSurchargeRule[]>()
  for (const m of mitarbeiter) {
    const key = m.locationId ?? ''
    if (!regelnJeStandort.has(key)) {
      regelnJeStandort.set(key, await zuschlagsregelnLaden(customerId, m.locationId))
    }
  }

  const zeitenJeMitarbeiter = new Map<string, typeof zeiten>()
  for (const z of zeiten) {
    const liste = zeitenJeMitarbeiter.get(z.employeeId) ?? []
    liste.push(z)
    zeitenJeMitarbeiter.set(z.employeeId, liste)
  }

  for (const m of mitarbeiter) {
    const g = ergebnis.get(m.employeeId)!
    const regeln = regelnJeStandort.get(m.locationId ?? '') ?? DEFAULT_SURCHARGE_RULES
    const satz = zuschlagsStundenlohn(m.lohnart, m.stundenlohn, m.monatsgehalt, m.weeklyHours)
    g.zuschlagsStundenlohn = satz != null ? Math.round(satz * 100) / 100 : null

    let minuten = 0
    for (const z of zeitenJeMitarbeiter.get(m.employeeId) ?? []) {
      if (!z.clockOut) continue
      const gearbeitet = z.totalMinutes ?? 0
      minuten += gearbeitet

      const treffer = computeWithRules(
        { date: z.date, clockIn: z.clockIn, clockOut: z.clockOut, totalMinutes: gearbeitet },
        regeln, m.bundesland ?? undefined, satz ?? undefined,
      )
      for (const r of treffer.byRule) {
        const regel = regeln.find(x => x.id === r.ruleId)
        const stunden = r.minutes / 60
        switch (kategorie(regel?.type ?? '', r.ruleName)) {
          case 'night': g.nightHours += stunden; g.nightSurcharge += r.euros; break
          case 'saturday': g.saturdayHours += stunden; g.saturdaySurcharge += r.euros; break
          case 'sunday': g.sundayHours += stunden; g.sundaySurcharge += r.euros; break
          case 'holiday': g.holidayHours += stunden; g.holidaySurcharge += r.euros; break
          case 'overtime': g.overtimeSurcharge += r.euros; break
          default: g.otherSurcharge += r.euros
        }
      }
    }

    // Sollstunden aus dem Vertrag; alles darüber sind Überstunden.
    const gearbeitet = minuten / 60
    const soll = m.weeklyHours > 0 ? m.weeklyHours * (13 / 3) : gearbeitet
    g.regularHours = Math.round(Math.min(gearbeitet, soll) * 100) / 100
    g.overtimeHours = Math.round(Math.max(0, gearbeitet - soll) * 100) / 100

    for (const feld of [
      'nightHours', 'saturdayHours', 'sundayHours', 'holidayHours',
      'nightSurcharge', 'saturdaySurcharge', 'sundaySurcharge', 'holidaySurcharge',
      'overtimeSurcharge', 'otherSurcharge',
    ] as const) {
      g[feld] = Math.round(g[feld] * 100) / 100
    }
  }

  // Urlaub und Krankheit: die Arbeitstage, die in diesen Monat fallen
  for (const a of abwesenheiten) {
    const g = ergebnis.get(a.employeeId)
    if (!g) continue
    const tage = arbeitstageImZeitraum(
      a.startDate > von ? a.startDate : von,
      a.endDate < bis ? a.endDate : bis,
    )
    if (a.type === 'urlaub') g.vacationDays += tage
    else if (a.type === 'krank' || a.type === 'krankheit') g.sickDays += tage
  }

  return ergebnis
}

/** Montag bis Freitag im Zeitraum — die übliche Zählweise für Urlaubs- und Krankheitstage. */
function arbeitstageImZeitraum(von: string, bis: string): number {
  const start = new Date(von + 'T00:00:00Z')
  const ende = new Date(bis + 'T00:00:00Z')
  let tage = 0
  for (const d = new Date(start); d <= ende; d.setUTCDate(d.getUTCDate() + 1)) {
    const wt = d.getUTCDay()
    if (wt !== 0 && wt !== 6) tage++
  }
  return tage
}

export interface AbrechnungsStammdaten {
  lohnart?: string | null
  stundenlohn?: number | null
  monatsgehalt?: number | null
  steuerklasse?: number | null
  kinderfreibetraege?: number | null
  versicherungsart?: string | null
  pkvBeitrag?: number | null
  zusatzbeitrag?: number | null
  konfession?: string | null
  bundesland?: string | null
  /** Hat Kinder — entscheidet über den Zuschlag zur Pflegeversicherung */
  hatKinder?: boolean | null
  /** Kinder unter 25 — ab dem zweiten mindert jedes den Pflegebeitrag */
  kinderUnter25?: number | null
  rentenversicherungspflichtig?: boolean | null
  /** Freibetrag und Hinzurechnungsbetrag laut ELStAM, Monatsbetrag */
  freibetragMonat?: number | null
  hinzurechnungMonat?: number | null
  faktor?: number | null
}

/** Aus Stammdaten und Monatsgrundlage die fertige Abrechnung rechnen. */
export function abrechnungRechnen(
  stamm: AbrechnungsStammdaten,
  g: MonatsGrundlage,
  jahr: number,
): { eingabe: PayrollInput; ergebnis: PayrollResult } {
  // Der Grundlohn je Stunde ist der Maßstab für die Steuerfreiheit der
  // Zuschläge — beim Monatsgehalt aus Gehalt und Wochenstunden abgeleitet.
  const eingabe: PayrollInput = {
    jahr,
    hourlyWage: stamm.lohnart === 'stunde' ? (stamm.stundenlohn ?? undefined) : undefined,
    monthlyWage: stamm.lohnart === 'monat' ? (stamm.monatsgehalt ?? undefined) : undefined,
    regularHours: g.regularHours,
    overtimeHours: g.overtimeHours,
    nightHours: g.nightHours,
    sundayHours: g.sundayHours,
    holidayHours: g.holidayHours,
    saturdayHours: g.saturdayHours,
    vacationDays: g.vacationDays,
    sickDays: g.sickDays,
    nightSurcharge: g.nightSurcharge,
    sundaySurcharge: g.sundaySurcharge,
    holidaySurcharge: g.holidaySurcharge,
    saturdaySurcharge: g.saturdaySurcharge,
    overtimeSurcharge: g.overtimeSurcharge,
    otherSurcharge: g.otherSurcharge,
    taxClass: (stamm.steuerklasse ?? 1) as PayrollInput['taxClass'],
    childCount: stamm.kinderfreibetraege ?? 0,
    insuranceType: stamm.versicherungsart === 'PKV' ? 'PKV' : 'GKV',
    pkvMonthly: stamm.pkvBeitrag ?? undefined,
    zusatzbeitragPercent: stamm.zusatzbeitrag ?? undefined,
    hasChildren: stamm.hatKinder ?? undefined,
    childrenUnder25: stamm.kinderUnter25 ?? undefined,
    rvExempt: stamm.rentenversicherungspflichtig === false,
    freibetragMonat: stamm.freibetragMonat ?? undefined,
    hinzurechnungMonat: stamm.hinzurechnungMonat ?? undefined,
    faktor: stamm.faktor ?? undefined,
    grundlohnHourly: g.zuschlagsStundenlohn ?? undefined,
    churchTax: !!stamm.konfession && stamm.konfession !== 'keine',
    bundesland: stamm.bundesland ?? undefined,
  }
  return { eingabe, ergebnis: calculatePayroll(eingabe) }
}

/** Die berechneten Felder, wie sie am PayrollEntry gespeichert werden. */
export function abrechnungsFelder(g: MonatsGrundlage, r: PayrollResult) {
  return {
    regularHours: g.regularHours,
    overtimeHours: g.overtimeHours,
    nightHours: g.nightHours,
    sundayHours: g.sundayHours,
    holidayHours: g.holidayHours,
    saturdayHours: g.saturdayHours,
    vacationDays: Math.round(g.vacationDays),
    sickDays: Math.round(g.sickDays),
    brutto: r.brutto,
    surchargesTotal: r.surchargesTotal,
    grundlage: r.grundlage,
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
  }
}
