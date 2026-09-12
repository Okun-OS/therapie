import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'
import { generateSecret, totpUri } from '@/lib/totp'
import QRCode from 'qrcode'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const secret = generateSecret()

  await prisma.user.update({
    where: { id: session.userId },
    data: { totpSecret: secret, totpEnabled: false },
  })

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  })

  const uri = totpUri(user!.email, secret)
  const qrDataUrl = await QRCode.toDataURL(uri, { width: 200, margin: 1 })

  return NextResponse.json({ secret, qrDataUrl })
}
