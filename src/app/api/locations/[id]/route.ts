import { NextRequest, NextResponse } from 'next/server'
import { getLocationById, updateLocation, deleteLocation } from '@/lib/entities'
import { requireRole } from '@/lib/session'
import { prisma } from '@/lib/prisma'

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

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  try {
    const deleted = await deleteLocation(params.id)
    if (!deleted) return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })

    await prisma.adminAuditLog.create({
      data: {
        id: crypto.randomUUID(),
        action: 'DELETE_LOCATION',
        entityType: 'Location',
        entityId: params.id,
        entityName: deleted.name,
        actorId: session.userId,
        actorName: session.name ?? session.email,
      },
    })

    return NextResponse.json({ deleted: true })
  } catch (err: unknown) {
    console.error('locations DELETE', err)
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
