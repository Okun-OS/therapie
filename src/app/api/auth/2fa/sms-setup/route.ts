import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'
import { sendSms, smsEingerichtet, generateOtp, EXPIRY_MINUTES, RATE_LIMIT_MINUTES } from '@/lib/sms'

export const dynamic = 'force-dynamic'

// Step 1: user provides phone number → we send a verification code
export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  /*
   * §195 Erst fragen, ob ein Versand überhaupt möglich ist.
   *
   * Vorher wurde ein Code erzeugt, in der Datenbank abgelegt und erst danach
   * gemerkt, dass niemand ihn zustellen kann. Übrig blieb ein gültiger
   * Anmeldecode ohne Empfänger — und eine Oberfläche, die „gesendet" sagte.
   */
  if (!smsEingerichtet()) {
    return NextResponse.json(
      { error: 'Der SMS-Versand ist nicht eingerichtet. Bitte eine andere Methode für den zweiten Faktor wählen.' },
      { status: 503 },
    )
  }

  const { phone } = await req.json()
  if (!phone || typeof phone !== 'string') {
    return NextResponse.json({ error: 'Telefonnummer fehlt' }, { status: 400 })
  }

  // Normalize: accept +49… or 0049… or local 0…
  const normalized = phone.trim()
  if (!/^\+?[0-9\s\-()]{7,20}$/.test(normalized)) {
    return NextResponse.json({ error: 'Ungültige Telefonnummer' }, { status: 400 })
  }

  // Rate limit: max 1 code per RATE_LIMIT_MINUTES
  const recent = await prisma.smsTotpCode.findFirst({
    where: {
      userId: session.userId,
      createdAt: { gte: new Date(Date.now() - RATE_LIMIT_MINUTES * 60 * 1000) },
    },
  })
  if (recent) {
    return NextResponse.json({ error: `Bitte warte ${RATE_LIMIT_MINUTES} Minute(n) vor dem nächsten Versuch.` }, { status: 429 })
  }

  // Invalidate old codes for this user
  await prisma.smsTotpCode.deleteMany({ where: { userId: session.userId } })

  const otp = generateOtp()
  const codeHash = await bcrypt.hash(otp, 10)
  const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000)

  await prisma.smsTotpCode.create({ data: { userId: session.userId, codeHash, expiresAt } })

  // Store phone on user (not yet verified)
  await prisma.user.update({ where: { id: session.userId }, data: { phone: normalized, phoneVerified: false } })

  const result = await sendSms(normalized, `Dein OKUN Verifizierungscode: ${otp}. Gültig ${EXPIRY_MINUTES} Minuten.`)
  if (!result.success) {
    /*
     * §197 Hier DARF der echte Grund mit.
     *
     * Wer diese Route aufruft, ist angemeldet und richtet den Versand für
     * sein eigenes Konto ein. Ihm „SMS konnte nicht gesendet werden" zu
     * sagen und den Grund ins Serverprotokoll zu schreiben, heißt: Er sucht
     * eine halbe Stunde, obwohl Twilio längst gesagt hat, woran es liegt.
     *
     * Vor der Anmeldung (`sms-send`) bleibt es bewusst beim allgemeinen
     * Satz — dort steht ein Unbekannter, und wie unsere Einrichtung
     * aussieht, geht ihn nichts an.
     */
    return NextResponse.json(
      {
        error: result.error ?? 'SMS-Versand fehlgeschlagen',
        twilioCode: result.fehler?.code,
        twilioMeldung: result.fehler?.twilio,
        hinweis: result.fehler?.hinweis,
      },
      { status: 502 },
    )
  }

  return NextResponse.json({ sent: true })
}
