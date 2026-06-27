import { NextRequest, NextResponse } from 'next/server'
import { getBurnoutRisks, getFluctuationRisks, getUnderstaffingRisk } from '@/lib/personnel-risk-service'
import { requireRole } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const scope = req.nextUrl.searchParams.get('scope')
  const locationId = scope === 'organization' ? undefined : req.nextUrl.searchParams.get('locationId') ?? undefined
  const customerId = session.customerId

  const [burnout, fluctuation] = await Promise.all([
    getBurnoutRisks(locationId, customerId),
    getFluctuationRisks(locationId, customerId),
  ])
  const understaffing = await getUnderstaffingRisk(locationId, customerId)

  return NextResponse.json({ burnout, fluctuation, understaffing })
}
