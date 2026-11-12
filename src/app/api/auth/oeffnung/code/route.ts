import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'
import { sendSms, smsEingerichtet } from '@/lib/sms'
import { sendEmail } from '@/lib/email'
import { codeHinterlegen, zuFrueh, GUELTIG_MINUTEN } from '@/lib/zweiter-faktor'

export const dynamic = 'force-dynamic'

/**
 * §289 Einen Code schicken, um die App wieder aufzuschließen.
 *
 * WARUM NICHT DIE VORHANDENEN ROUTEN
 * `2fa/sms-send` und `2fa/email-send` laufen WÄHREND der Anmeldung und nehmen
 * die `userId` aus dem Körper der Anfrage entgegen — dort muss das so sein,
 * weil es noch keine Sitzung gibt. Hier gibt es eine, und die `userId` kommt
 * aus ihr. Eine angemeldete Route, die sich sagen lässt, für wen sie einen
 * Code schickt, wäre ein Versandwerkzeug für fremde Telefonnummern.
 *
 * Die Zählung, die Gültigkeit und die Mindestpause teilen sich beide Wege
 * mit der Anmeldung (`zweiter-faktor.ts`) — eine eigene, großzügigere wäre
 * der bequemere Weg zum Durchprobieren (§201).
 */
export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const { weg } = await req.json().catch(() => ({})) as { weg?: 'sms' | 'email' }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      name: true, email: true, phone: true,
      smsOtpEnabled: true, emailOtpEnabled: true,
    },
  })
  if (!user) return NextResponse.json({ error: 'Konto nicht gefunden' }, { status: 404 })

  // Ohne Angabe: der Weg, den das Konto hat. SMS zuerst — danach wurde
  // ausdrücklich gefragt.
  const gewaehlt = weg ?? (user.smsOtpEnabled ? 'sms' : user.emailOtpEnabled ? 'email' : null)
  if (!gewaehlt) {
    return NextResponse.json(
      { error: 'Für dieses Konto ist kein Code-Versand eingerichtet.' }, { status: 400 })
  }

  if (await zuFrueh(session.userId)) {
    return NextResponse.json({ error: 'Bitte kurz warten.' }, { status: 429 })
  }

  if (gewaehlt === 'sms') {
    if (!user.smsOtpEnabled || !user.phone) {
      return NextResponse.json({ error: 'SMS ist für dieses Konto nicht eingerichtet.' },
        { status: 400 })
    }
    /*
     * §195 Kein Code ohne Zustellweg. Ist der Versand nicht eingerichtet,
     * käme keine SMS — und der Mensch stünde vor der Tür und suchte den
     * Fehler bei seinem Telefon. Hier wiegt das schwerer als bei der
     * Anmeldung: Dort gibt es noch andere Wege hinein, hier ist er gesperrt.
     */
    if (!smsEingerichtet()) {
      return NextResponse.json({
        error: 'Der SMS-Versand ist gerade nicht eingerichtet. Melde dich ab und '
          + 'wieder an, oder wende dich an deine Verwaltung.',
      }, { status: 503 })
    }
    const code = await codeHinterlegen(session.userId, 'sms')
    const ergebnis = await sendSms(user.phone,
      `Dein OKUN-Code zum Entsperren: ${code}. Gültig ${GUELTIG_MINUTEN} Minuten.`)
    if (!ergebnis.success) {
      return NextResponse.json({ error: ergebnis.error ?? 'SMS fehlgeschlagen' },
        { status: 502 })
    }
    return NextResponse.json({ gesendet: true, weg: 'sms', minuten: GUELTIG_MINUTEN })
  }

  if (!user.emailOtpEnabled) {
    return NextResponse.json({ error: 'E-Mail ist für dieses Konto nicht eingerichtet.' },
      { status: 400 })
  }
  const code = await codeHinterlegen(session.userId, 'email')
  await sendEmail(
    user.email,
    'Ihr Code zum Entsperren von OKUN Workforce',
    `Hallo ${user.name},\n\n`
    + `Ihr Code lautet: ${code}\n\n`
    + `Er gilt ${GUELTIG_MINUTEN} Minuten und nur ein einziges Mal.\n\n`
    + 'Wenn Sie die App gerade nicht geöffnet haben, ändern Sie Ihr Passwort — '
    + 'jemand hat Zugriff auf Ihr Gerät oder Ihr Konto.\n',
  )
  return NextResponse.json({ gesendet: true, weg: 'email', minuten: GUELTIG_MINUTEN })
}
