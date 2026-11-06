import { NextRequest, NextResponse } from 'next/server'
import { codePruefen, sitzungSetzen } from '@/lib/zweiter-faktor'

export const dynamic = 'force-dynamic'

/**
 * §196 Den eingegebenen Code prüfen und die Sitzung ausstellen.
 *
 * Die Prüfung selbst steht in `zweiter-faktor.ts` — dieselbe wie beim
 * SMS-Weg. Zwei Kopien einer Prüfung, die entscheidet, wer hereinkommt,
 * laufen garantiert auseinander.
 */
export async function POST(req: NextRequest) {
  const { userId, code } = await req.json().catch(() => ({ userId: '', code: '' }))
  if (!userId || !code) {
    return NextResponse.json({ error: 'userId und code erforderlich' }, { status: 400 })
  }

  const ergebnis = await codePruefen(userId, code)
  if (!ergebnis.ok) {
    return NextResponse.json({ error: ergebnis.fehler }, { status: ergebnis.status })
  }

  const res = NextResponse.json({ ok: true })
  if (!await sitzungSetzen(res, userId)) {
    return NextResponse.json({ error: 'Nutzer nicht gefunden' }, { status: 404 })
  }
  return res
}
