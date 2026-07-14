import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, setSessionCookie, clearSessionCookie, type SessionRole } from '@/lib/session'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } })
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  const res = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId ?? undefined,
      locationId: user.locationId ?? undefined,
      customerId: user.customerId ?? undefined,
      customerName: user.customerName ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined,
    },
  })

  const driftedFromCookie =
    user.employeeId !== (session.employeeId ?? null) ||
    user.locationId !== (session.locationId ?? null) ||
    user.customerId !== (session.customerId ?? null) ||
    user.role !== session.role
  if (driftedFromCookie) {
    setSessionCookie(res, {
      userId: user.id,
      email: user.email,
      role: user.role as SessionRole,
      employeeId: user.employeeId ?? undefined,
      locationId: user.locationId ?? undefined,
      customerId: user.customerId ?? undefined,
    })
  }

  return res
}

// DSGVO Art. 17 – Recht auf Löschung
export async function DELETE(req: NextRequest) {
  const session = getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  await logAudit({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: 'delete',
    entityType: 'user_self',
    entityId: session.userId,
    customerId: session.customerId,
    details: { reason: 'DSGVO Art. 17 self-deletion' },
  })

  if (session.employeeId) {
    await prisma.employee.updateMany({
      where: { id: session.employeeId },
      data: { active: false, name: 'Gelöschter Mitarbeiter', email: `deleted-${session.userId}@okun.deleted`, avatarUrl: null },
    })
  }
  await prisma.user.delete({ where: { id: session.userId } })

  const res = NextResponse.json({ ok: true })
  clearSessionCookie(res)
  return res
}

