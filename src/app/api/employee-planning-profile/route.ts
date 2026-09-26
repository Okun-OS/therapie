import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { prisma } from '@/lib/prisma'

// GET /api/employee-planning-profile?employeeId=xxx
export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'employee'])
  if (session instanceof NextResponse) return session

  const employeeId = req.nextUrl.searchParams.get('employeeId')
  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId ist erforderlich' }, { status: 400 })
  }

  const profile = await prisma.employeePlanningProfile.findUnique({ where: { employeeId } })
  return NextResponse.json({ profile })
}

// PUT /api/employee-planning-profile  { employeeId, shiftPreference, ... }
export async function PUT(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'employee'])
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { employeeId, shiftPreference, childPickupTimes, maxConsecutiveDays, weekendRule, planningNote } = body

  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId ist erforderlich' }, { status: 400 })
  }

  const profile = await prisma.employeePlanningProfile.upsert({
    where: { employeeId },
    create: {
      employeeId,
      shiftPreference: shiftPreference ?? 'keine',
      childPickupTimes: childPickupTimes ?? [],
      maxConsecutiveDays: maxConsecutiveDays ?? 0,
      weekendRule: weekendRule ?? null,
      planningNote: planningNote ?? null,
    },
    update: {
      ...(shiftPreference !== undefined && { shiftPreference }),
      ...(childPickupTimes !== undefined && { childPickupTimes }),
      ...(maxConsecutiveDays !== undefined && { maxConsecutiveDays }),
      ...(weekendRule !== undefined && { weekendRule }),
      ...(planningNote !== undefined && { planningNote }),
    },
  })

  return NextResponse.json({ profile })
}
