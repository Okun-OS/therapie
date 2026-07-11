import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  await prisma.smsTotpCode.deleteMany({ where: { userId: session.userId } })
  await prisma.user.update({
    where: { id: session.userId },
    data: { smsOtpEnabled: false, phoneVerified: false, phone: null },
  })

  return NextResponse.json({ disabled: true })
}
