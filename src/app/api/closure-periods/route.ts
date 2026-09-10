import { NextRequest, NextResponse } from 'next/server'
import { listClosurePeriodsByLocation, addClosurePeriod, deleteClosurePeriod } from '@/lib/vacation-entities'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { locationFilter } from '@/lib/scope'
import { listLocations } from '@/lib/entities'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const locationId = req.nextUrl.searchParams.get('locationId')

  if (locationId) {
    const erlaubtGet = await locationFilter(session, locationId)
    if (erlaubtGet instanceof NextResponse) return erlaubtGet
  }
  if (!locationId) {
    return NextResponse.json({ error: 'locationId ist erforderlich' }, { status: 400 })
  }

  const closures = await listClosurePeriodsByLocation(locationId)
  return NextResponse.json({ closures })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { locationId, name, startDate, endDate } = body
  if (!locationId?.trim() || !name?.trim() || !startDate || !endDate) {
    return NextResponse.json({ error: 'locationId, name, startDate und endDate sind erforderlich' }, { status: 400 })
  }
  if (endDate < startDate) {
    return NextResponse.json({ error: 'endDate darf nicht vor startDate liegen' }, { status: 400 })
  }

  // §110 Eine fremde Leitung konnte an diesem Standort Schliesszeiten anlegen.
  const erlaubt = await locationFilter(session, locationId)
  if (erlaubt instanceof NextResponse) return erlaubt

  const closure = await addClosurePeriod({ locationId, name, startDate, endDate, createdBy: session.userId })
  return NextResponse.json({ closure })
}

export async function DELETE(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const id = req.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id ist erforderlich' }, { status: 400 })
  }

  const closure = await prisma.closurePeriod.findUnique({ where: { id }, select: { locationId: true } })
  if (!closure) {
    return NextResponse.json({ error: 'Schließzeit nicht gefunden' }, { status: 404 })
  }

  if (session.role === 'admin') {
    if (closure.locationId !== session.locationId) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }
  } else if (session.role === 'company') {
    const customerId = await resolveCustomerId(session)
    const locations = await listLocations(customerId)
    const locationIds = locations.map(l => l.id)
    if (!locationIds.includes(closure.locationId)) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }
  }

  await deleteClosurePeriod(id)
  return NextResponse.json({ ok: true })
}
