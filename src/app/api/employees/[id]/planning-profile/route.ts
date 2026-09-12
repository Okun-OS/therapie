import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session
  const profile = await prisma.employeePlanningProfile.findUnique({ where: { employeeId: params.id } })
  return NextResponse.json({ profile })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session
  const body = await req.json()
  const { shiftPreference, childPickupTimes, maxConsecutiveDays, weekendRule, planningNote, surchargeMode, surchargeOverrides } = body
  const profile = await prisma.employeePlanningProfile.upsert({
    where: { employeeId: params.id },
    create: {
      employeeId: params.id,
      shiftPreference: shiftPreference ?? 'keine',
      childPickupTimes: childPickupTimes ?? [],
      maxConsecutiveDays: maxConsecutiveDays ?? 0,
      weekendRule: weekendRule ?? null,
      planningNote: planningNote ?? null,
      surchargeMode: surchargeMode ?? 'unternehmensregel',
      surchargeOverrides: surchargeOverrides ?? null,
    },
    update: {
      shiftPreference: shiftPreference ?? 'keine',
      childPickupTimes: childPickupTimes ?? [],
      maxConsecutiveDays: maxConsecutiveDays ?? 0,
      weekendRule: weekendRule ?? null,
      planningNote: planningNote ?? null,
      surchargeMode: surchargeMode ?? 'unternehmensregel',
      surchargeOverrides: surchargeOverrides ?? null,
    },
  })
  return NextResponse.json({ profile })
}
