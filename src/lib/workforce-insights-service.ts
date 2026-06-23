import { prisma } from './prisma'
import { EMPLOYEES, LOCATIONS, SCHEDULE_ENTRIES, SHIFTS, TIME_LOGS, VACATION_REQUESTS } from './mock-data'
import { getLevelForPoints, LEVEL_ORDER, type WorkforceLevel } from './workforce-score-constants'
import { ESCALATION_ORDER, type EscalationStage } from './substitution-constants'

function scopeLocationIds(locationId?: string): string[] {
  return locationId ? [locationId] : LOCATIONS.map(l => l.id)
}

// ─── Pünktlichkeit & Workforce Score ────────────────────────────────────────

export interface PunctualityInsights {
  employeeCount: number
  averagePoints: number
  punctualClockInRate: number
  levelDistribution: Record<WorkforceLevel, number>
}

export async function getPunctualityInsights(locationId?: string): Promise<PunctualityInsights> {
  const locationIds = scopeLocationIds(locationId)
  const employeeIds = EMPLOYEES.filter(e => e.role === 'employee' && e.locationId && locationIds.includes(e.locationId)).map(e => e.id)

  const levelDistribution: Record<WorkforceLevel, number> = { bronze: 0, silber: 0, gold: 0, platin: 0, diamant: 0 }
  if (employeeIds.length === 0) {
    return { employeeCount: 0, averagePoints: 0, punctualClockInRate: 0, levelDistribution }
  }

  const grouped = await prisma.scoreEvent.groupBy({
    by: ['employeeId'],
    where: { employeeId: { in: employeeIds } },
    _sum: { points: true },
  })
  const pointsByEmployee = new Map(grouped.map(g => [g.employeeId, g._sum.points ?? 0]))
  let totalPoints = 0
  for (const id of employeeIds) {
    const points = pointsByEmployee.get(id) ?? 0
    totalPoints += points
    levelDistribution[getLevelForPoints(points)]++
  }

  const [totalClockIns, punctualClockIns] = await Promise.all([
    prisma.timeClockEntry.count({ where: { employeeId: { in: employeeIds } } }),
    prisma.scoreEvent.count({ where: { employeeId: { in: employeeIds }, type: 'punctual_clock_in' } }),
  ])

  return {
    employeeCount: employeeIds.length,
    averagePoints: Math.round(totalPoints / employeeIds.length),
    punctualClockInRate: totalClockIns > 0 ? Math.round((punctualClockIns / totalClockIns) * 100) : 0,
    levelDistribution,
  }
}

// ─── Vertretungs-KPIs ────────────────────────────────────────────────────────

export interface SubstitutionInsights {
  totalRequests: number
  filledRequests: number
  openRequests: number
  unresolvedRequests: number
  fillRate: number
  avgTimeToFillHours: number | null
  escalationDistribution: Record<EscalationStage, number>
}

export async function getSubstitutionInsights(locationId?: string): Promise<SubstitutionInsights> {
  const locationIds = scopeLocationIds(locationId)
  const requests = await prisma.substitutionRequest.findMany({ where: { locationId: { in: locationIds } } })

  const filled = requests.filter(r => r.status === 'filled')
  const open = requests.filter(r => r.status === 'open')
  const unresolved = requests.filter(r => r.status === 'cancelled' || r.status === 'expired')

  const fillTimes = filled
    .filter(r => r.filledAt)
    .map(r => (r.filledAt!.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60))

  const escalationDistribution: Record<EscalationStage, number> = { group: 0, location: 0, organization: 0, springerpool: 0 }
  for (const r of requests) {
    escalationDistribution[r.escalationStage as EscalationStage]++
  }

  return {
    totalRequests: requests.length,
    filledRequests: filled.length,
    openRequests: open.length,
    unresolvedRequests: unresolved.length,
    fillRate: requests.length > 0 ? Math.round((filled.length / requests.length) * 100) : 0,
    avgTimeToFillHours: fillTimes.length > 0 ? Math.round((fillTimes.reduce((s, h) => s + h, 0) / fillTimes.length) * 10) / 10 : null,
    escalationDistribution,
  }
}

// ─── Abwesenheit & Urlaub ────────────────────────────────────────────────────

export interface AbsenceInsights {
  totalRequests: number
  pendingRequests: number
  approvedRequests: number
  deniedRequests: number
  approvalRate: number
  approvedDaysTotal: number
}

