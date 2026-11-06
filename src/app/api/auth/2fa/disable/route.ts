import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'
import { verifyTotp } from '@/lib/totp'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const { token } = await req.json()
  if (!token) {
    return NextResponse.json({ error: 'Bestätigungscode erforderlich' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { totpSecret: true, totpEnabled: true },
  })

  if (!user?.totpEnabled || !user?.totpSecret) {
    return NextResponse.json({ error: '2FA ist nicht aktiv' }, { status: 400 })
  }

  if (!verifyTotp(user.totpSecret, String(token))) {
    return NextResponse.json({ error: 'Ungültiger Code' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { totpSecret: null, totpEnabled: false },
  })

  return NextResponse.json({ ok: true })
}
