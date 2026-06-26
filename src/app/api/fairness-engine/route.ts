import { NextRequest, NextResponse } from 'next/server'
import { getFairnessInsights } from '@/lib/fairness'

export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get('scope')
  const locationId = scope === 'organization' ? undefined : req.nextUrl.searchParams.get('locationId') ?? undefined

  const data = await getFairnessInsights(locationId)

  return NextResponse.json({ data })
}