export function getAbsenceInsights(locationId?: string): AbsenceInsights {
  const locationIds = scopeLocationIds(locationId)
  const requests = VACATION_REQUESTS.filter(v => locationIds.includes(v.locationId))

  const pending = requests.filter(v => v.status === 'pending')
  const approved = requests.filter(v => v.status === 'approved')
  const denied = requests.filter(v => v.status === 'denied')
  const decided = approved.length + denied.length

  return {
    totalRequests: requests.length,
    pendingRequests: pending.length,
    approvedRequests: approved.length,
    deniedRequests: denied.length,
    approvalRate: decided > 0 ? Math.round((approved.length / decided) * 100) : 0,
    approvedDaysTotal: approved.reduce((s, v) => s + v.days, 0),
  }
}

// ─── Auslastung & Überstunden ────────────────────────────────────────────────

export interface OvertimeHotspot {
  employeeId: string
  employeeName: string
  overtimeMinutes: number
}

export interface WorkloadInsights {
  avgWeeklyHoursTarget: number
  avgLoggedHoursTotal: number
  overtimeHotspots: OvertimeHotspot[]
  understaffedShiftSlots: number
  totalShiftSlots: number
}

const DAILY_TARGET_MINUTES = 480 // 8h reference shift, consistent with existing time-tracking "isOver" logic

export async function getWorkloadInsights(locationId?: string): Promise<WorkloadInsights> {
  const locationIds = scopeLocationIds(locationId)
  const employees = EMPLOYEES.filter(e => e.role === 'employee' && e.locationId && locationIds.includes(e.locationId))
  const employeeIds = employees.map(e => e.id)

  const avgWeeklyHoursTarget = employees.length > 0
    ? Math.round(employees.reduce((s, e) => s + e.weeklyHours, 0) / employees.length)
    : 0

  const mockLogs = TIME_LOGS.filter(t => employeeIds.includes(t.employeeId))
  const realEntries = employeeIds.length > 0
    ? await prisma.timeClockEntry.findMany({ where: { employeeId: { in: employeeIds }, clockOut: { not: null } } })
    : []

  const overtimeByEmployee = new Map<string, number>()
  let totalLoggedMinutes = 0

  for (const log of mockLogs) {
    const minutes = log.totalMinutes || 0
    totalLoggedMinutes += minutes
    if (minutes > DAILY_TARGET_MINUTES) {
      overtimeByEmployee.set(log.employeeId, (overtimeByEmployee.get(log.employeeId) ?? 0) + (minutes - DAILY_TARGET_MINUTES))
    }
  }

  for (const entry of realEntries) {
    const minutes = Math.round((entry.clockOut!.getTime() - entry.clockIn.getTime()) / 60000)
    totalLoggedMinutes += minutes
    if (minutes > DAILY_TARGET_MINUTES) {
      overtimeByEmployee.set(entry.employeeId, (overtimeByEmployee.get(entry.employeeId) ?? 0) + (minutes - DAILY_TARGET_MINUTES))
    }
  }

  const overtimeHotspots: OvertimeHotspot[] = Array.from(overtimeByEmployee.entries())
    .map(([employeeId, overtimeMinutes]) => ({
      employeeId,
      employeeName: employees.find(e => e.id === employeeId)?.name ?? employeeId,
      overtimeMinutes,
    }))
    .sort((a, b) => b.overtimeMinutes - a.overtimeMinutes)
    .slice(0, 5)

  const locationShifts = SHIFTS.filter(s => locationIds.includes(s.locationId))
  const relevantEntries = SCHEDULE_ENTRIES.filter(e => locationIds.includes(e.locationId))
  const slotKeys = new Set(relevantEntries.map(e => `${e.date}|${e.shiftId}`))

  let understaffedShiftSlots = 0
  for (const key of Array.from(slotKeys)) {
    const [date, shiftId] = key.split('|')
    const shift = locationShifts.find(s => s.id === shiftId)
    if (!shift) continue
    const assigned = relevantEntries.filter(e => e.date === date && e.shiftId === shiftId).length
    if (assigned < shift.minStaff) understaffedShiftSlots++
  }

  return {
    avgWeeklyHoursTarget,
    avgLoggedHoursTotal: employees.length > 0 ? Math.round(totalLoggedMinutes / 60 / employees.length) : 0,
    overtimeHotspots,
    understaffedShiftSlots,
    totalShiftSlots: slotKeys.size,
  }
}

export const ESCALATION_STAGE_ORDER = ESCALATION_ORDER
export const WORKFORCE_LEVEL_ORDER = LEVEL_ORDER
