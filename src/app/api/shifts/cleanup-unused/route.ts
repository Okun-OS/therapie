import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveLocationId } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

// §77: one-click cleanup — delete every shift of this location that no
// schedule entry has ever referenced (leftovers from earlier onboarding runs
// or LLM generations). Shifts with history are never touched.
export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'okun'])
  if (session instanceof NextResponse) return session

  const locationId = await resolveLocationId(session)
  if (!locationId) return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })

  const [shifts, usedShiftIds] = await Promise.all([
    prisma.shift.findMany({ where: { locationId }, select: { id: true, name: true } }),
    prisma.scheduleEntry.findMany({
      where: { locationId },
      select: { shiftId: true },
      distinct: ['shiftId'],
    }),
  ])
  const used = new Set(usedShiftIds.map(e => e.shiftId))
  const unused = shifts.filter(s => !used.has(s.id))

  if (unused.length > 0) {
    await prisma.shift.deleteMany({ where: { id: { in: unused.map(s => s.id) } } })
    await logAudit({
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      action: 'delete',
      entityType: 'ShiftCleanup',
      entityId: locationId,
      details: { deleted: unused.map(s => s.name) },
    })
  }

  return NextResponse.json({ deleted: unused.length, ids: unused.map(s => s.id), names: unused.map(s => s.name) })
}
