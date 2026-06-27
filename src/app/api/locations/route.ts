import { NextRequest, NextResponse } from 'next/server'
import { listLocations, addLocation } from '@/lib/entities'
import { requireRole, resolveCustomerId } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const customerId = session.role === 'okun' ? undefined : await resolveCustomerId(session)
  if (session.role !== 'okun' && !customerId) {
    return NextResponse.json({ locations: [] })
  }
  const locations = await listLocations(customerId)
  return NextResponse.json({ locations })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { name, address, city, state } = body

  if (!name?.trim() || !address?.trim() || !city?.trim()) {
    return NextResponse.json({ error: 'name, address und city sind erforderlich' }, { status: 400 })
  }

  const location = await addLocation({ name, address, city, state, customerId: await resolveCustomerId(session) })
  return NextResponse.json({ location })
}
