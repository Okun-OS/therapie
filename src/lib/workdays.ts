// Zählt tatsächliche Arbeitstage statt reiner Kalendertage – Grundlage für
// korrekte Urlaubsberechnung (Wochenenden/Feiertage/freie Tage laut
// Arbeitsmodell dürfen nicht vom Urlaubskonto abgezogen werden).
import { isPublicHoliday } from './holidays'
import type { Employee } from './types'

function eachDate(start: string, end: string): string[] {
  const dates: string[] = []
  const cursor = new Date(start + 'T00:00:00')
  const last = new Date(end + 'T00:00:00')
  while (cursor <= last) {
    const y = cursor.getFullYear()
    const m = String(cursor.getMonth() + 1).padStart(2, '0')
    const d = String(cursor.getDate()).padStart(2, '0')
    dates.push(`${y}-${m}-${d}`)
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

/** Ein Tag gilt als Arbeitstag, wenn er kein gesetzlicher Feiertag (im
 * Bundesland des Standorts) ist und laut Arbeitsmodell des Mitarbeiters
 * (EmployeePreferences.unavailableDays) bzw. mangels Angabe per Default
 * (Mo–Fr) ein regulärer Arbeitstag ist. */
export function isWorkday(dateStr: string, employee?: Pick<Employee, 'preferences'> | null, state?: string): boolean {
  const dow = new Date(dateStr + 'T00:00:00').getDay()
  const unavailableDays = employee?.preferences?.unavailableDays
  const isFreeDay = unavailableDays && unavailableDays.length > 0
    ? unavailableDays.includes(dow)
    : dow === 0 || dow === 6
  if (isFreeDay) return false
  if (state && isPublicHoliday(dateStr, state)) return false
  return true
}

/** Anzahl tatsächlicher Arbeitstage (inkl. Start- und Enddatum) in einem
 * Zeitraum – das ist die korrekte Anzahl der vom Urlaubskonto abzuziehenden Tage. */
export function countWorkdays(start: string, end: string, employee?: Pick<Employee, 'preferences'> | null, state?: string): number {
  return eachDate(start, end).filter(d => isWorkday(d, employee, state)).length
}
