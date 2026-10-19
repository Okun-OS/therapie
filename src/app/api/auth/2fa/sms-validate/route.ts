import { NextRequest, NextResponse } from 'next/server'
import { codePruefen, sitzungSetzen } from '@/lib/zweiter-faktor'

export const dynamic = 'force-dynamic'

/**
 * §196 Den SMS-Code prüfen und die Sitzung ausstellen.
 *
 * WAS SICH HIER GEÄNDERT HAT
 * Die Prüfung stand ausgeschrieben in dieser Datei. Mit dem E-Mail-Weg wäre
 * sie zweimal dagewesen, und dann läuft sie auseinander. Jetzt steht sie in
 * `zweiter-faktor.ts`, und beide Wege benutzen dieselbe.
 *
 * Dabei kam ein Fehler heraus, der vorher niemandem auffiel: Diese Route
 * setzte `bereichIds` NICHT in die Sitzung, die normale Anmeldung schon. Wer
 * auf bestimmte Bereiche eingeschränkt ist, bekam über den zweiten Faktor
 * eine Sitzung ohne diese Einschränkung — der sicherere Anmeldeweg führte zu
 * mehr Rechten.
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
