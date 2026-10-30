import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { sendSms, smsEingerichtet, generateOtp, EXPIRY_MINUTES, RATE_LIMIT_MINUTES } from '@/lib/sms'

export const dynamic = 'force-dynamic'

// Called during login flow when user has smsOtpEnabled and TOTP is not being used
export async function POST(req: NextRequest) {
  const { userId } = await req.json().catch(() => ({ userId: '' }))
  if (!userId) return NextResponse.json({ error: 'userId fehlt' }, { status: 400 })

  /*
   * §195 Kein Code ohne Zustellweg — und eine Meldung, die weiterhilft.
   *
   * Hier steht jemand VOR der Anmeldung und wartet auf eine SMS. Ist der
   * Versand nicht eingerichtet, kommt keine, und ohne diesen Zweig bekäme er
   * „SMS fehlgeschlagen" zu lesen und suchte den Fehler bei seinem Telefon.
   *
   * Es gibt bewusst keine Selbsthilfe: Einen zweiten Faktor, den der
   * Ausgesperrte selbst abschalten kann, ist keiner. Deshalb der Verweis auf
   * die Verwaltung.
   */
  if (!smsEingerichtet()) {
    return NextResponse.json(
      {
        error: 'Der SMS-Versand ist derzeit nicht eingerichtet. Es kann kein Code '
          + 'zugestellt werden — bitte wenden Sie sich an Ihre Verwaltung.',
      },
      { status: 503 },
    )
  }

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
