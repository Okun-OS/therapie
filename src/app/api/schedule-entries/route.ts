import { NextRequest, NextResponse } from 'next/server'
import {
  getScheduleByEmployee,
  getScheduleByLocationAndWeek,
  getAllEntriesForLocation,
} from '@/lib/schedule-entities'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'
import { locationFilter, assertEmployeeAccess } from '@/lib/scope'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const employeeId = req.nextUrl.searchParams.get('employeeId')
  const locationId = req.nextUrl.searchParams.get('locationId')
  const weekStart = req.nextUrl.searchParams.get('weekStart')
  const dateFrom = req.nextUrl.searchParams.get('dateFrom')
  const dateTo = req.nextUrl.searchParams.get('dateTo')

  // §81 scope guard — never return foreign locations' data
  if (employeeId) {
    const denied = await assertEmployeeAccess(session, employeeId)
    if (denied) return denied
    return NextResponse.json({ entries: await getScheduleByEmployee(employeeId) })
  }

  const allowed = await locationFilter(session, locationId)
  if (allowed instanceof NextResponse) return allowed

  if (locationId && dateFrom && dateTo) {
    const rows = await prisma.scheduleEntry.findMany({
      where: { locationId, date: { gte: dateFrom, lte: dateTo } },
      orderBy: [{ date: 'asc' }, { employeeId: 'asc' }],
    })
    return NextResponse.json({ entries: rows })
  }

  if (locationId) {
    const entries = weekStart
      ? await getScheduleByLocationAndWeek(locationId, weekStart)
      : await getAllEntriesForLocation(locationId)
    return NextResponse.json({ entries })
  }

  const rows = await prisma.scheduleEntry.findMany({
    where: allowed ? { locationId: { in: allowed } } : {},
    orderBy: [{ date: 'asc' }, { employeeId: 'asc' }],
  })
  return NextResponse.json({ entries: rows })
}
