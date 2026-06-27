import { NextRequest, NextResponse } from 'next/server'
import {
  getScheduleByEmployee,
  getScheduleByLocationAndWeek,
  getAllEntriesForLocation,
  listAllScheduleEntries,
} from '@/lib/schedule-entities'
import { requireRole } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const employeeId = req.nextUrl.searchParams.get('employeeId')
  const locationId = req.nextUrl.searchParams.get('locationId')
  const weekStart = req.nextUrl.searchParams.get('weekStart')

  const entries = employeeId
    ? await getScheduleByEmployee(employeeId)
    : locationId && weekStart
    ? await getScheduleByLocationAndWeek(locationId, weekStart)
    : locationId
    ? await getAllEntriesForLocation(locationId)
    : await listAllScheduleEntries()

  return NextResponse.json({ entries })
}
