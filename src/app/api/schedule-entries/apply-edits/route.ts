import { NextRequest, NextResponse } from 'next/server'
import { applyScheduleEdits } from '@/lib/schedule-entities'
import type { ScheduleEditChange } from '@/lib/schedule-entities'
import { requireRole } from '@/lib/session'
import { locationFilter } from '@/lib/scope'

/** Wendet einzelne Änderungen aus dem Dienstplan-Editier-Chat (z.B. Tausch, Tag freigeben)
 * auf einen bereits gespeicherten Dienstplan an, ohne die übrige Woche zu überschreiben. */
export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const { locationId, changes } = await req.json()
  // §112 Standortprüfung: Die Rolle allein genügt nicht — geprüft werden muss,
  // ob dieser Standort überhaupt zum Aufrufer gehört.
  const standortErlaubt = await locationFilter(session, locationId)
  if (standortErlaubt instanceof NextResponse) return standortErlaubt

  if (!locationId || !Array.isArray(changes) || changes.length === 0) {
    return NextResponse.json({ error: 'locationId und changes sind erforderlich' }, { status: 400 })
  }

  const entries = await applyScheduleEdits(locationId, changes as ScheduleEditChange[])
  return NextResponse.json({ entries })
}
