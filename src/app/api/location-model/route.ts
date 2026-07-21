import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveLocationId } from '@/lib/session'
import { getLocationModel } from '@/lib/company-model-service'

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin'])
  if (session instanceof NextResponse) return session

  const locationId = await resolveLocationId(session)
  if (!locationId) return NextResponse.json({ error: 'Kein Standort zugeordnet' }, { status: 403 })

  const model = await getLocationModel(locationId)
  return NextResponse.json({ model })
}
