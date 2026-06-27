import { NextRequest, NextResponse } from 'next/server'
import { listLocations, addLocation } from '@/lib/entities'
import { requireRole } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const locations = await listLocations()
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

  const location = await addLocation({ name, address, city, state })
  return NextResponse.json({ location })
}
