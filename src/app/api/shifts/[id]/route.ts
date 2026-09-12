import { NextRequest, NextResponse } from 'next/server'
import { setShiftMinStaff, updateShift, deleteShift } from '@/lib/schedule-entities'
import { requireRole } from '@/lib/session'
import { allowedLocationScope } from '@/lib/scope'
import { prisma } from '@/lib/prisma'

// §82: one guard for both PATCH and DELETE — PATCH had NO ownership check at
// all, so any admin could rename/re-time another tenant's shift by id.
async function guardShift(session: Parameters<typeof allowedLocationScope>[0], id: string) {
  const shift = await prisma.shift.findUnique({ where: { id }, select: { locationId: true } })
  if (!shift) return { error: NextResponse.json({ error: 'Schicht nicht gefunden' }, { status: 404 }) }
  const scope = await allowedLocationScope(session)
  if (scope.kind !== 'all' && !scope.ids.includes(shift.locationId)) {
    return { error: NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 }) }
  }
  return { shift }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const guard = await guardShift(session, params.id)
  if (guard.error) return guard.error

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

  const guard = await guardShift(session, params.id)
  if (guard.error) return guard.error

  const deleted = await deleteShift(params.id)
  if (!deleted) {
    return NextResponse.json({ error: 'Schicht konnte nicht gelöscht werden' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
