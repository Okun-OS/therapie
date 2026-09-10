import { NextRequest, NextResponse } from 'next/server'
import { getAbsencesByLocation, getAbsencesByEmployee, addAbsence } from '@/lib/time-tracking-entities'
import { requireRole } from '@/lib/session'
import { locationFilter, assertEmployeeAccess } from '@/lib/scope'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const locationId = req.nextUrl.searchParams.get('locationId')
  const employeeId = req.nextUrl.searchParams.get('employeeId')

  // §81 scope guard
  if (employeeId) {
    const denied = await assertEmployeeAccess(session, employeeId)
    if (denied) return denied
    return NextResponse.json({ absences: await getAbsencesByEmployee(employeeId) })
  }
  const allowed = await locationFilter(session, locationId)
  if (allowed instanceof NextResponse) return allowed
  if (locationId) {
    return NextResponse.json({ absences: await getAbsencesByLocation(locationId) })
  }
  const rows = await prisma.absence.findMany({
    where: allowed ? { locationId: { in: allowed } } : {},
  })
  return NextResponse.json({ absences: rows })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { employeeId, employeeName, locationId, type, startDate, endDate, days, note, proofProvided } = body
  if (!employeeId || !locationId || !type || !startDate || !endDate || typeof days !== 'number') {
    return NextResponse.json({ error: 'Erforderliche Felder fehlen' }, { status: 400 })
  }

  // §110: Die Zugriffspruefung stand nur im GET. Ein Mitarbeiter konnte damit
  // eine Krankmeldung auf den Namen einer Kollegin erfassen.
  const zugriffVerweigert = await assertEmployeeAccess(session, employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  const absence = await addAbsence({ employeeId, employeeName, locationId, type, startDate, endDate, days, note, proofProvided: !!proofProvided })
  return NextResponse.json({ absence })
}
