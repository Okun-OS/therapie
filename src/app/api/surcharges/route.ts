import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId, resolveLocationId } from '@/lib/session'
import { aggregateWithRules, DEFAULT_SURCHARGE_RULES } from '@/lib/surcharge-engine'
import type { ConfiguredSurchargeRule } from '@/lib/surcharge-engine'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const yearParam = req.nextUrl.searchParams.get('year')
  const monthParam = req.nextUrl.searchParams.get('month')
  const locationIdParam = req.nextUrl.searchParams.get('locationId')

  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear()
  const month = monthParam ? parseInt(monthParam) : new Date().getMonth() + 1

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'customerId fehlt' }, { status: 400 })

  const locationId = locationIdParam ?? (await resolveLocationId(session))
  if (!locationId) {
    return NextResponse.json({ error: 'locationId nicht gefunden' }, { status: 400 })
  }

  const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`
  const dateTo = `${year}-${String(month).padStart(2, '0')}-31`

  const [location, ruleSet] = await Promise.all([
    prisma.location.findUnique({ where: { id: locationId }, select: { bundesland: true } }),
    prisma.surchargeRuleSet.findFirst({
      where: { customerId, locationId: locationId ?? null },
      include: { rules: { orderBy: { sortOrder: 'asc' } }, wageConfigs: true },
    }),
  ])

  const bundesland = location?.bundesland ?? undefined

  const rules: ConfiguredSurchargeRule[] = (ruleSet?.rules ?? []).length > 0
    ? (ruleSet!.rules as unknown as ConfiguredSurchargeRule[])
    : DEFAULT_SURCHARGE_RULES

  const wageByEmployee: Record<string, number> = {}
  for (const wc of ruleSet?.wageConfigs ?? []) {
    if (wc.employeeId) wageByEmployee[wc.employeeId] = wc.hourlyWage
  }
  const defaultWage = ruleSet?.defaultHourlyWage ?? undefined

  const logs = await prisma.timeLog.findMany({
    where: { locationId, date: { gte: dateFrom, lte: dateTo }, clockOut: { not: null } },
    orderBy: { date: 'asc' },
  })

  const employeeIds = Array.from(new Set(logs.map(l => l.employeeId)))
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true, name: true },
  })
  const empMap = Object.fromEntries(employees.map(e => [e.id, e.name]))

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

  const rows = aggregateWithRules(
    Array.from(byEmployee.values()),
    rules,
    bundesland,
    wageByEmployee,
    defaultWage,
  )
  rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'de'))

  return NextResponse.json({
    rows,
    ruleSet: ruleSet ?? null,
    usingDefaults: (ruleSet?.rules ?? []).length === 0,
    year,
    month,
    locationId,
    bundesland,
  })
}
