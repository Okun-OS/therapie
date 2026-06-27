import { NextRequest, NextResponse } from 'next/server'
import { listShiftsByLocation, listAllShifts, addShift } from '@/lib/schedule-entities'
import { requireRole } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const locationId = req.nextUrl.searchParams.get('locationId')
  const shifts = locationId ? await listShiftsByLocation(locationId) : await listAllShifts()
  return NextResponse.json({ shifts })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { name, type, startTime, endTime, color, bgColor, minStaff, locationId } = body
  if (!name?.trim() || !type || !startTime || !endTime || !locationId) {
    return NextResponse.json({ error: 'name, type, startTime, endTime und locationId sind erforderlich' }, { status: 400 })
  }

  const shift = await addShift({ name, type, startTime, endTime, color, bgColor, minStaff: minStaff ?? 1, locationId })
  return NextResponse.json({ shift })
}
