import type { Employee, ScheduleEntry, Shift, ShiftFairnessData, WishSubmission } from './types'
import { SHIFTS, getAllEntriesForFairness } from './mock-data'
import { listEmployees, listLocations } from './entities'
import { prisma } from './prisma'

// ─── Core Fairness Calculation ───────────────────────────────────────────────

export interface PlanningRuleLimits {
  fridayLateMax?: number
  mondayEarlyMax?: number
  fridayEarlyMax?: number
  weekendMax?: number
}

export function calculateFairnessData(
  employees: Employee[],
  entries: ScheduleEntry[],
  shifts: Shift[],
  ruleLimits?: PlanningRuleLimits,
): ShiftFairnessData[] {
  return employees.map(emp => {
    const empEntries = entries.filter(e => e.employeeId === emp.id)

    let earlyCnt = 0, lateCnt = 0, midCnt = 0
    let fridayEarlyCnt = 0, fridayLateCnt = 0
    let mondayEarlyCnt = 0, mondayLateCnt = 0
    let weekendCnt = 0
    const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0]

    for (const entry of empEntries) {
      const shift = shifts.find(s => s.id === entry.shiftId)
      if (!shift) continue
      const dow = new Date(entry.date + 'T00:00:00').getDay() // 0=Sun, 5=Fri, 1=Mon
      dayOfWeekCounts[dow]++
      if (dow === 0 || dow === 6) weekendCnt++

      if (shift.type === 'early') {
        earlyCnt++
        if (dow === 5) fridayEarlyCnt++
        if (dow === 1) mondayEarlyCnt++
      } else if (shift.type === 'late') {
        lateCnt++
        if (dow === 5) fridayLateCnt++
        if (dow === 1) mondayLateCnt++
      } else if (shift.type === 'mid') {
        midCnt++
      }
    }

    const total = earlyCnt + lateCnt + midCnt

    const workDates = Array.from(new Set(empEntries.map(e => e.date))).sort()
    let maxConsecutiveDays = workDates.length > 0 ? 1 : 0
    let streak = 1
    for (let i = 1; i < workDates.length; i++) {
      const prev = new Date(workDates[i - 1] + 'T00:00:00')
      const curr = new Date(workDates[i] + 'T00:00:00')
      const dayDiff = Math.round((curr.getTime() - prev.getTime()) / 86_400_000)
      streak = dayDiff === 1 ? streak + 1 : 1
      maxConsecutiveDays = Math.max(maxConsecutiveDays, streak)
    }

    const weeks = 4
    const shiftsPerWeek = emp.weeklyHours / 8
    const expectedPerWeek = shiftsPerWeek * weeks

    // Fair split across shift types (roughly 40% early, 40% late, 20% mid)
    const earlyTarget = expectedPerWeek * 0.4
    const lateTarget = expectedPerWeek * 0.4
    const midTarget = expectedPerWeek * 0.2

    const earlyDebt = earlyTarget - earlyCnt  // positive = should get more early
    const lateDebt = lateTarget - lateCnt
    const midDebt = midTarget - midCnt

    // Friday/Monday special days: fair share = 1 per 4 weeks per type
    const fridayLateMax = ruleLimits?.fridayLateMax ?? 2
    const mondayEarlyMax = ruleLimits?.mondayEarlyMax ?? 2
    const fridayEarlyMax = ruleLimits?.fridayEarlyMax ?? 3
    const weekendMax = ruleLimits?.weekendMax ?? 2

    const issues: string[] = []

    if (fridayLateCnt >= fridayLateMax) {
      issues.push(`${fridayLateCnt}× Freitag-Spätdienst in 4 Wochen (Limit: ${fridayLateMax})`)
    }
    if (mondayEarlyCnt >= mondayEarlyMax) {
      issues.push(`${mondayEarlyCnt}× Montag-Frühdienst in 4 Wochen (Limit: ${mondayEarlyMax})`)
    }
    if (fridayEarlyCnt >= fridayEarlyMax) {
      issues.push(`${fridayEarlyCnt}× Freitag-Frühdienst in 4 Wochen (Limit: ${fridayEarlyMax})`)
    }
    if (weekendCnt > weekendMax) {
      issues.push(`${weekendCnt}× Wochenenddienst in 4 Wochen (Limit: ${weekendMax})`)
    }
    if (Math.abs(earlyDebt) > 2) {
      issues.push(earlyDebt > 0 ? 'Zu wenige Frühschichten' : 'Zu viele Frühschichten')
    }
    if (Math.abs(lateDebt) > 2) {
      issues.push(lateDebt > 0 ? 'Zu wenige Spätschichten' : 'Zu viele Spätschichten')
    }
    if (maxConsecutiveDays > 5) {
      issues.push(`${maxConsecutiveDays}× in Folge gearbeitet (Limit: 5 Tage)`)
    }

    // Fairness score: penalise for each issue and deviation from target
    const deviationPenalty = (Math.abs(earlyDebt) + Math.abs(lateDebt) + Math.abs(midDebt)) * 5
    const specialDayPenalty =
      Math.max(0, fridayLateCnt - fridayLateMax) * 15 +
      Math.max(0, mondayEarlyCnt - mondayEarlyMax) * 15 +
      Math.max(0, fridayEarlyCnt - fridayEarlyMax) * 10 +
      Math.max(0, weekendCnt - weekendMax) * 10 +
      Math.max(0, maxConsecutiveDays - 5) * 15
    const fairnessScore = Math.max(0, Math.min(100, 100 - deviationPenalty - specialDayPenalty))

    return {
      employeeId: emp.id,
      employeeName: emp.name,
      weeklyHours: emp.weeklyHours,
      earlyCnt,
      lateCnt,
      midCnt,
      dayOfWeekCounts,
      fridayEarlyCnt,
      fridayLateCnt,
      mondayEarlyCnt,
      mondayLateCnt,
      weekendCnt,
      totalShiftsCnt: total,
      maxConsecutiveDays,
      substitutionCoverageCnt: 0,
      earlyDebt,
      lateDebt,
      midDebt,
      fairnessScore: Math.round(fairnessScore),
      issues,
    }
  })
}

