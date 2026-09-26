import { NextRequest, NextResponse } from 'next/server'
import { getTimeLogById, updateTimeLog } from '@/lib/time-tracking-entities'
import { computeBreakMinutesForClockOut } from '@/lib/break-rules-service'
import { requireRole } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { assertEmployeeAccess } from '@/lib/scope'

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

  // §109 Eine Zeitbuchung liess sich allein ueber ihre ID aendern.
  const buchung = await prisma.timeLog.findUnique({
    where: { id: params.id }, select: { employeeId: true },
  })
  if (!buchung) return NextResponse.json({ error: 'Zeitbuchung nicht gefunden' }, { status: 404 })
  const zugriffVerweigert = await assertEmployeeAccess(session, buchung.employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  const updates = await req.json()
  if (updates.clockOut && typeof updates.totalMinutes === 'number' && updates.breakMinutes === undefined) {
    updates.breakMinutes = await computeBreakMinutesForClockOut(existing.locationId, existing.breakMinutes ?? 0, updates.totalMinutes)
  }
  const log = await updateTimeLog(params.id, updates)
  if (!log) return NextResponse.json({ error: 'Zeiteintrag nicht gefunden' }, { status: 404 })
  return NextResponse.json({ log })
}
