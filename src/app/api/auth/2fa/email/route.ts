import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'

export const dynamic = 'force-dynamic'

/**
 * §196 Den E-Mail-Faktor ein- oder ausschalten.
 *
 * WARUM HIER NICHTS ZU BESTÄTIGEN IST
 * Beim SMS-Faktor muss die Nummer erst bewiesen werden — sie ist neu, und
 * niemand weiß, ob sie stimmt. Bei der E-Mail-Adresse ist das anders: Über
 * genau diese Adresse kam die Einladung, mit der dieses Konto entstanden ist.
 * Wer sie nicht empfangen kann, hätte das Konto nie gehabt.
 *
 * Ein zusätzlicher Bestätigungsschritt würde hier also etwas prüfen, das
 * schon bewiesen ist — und drei Klicks kosten, bei denen Leute aussteigen.
 */
export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const { aktiv } = await req.json().catch(() => ({ aktiv: null }))
  if (typeof aktiv !== 'boolean') {
    return NextResponse.json({ error: 'aktiv muss true oder false sein' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  })
  if (!user?.email) {
    return NextResponse.json({ error: 'Für dieses Konto ist keine E-Mail-Adresse hinterlegt.' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { emailOtpEnabled: aktiv },
  })

  return NextResponse.json({ emailOtpEnabled: aktiv, email: user.email })
}
