import { NextRequest, NextResponse } from 'next/server'
import { getMonthlyClosingsByLocation, getMonthlyClosingsByEmployee } from '@/lib/time-tracking-entities'
import { requireRole } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const locationId = req.nextUrl.searchParams.get('locationId')
  const employeeId = req.nextUrl.searchParams.get('employeeId')
  if (!locationId && !employeeId) {
    return NextResponse.json({ error: 'locationId oder employeeId ist erforderlich' }, { status: 400 })
  }

  const closings = locationId ? await getMonthlyClosingsByLocation(locationId) : await getMonthlyClosingsByEmployee(employeeId!)
  return NextResponse.json({ closings })
}
