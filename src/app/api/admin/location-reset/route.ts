import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId, resolveLocationId } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

// POST /api/admin/location-reset — wipe planning configuration for a fresh start.
// Scope is opt-in per area so admins can keep e.g. shifts while resetting rules.
// Operational data (schedule entries, time logs, vacations, employees) is never touched.
export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'okun'])
  if (session instanceof NextResponse) return session

  const locationId = await resolveLocationId(session)
  if (!locationId) return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })
  const customerId = await resolveCustomerId(session)

  const body = await req.json() as {
    planungsmodell?: boolean
    planungsrichtlinien?: boolean
    customConstraints?: boolean
    schichten?: boolean
    onboarding?: boolean
    confirm?: string
  }

  if (body.confirm !== 'ZURÜCKSETZEN') {
    return NextResponse.json({ error: 'Bestätigung fehlt' }, { status: 400 })
  }

  const done: Record<string, number> = {}

  if (body.planungsmodell) {
    done.planungsmodell = (await prisma.locationRuleModelRecord.deleteMany({ where: { locationId } })).count
  }
  if (body.planungsrichtlinien) {
    const a = await prisma.locationPlanningRules.deleteMany({ where: { locationId } })
    const b = await prisma.planningPolicy.deleteMany({ where: { locationId } })
    done.planungsrichtlinien = a.count + b.count
  }
  if (body.customConstraints) {
    done.customConstraints = (await prisma.customConstraint.deleteMany({ where: { locationId } })).count
  }
  if (body.schichten) {
    const demands = await prisma.shiftDemand.deleteMany({ where: { locationId } })
    const shifts = await prisma.shift.deleteMany({ where: { locationId } })
    done.schichten = shifts.count + demands.count
  }
  if (body.onboarding) {
    done.onboarding = (await prisma.locationOnboarding.deleteMany({ where: { locationId } })).count
  }

  await logAudit({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: 'delete',
    entityType: 'LocationPlanningReset',
    entityId: locationId,
    customerId: customerId ?? undefined,
    details: done,
  })

  return NextResponse.json({ ok: true, deleted: done })
}
