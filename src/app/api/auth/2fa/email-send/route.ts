import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { codeHinterlegen, zuFrueh, GUELTIG_MINUTEN } from '@/lib/zweiter-faktor'

export const dynamic = 'force-dynamic'

/**
 * §196 Den Code verschicken — während der Anmeldung, also OHNE Sitzung.
 *
 * Wer hier steht, hat Benutzername und Passwort schon richtig eingegeben;
 * die `userId` kommt aus dem Schritt davor. Deshalb darf diese Route nichts
 * verraten, was ein Fremder nicht ohnehin wüsste: keine Adresse, keinen
 * Namen, nicht einmal, ob das Konto den E-Mail-Faktor überhaupt benutzt.
 */
export async function POST(req: NextRequest) {
  const { userId } = await req.json().catch(() => ({ userId: '' }))
  if (!userId) return NextResponse.json({ error: 'userId fehlt' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, emailOtpEnabled: true },
  })
  if (!user?.emailOtpEnabled || !user.email) {
    return NextResponse.json({ error: 'E-Mail-Faktor nicht eingerichtet' }, { status: 400 })
  }

  if (await zuFrueh(userId)) {
    return NextResponse.json({ error: 'Bitte kurz warten.' }, { status: 429 })
  }

  const code = await codeHinterlegen(userId, 'email')

  await sendEmail(
    user.email,
    'Ihr Anmeldecode für OKUN Workforce',
    `Hallo ${user.name},\n\n`
    + `Ihr Anmeldecode lautet: ${code}\n\n`
    + `Er gilt ${GUELTIG_MINUTEN} Minuten und nur ein einziges Mal.\n\n`
    + 'Wenn Sie sich gerade nicht anmelden wollten, ignorieren Sie diese '
    + 'Nachricht und ändern Sie Ihr Passwort — jemand kennt es.\n',
  )

  // Die Adresse wird verkürzt zurückgegeben, damit auf dem Anmeldeschirm
  // steht, WOHIN der Code ging — ohne die ganze Adresse preiszugeben.
  return NextResponse.json({ sent: true, hinweis: adresseVerkuerzen(user.email) })
}

/** aus „felix.okun@okun-systems.com" wird „f…n@okun-systems.com" */
function adresseVerkuerzen(adresse: string): string {
  const [vorn, hinten] = adresse.split('@')
  if (!hinten) return '…'
  if (vorn.length <= 2) return `${vorn[0]}…@${hinten}`
  return `${vorn[0]}…${vorn[vorn.length - 1]}@${hinten}`
}
