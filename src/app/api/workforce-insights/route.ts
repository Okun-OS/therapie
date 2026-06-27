import { NextRequest, NextResponse } from 'next/server'
import {
  getAbsenceInsights,
  getPunctualityInsights,
  getSubstitutionInsights,
  getWorkloadInsights,
} from '@/lib/workforce-insights-service'
import { requireRole } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const scope = req.nextUrl.searchParams.get('scope')
  const locationId = scope === 'organization' ? undefined : req.nextUrl.searchParams.get('locationId') ?? undefined

  const customerId = session.customerId
  const [punctuality, substitutions, absence, workload] = await Promise.all([
    getPunctualityInsights(locationId, customerId),
    getSubstitutionInsights(locationId, customerId),
    Promise.resolve(getAbsenceInsights(locationId, customerId)),
    getWorkloadInsights(locationId, customerId),
  ])

  return NextResponse.json({ punctuality, substitutions, absence, workload })
}
