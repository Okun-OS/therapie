import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveLocationId } from '@/lib/session'
import { aggregateSurcharges } from '@/lib/surcharge-engine'

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const yearParam = req.nextUrl.searchParams.get('year')
  const monthParam = req.nextUrl.searchParams.get('month')
  const locationIdParam = req.nextUrl.searchParams.get('locationId')

  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear()
  const month = monthParam ? parseInt(monthParam) : new Date().getMonth() + 1

  const locationId = locationIdParam ?? (await resolveLocationId(session))
  if (!locationId) {
    return NextResponse.json({ error: 'locationId nicht gefunden' }, { status: 400 })
  }

  const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`
  const dateTo = `${year}-${String(month).padStart(2, '0')}-31`

  // Fetch location for bundesland
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: { bundesland: true },
  })
  const bundesland = location?.bundesland ?? undefined

  // Fetch all time logs for this location + month
  const logs = await prisma.timeLog.findMany({
    where: {
      locationId,
      date: { gte: dateFrom, lte: dateTo },
      clockOut: { not: null },
    },
    orderBy: { date: 'asc' },
  })

  // Fetch employees to get names
  const employeeIds = Array.from(new Set(logs.map(l => l.employeeId)))
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true, name: true },
  })
  const empMap = Object.fromEntries(employees.map(e => [e.id, e.name]))

  // Group by employee
  const byEmployee = new Map<string, { employeeId: string; employeeName: string; entries: { date: string; clockIn: string; clockOut: string; totalMinutes: number }[] }>()
  for (const log of logs) {
    if (!log.clockOut) continue
    if (!byEmployee.has(log.employeeId)) {
      byEmployee.set(log.employeeId, {
        employeeId: log.employeeId,
        employeeName: empMap[log.employeeId] ?? log.employeeId,
        entries: [],
      })
    }
    byEmployee.get(log.employeeId)!.entries.push({
      date: log.date,
      clockIn: log.clockIn,
      clockOut: log.clockOut!,
      totalMinutes: log.totalMinutes ?? 0,
    })
  }

  const rows = aggregateSurcharges(Array.from(byEmployee.values()), bundesland)
  rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'de'))

  return NextResponse.json({ rows, year, month, locationId, bundesland })
}
