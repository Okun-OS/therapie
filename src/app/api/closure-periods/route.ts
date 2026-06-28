import { NextRequest, NextResponse } from 'next/server'
import { listClosurePeriodsByLocation, addClosurePeriod, deleteClosurePeriod } from '@/lib/vacation-entities'
import { requireRole } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const locationId = req.nextUrl.searchParams.get('locationId')
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
  await deleteClosurePeriod(id)
  return NextResponse.json({ ok: true })
}
