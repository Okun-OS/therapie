import { NextRequest, NextResponse } from 'next/server'
import { getMonthlyClosingsByLocation, getMonthlyClosingsByEmployee } from '@/lib/time-tracking-entities'
import { requireRole } from '@/lib/session'
import { assertEmployeeAccess, locationFilter } from '@/lib/scope'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const locationId = req.nextUrl.searchParams.get('locationId')
  const employeeId = req.nextUrl.searchParams.get('employeeId')

  // §109 Vorher konnte jeder Angemeldete die Abschluesse jedes Standorts lesen.
  if (locationId) {
    const erlaubt = await locationFilter(session, locationId)
    if (erlaubt instanceof NextResponse) return erlaubt
  } else if (employeeId) {
    const verweigert = await assertEmployeeAccess(session, employeeId)
    if (verweigert) return verweigert
  }
  if (!locationId && !employeeId) {
    return NextResponse.json({ error: 'locationId oder employeeId ist erforderlich' }, { status: 400 })
  }

  const closings = locationId ? await getMonthlyClosingsByLocation(locationId) : await getMonthlyClosingsByEmployee(employeeId!)
  return NextResponse.json({ closings })
}
