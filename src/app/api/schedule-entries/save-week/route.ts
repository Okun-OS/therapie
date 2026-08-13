import { NextRequest, NextResponse } from 'next/server'
import { saveScheduleForWeek } from '@/lib/schedule-entities'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const { locationId, weekDates, assignments, reasons, status, sessionId } = await req.json()
  if (!locationId || !Array.isArray(weekDates) || !assignments) {
    return NextResponse.json({ error: 'locationId, weekDates und assignments sind erforderlich' }, { status: 400 })
  }

  // §62: track manual changes for dispatcher learning — compare new assignments vs existing
  const customerId = await resolveCustomerId(session)
  if (customerId) {
    const changedBy = session.email ?? session.role ?? 'admin'
    const existingEntries = await prisma.scheduleEntry.findMany({
      where: { locationId, date: { in: weekDates } },
      select: { employeeId: true, date: true, shiftId: true },
    })
    const existingMap = new Map(existingEntries.map(e => [`${e.employeeId}|${e.date}`, e.shiftId]))

    const planChanges: Array<{
      locationId: string; customerId: string; sessionId?: string
      employeeId: string; date: string; oldShiftId?: string; newShiftId?: string
      changeType: string; changedBy: string
    }> = []

    for (const [empId, byDate] of Object.entries(assignments as Record<string, Record<string, { shiftId?: string }>>)) {
      for (const [date, assignment] of Object.entries(byDate)) {
        const newShiftId = assignment?.shiftId
        const oldShiftId = existingMap.get(`${empId}|${date}`)
        if (!newShiftId && !oldShiftId) continue
        if (newShiftId === oldShiftId) continue
        planChanges.push({
          locationId, customerId,
          sessionId: sessionId as string | undefined,
          employeeId: empId, date,
          oldShiftId: oldShiftId ?? undefined,
          newShiftId: newShiftId ?? undefined,
          changeType: !oldShiftId ? 'assign' : !newShiftId ? 'remove' : 'swap',
          changedBy,
        })
      }
    }

    if (planChanges.length > 0) {
      await prisma.planChange.createMany({ data: planChanges }).catch(() => {})
    }
  }

  await saveScheduleForWeek(locationId, weekDates, assignments, reasons, status ?? 'confirmed')
  return NextResponse.json({ success: true })
}
