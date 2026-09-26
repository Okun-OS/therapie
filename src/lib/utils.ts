import { clsx } from 'clsx'

export function cn(...inputs: (string | boolean | undefined | null | Record<string, boolean>)[]) {
  return clsx(inputs)
}

export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m > 0 ? `${m}min` : ''}`.trim()
}

export function formatHours(minutes: number): string {
  const h = (minutes / 60).toFixed(1)
  return `${h}h`
}

export function getWeekDays(date: Date): Date[] {
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(date)
  monday.setDate(diff)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

export function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getWeeksInRange(start: Date, end: Date): Date[][] {
  const weeks: Date[][] = []
  let cursor = new Date(start)
  while (cursor <= end) {
    weeks.push(getWeekDays(cursor))
    cursor.setDate(cursor.getDate() + 7)
  }
  return weeks
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

export function getDayName(dateStr: string, short = false): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('de-DE', { weekday: short ? 'short' : 'long' })
}

export function isToday(dateStr: string): boolean {
  return dateStr === toDateString(new Date())
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toDateString(d)
}

export function diffDays(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

export function formatRelativeTime(date: Date): string {
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000)
  if (diffMin < 1) return 'jetzt'
  if (diffMin < 60) return `vor ${diffMin} Min.`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `vor ${diffH} Std.`
  const diffD = Math.floor(diffH / 24)
  if (diffD === 1) return 'gestern'
  if (diffD < 7) return `vor ${diffD} Tagen`
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'approved': return 'text-green-700 bg-green-100'
    case 'denied': return 'text-red-700 bg-red-100'
    case 'pending': return 'text-yellow-700 bg-yellow-100'
    default: return 'text-gray-700 bg-gray-100'
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'approved': return 'Genehmigt'
    case 'denied': return 'Abgelehnt'
    case 'pending': return 'Ausstehend'
    case 'planned': return 'Geplant'
    case 'confirmed': return 'Bestätigt'
    default: return status
  }
}

// Defensive net in case AI output still slips raw developer tokens into
// admin-facing text despite the prompt instructions forbidding it.
const AI_TEXT_REPLACEMENTS: [RegExp, string][] = [
  [/\bearlyDebt\b/gi, 'Frühdienst-Verteilung'],
  [/\blateDebt\b/gi, 'Spätdienst-Verteilung'],
  [/\bmidDebt\b/gi, 'Mitteldienst-Verteilung'],
  [/\bfridayLateCnt\b/gi, 'Anzahl Freitag-Spätdienste'],
  [/\bmondayEarlyCnt\b/gi, 'Anzahl Montag-Frühdienste'],
  [/\bfairnessScore\b/gi, 'Fairness-Punktzahl'],
  [/\bhasChildren\s*[=:]?\s*(true|false)?\b/gi, 'hat schulpflichtige Kinder'],
  [/\bpriority[\s-=:]*(high|medium|low)?\b/gi, 'Priorität'],
  [/\bremainingDays\b/gi, 'Resturlaub'],
  [/\bemp\d+\b/gi, 'der Mitarbeiter'],
]

export function sanitizeAiText(text: string): string {
  return AI_TEXT_REPLACEMENTS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text)
}
