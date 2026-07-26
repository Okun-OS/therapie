import { NextRequest, NextResponse } from 'next/server'
import { saveScheduleForWeek } from '@/lib/schedule-entities'
import { requireRole } from '@/lib/session'

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const { locationId, weekDates, assignments, reasons, status } = await req.json()
  if (!locationId || !Array.isArray(weekDates) || !assignments) {
    return NextResponse.json({ error: 'locationId, weekDates und assignments sind erforderlich' }, { status: 400 })
  }

  await saveScheduleForWeek(locationId, weekDates, assignments, reasons, status ?? 'confirmed')
  return NextResponse.json({ success: true })
}
