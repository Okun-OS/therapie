import { NextRequest, NextResponse } from 'next/server'
import { listShiftsByLocation, addShift } from '@/lib/schedule-entities'
import { requireRole } from '@/lib/session'
import { allowedLocationScope, locationFilter } from '@/lib/scope'
import { paletteFor } from '@/lib/shift-colors'
import { prisma } from '@/lib/prisma'

// §81: shifts are ALWAYS scoped to the caller's own location(s). The old
// behaviour returned listAllShifts() (every customer's shifts platform-wide)
// when no locationId was passed — which made fresh locations appear to have
// "existing" foreign shifts whose deletion then correctly failed with 403.
export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const requested = req.nextUrl.searchParams.get('locationId')
  const allowed = await locationFilter(session, requested)
  if (allowed instanceof NextResponse) return allowed

  // allowed === undefined → nur okun ohne expliziten Standort: plattformweit
  if (allowed === undefined) {
    return NextResponse.json({ shifts: await prisma.shift.findMany() })
  }
  if (allowed.length === 1) {
    return NextResponse.json({ shifts: await listShiftsByLocation(allowed[0]) })
  }
  const rows = await prisma.shift.findMany({ where: { locationId: { in: allowed } } })
  return NextResponse.json({ shifts: rows })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { name, type, startTime, endTime, color, bgColor, minStaff, locationId } = body
  if (!name?.trim() || !type || !startTime || !endTime || !locationId) {
    return NextResponse.json({ error: 'name, type, startTime, endTime und locationId sind erforderlich' }, { status: 400 })
  }

  // §81: creation is scoped too — never trust a client-supplied locationId
  const scope = await allowedLocationScope(session)
  if (scope.kind !== 'all' && !scope.ids.includes(locationId)) {
    return NextResponse.json({ error: 'Keine Berechtigung für diesen Standort' }, { status: 403 })
  }

  // Default colors — UI forms don't send them; without defaults the create
  // failed with 500 (color/bgColor are required columns). §96: die Palette
  // liegt zentral in shift-colors.ts, damit Plan und Anlage übereinstimmen.
  const fallback = paletteFor(type as string)

  const shift = await addShift({
    name, type, startTime, endTime,
    color: color ?? fallback.color,
    bgColor: bgColor ?? fallback.bgColor,
    minStaff: minStaff ?? 1, locationId,
  })
  return NextResponse.json({ shift })
}
