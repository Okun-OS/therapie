import { NextRequest, NextResponse } from 'next/server'
import { getAbsencesByLocation, getAbsencesByEmployee, listAllAbsences, addAbsence } from '@/lib/time-tracking-entities'
import { requireRole } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const locationId = req.nextUrl.searchParams.get('locationId')
  const employeeId = req.nextUrl.searchParams.get('employeeId')

  const absences = employeeId
    ? await getAbsencesByEmployee(employeeId)
    : locationId
    ? await getAbsencesByLocation(locationId)
    : await listAllAbsences()

  return NextResponse.json({ absences })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { employeeId, employeeName, locationId, type, startDate, endDate, days, note, proofProvided } = body
  if (!employeeId || !locationId || !type || !startDate || !endDate || typeof days !== 'number') {
    return NextResponse.json({ error: 'Erforderliche Felder fehlen' }, { status: 400 })
  }

  const absence = await addAbsence({ employeeId, employeeName, locationId, type, startDate, endDate, days, note, proofProvided: !!proofProvided })
  return NextResponse.json({ absence })
}
