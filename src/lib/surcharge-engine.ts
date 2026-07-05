/**
 * Zuschlags-Engine: computes surcharge-eligible minutes from TimeLogs.
 * No schema changes needed — derives everything from existing date/clockIn/clockOut fields.
 *
 * Surcharge categories (German standard):
 *  - Nacht (night):     22:00–06:00  — 25%
 *  - Samstag (Sat):     13:00–24:00  — 20%
 *  - Sonntag (Sun):     00:00–24:00  — 50%
 *  - Feiertag (holiday):00:00–24:00  — 100%
 *
 * Categories can overlap (e.g. a night shift on a Sunday is both Nacht + Sonntag).
 * The caller decides how to combine them for payroll.
 */

import { isPublicHoliday } from './holidays'

export interface SurchargeRates {
  nightPercent: number    // default 25
  saturdayPercent: number // default 20
  sundayPercent: number   // default 50
  holidayPercent: number  // default 100
}

export const DEFAULT_SURCHARGE_RATES: SurchargeRates = {
  nightPercent: 25,
  saturdayPercent: 20,
  sundayPercent: 50,
  holidayPercent: 100,
}

export interface TimeLogSurchargeInput {
  date: string       // YYYY-MM-DD
  clockIn: string    // HH:MM
  clockOut: string   // HH:MM (may be next day if < clockIn)
  totalMinutes: number
}

export interface SurchargeBreakdown {
  nightMinutes: number
  saturdayMinutes: number
  sundayMinutes: number
  holidayMinutes: number
  totalMinutes: number
}

function hhmm(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart))
}

/**
 * Computes surcharge-eligible minutes for a single time log entry.
 */
export function computeSurcharges(
  entry: TimeLogSurchargeInput,
  bundesland?: string,
): SurchargeBreakdown {
  const year = parseInt(entry.date.slice(0, 4))
  const monthIndex = parseInt(entry.date.slice(5, 7)) - 1
  const day = parseInt(entry.date.slice(8, 10))
  const date = new Date(year, monthIndex, day)
  const dow = date.getDay() // 0=Sun, 6=Sat

  const start = hhmm(entry.clockIn)
  let end = hhmm(entry.clockOut)
  if (end <= start) end += 24 * 60  // overnight shift

  const totalMinutes = Math.min(entry.totalMinutes, end - start)

  // Night: 22:00–06:00 (= [1320, 1440] same day + [1440, 1800] next day's 00:00–06:00)
  const nightMinutes =
    overlap(start, end, 1320, 1440) +   // 22:00–24:00 today
    overlap(start, end, 1440, 1800) +   // 00:00–06:00 next-day part of overnight shift
    overlap(start, end, 0, 360)         // 00:00–06:00 for early-morning shifts (start before 06:00)

  // Saturday: only afternoon part 13:00–24:00 (German standard: Samstagszuschlag ab 13h)
  const saturdayMinutes = dow === 6
    ? overlap(start, end, 780, 1440)    // 13:00–24:00
    : 0

  // Sunday: entire shift
  const sundayMinutes = dow === 0 ? totalMinutes : 0

  // Holiday: check if the shift date is a public holiday (takes priority over Sunday)
  const isHoliday = isPublicHoliday(entry.date, bundesland)
  const holidayMinutes = isHoliday ? totalMinutes : 0

  return {
    nightMinutes: Math.min(nightMinutes, totalMinutes),
    saturdayMinutes: Math.min(saturdayMinutes, totalMinutes),
    sundayMinutes,
    holidayMinutes,
    totalMinutes,
  }
}

export interface EmployeeSurchargeRow {
  employeeId: string
  employeeName: string
  nightMinutes: number
  saturdayMinutes: number
  sundayMinutes: number
  holidayMinutes: number
  totalWorkedMinutes: number
}

/**
 * Aggregates surcharge breakdowns for a list of employees' time logs.
 * @param logs  Array of { employeeId, employeeName, entries: TimeLogSurchargeInput[] }
 * @param bundesland  German state for holiday lookup
 */
export function aggregateSurcharges(
  logs: { employeeId: string; employeeName: string; entries: TimeLogSurchargeInput[] }[],
  bundesland?: string,
): EmployeeSurchargeRow[] {
  return logs.map(({ employeeId, employeeName, entries }) => {
    let nightMinutes = 0
    let saturdayMinutes = 0
    let sundayMinutes = 0
    let holidayMinutes = 0
    let totalWorkedMinutes = 0

    for (const entry of entries) {
      if (!entry.clockIn || !entry.clockOut) continue
      const s = computeSurcharges(entry, bundesland)
      nightMinutes += s.nightMinutes
      saturdayMinutes += s.saturdayMinutes
      sundayMinutes += s.sundayMinutes
      holidayMinutes += s.holidayMinutes
      totalWorkedMinutes += s.totalMinutes
    }

    return { employeeId, employeeName, nightMinutes, saturdayMinutes, sundayMinutes, holidayMinutes, totalWorkedMinutes }
  })
}

export function minutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}
