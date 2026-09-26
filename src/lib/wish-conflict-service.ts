import { prisma } from '@/lib/prisma'
import { notifyEmployee } from '@/lib/notify'

// §73: after a schedule is saved, resolve every wish for the saved week:
// - mark each wish 'fulfilled' / 'not_fulfilled' based on the saved plan
// - detect "Doppelungen" (≥2 employees wished the same shift on the same day,
//   not all got it): losers get conflictInfo + an in-app/push notification
//   naming the colleague who won (first come, first served), so they can
//   contact them or request a shift swap. Winners get no message.
// conflictInfo acts as dedup marker so re-saving the week does not re-notify.
export async function processWishConflicts(
  locationId: string,
  weekDates: string[],
  assignments: Record<string, Record<string, { shiftId?: string } | null | undefined>>,
): Promise<void> {
  const [wishes, shifts, employees] = await Promise.all([
    prisma.wishSubmission.findMany({
      where: { locationId, date: { in: weekDates }, status: { notIn: ['rejected'] } },
    }),
    prisma.shift.findMany({ where: { locationId } }),
    prisma.employee.findMany({ where: { locationId }, select: { id: true, name: true } }),
  ])
  if (wishes.length === 0) return

  const nameById = new Map(employees.map(e => [e.id, e.name]))
  const resolveShift = (pref: string) =>
    shifts.find(s => s.id === pref || s.name.toLowerCase() === pref.toLowerCase())

  // 1) Mark fulfilled / not_fulfilled for every wish of the saved week
  for (const w of wishes) {
    const assigned = assignments[w.employeeId]?.[w.date]?.shiftId
    let fulfilled: boolean
    if (w.preferredShiftType === 'frei') {
      fulfilled = !assigned
    } else {
      const target = resolveShift(w.preferredShiftType)
      fulfilled = !!target && assigned === target.id
    }
    const newStatus = fulfilled ? 'fulfilled' : 'not_fulfilled'
    if (w.status !== newStatus) {
      await prisma.wishSubmission.update({ where: { id: w.id }, data: { status: newStatus } }).catch(() => {})
    }
  }

  // 2) Conflict groups: same (date, target shift), shift wishes only
  const groups = new Map<string, typeof wishes>()
  for (const w of wishes) {
    if (w.preferredShiftType === 'frei') continue
    const shift = resolveShift(w.preferredShiftType)
    if (!shift) continue
    const key = `${w.date}|${shift.id}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(w)
  }

  for (const [key, group] of Array.from(groups.entries())) {
    if (group.length < 2) continue
    const [date, shiftId] = key.split('|')
    const shiftName = shifts.find(s => s.id === shiftId)?.name ?? shiftId

    const fulfilled = group.filter(w => assignments[w.employeeId]?.[date]?.shiftId === shiftId)
    const losers = group.filter(w => assignments[w.employeeId]?.[date]?.shiftId !== shiftId)
    if (fulfilled.length === 0 || losers.length === 0) continue

    // Winner named in the message: earliest fulfilled submission
    const winner = [...fulfilled].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))[0]
    const winnerName = nameById.get(winner.employeeId) ?? winner.employeeName

    for (const loser of losers) {
      const existing = loser.conflictInfo as { winnerId?: string; date?: string } | null
      const alreadyNotified = existing?.winnerId === winner.employeeId && existing?.date === date
      await prisma.wishSubmission.update({
        where: { id: loser.id },
        data: {
          conflictInfo: {
            conflictedWith: [winnerName],
            reason: `${shiftName} am ${date}: ${winnerName} hatte den gleichen Wunsch früher eingereicht.`,
            winnerId: winner.employeeId,
            date,
            shiftId,
            shiftName,
            notifiedAt: new Date().toISOString(),
          },
        },
      }).catch(() => {})

      if (!alreadyNotified) {
        await notifyEmployee(loser.employeeId, {
          type: 'wish_conflict',
          title: 'Dienstwunsch nicht berücksichtigt',
          body: `Dein Wunsch (${shiftName} am ${date}) konnte wegen Doppelung nicht berücksichtigt werden — ${winnerName} hatte ihn früher eingereicht. Du kannst ${winnerName} kontaktieren oder einen Schichttausch anfragen.`,
          requestId: loser.id,
          url: '/employee/schedule?tab=wishes',
        }).catch(() => {})
      }
    }
  }
}
