/**
 * Zuschlags-Engine: deterministic surcharge calculation.
 *
 * Flow:
 *   1. Load SurchargeRule records from DB (via API/server)
 *   2. For each TimeLog, evaluate each rule against the shift
 *   3. Sum minutes + optionally euros (if hourlyWage is available)
 *   4. No AI involved in calculation — AI only helps capture rules during onboarding
 *
 * Fallback: if no rules are configured, falls back to German legal defaults.
 */

import { isPublicHoliday } from './holidays'

// ── Rule types (mirrors Prisma SurchargeRule) ───────────────────────────────

export type SurchargeRateType = 'percent' | 'fixed_per_hour' | 'fixed_per_shift'

export interface ConfiguredSurchargeRule {
  id: string
  name: string
  description?: string
  type: string
  timeStart?: string        // HH:MM, undefined = full shift
  timeEnd?: string          // HH:MM
  daysOfWeek: number[]      // 0=Sun…6=Sat, empty = all days
  includeHolidays: boolean  // only apply on holidays
  excludeHolidays: boolean  // skip on holidays
  rateType: SurchargeRateType
  rateValue: number
  priority: number
  roundingMinutes: number   // 0 = no rounding
  maxMinutesPerDay?: number | null
  isActive: boolean
  sortOrder: number
}

export interface TimeLogSurchargeInput {
  date: string       // YYYY-MM-DD
  clockIn: string    // HH:MM
  clockOut: string   // HH:MM (may be next day if < clockIn)
  totalMinutes: number
}

export interface RuleResult {
  ruleId: string
  ruleName: string
  rateType: SurchargeRateType
  rateValue: number
  minutes: number
  euros: number
}

export interface SurchargeBreakdown {
  byRule: RuleResult[]
  totalMinutes: number
}

export interface EmployeeSurchargeRow {
  employeeId: string
  employeeName: string
  byRule: RuleResult[]
  totalWorkedMinutes: number
}

// ── Utility ─────────────────────────────────────────────────────────────────

function hhmm(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

function overlapMinutes(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart))
}

// ── Core rule evaluator ──────────────────────────────────────────────────────

export function evaluateRule(
  rule: ConfiguredSurchargeRule,
  entry: TimeLogSurchargeInput,
  bundesland?: string,
  hourlyWage?: number,
): { minutes: number; euros: number } {
  const date = new Date(entry.date + 'T00:00:00')
  const dow = date.getDay()
  const isHoliday = isPublicHoliday(entry.date, bundesland)

  if (rule.daysOfWeek.length > 0 && !rule.daysOfWeek.includes(dow)) return { minutes: 0, euros: 0 }
  if (rule.includeHolidays && !isHoliday) return { minutes: 0, euros: 0 }
  if (rule.excludeHolidays && isHoliday) return { minutes: 0, euros: 0 }

  const shiftStart = hhmm(entry.clockIn)
  let shiftEnd = hhmm(entry.clockOut)
  if (shiftEnd <= shiftStart) shiftEnd += 24 * 60

  const workedMinutes = Math.min(
    entry.totalMinutes > 0 ? entry.totalMinutes : shiftEnd - shiftStart,
    shiftEnd - shiftStart,
  )

  let minutes = 0

  if (rule.rateType === 'fixed_per_shift') {
    // Fixed per shift: 1 unit if shift overlaps with time window (or always)
    if (rule.timeStart && rule.timeEnd) {
      const rStart = hhmm(rule.timeStart)
      let rEnd = hhmm(rule.timeEnd)
      if (rEnd <= rStart) rEnd += 24 * 60
      const hasOverlap =
        overlapMinutes(shiftStart, shiftEnd, rStart, rEnd) > 0 ||
        overlapMinutes(shiftStart, shiftEnd, rStart + 24 * 60, rEnd + 24 * 60) > 0
      minutes = hasOverlap ? workedMinutes : 0
    } else {
      minutes = workedMinutes
    }
  } else if (rule.timeStart && rule.timeEnd) {
    const rStart = hhmm(rule.timeStart)
    let rEnd = hhmm(rule.timeEnd)
    if (rEnd <= rStart) rEnd += 24 * 60

    // Main window overlap
    minutes = overlapMinutes(shiftStart, shiftEnd, rStart, rEnd)
    // Overnight window wrapping: e.g. if rule is 22:00–06:00, rEnd = 30*60
    // Shift might start early morning (00:00–06:00)
    minutes += overlapMinutes(shiftStart, shiftEnd, rStart - 24 * 60, rEnd - 24 * 60)
  } else {
    minutes = workedMinutes
  }

  if (rule.maxMinutesPerDay != null) minutes = Math.min(minutes, rule.maxMinutesPerDay)
  if (rule.roundingMinutes > 0 && minutes > 0) {
    minutes = Math.round(minutes / rule.roundingMinutes) * rule.roundingMinutes
  }
  minutes = Math.min(minutes, workedMinutes)

  let euros = 0
  if (minutes > 0) {
    if (rule.rateType === 'percent' && hourlyWage != null) {
      euros = (minutes / 60) * hourlyWage * (rule.rateValue / 100)
    } else if (rule.rateType === 'fixed_per_hour') {
      euros = (minutes / 60) * rule.rateValue
    } else if (rule.rateType === 'fixed_per_shift') {
      euros = rule.rateValue
    }
  }

  return { minutes, euros }
}

// ── Entry-level aggregation ─────────────────────────────────────────────────

