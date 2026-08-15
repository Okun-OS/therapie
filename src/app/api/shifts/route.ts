import { NextRequest, NextResponse } from 'next/server'
import { listShiftsByLocation, addShift } from '@/lib/schedule-entities'
import { requireRole, resolveLocationId, resolveCustomerId } from '@/lib/session'
import { listLocations } from '@/lib/entities'
import { prisma } from '@/lib/prisma'

// §81: shifts are ALWAYS scoped to the caller's own location(s). The old
// behaviour returned listAllShifts() (every customer's shifts platform-wide)
// when no locationId was passed — which made fresh locations appear to have
// "existing" foreign shifts whose deletion then correctly failed with 403.
export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const requested = req.nextUrl.searchParams.get('locationId')

  if (session.role === 'okun') {
    const shifts = requested
      ? await listShiftsByLocation(requested)
      : (await prisma.shift.findMany()).map(s => s)
    return NextResponse.json({ shifts })
  }

  if (session.role === 'company') {
    const customerId = await resolveCustomerId(session)
    const locations = await listLocations(customerId)
    const ownIds = locations.map(l => l.id)
    if (requested) {
      if (!ownIds.includes(requested)) {
        return NextResponse.json({ error: 'Keine Berechtigung für diesen Standort' }, { status: 403 })
      }
      return NextResponse.json({ shifts: await listShiftsByLocation(requested) })
    }
    const rows = await prisma.shift.findMany({ where: { locationId: { in: ownIds } } })
    return NextResponse.json({ shifts: rows })
  }

  // admin + employee: only their own location, ever
  const ownLocationId = await resolveLocationId(session)
  if (!ownLocationId) return NextResponse.json({ shifts: [] })
  if (requested && requested !== ownLocationId) {
    return NextResponse.json({ error: 'Keine Berechtigung für diesen Standort' }, { status: 403 })
  }
  return NextResponse.json({ shifts: await listShiftsByLocation(ownLocationId) })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { name, type, startTime, endTime, color, bgColor, minStaff, locationId } = body
  if (!name?.trim() || !type || !startTime || !endTime || !locationId) {
    return NextResponse.json({ error: 'name, type, startTime, endTime und locationId sind erforderlich' }, { status: 400 })
  }

  // §81: creation is scoped too — admin only at own location, company only at own customer
  if (session.role === 'admin') {
    const ownLocationId = await resolveLocationId(session)
    if (locationId !== ownLocationId) {
      return NextResponse.json({ error: 'Keine Berechtigung für diesen Standort' }, { status: 403 })
    }
  } else if (session.role === 'company') {
    const customerId = await resolveCustomerId(session)
    const locations = await listLocations(customerId)
    if (!locations.some(l => l.id === locationId)) {
      return NextResponse.json({ error: 'Keine Berechtigung für diesen Standort' }, { status: 403 })
    }
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
