import { NextRequest, NextResponse } from 'next/server'
import { publishVacationPlan } from '@/lib/vacation-entities'
import { requireRole } from '@/lib/session'

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const { locationId, locationName, entries } = await req.json()
  if (!locationId || !locationName || !Array.isArray(entries)) {
    return NextResponse.json({ error: 'locationId, locationName und entries sind erforderlich' }, { status: 400 })
  }

  const requests = await publishVacationPlan(locationId, locationName, entries)
  return NextResponse.json({ requests })
}
