import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'

export const dynamic = 'force-dynamic'

const MAX_ATTEMPTS = 5

// Step 2: user provides the code they received → phone verified, SMS 2FA enabled
export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const { code } = await req.json()
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Code fehlt' }, { status: 400 })
  }

  const record = await prisma.smsTotpCode.findFirst({
    where: { userId: session.userId, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
  if (!record) {
    return NextResponse.json({ error: 'Kein gültiger Code vorhanden. Bitte neu anfordern.' }, { status: 400 })
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await prisma.smsTotpCode.delete({ where: { id: record.id } })
    return NextResponse.json({ error: 'Zu viele Fehlversuche. Bitte neuen Code anfordern.' }, { status: 429 })
  }

  const valid = await bcrypt.compare(code.trim(), record.codeHash)
  if (!valid) {
    await prisma.smsTotpCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } })
    const remaining = MAX_ATTEMPTS - record.attempts - 1
    return NextResponse.json({ error: `Falscher Code. Noch ${remaining} Versuch(e).` }, { status: 400 })
  }

  await prisma.smsTotpCode.update({ where: { id: record.id }, data: { usedAt: new Date() } })
  await prisma.user.update({
    where: { id: session.userId },
    data: { phoneVerified: true, smsOtpEnabled: true },
  })

  return NextResponse.json({ verified: true })
}
