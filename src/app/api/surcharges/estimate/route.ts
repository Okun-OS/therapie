import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId, resolveLocationId } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { computeWithRules, DEFAULT_SURCHARGE_RULES } from '@/lib/surcharge-engine'
import type { ConfiguredSurchargeRule, TimeLogSurchargeInput } from '@/lib/surcharge-engine'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'customerId fehlt' }, { status: 400 })

  const locationId = await resolveLocationId(session)
  if (!locationId) return NextResponse.json({ error: 'locationId fehlt' }, { status: 400 })

  // Body: array of { employeeId, employeeName, date, shiftId }
  const { entries } = await req.json() as {
    entries: { employeeId: string; employeeName: string; date: string; shiftId: string }[]
  }

  if (!entries?.length) return NextResponse.json({ rows: [] })

  const [location, ruleSet, shifts] = await Promise.all([
    prisma.location.findUnique({ where: { id: locationId }, select: { bundesland: true } }),
    prisma.surchargeRuleSet.findFirst({
      where: { customerId, locationId },
      include: { rules: { orderBy: { sortOrder: 'asc' } }, wageConfigs: true },
    }),
    prisma.shift.findMany({ where: { locationId } }),
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

  const shiftMap = new Map(shifts.map(s => [s.id, s]))

  // Aggregate per employee
  const byEmp = new Map<string, { employeeName: string; totalMinutes: number; totalEuros: number; ruleNames: string[] }>()

  for (const entry of entries) {
    const shift = shiftMap.get(entry.shiftId)
    if (!shift) continue

    const clockIn = shift.startTime
    const clockOut = shift.endTime
    const startM = parseInt(clockIn.split(':')[0]) * 60 + parseInt(clockIn.split(':')[1])
    let endM = parseInt(clockOut.split(':')[0]) * 60 + parseInt(clockOut.split(':')[1])
    if (endM <= startM) endM += 24 * 60
    const totalMinutes = endM - startM

    const input: TimeLogSurchargeInput = { date: entry.date, clockIn, clockOut, totalMinutes }
    const wage = wageByEmployee[entry.employeeId] ?? defaultWage
    const breakdown = computeWithRules(input, rules, bundesland, wage)

    const existing = byEmp.get(entry.employeeId)
    if (existing) {
      existing.totalMinutes += breakdown.totalMinutes
      existing.totalEuros += breakdown.byRule.reduce((s, r) => s + r.euros, 0)
      for (const r of breakdown.byRule) {
        if (!existing.ruleNames.includes(r.ruleName)) existing.ruleNames.push(r.ruleName)
      }
    } else {
      byEmp.set(entry.employeeId, {
        employeeName: entry.employeeName,
        totalMinutes: breakdown.totalMinutes,
        totalEuros: breakdown.byRule.reduce((s, r) => s + r.euros, 0),
        ruleNames: breakdown.byRule.map(r => r.ruleName),
      })
    }
  }

  const rows = Array.from(byEmp.entries()).map(([employeeId, data]) => ({
    employeeId,
    ...data,
  }))
  rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'de'))

  return NextResponse.json({ rows, usingDefaults: (ruleSet?.rules ?? []).length === 0 })
}
