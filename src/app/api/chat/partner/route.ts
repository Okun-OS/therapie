import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { erreichbarePartner, eigeneKennung, nochOhneZugang } from '@/lib/chat'

export const dynamic = 'force-dynamic'

/**
 * §129 GET /api/chat/partner — wem diese Person schreiben darf.
 *
 * Die Liste ist absichtlich knapp: Name, Position, Standort. Wer jemanden
 * anschreiben will, braucht nicht dessen Stundenkonto — und eine Liste, die
 * mehr enthält als nötig, ist bei jedem Aufruf eine kleine Preisgabe.
 */
export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session
  if (!eigeneKennung(session)) return NextResponse.json({ partner: [] })

  // §144 Dazu, wer hier FEHLT. Ohne diese Angabe sucht eine Standortleitung
  // nach jemandem, der nie auftauchen wird, und zweifelt an der Suche statt an
  // der fehlenden Einladung.
  const [partner, ohneZugang] = await Promise.all([
    erreichbarePartner(session),
    nochOhneZugang(session),
  ])
  return NextResponse.json({ partner, ohneZugang })
}
