import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { erreichbarePartner, eigeneKennung } from '@/lib/chat'

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

  return NextResponse.json({ partner: await erreichbarePartner(session) })
}
