import { NextRequest, NextResponse } from 'next/server'
import { getLeaderboardByLocation, getOrganizationLeaderboard } from '@/lib/workforce-score-service'

export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get('scope')
  const locationId = req.nextUrl.searchParams.get('locationId')

  if (scope === 'organization') {
    const leaderboard = await getOrganizationLeaderboard()
    return NextResponse.json({ leaderboard })
  }

  if (!locationId) return NextResponse.json({ error: 'locationId ist erforderlich' }, { status: 400 })
  const leaderboard = await getLeaderboardByLocation(locationId)
  return NextResponse.json({ leaderboard })
}
