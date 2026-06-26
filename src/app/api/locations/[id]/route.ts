import { NextRequest, NextResponse } from 'next/server'
import { getLocationById, updateLocation } from '@/lib/entities'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const location = await getLocationById(params.id)
  if (!location) return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })
  return NextResponse.json({ location })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const updates = await req.json()
  const location = await updateLocation(params.id, updates)
  if (!location) return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })
  return NextResponse.json({ location })
}
