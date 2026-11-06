import { NextRequest, NextResponse } from 'next/server'
import { getTimeLogsByEmployee, getTimeLogsByMonth, addTimeLog } from '@/lib/time-tracking-entities'
import { requireRole } from '@/lib/session'
import { allowedLocationScope, assertEmployeeAccess } from '@/lib/scope'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const employeeId = req.nextUrl.searchParams.get('employeeId')
  const year = req.nextUrl.searchParams.get('year')
  const month = req.nextUrl.searchParams.get('month')

  // §81 scope guard
  if (employeeId) {
    const denied = await assertEmployeeAccess(session, employeeId)
    if (denied) return denied
    const logs = year && month
      ? await getTimeLogsByMonth(employeeId, Number(year), Number(month))
      : await getTimeLogsByEmployee(employeeId)
    return NextResponse.json({ logs })
  }
  const scope = await allowedLocationScope(session)
  const logs = await prisma.timeLog.findMany({
    where: scope.kind === 'all' ? {} : { locationId: { in: scope.ids } },
  })
  return NextResponse.json({ logs })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const { employeeId, date, clockIn, locationId } = await req.json()
  if (!employeeId || !date || !clockIn || !locationId) {
    return NextResponse.json({ error: 'employeeId, date, clockIn und locationId sind erforderlich' }, { status: 400 })
  }

  const log = await addTimeLog({ employeeId, date, clockIn, locationId })
  return NextResponse.json({ log })
}
