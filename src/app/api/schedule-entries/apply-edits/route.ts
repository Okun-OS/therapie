import { NextRequest, NextResponse } from 'next/server'
import { applyScheduleEdits } from '@/lib/schedule-entities'
import type { ScheduleEditChange } from '@/lib/schedule-entities'
import { requireRole } from '@/lib/session'

/** Wendet einzelne Änderungen aus dem Dienstplan-Editier-Chat (z.B. Tausch, Tag freigeben)
 * auf einen bereits gespeicherten Dienstplan an, ohne die übrige Woche zu überschreiben. */
export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const { locationId, changes } = await req.json()
  if (!locationId || !Array.isArray(changes) || changes.length === 0) {
    return NextResponse.json({ error: 'locationId und changes sind erforderlich' }, { status: 400 })
  }

  const entries = await applyScheduleEdits(locationId, changes as ScheduleEditChange[])
  return NextResponse.json({ entries })
}
