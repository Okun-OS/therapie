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

/** Wochentagskürzel zu Nummer — dieselbe Abbildung wie im Rechendienst. */
const KUERZEL_ZU_TAG: Record<string, number> = {
  Mo: 1, Di: 2, Mi: 3, Do: 4, Fr: 5, Sa: 6, So: 0,
}

/**
 * §235 Die festen freien Tage eines Menschen, als Wochentagsnummern.
 *
 * Gelesen wird `fixedOffDays` — DAS Feld, nach dem auch der Dienstplan
 * gerechnet wird (`rule-model-service.ts` baut daraus die Nichtverfügbarkeit).
 *
 * WARUM NICHT MEHR `preferences.unavailableDays`
 * Es gab beide. `fixedOffDays` („Mo", „Di") plante, `preferences.unavailableDays`
 * (0–6) zählte den Urlaub — und gepflegt wurden sie an verschiedenen Stellen.
 * Wer unter „Dienstpräferenzen" Samstag und Sonntag abwählte, bekam einen
 * anders gezählten Urlaub, während der Dienstplan ihn weiter einplante.
 * Zwei Felder für „an diesem Wochentag bin ich nicht da", und nur eines davon
 * hat jemals geplant.
 *
 * Ältere Datensätze tragen `unavailableDays` noch; sie werden gelesen, solange
 * `fixedOffDays` leer ist. Ohne diesen Rückfall würde für sie über Nacht wieder
 * Montag bis Freitag gelten, und ein Urlaubsantrag bekäme eine andere Tagezahl
 * als gestern.
 */
function freieWochentage(
  employee?: Pick<Employee, 'preferences' | 'fixedOffDays'> | null,
): number[] | null {
  const fest = (employee?.fixedOffDays ?? [])
    .map(t => KUERZEL_ZU_TAG[t] ?? (Number.isFinite(Number(t)) ? Number(t) : undefined))
    .filter((n): n is number => n !== undefined)
  if (fest.length > 0) return fest

  const alt = employee?.preferences?.unavailableDays
  return alt && alt.length > 0 ? alt : null
}

/** Ein Tag gilt als Arbeitstag, wenn er kein gesetzlicher Feiertag (im
 * Bundesland des Standorts) ist und laut Arbeitsmodell des Mitarbeiters
 * (feste freie Wochentage) bzw. mangels Angabe per Default (Mo–Fr) ein
 * regulärer Arbeitstag ist. */
export function isWorkday(
  dateStr: string,
  employee?: Pick<Employee, 'preferences' | 'fixedOffDays'> | null,
  state?: string,
): boolean {
  const dow = new Date(dateStr + 'T00:00:00').getDay()
  const frei = freieWochentage(employee)
  const isFreeDay = frei ? frei.includes(dow) : dow === 0 || dow === 6
  if (isFreeDay) return false
  if (state && isPublicHoliday(dateStr, state)) return false
  return true
}

/** Anzahl tatsächlicher Arbeitstage (inkl. Start- und Enddatum) in einem
 * Zeitraum – das ist die korrekte Anzahl der vom Urlaubskonto abzuziehenden Tage. */
export function countWorkdays(
  start: string,
  end: string,
  employee?: Pick<Employee, 'preferences' | 'fixedOffDays'> | null,
  state?: string,
): number {
  return eachDate(start, end).filter(d => isWorkday(d, employee, state)).length
}