// ─── Scoped fairness lookup for the transparency dashboard ──────────────────

export async function getFairnessInsights(locationId?: string, ruleLimits?: PlanningRuleLimits): Promise<ShiftFairnessData[]> {
  const locationIds = locationId ? [locationId] : (await listLocations()).map(l => l.id)
  const allEmployees = await listEmployees()
  const employees = allEmployees.filter(e => e.role === 'employee' && e.locationId && locationIds.includes(e.locationId))
  const shifts = SHIFTS.filter(s => locationIds.includes(s.locationId))
  const entries = locationIds.flatMap(id => getAllEntriesForFairness(id))
  const fairnessData = calculateFairnessData(employees, entries, shifts, ruleLimits)

  const employeeIds = employees.map(e => e.id)
  const coverageGroups = employeeIds.length > 0
    ? await prisma.substitutionCandidate.groupBy({
        by: ['employeeId'],
        where: { employeeId: { in: employeeIds }, responseStatus: 'accepted' },
        _count: { _all: true },
      })
    : []
  const coverageByEmployee = new Map(coverageGroups.map(g => [g.employeeId, g._count._all]))

  return fairnessData.map(fd => ({ ...fd, substitutionCoverageCnt: coverageByEmployee.get(fd.employeeId) ?? 0 }))
}

// ─── Conflict Resolution ─────────────────────────────────────────────────────

export interface ConflictResolution {
  winnerId: string
  winnerName: string
  losers: Array<{ id: string; name: string; reason: string }>
}

/**
 * Given multiple wish submissions for the same date+shiftType, determine who wins.
 * Priority: 1) importance, 2) fairness debt (who deserves it more), 3) submission time
 */
