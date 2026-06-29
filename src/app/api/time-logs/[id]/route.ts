import { NextRequest, NextResponse } from 'next/server'
import { getTimeLogById, updateTimeLog } from '@/lib/time-tracking-entities'
import { computeBreakMinutesForClockOut } from '@/lib/break-rules-service'
import { requireRole } from '@/lib/session'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const existing = await getTimeLogById(params.id)
  if (!existing) return NextResponse.json({ error: 'Zeiteintrag nicht gefunden' }, { status: 404 })

  const isOwner = !!session.employeeId && session.employeeId === existing.employeeId
  const isPrivileged = ['admin', 'company', 'okun'].includes(session.role)
  if (!isOwner && !isPrivileged) {
    return NextResponse.json({ error: 'Keine Berechtigung für diesen Zeiteintrag' }, { status: 403 })
  }

  const updates = await req.json()
  if (updates.clockOut && typeof updates.totalMinutes === 'number' && updates.breakMinutes === undefined) {
    updates.breakMinutes = await computeBreakMinutesForClockOut(existing.locationId, existing.breakMinutes ?? 0, updates.totalMinutes)
  }
  const log = await updateTimeLog(params.id, updates)
  if (!log) return NextResponse.json({ error: 'Zeiteintrag nicht gefunden' }, { status: 404 })
  return NextResponse.json({ log })
}
