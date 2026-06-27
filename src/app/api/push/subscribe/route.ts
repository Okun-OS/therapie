import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'

export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const { employeeId, subscription } = await req.json()
  if (!employeeId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: 'employeeId und subscription sind erforderlich' }, { status: 400 })
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: { employeeId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    create: {
      employeeId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  })

  return NextResponse.json({ ok: true })
}
