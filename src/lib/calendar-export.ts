import type { ScheduleEntry, Shift, Location, Employee } from './types'

// ─── iCal / .ics generation ──────────────────────────────────────────────────

function toICSDate(dateStr: string, timeStr: string): string {
  // dateStr: "2026-04-28", timeStr: "06:00"  → "20260428T060000"
  return dateStr.replace(/-/g, '') + 'T' + timeStr.replace(':', '') + '00'
}

function escapeICS(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export function generateICSContent(
  entries: ScheduleEntry[],
  shifts: Shift[],
  location: Location,
  employee: Employee,
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PlanMate//Dienstplan//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:PlanMate – ${escapeICS(location.name)}`,
    'X-WR-TIMEZONE:Europe/Berlin',
  ]

  for (const entry of entries) {
    const shift = shifts.find(s => s.id === entry.shiftId)
    if (!shift) continue

    const dtstart = toICSDate(entry.date, shift.startTime)
    const dtend = toICSDate(entry.date, shift.endTime)
    const uid = `planmate-${employee.id}-${entry.date}-${entry.shiftId}@planmate.app`
    const summary = `${shift.name} – ${location.name}`
    const description = `${shift.name} · ${shift.startTime}–${shift.endTime} Uhr\\nMitarbeiter: ${employee.name}\\nStandort: ${location.name}`

    lines.push(
      'BEGIN:VEVENT',
      `DTSTART;TZID=Europe/Berlin:${dtstart}`,
      `DTEND;TZID=Europe/Berlin:${dtend}`,
      `SUMMARY:${escapeICS(summary)}`,
      `DESCRIPTION:${escapeICS(description)}`,
      `LOCATION:${escapeICS(`${location.address}, ${location.city}`)}`,
      `UID:${uid}`,
      `STATUS:${entry.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE'}`,
      `CATEGORIES:DIENSTPLAN`,
      'BEGIN:VALARM',
      'TRIGGER:-PT60M',
      'ACTION:DISPLAY',
      `DESCRIPTION:In 1 Stunde: ${escapeICS(shift.name)}`,
      'END:VALARM',
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadICS(content: string, filename = 'dienstplan.ics'): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Single-event Google Calendar link ───────────────────────────────────────

export function googleCalendarLink(
  entry: ScheduleEntry,
  shift: Shift,
  location: Location,
): string {
  const dtstart = toICSDate(entry.date, shift.startTime)
  const dtend = toICSDate(entry.date, shift.endTime)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${shift.name} – ${location.name}`,
    dates: `${dtstart}/${dtend}`,
    details: `${shift.name} · ${shift.startTime}–${shift.endTime} Uhr\nStandort: ${location.name}`,
    location: `${location.address}, ${location.city}`,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

// ─── Apple Calendar (webcal link using same ics blob) ────────────────────────

export function appleCalendarDownload(
  entries: ScheduleEntry[],
  shifts: Shift[],
  location: Location,
  employee: Employee,
): void {
  const content = generateICSContent(entries, shifts, location, employee)
  downloadICS(content, `dienstplan-${employee.name.replace(/\s+/g, '-').toLowerCase()}.ics`)
}
