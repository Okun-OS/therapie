import { NextRequest, NextResponse } from 'next/server'
import { getOvertimeRequestsByLocation, getOvertimeRequestsByEmployee, addOvertimeRequest } from '@/lib/time-tracking-entities'
import { requireRole } from '@/lib/session'
import { assertEmployeeAccess, locationFilter } from '@/lib/scope'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const locationId = req.nextUrl.searchParams.get('locationId')
  const employeeId = req.nextUrl.searchParams.get('employeeId')
  if (!locationId && !employeeId) {
    return NextResponse.json({ error: 'locationId oder employeeId ist erforderlich' }, { status: 400 })
  }

  // §109 Zugriffsschutz — vorher konnte jeder Angemeldete die Antraege jedes
  // beliebigen Standorts oder jeder beliebigen Person abrufen.
  if (locationId) {
    const erlaubt = await locationFilter(session, locationId)
    if (erlaubt instanceof NextResponse) return erlaubt
  } else {
    const verweigert = await assertEmployeeAccess(session, employeeId!)
    if (verweigert) return verweigert
  }

  const requests = locationId ? await getOvertimeRequestsByLocation(locationId) : await getOvertimeRequestsByEmployee(employeeId!)
  return NextResponse.json({ requests })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { employeeId, employeeName, locationId, date, timeLogId, overtimeMinutes, reason, comment } = body
  if (!employeeId || !locationId || !date || !timeLogId || typeof overtimeMinutes !== 'number' || !reason) {
    return NextResponse.json({ error: 'Erforderliche Felder fehlen' }, { status: 400 })
  }

  // §109: Ein Antrag konnte auf fremden Namen gestellt werden.
  const verweigert = await assertEmployeeAccess(session, employeeId)
  if (verweigert) return verweigert

  const request = await addOvertimeRequest({ employeeId, employeeName, locationId, date, timeLogId, overtimeMinutes, reason, comment })
  return NextResponse.json({ request })
}
