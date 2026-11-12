import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPendingToken, setSessionCookie, sitzungsangabenAus } from '@/lib/session'
import { verifyTotp } from '@/lib/totp'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { pendingToken, totpCode } = await req.json()
  if (!pendingToken || !totpCode) {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const pending = verifyPendingToken(String(pendingToken))
  if (!pending) {
    return NextResponse.json({ error: 'Sitzung abgelaufen. Bitte neu anmelden.' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: pending.userId } })
  if (!user || !user.totpEnabled || !user.totpSecret) {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  if (!verifyTotp(user.totpSecret, String(totpCode))) {
    return NextResponse.json({ error: 'Ungültiger Code. Bitte erneut versuchen.' }, { status: 400 })
  }

  const res = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId ?? undefined,
      locationId: user.locationId ?? undefined,
      customerId: user.customerId ?? undefined,
    },
  })
  /*
   * §289 Hier fehlten `bereichIds` — dieselbe Lücke, die §196 beim SMS-Weg
   * gefunden und dort behoben hat; die App-Variante blieb übrig. Wer auf
   * Bereiche eingeschränkt ist und sich mit der Authenticator-App anmeldet,
   * bekam eine Sitzung OHNE diese Einschränkung. Jetzt bauen alle drei
   * Anmeldewege dieselben Angaben.
   */
  setSessionCookie(res, sitzungsangabenAus(user))
  return res
}