export function resolveWishConflict(
  wishes: WishSubmission[],
  fairnessData: ShiftFairnessData[],
): ConflictResolution {
  if (wishes.length === 0) throw new Error('No wishes to resolve')
  if (wishes.length === 1) {
    return { winnerId: wishes[0].employeeId, winnerName: wishes[0].employeeName, losers: [] }
  }

  const importanceWeight: Record<string, number> = { urgent: 30, important: 15, normal: 0 }

  const scored = wishes.map(w => {
    const fd = fairnessData.find(f => f.employeeId === w.employeeId)
    const debt = fd
      ? (w.preferredShiftType === 'early' ? fd.earlyDebt : w.preferredShiftType === 'late' ? fd.lateDebt : fd.midDebt)
      : 0

    // Higher score = higher priority
    const score =
      importanceWeight[w.importance] +
      debt * 3 +                           // positive debt = deserves this shift more
      (new Date(w.submittedAt).getTime() / -1e12)  // earlier submission → higher score

    return { wish: w, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const winner = scored[0].wish

  const losers = scored.slice(1).map(({ wish }) => {
    const winnerFD = fairnessData.find(f => f.employeeId === winner.employeeId)
    const loserFD = fairnessData.find(f => f.employeeId === wish.employeeId)

    const importanceDiff = importanceWeight[winner.importance] - importanceWeight[wish.importance]
    const winnerDebt = winnerFD
      ? (wish.preferredShiftType === 'early' ? winnerFD.earlyDebt : wish.preferredShiftType === 'late' ? winnerFD.lateDebt : winnerFD.midDebt)
      : 0
    const loserDebt = loserFD
      ? (wish.preferredShiftType === 'early' ? loserFD.earlyDebt : wish.preferredShiftType === 'late' ? loserFD.lateDebt : loserFD.midDebt)
      : 0

    const reasons: string[] = []

    if (importanceDiff > 0) {
      reasons.push(`${winner.employeeName} hat einen dringenderen Grund (${winner.importance === 'urgent' ? 'dringend' : 'wichtig'} vs. ${wish.importance === 'important' ? 'wichtig' : 'normal'})`)
    }
    if (winnerDebt > loserDebt + 0.5) {
      const delta = Math.abs(Math.round(winnerDebt - loserDebt))
      reasons.push(`${winner.employeeName} hat diese Schichtart in den letzten 4 Wochen ${delta}× seltener als du – KI gleicht dies aus`)
    }
    if (new Date(winner.submittedAt) < new Date(wish.submittedAt) && reasons.length === 0) {
      const diffH = Math.round((new Date(wish.submittedAt).getTime() - new Date(winner.submittedAt).getTime()) / 3_600_000)
      reasons.push(`${winner.employeeName} hat den Wunsch ${diffH} Stunden früher eingetragen`)
    }

    return {
      id: wish.employeeId,
      name: wish.employeeName,
      reason: reasons.length > 0 ? reasons.join(' · ') : `${winner.employeeName} hatte höhere Priorität`,
    }
  })

  return { winnerId: winner.employeeId, winnerName: winner.employeeName, losers }
}

// ─── Fairness-aware AI schedule generation ───────────────────────────────────

/**
 * Extension of the basic AI generator that takes historical fairness into account.
 * Employees with high debt for a shift type are prioritised to reduce debt.
 * Friday/Monday caps are enforced.
 */
export function generateFairSchedule(
  employees: Employee[],
  shifts: Shift[],
  weekDays: Date[],
  fairnessData: ShiftFairnessData[],
  ruleLimits?: PlanningRuleLimits,
): Record<string, Record<string, string>> {
  const fridayLateMax = ruleLimits?.fridayLateMax ?? 2
  const mondayEarlyMax = ruleLimits?.mondayEarlyMax ?? 3
  const result: Record<string, Record<string, string>> = {}
  const sessionCounts: Record<string, Record<string, number>> = {}

  employees.forEach(emp => {
    result[emp.id] = {}
    sessionCounts[emp.id] = { early: 0, late: 0, mid: 0 }
  })

  for (const day of weekDays) {
    const dow = day.getDay()
    if (dow === 0 || dow === 6) continue  // skip weekends
    const dateStr = day.toISOString().split('T')[0]
    const isFriday = dow === 5
    const isMonday = dow === 1

    for (const shift of shifts) {
      // Sort employees by "who deserves this shift most" (highest debt first)
      const candidates = employees
        .filter(emp => {
          const fd = fairnessData.find(f => f.employeeId === emp.id)
          // Skip if already assigned this day
          if (result[emp.id][dateStr]) return false
          // Skip unavailable days
          if (emp.preferences?.unavailableDays?.includes(dow)) return false
          // Skip Friday-late cap
          if (isFriday && shift.type === 'late' && fd && fd.fridayLateCnt >= fridayLateMax) return false
          // Skip Monday-early cap
          if (isMonday && shift.type === 'early' && fd && fd.mondayEarlyCnt >= mondayEarlyMax) return false
          return true
        })
        .sort((a, b) => {
          const fdA = fairnessData.find(f => f.employeeId === a.id)
          const fdB = fairnessData.find(f => f.employeeId === b.id)
          const debtA = fdA ? (shift.type === 'early' ? fdA.earlyDebt : shift.type === 'late' ? fdA.lateDebt : fdA.midDebt) : 0
          const debtB = fdB ? (shift.type === 'early' ? fdB.earlyDebt : shift.type === 'late' ? fdB.lateDebt : fdB.midDebt) : 0
          return debtB - debtA  // higher debt → higher priority
        })

      let assigned = 0
      for (const emp of candidates) {
        if (assigned >= shift.minStaff + 1) break
        const fd = fairnessData.find(f => f.employeeId === emp.id)
        const targetPerWeek = Math.floor(emp.weeklyHours / 8)
        if (sessionCounts[emp.id].early + sessionCounts[emp.id].late + sessionCounts[emp.id].mid >= targetPerWeek) continue

        result[emp.id][dateStr] = shift.id
        sessionCounts[emp.id][shift.type as 'early' | 'late' | 'mid']++
        // Update running fairness debt for this session
        if (fd) {
          if (shift.type === 'early') fd.earlyDebt -= 1
          else if (shift.type === 'late') fd.lateDebt -= 1
          else if (shift.type === 'mid') fd.midDebt -= 1
        }
        assigned++
      }
    }
  }

  return result
}

// ─── Helper: fairness score label ────────────────────────────────────────────

export function fairnessLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Fair', color: 'text-green-600 bg-green-100' }
  if (score >= 60) return { label: 'OK', color: 'text-amber-600 bg-amber-100' }
  return { label: 'Unfair', color: 'text-red-600 bg-red-100' }
}
