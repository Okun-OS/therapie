import { NextRequest, NextResponse } from 'next/server'
import { publishVacationPlan } from '@/lib/vacation-entities'
import { requireRole } from '@/lib/session'
import { locationFilter } from '@/lib/scope'

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const { locationId, locationName, entries } = await req.json()
  // §110 Standortprüfung: Die Rolle allein genügt nicht — eine Leitung darf nur
  // den EIGENEN Standort verändern, nicht den eines fremden Kunden.
  const erlaubt = await locationFilter(session, locationId)
  if (erlaubt instanceof NextResponse) return erlaubt

  if (!locationId || !locationName || !Array.isArray(entries)) {
    return NextResponse.json({ error: 'locationId, locationName und entries sind erforderlich' }, { status: 400 })
  }

  const requests = await publishVacationPlan(locationId, locationName, entries)
  return NextResponse.json({ requests })
}
