import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { locationFilter } from '@/lib/scope'
import { einrichtungNachholen } from '@/lib/paket-einrichtung'

export const dynamic = 'force-dynamic'

/**
 * §201 Die Einrichtung des Regelpakets nachholen, wenn ein Standort sein
 * Paket hat, aber noch keine Dienstzeiten.
 *
 * Der Dienstplan ruft das beim Öffnen auf. Der Kunde stellt dabei nichts ein:
 * Angelegt wird nur, was OKUN ins Paket geschrieben hat, und nur, was fehlt.
 * Ohne diesen Schritt sähe eine Leitung, deren Paket vor §201 zugewiesen
 * wurde, weiter „Noch keine Dienstzeiten" — bis zum ersten Planungslauf.
 */
export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const body = await req.json().catch(() => ({})) as { locationId?: string }
  if (!body.locationId) return NextResponse.json({ error: 'locationId fehlt' }, { status: 400 })
  const erlaubt = await locationFilter(session, body.locationId)
  if (erlaubt instanceof NextResponse) return erlaubt

  const dienstzeiten = await einrichtungNachholen(body.locationId)
  return NextResponse.json({ dienstzeiten })
}
