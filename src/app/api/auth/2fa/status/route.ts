import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { totpEnabled: true, smsOtpEnabled: true, phoneVerified: true, phone: true },
  })

  return NextResponse.json({
    totpEnabled: user?.totpEnabled ?? false,
    smsOtpEnabled: user?.smsOtpEnabled ?? false,
    phoneVerified: user?.phoneVerified ?? false,
    phone: user?.phone ? user.phone.replace(/(\+\d{1,3})\d+(\d{2})$/, '$1***$2') : null,
  })
}
