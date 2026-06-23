import { NextRequest, NextResponse } from 'next/server'
import { getBurnoutRisks, getFluctuationRisks, getUnderstaffingRisk } from '@/lib/personnel-risk-service'

export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get('scope')
  const locationId = scope === 'organization' ? undefined : req.nextUrl.searchParams.get('locationId') ?? undefined

  const [burnout, fluctuation] = await Promise.all([
    getBurnoutRisks(locationId),
    getFluctuationRisks(locationId),
  ])
  const understaffing = getUnderstaffingRisk(locationId)

  return NextResponse.json({ burnout, fluctuation, understaffing })
}
