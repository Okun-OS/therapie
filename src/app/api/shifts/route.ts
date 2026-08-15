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

  // Default colors — UI forms don't send them; without defaults the create
  // failed with 500 (color/bgColor are required columns)
  const DEFAULTS: Record<string, { color: string; bgColor: string }> = {
    early: { color: '#0E6B6F', bgColor: '#E5FAFA' },
    mid: { color: '#C89C5B', bgColor: '#F8EFE2' },
    late: { color: '#3A3F42', bgColor: '#E8ECEF' },
    night: { color: '#26292B', bgColor: '#C9D0D4' },
    standard: { color: '#0E6B6F', bgColor: '#E5FAFA' },
  }
  const fallback = DEFAULTS[type as string] ?? DEFAULTS.standard

  const shift = await addShift({
    name, type, startTime, endTime,
    color: color ?? fallback.color,
    bgColor: bgColor ?? fallback.bgColor,
    minStaff: minStaff ?? 1, locationId,
  })
  return NextResponse.json({ shift })
}