export function computeWithRules(
  entry: TimeLogSurchargeInput,
  rules: ConfiguredSurchargeRule[],
  bundesland?: string,
  hourlyWage?: number,
): SurchargeBreakdown {
  const shiftStart = hhmm(entry.clockIn)
  let shiftEnd = hhmm(entry.clockOut)
  if (shiftEnd <= shiftStart) shiftEnd += 24 * 60
  const totalMinutes = Math.min(
    entry.totalMinutes > 0 ? entry.totalMinutes : shiftEnd - shiftStart,
    shiftEnd - shiftStart,
  )

  const active = rules.filter(r => r.isActive).sort((a, b) => a.sortOrder - b.sortOrder || a.priority - b.priority)
  const byRule: RuleResult[] = []

  for (const rule of active) {
    const { minutes, euros } = evaluateRule(rule, entry, bundesland, hourlyWage)
    if (minutes > 0 || euros > 0) {
      byRule.push({ ruleId: rule.id, ruleName: rule.name, rateType: rule.rateType, rateValue: rule.rateValue, minutes, euros })
    }
  }

  return { byRule, totalMinutes }
}

// ── Employee-level aggregation ───────────────────────────────────────────────

export function aggregateWithRules(
  logs: { employeeId: string; employeeName: string; entries: TimeLogSurchargeInput[] }[],
  rules: ConfiguredSurchargeRule[],
  bundesland?: string,
  wageByEmployee?: Record<string, number>,
  defaultWage?: number,
): EmployeeSurchargeRow[] {
  return logs.map(({ employeeId, employeeName, entries }) => {
    const wage = wageByEmployee?.[employeeId] ?? defaultWage
    const ruleMap = new Map<string, RuleResult>()
    let totalWorkedMinutes = 0

    for (const entry of entries) {
      if (!entry.clockIn || !entry.clockOut) continue
      const { byRule, totalMinutes } = computeWithRules(entry, rules, bundesland, wage)
      totalWorkedMinutes += totalMinutes
      for (const r of byRule) {
        const existing = ruleMap.get(r.ruleId)
        if (existing) {
          existing.minutes += r.minutes
          existing.euros += r.euros
        } else {
          ruleMap.set(r.ruleId, { ...r })
        }
      }
    }

    return { employeeId, employeeName, byRule: Array.from(ruleMap.values()), totalWorkedMinutes }
  })
}

// ── Default rules (§3b EStG, used when no rules configured) ─────────────────

export const DEFAULT_SURCHARGE_RULES: ConfiguredSurchargeRule[] = [
  {
    id: '_default_night', name: 'Nachtzuschlag', description: '22:00–06:00 Uhr (§3b EStG)',
    type: 'night', timeStart: '22:00', timeEnd: '06:00',
    daysOfWeek: [], includeHolidays: false, excludeHolidays: false,
    rateType: 'percent', rateValue: 25, priority: 0, roundingMinutes: 0, isActive: true, sortOrder: 0,
  },
  {
    id: '_default_saturday', name: 'Samstagszuschlag', description: 'Samstag ab 13:00 Uhr',
    type: 'saturday', timeStart: '13:00', timeEnd: '24:00',
    daysOfWeek: [6], includeHolidays: false, excludeHolidays: false,
    rateType: 'percent', rateValue: 20, priority: 1, roundingMinutes: 0, isActive: true, sortOrder: 1,
  },
  {
    id: '_default_sunday', name: 'Sonntagszuschlag', description: 'Ganzer Sonntag',
    type: 'sunday', daysOfWeek: [0], includeHolidays: false, excludeHolidays: true,
    rateType: 'percent', rateValue: 50, priority: 2, roundingMinutes: 0, isActive: true, sortOrder: 2,
  },
  {
    id: '_default_holiday', name: 'Feiertagszuschlag', description: 'Gesetzliche Feiertage nach Bundesland',
    type: 'holiday', daysOfWeek: [], includeHolidays: true, excludeHolidays: false,
    rateType: 'percent', rateValue: 100, priority: 3, roundingMinutes: 0, isActive: true, sortOrder: 3,
  },
]

// ── Legacy compat types (existing /api/surcharges route) ─────────────────────

export interface SurchargeRates {
  nightPercent: number
  saturdayPercent: number
  sundayPercent: number
  holidayPercent: number
}

export const DEFAULT_SURCHARGE_RATES: SurchargeRates = {
  nightPercent: 25,
  saturdayPercent: 20,
  sundayPercent: 50,
  holidayPercent: 100,
}

export interface EmployeeSurchargeRowLegacy {
  employeeId: string
  employeeName: string
  nightMinutes: number
  saturdayMinutes: number
  sundayMinutes: number
  holidayMinutes: number
  totalWorkedMinutes: number
}

// toLegacyRows maps new rule-based rows back to the 4-column legacy format
export function toLegacyRows(rows: EmployeeSurchargeRow[]): EmployeeSurchargeRowLegacy[] {
  return rows.map(row => {
    const sum = (keywords: string[]) =>
      row.byRule
        .filter(r => keywords.some(k => r.ruleName.toLowerCase().includes(k) || r.ruleId.includes(k)))
        .reduce((s, r) => s + r.minutes, 0)
    return {
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      nightMinutes: sum(['nacht', 'night']),
      saturdayMinutes: sum(['samstag', 'saturday']),
      sundayMinutes: sum(['sonntag', 'sunday']),
      holidayMinutes: sum(['feiertag', 'holiday']),
      totalWorkedMinutes: row.totalWorkedMinutes,
    }
  })
}

// aggregateSurcharges: legacy entrypoint, uses default rules
export function aggregateSurcharges(
  logs: { employeeId: string; employeeName: string; entries: TimeLogSurchargeInput[] }[],
  bundesland?: string,
): EmployeeSurchargeRowLegacy[] {
  return toLegacyRows(aggregateWithRules(logs, DEFAULT_SURCHARGE_RULES, bundesland))
}

export function minutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function formatEuros(amount: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)
}
