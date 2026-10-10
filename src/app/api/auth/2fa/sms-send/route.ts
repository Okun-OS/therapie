import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { sendSms, generateOtp, EXPIRY_MINUTES, RATE_LIMIT_MINUTES } from '@/lib/sms'

export const dynamic = 'force-dynamic'

// Called during login flow when user has smsOtpEnabled and TOTP is not being used
export async function POST(req: NextRequest) {
  const { userId } = await req.json().catch(() => ({ userId: '' }))
  if (!userId) return NextResponse.json({ error: 'userId fehlt' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { smsOtpEnabled: true, phoneVerified: true, phone: true },
  })
  if (!user?.smsOtpEnabled || !user.phoneVerified || !user.phone) {
    return NextResponse.json({ error: 'SMS-2FA nicht konfiguriert' }, { status: 400 })
  }

  // Rate limit
  const recent = await prisma.smsTotpCode.findFirst({
    where: { userId, createdAt: { gte: new Date(Date.now() - RATE_LIMIT_MINUTES * 60 * 1000) } },
  })
  if (recent) {
    return NextResponse.json({ error: 'Bitte kurz warten.' }, { status: 429 })
  }

  await prisma.smsTotpCode.deleteMany({ where: { userId } })

  const otp = generateOtp()
  const codeHash = await bcrypt.hash(otp, 10)
  await prisma.smsTotpCode.create({
    data: { userId, codeHash, expiresAt: new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000) },
  })

  const result = await sendSms(user.phone, `Dein OKUN Anmelde-Code: ${otp}. Gültig ${EXPIRY_MINUTES} Minuten.`)
  if (!result.success) {
    return NextResponse.json({ error: result.error ?? 'SMS fehlgeschlagen' }, { status: 502 })
  }

  return NextResponse.json({ sent: true })
}
