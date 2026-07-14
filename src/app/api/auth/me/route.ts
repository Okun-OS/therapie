import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, setSessionCookie, type SessionRole } from '@/lib/session'

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
