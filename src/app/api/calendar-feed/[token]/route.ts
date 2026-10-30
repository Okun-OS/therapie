import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getScheduleByEmployee, listShiftsByLocation } from '@/lib/schedule-entities'
import { getEmployeeById, getLocationById } from '@/lib/entities'
import { generateICSContent } from '@/lib/calendar-export'

// Öffentlicher, token-basierter ICS-Feed: der Mitarbeiter abonniert diese URL
// einmalig in Google/Apple Kalender ("webcal://..."). Da jede Anfrage den Feed
// live aus dem aktuellen Dienstplan generiert, hält der Kalender-Anbieter den
// Plan automatisch aktuell, ohne dass eine erneute manuelle Übernahme nötig ist.
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const sync = await prisma.employeeCalendarSync.findUnique({ where: { token: params.token } })
  if (!sync || !sync.enabled) {
    return NextResponse.json({ error: 'Feed nicht gefunden oder deaktiviert' }, { status: 404 })
  }

  const employee = await getEmployeeById(sync.employeeId)
  const location = employee?.locationId ? await getLocationById(employee.locationId) : undefined
  if (!employee || !location) {
    return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 })
  }

  const entries = await getScheduleByEmployee(employee.id)
  const entryLocationIds = Array.from(new Set(entries.map(e => e.locationId)))
  const shifts = (await Promise.all(entryLocationIds.map(id => listShiftsByLocation(id)))).flat()
  const content = generateICSContent(entries, shifts, location, employee)

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="dienstplan.ics"',
      'Cache-Control': 'no-store',
    },
  })
}
