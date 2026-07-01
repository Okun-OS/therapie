import { NextRequest, NextResponse } from 'next/server'
import { setShiftMinStaff, updateShift, deleteShift } from '@/lib/schedule-entities'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { listLocations } from '@/lib/entities'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { name, type, startTime, endTime, color, bgColor, minStaff } = body

  if (Object.keys(body).length === 1 && typeof minStaff === 'number') {
    await setShiftMinStaff(params.id, minStaff)
    return NextResponse.json({ success: true })
  }

  const fields: Record<string, unknown> = {}
  if (typeof name === 'string' && name.trim()) fields.name = name.trim()
  if (typeof type === 'string') fields.type = type
  if (typeof startTime === 'string') fields.startTime = startTime
  if (typeof endTime === 'string') fields.endTime = endTime
  if (typeof color === 'string') fields.color = color
  if (typeof bgColor === 'string') fields.bgColor = bgColor
  if (typeof minStaff === 'number') fields.minStaff = minStaff

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'Keine gültigen Felder zum Aktualisieren' }, { status: 400 })
  }

  const shift = await updateShift(params.id, fields)
  return NextResponse.json({ shift })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const shift = await prisma.shift.findUnique({ where: { id: params.id }, select: { locationId: true } })
  if (!shift) {
    return NextResponse.json({ error: 'Schicht nicht gefunden' }, { status: 404 })
  }

  if (session.role === 'admin') {
    if (shift.locationId !== session.locationId) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }
  } else if (session.role === 'company') {
    const customerId = await resolveCustomerId(session)
    const locations = await listLocations(customerId)
    const locationIds = locations.map(l => l.id)
    if (!locationIds.includes(shift.locationId)) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }
  }
  // 'okun' role: allow any

  await deleteShift(params.id)
  return NextResponse.json({ ok: true })
}
