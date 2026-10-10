import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId, resolveLocationId } from '@/lib/session'
import type { ConfiguredSurchargeRule } from '@/lib/surcharge-engine'

export const dynamic = 'force-dynamic'

// GET /api/surcharge-rules — load rule set + rules for this location
export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'customerId fehlt' }, { status: 400 })

  const locationId = await resolveLocationId(session)

  const ruleSet = await prisma.surchargeRuleSet.findFirst({
    where: { customerId, locationId: locationId ?? null },
    include: { rules: { orderBy: { sortOrder: 'asc' } }, wageConfigs: true },
  })

  return NextResponse.json({ ruleSet: ruleSet ?? null })
}

// POST /api/surcharge-rules — upsert rule set + replace rules
export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'customerId fehlt' }, { status: 400 })

  const locationId = await resolveLocationId(session)

  const body = await req.json() as {
    name?: string
    defaultHourlyWage?: number | null
    onboardingCompleted?: boolean
    onboardingMessages?: unknown
    rules?: Omit<ConfiguredSurchargeRule, 'id'>[]
    wageConfigs?: { employeeId?: string | null; hourlyWage: number; validFrom: string; validTo?: string | null }[]
  }

  const existing = await prisma.surchargeRuleSet.findFirst({
    where: { customerId, locationId: locationId ?? null },
    select: { id: true },
  })

  let ruleSetId: string

  if (existing) {
    ruleSetId = existing.id
    await prisma.surchargeRuleSet.update({
      where: { id: ruleSetId },
      data: {
        name: body.name ?? undefined,
        defaultHourlyWage: body.defaultHourlyWage !== undefined ? body.defaultHourlyWage : undefined,
        onboardingCompleted: body.onboardingCompleted ?? undefined,
        onboardingMessages: body.onboardingMessages !== undefined ? (body.onboardingMessages as object) : undefined,
      },
    })
  } else {
    const created = await prisma.surchargeRuleSet.create({
      data: {
        customerId,
        locationId: locationId ?? null,
        name: body.name ?? 'Zuschlagsregelwerk',
        defaultHourlyWage: body.defaultHourlyWage ?? null,
        onboardingCompleted: body.onboardingCompleted ?? false,
        onboardingMessages: body.onboardingMessages as object ?? null,
      },
    })
    ruleSetId = created.id
  }

  // Replace rules if provided
  if (body.rules !== undefined) {
    await prisma.surchargeRule.deleteMany({ where: { ruleSetId } })
    if (body.rules.length > 0) {
      await prisma.surchargeRule.createMany({
        data: body.rules.map((r, i) => ({
          ruleSetId,
          name: r.name,
          description: r.description ?? null,
          type: r.type,
          timeStart: r.timeStart ?? null,
          timeEnd: r.timeEnd ?? null,
          daysOfWeek: r.daysOfWeek,
          includeHolidays: r.includeHolidays,
          excludeHolidays: r.excludeHolidays,
          rateType: r.rateType,
          rateValue: r.rateValue,
          priority: r.priority,
          roundingMinutes: r.roundingMinutes,
          maxMinutesPerDay: r.maxMinutesPerDay ?? null,
          isActive: r.isActive,
          sortOrder: r.sortOrder ?? i,
        })),
      })
    }
  }

  // Replace wage configs if provided
  if (body.wageConfigs !== undefined) {
    await prisma.surchargeWageConfig.deleteMany({ where: { ruleSetId } })
    if (body.wageConfigs.length > 0) {
      await prisma.surchargeWageConfig.createMany({
        data: body.wageConfigs.map(w => ({
          ruleSetId,
          employeeId: w.employeeId ?? null,
          hourlyWage: w.hourlyWage,
          validFrom: w.validFrom,
          validTo: w.validTo ?? null,
        })),
      })
    }
  }

  const updated = await prisma.surchargeRuleSet.findUnique({
    where: { id: ruleSetId },
    include: { rules: { orderBy: { sortOrder: 'asc' } }, wageConfigs: true },
  })

  return NextResponse.json({ ruleSet: updated })
}

// DELETE /api/surcharge-rules?ruleId=xxx — delete a single rule
export async function DELETE(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const ruleId = req.nextUrl.searchParams.get('ruleId')
  if (!ruleId) return NextResponse.json({ error: 'ruleId fehlt' }, { status: 400 })

  await prisma.surchargeRule.delete({ where: { id: ruleId } })
  return NextResponse.json({ ok: true })
}
