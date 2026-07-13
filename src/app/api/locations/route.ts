import { NextRequest, NextResponse } from 'next/server'
import { listLocations, addLocation, locationIdsForBereiche } from '@/lib/entities'
import { requireRole, resolveCustomerId, resolveBereichIds } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const customerId = session.role === 'okun' ? undefined : await resolveCustomerId(session)
  if (session.role !== 'okun' && !customerId) {
    return NextResponse.json({ locations: [] })
  }
  let locations = await listLocations(customerId)

  // Bereichsleiter: scope to their bereiche
  if (session.role === 'company') {
    const bereichIds = await resolveBereichIds(session)
    if (bereichIds.length > 0) {
      const allowedIds = await locationIdsForBereiche(bereichIds)
      locations = locations.filter(l => allowedIds.includes(l.id))
    }
  }

  return NextResponse.json({ locations })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { name, city, state, zip, street, houseNumber, country, bundesland } = body
  // Support both old flat address and new structured fields
  const address = (street && houseNumber) ? `${street} ${houseNumber}` : (body.address?.trim() || street || '')

  if (!name?.trim() || !city?.trim()) {
    return NextResponse.json({ error: 'name und city sind erforderlich' }, { status: 400 })
  }

  const location = await addLocation({
    name,
    address,
    city,
    state,
    zip,
    street,
    houseNumber,
    country,
    bundesland,
    customerId: await resolveCustomerId(session),
  })
  return NextResponse.json({ location })
}
