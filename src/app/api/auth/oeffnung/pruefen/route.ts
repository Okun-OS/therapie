import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'
import { codePruefen } from '@/lib/zweiter-faktor'
import { verifyTotp } from '@/lib/totp'
import { logAudit } from '@/lib/audit'
import { OEFFNUNG_KEKS, KEKS_OPTIONEN, siegelErzeugen } from '@/lib/oeffnungssiegel'

export const dynamic = 'force-dynamic'

/**
 * §289 Den Code prüfen und die App aufschließen.
 *
 * Angenommen werden beide Arten, die das Konto haben kann:
 *   – ein zugeschickter Code (SMS oder E-Mail), geprüft über
 *     `zweiter-faktor.ts` — mit Verbrauch, Ablauf und Versuchszählung;
 *   – ein Code aus der Authenticator-App, geprüft über `totp.ts`.
 *
 * Beide sind dieselbe Prüfung wie bei der Anmeldung. Das ist der Kern des
 * ganzen Entwurfs: Wer hier nicht hindurchkommt, käme auch durch die
 * Anmeldung nicht — die Sperre nimmt also niemandem etwas, das er sonst
 * hätte (§288).
 */
export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const { code } = await req.json().catch(() => ({})) as { code?: string }
  const eingabe = String(code ?? '').trim()
  if (!eingabe) {
    return NextResponse.json({ error: 'Bitte den Code eingeben.' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      totpEnabled: true, totpSecret: true,
      smsOtpEnabled: true, emailOtpEnabled: true,
    },
  })
  if (!user) return NextResponse.json({ error: 'Konto nicht gefunden' }, { status: 404 })

  /*
   * Zuerst die Authenticator-App: Ihr Code ist immer gültig, während ein
   * zugeschickter erst angefordert werden muss. Wer beides hat, soll den
   * nehmen können, der schneller zur Hand ist.
   */
  let erkannt = false
  if (user.totpEnabled && user.totpSecret && verifyTotp(user.totpSecret, eingabe)) {
    erkannt = true
  } else if (user.smsOtpEnabled || user.emailOtpEnabled) {
    const ergebnis = await codePruefen(session.userId, eingabe)
    if (!ergebnis.ok) {
      /*
       * Die Meldung kommt unverändert aus der gemeinsamen Prüfung — sie
       * unterscheidet „abgelaufen", „falsch" und „zu viele Versuche", und
       * genau diese drei muss ein Mensch vor der Tür auseinanderhalten
       * können.
       */
      await logAudit({
        userId: session.userId, userEmail: session.email, userRole: session.role,
        action: 'login_failed', entityType: 'oeffnung',
        customerId: session.customerId,
        details: { wo: 'App entsperren' },
      })
      return NextResponse.json({ error: ergebnis.fehler }, { status: ergebnis.status })
    }
    erkannt = true
  }

  if (!erkannt) {
    await logAudit({
      userId: session.userId, userEmail: session.email, userRole: session.role,
      action: 'login_failed', entityType: 'oeffnung',
      customerId: session.customerId,
      details: { wo: 'App entsperren' },
    })
    return NextResponse.json({ error: 'Falscher Code.' }, { status: 400 })
  }

  const res = NextResponse.json({ frei: true })
  // Sitzungskeks ohne `maxAge`: Er lebt, solange die App lebt. Genau daran
  // hängt „beim Öffnen" — siehe `oeffnungssiegel.ts`.
  res.cookies.set(OEFFNUNG_KEKS, siegelErzeugen(session.userId), KEKS_OPTIONEN)
  return res
}
