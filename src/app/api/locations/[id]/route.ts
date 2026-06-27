import { NextRequest, NextResponse } from 'next/server'
import { getLocationById, updateLocation } from '@/lib/entities'
import { requireRole } from '@/lib/session'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const location = await getLocationById(params.id)
  if (!location) return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })
  return NextResponse.json({ location })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const updates = await req.json()
  const location = await updateLocation(params.id, updates)
  if (!location) return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })
  return NextResponse.json({ location })
}
