// Gesetzliche Feiertage in Deutschland je Bundesland – berechnet (nicht als
// Tabelle gepflegt), damit jedes beliebige Jahr ohne Datenpflege funktioniert.
// Bewegliche Feiertage basieren auf dem Gauß'schen Osterformel-Algorithmus.

export const GERMAN_STATES = [
  'Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg', 'Hessen',
  'Mecklenburg-Vorpommern', 'Niedersachsen', 'Nordrhein-Westfalen', 'Rheinland-Pfalz',
  'Saarland', 'Sachsen', 'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen',
] as const

export interface PublicHoliday {
  name: string
  date: string // ISO YYYY-MM-DD
}

function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function plusDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function fmt(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const cache = new Map<string, PublicHoliday[]>()

/** Liefert alle gesetzlichen Feiertage eines Jahres für ein Bundesland.
 * Unbekannte/leere state-Werte liefern nur die bundesweit einheitlichen Feiertage. */
export function getPublicHolidays(year: number, state?: string): PublicHoliday[] {
  const key = `${year}|${state ?? ''}`
  const cached = cache.get(key)
  if (cached) return cached

  const easter = easterSunday(year)
  const holidays: PublicHoliday[] = [
    { name: 'Neujahr', date: `${year}-01-01` },
    { name: 'Karfreitag', date: fmt(plusDays(easter, -2)) },
    { name: 'Ostermontag', date: fmt(plusDays(easter, 1)) },
    { name: 'Tag der Arbeit', date: `${year}-05-01` },
    { name: 'Christi Himmelfahrt', date: fmt(plusDays(easter, 39)) },
    { name: 'Pfingstmontag', date: fmt(plusDays(easter, 50)) },
    { name: 'Tag der Deutschen Einheit', date: `${year}-10-03` },
    { name: '1. Weihnachtstag', date: `${year}-12-25` },
    { name: '2. Weihnachtstag', date: `${year}-12-26` },
  ]

  const has = (states: string[]) => !!state && states.includes(state)

  if (has(['Baden-Württemberg', 'Bayern', 'Sachsen-Anhalt'])) {
    holidays.push({ name: 'Heilige Drei Könige', date: `${year}-01-06` })
  }
  if (has(['Berlin', 'Mecklenburg-Vorpommern'])) {
    holidays.push({ name: 'Internationaler Frauentag', date: `${year}-03-08` })
  }
  if (has(['Baden-Württemberg', 'Bayern', 'Hessen', 'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland'])) {
    holidays.push({ name: 'Fronleichnam', date: fmt(plusDays(easter, 60)) })
  }
  if (has(['Saarland'])) {
    holidays.push({ name: 'Mariä Himmelfahrt', date: `${year}-08-15` })
  }
  if (has(['Brandenburg', 'Bremen', 'Hamburg', 'Mecklenburg-Vorpommern', 'Niedersachsen', 'Sachsen', 'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen'])) {
    holidays.push({ name: 'Reformationstag', date: `${year}-10-31` })
  }
  if (has(['Thüringen'])) {
    holidays.push({ name: 'Weltkindertag', date: `${year}-09-20` })
  }
  if (has(['Sachsen'])) {
    // Buß- und Bettag: Mittwoch vor dem 23. November
    const nov23 = new Date(year, 10, 23)
    const dow = nov23.getDay()
    const diff = dow >= 3 ? dow - 3 : dow + 4
    holidays.push({ name: 'Buß- und Bettag', date: fmt(plusDays(nov23, -diff)) })
  }

  holidays.sort((a, b) => a.date.localeCompare(b.date))
  cache.set(key, holidays)
  return holidays
}

export function isPublicHoliday(dateStr: string, state?: string): boolean {
  const year = parseInt(dateStr.slice(0, 4), 10)
  if (!Number.isFinite(year)) return false
  return getPublicHolidays(year, state).some(h => h.date === dateStr)
}

export function getPublicHolidayName(dateStr: string, state?: string): string | undefined {
  const year = parseInt(dateStr.slice(0, 4), 10)
  if (!Number.isFinite(year)) return undefined
  return getPublicHolidays(year, state).find(h => h.date === dateStr)?.name
}
