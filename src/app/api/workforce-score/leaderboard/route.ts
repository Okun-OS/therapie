import { NextRequest, NextResponse } from 'next/server'
import { getLeaderboardByLocation, getOrganizationLeaderboard } from '@/lib/workforce-score-service'
import { requireRole } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const scope = req.nextUrl.searchParams.get('scope')
  const locationId = req.nextUrl.searchParams.get('locationId')

  if (scope === 'organization') {
    if (session.role !== 'okun' && !session.customerId) {
      return NextResponse.json({ leaderboard: [] })
    }
    const leaderboard = await getOrganizationLeaderboard(session.role === 'okun' ? undefined : session.customerId)
    return NextResponse.json({ leaderboard })
  }

  if (!locationId) return NextResponse.json({ error: 'locationId ist erforderlich' }, { status: 400 })
  const leaderboard = await getLeaderboardByLocation(locationId)
  return NextResponse.json({ leaderboard })
}
