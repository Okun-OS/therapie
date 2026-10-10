import { NextRequest, NextResponse } from 'next/server'
import { getFairnessInsights } from '@/lib/fairness'
import { requireRole, resolveCustomerId } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const scope = req.nextUrl.searchParams.get('scope')
  const locationId = scope === 'organization' ? undefined : req.nextUrl.searchParams.get('locationId') ?? undefined

  const data = await getFairnessInsights(locationId, await resolveCustomerId(session))

  return NextResponse.json({ data })
}
