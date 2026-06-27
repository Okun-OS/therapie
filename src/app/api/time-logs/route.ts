import { NextRequest, NextResponse } from 'next/server'
import { getTimeLogsByEmployee, getTimeLogsByMonth, listAllTimeLogs, addTimeLog } from '@/lib/time-tracking-entities'
import { requireRole } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const employeeId = req.nextUrl.searchParams.get('employeeId')
  const year = req.nextUrl.searchParams.get('year')
  const month = req.nextUrl.searchParams.get('month')

  const logs = employeeId && year && month
    ? await getTimeLogsByMonth(employeeId, Number(year), Number(month))
    : employeeId
    ? await getTimeLogsByEmployee(employeeId)
    : await listAllTimeLogs()

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
