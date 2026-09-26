import { NextRequest, NextResponse } from 'next/server'
import { getPlanningRules, upsertPlanningRules } from '@/lib/schedule-entities'
import { requireRole, resolveLocationId } from '@/lib/session'
import { locationFilter } from '@/lib/scope'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const locationId = req.nextUrl.searchParams.get('locationId')

  if (locationId) {
    const standortErlaubtGet = await locationFilter(session, locationId)
    if (standortErlaubtGet instanceof NextResponse) return standortErlaubtGet
  }
  if (!locationId) {
    return NextResponse.json({ error: 'locationId ist erforderlich' }, { status: 400 })
  }

  if (session.role === 'admin') {
    const ownLocationId = await resolveLocationId(session)
    if (!ownLocationId || ownLocationId !== locationId) {
      return NextResponse.json({ error: 'Keine Berechtigung für diesen Standort' }, { status: 403 })
    }
  }

  const rules = await getPlanningRules(locationId)
  return NextResponse.json({ rules })
}

export async function PUT(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { locationId, ...update } = body

  // §112 Standortprüfung — die Rolle allein sagt nichts über die Zuständigkeit.
  const standortErlaubt = await locationFilter(session, locationId)
  if (standortErlaubt instanceof NextResponse) return standortErlaubt
  if (!locationId) {
    return NextResponse.json({ error: 'locationId ist erforderlich' }, { status: 400 })
  }

  if (session.role === 'admin') {
    const ownLocationId = await resolveLocationId(session)
    if (!ownLocationId || ownLocationId !== locationId) {
      return NextResponse.json({ error: 'Keine Berechtigung für diesen Standort' }, { status: 403 })
    }
  }

  const rules = await upsertPlanningRules(locationId, update)
  return NextResponse.json({ rules })
}
