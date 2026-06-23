import { NextRequest, NextResponse } from 'next/server'
import {
  getAbsenceInsights,
  getPunctualityInsights,
  getSubstitutionInsights,
  getWorkloadInsights,
} from '@/lib/workforce-insights-service'

export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get('scope')
  const locationId = scope === 'organization' ? undefined : req.nextUrl.searchParams.get('locationId') ?? undefined

  const [punctuality, substitutions, absence, workload] = await Promise.all([
    getPunctualityInsights(locationId),
    getSubstitutionInsights(locationId),
    Promise.resolve(getAbsenceInsights(locationId)),
    getWorkloadInsights(locationId),
  ])

  return NextResponse.json({ punctuality, substitutions, absence, workload })
}
