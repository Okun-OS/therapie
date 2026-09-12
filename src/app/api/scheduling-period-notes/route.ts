import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const locationId = req.nextUrl.searchParams.get('locationId')
  const weekStart = req.nextUrl.searchParams.get('weekStart')
  if (!locationId || !weekStart) {
    return NextResponse.json({ error: 'locationId und weekStart sind erforderlich' }, { status: 400 })
  }
  const notes = await prisma.schedulingPeriodNote.findMany({
    where: { locationId, weekStart },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ notes })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const { locationId, weekStart, note } = await req.json()
  if (!locationId || !weekStart || !note?.trim()) {
    return NextResponse.json({ error: 'locationId, weekStart und note sind erforderlich' }, { status: 400 })
  }
  const created = await prisma.schedulingPeriodNote.create({
    data: { locationId, weekStart, note: note.trim() },
  })
  return NextResponse.json({ note: created })
}

export async function DELETE(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const id = req.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id ist erforderlich' }, { status: 400 })
  }
  await prisma.schedulingPeriodNote.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
