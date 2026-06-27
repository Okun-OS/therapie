import { prisma } from './prisma'
import { getAbsencesByLocation, getTimeLogsByEmployee } from './time-tracking-entities'
import { listShiftsByLocation, getAllEntriesForLocation, getWishSubmissionsByLocation } from './schedule-entities'
import { getVacationRequestsByLocation } from './vacation-entities'
import { listEmployees, listLocations } from './entities'
import { getLevelForPoints, LEVEL_ORDER, type WorkforceLevel } from './workforce-score-constants'
import { ESCALATION_ORDER, type EscalationStage } from './substitution-constants'

async function scopeLocationIds(locationId?: string): Promise<string[]> {
  return locationId ? [locationId] : (await listLocations()).map(l => l.id)
}

// ─── Pünktlichkeit & Workforce Score ────────────────────────────────────────

export interface PunctualityInsights {
  employeeCount: number
  averagePoints: number
  punctualClockInRate: number
  levelDistribution: Record<WorkforceLevel, number>
}

export async function getPunctualityInsights(locationId?: string): Promise<PunctualityInsights> {
  const locationIds = await scopeLocationIds(locationId)
  const allEmployees = await listEmployees()
  const employeeIds = allEmployees.filter(e => e.role === 'employee' && e.locationId && locationIds.includes(e.locationId)).map(e => e.id)

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
  const locationIds = await scopeLocationIds(locationId)
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
  vacationRate: number
}

export async function getAbsenceInsights(locationId?: string): Promise<AbsenceInsights> {
  const locationIds = await scopeLocationIds(locationId)
  const requests = (await Promise.all(locationIds.map(id => getVacationRequestsByLocation(id)))).flat()
  const allEmployees = await listEmployees()
  const employeeCount = allEmployees.filter(e => e.role === 'employee' && e.locationId && locationIds.includes(e.locationId)).length

  const pending = requests.filter(v => v.status === 'pending')
  const approved = requests.filter(v => v.status === 'approved')
  const denied = requests.filter(v => v.status === 'denied')
  const decided = approved.length + denied.length
  const approvedDaysTotal = approved.reduce((s, v) => s + v.days, 0)

  return {
    totalRequests: requests.length,
    pendingRequests: pending.length,
    approvedRequests: approved.length,
    deniedRequests: denied.length,
    approvalRate: decided > 0 ? Math.round((approved.length / decided) * 100) : 0,
    approvedDaysTotal,
    vacationRate: employeeCount > 0 ? Math.round((approvedDaysTotal / (employeeCount * 20)) * 1000) / 10 : 0,
  }
}

// ─── Krankheit & Fehlzeiten ──────────────────────────────────────────────────

export interface SicknessInsights {
  employeeCount: number
  currentlyAbsentCount: number
  totalSickDays: number
  totalOtherAbsenceDays: number
  sicknessRate: number
  openVerifications: number
  topSickEmployees: Array<{ employeeId: string; employeeName: string; sickDays: number }>
  groupHotspots: Array<{ gruppe: string; sickDays: number; employeeCount: number; rate: number }>
}

// Häufung von Krankmeldungen je Gruppe: Quote spürbar über dem Einrichtungs-
// durchschnitt deutet auf ein Muster/Engpass in dieser Gruppe hin (Spec: "In
// Gruppe Blau häufen sich Krankmeldungen").
const GROUP_HOTSPOT_THRESHOLD_FACTOR = 1.5

export async function getSicknessInsights(locationId?: string): Promise<SicknessInsights> {
  const locationIds = await scopeLocationIds(locationId)
  const allEmployees = await listEmployees()
  const employees = allEmployees.filter(e => e.role === 'employee' && e.locationId && locationIds.includes(e.locationId))
  const absences = (await Promise.all(locationIds.map(id => getAbsencesByLocation(id)))).flat()

  const todayStr = new Date().toISOString().split('T')[0]
  const currentlyAbsentCount = absences.filter(a => a.startDate <= todayStr && todayStr <= a.endDate).length

  const sickByEmployee = new Map<string, number>()
  let totalSickDays = 0
  let totalOtherAbsenceDays = 0
  for (const a of absences) {
    if (a.type === 'krankheit') {
      totalSickDays += a.days
      sickByEmployee.set(a.employeeId, (sickByEmployee.get(a.employeeId) ?? 0) + a.days)
    } else {
      totalOtherAbsenceDays += a.days
    }
  }

  const topSickEmployees = Array.from(sickByEmployee.entries())
    .map(([employeeId, sickDays]) => ({
      employeeId,
      employeeName: employees.find(e => e.id === employeeId)?.name ?? employeeId,
      sickDays,
    }))
    .sort((a, b) => b.sickDays - a.sickDays)
    .slice(0, 5)

  const overallRate = employees.length > 0 ? totalSickDays / (employees.length * 20) : 0
  const employeesByGroup = new Map<string, number>()
  for (const e of employees) {
    if (!e.gruppe) continue
    employeesByGroup.set(e.gruppe, (employeesByGroup.get(e.gruppe) ?? 0) + 1)
  }
  const groupHotspots = Array.from(employeesByGroup.entries())
    .map(([gruppe, employeeCount]) => {
      const sickDays = employees
        .filter(e => e.gruppe === gruppe)
        .reduce((s, e) => s + (sickByEmployee.get(e.id) ?? 0), 0)
      const rate = employeeCount > 0 ? Math.round((sickDays / (employeeCount * 20)) * 1000) / 10 : 0
      return { gruppe, sickDays, employeeCount, rate }
    })
    .filter(g => g.sickDays > 0 && overallRate > 0 && g.rate / 100 >= overallRate * GROUP_HOTSPOT_THRESHOLD_FACTOR)
    .sort((a, b) => b.rate - a.rate)

  return {
    employeeCount: employees.length,
    currentlyAbsentCount,
    totalSickDays,
    totalOtherAbsenceDays,
    sicknessRate: employees.length > 0 ? Math.round((totalSickDays / (employees.length * 20)) * 1000) / 10 : 0,
    openVerifications: absences.filter(a => a.verificationStatus === 'offen').length,
    topSickEmployees,
    groupHotspots,
  }
}

// ─── Personalübersicht (heute) ───────────────────────────────────────────────

export interface PersonnelOverview {
  totalEmployees: number
  presentToday: number
  sickToday: number
  trainingToday: number
  otherAbsenceToday: number
  onVacationToday: number
  openPositions: number
}

export async function getPersonnelOverview(locationId?: string): Promise<PersonnelOverview> {
  const locationIds = await scopeLocationIds(locationId)
  const allEmployees = await listEmployees()
  const employees = allEmployees.filter(e => e.role === 'employee' && e.active && e.locationId && locationIds.includes(e.locationId))
  const absences = (await Promise.all(locationIds.map(id => getAbsencesByLocation(id)))).flat()
  const vacations = (await Promise.all(locationIds.map(id => getVacationRequestsByLocation(id)))).flat().filter(v => v.status === 'approved')

  const todayStr = new Date().toISOString().split('T')[0]
  const activeToday = absences.filter(a => a.startDate <= todayStr && todayStr <= a.endDate)
  const sickToday = activeToday.filter(a => a.type === 'krankheit').length
  const trainingToday = activeToday.filter(a => a.type === 'fortbildung').length
  const otherAbsenceToday = activeToday.filter(a => a.type !== 'krankheit' && a.type !== 'fortbildung').length
  const onVacationToday = vacations.filter(v => v.startDate <= todayStr && todayStr <= v.endDate).length

  // "Offene Stellen": Soll-Personalstärke der Einrichtung (Location.employeeCount)
  // abzüglich tatsächlich aktiver Mitarbeiter – unbesetzte Planstellen, die
  // nachbesetzt werden müssen (nicht zu verwechseln mit "Offene Vertretungen").
  const allLocations = await listLocations()
  const locations = allLocations.filter(l => locationIds.includes(l.id))
  const targetHeadcount = locations.reduce((sum, l) => sum + l.employeeCount, 0)
  const openPositions = Math.max(0, targetHeadcount - employees.length)

  return {
    totalEmployees: employees.length,
    presentToday: Math.max(0, employees.length - sickToday - trainingToday - otherAbsenceToday - onVacationToday),
    sickToday,
    trainingToday,
    otherAbsenceToday,
    onVacationToday,
    openPositions,
  }
}

// ─── Wunschdienst-Erfüllung ──────────────────────────────────────────────────

export interface WishFulfillmentInsights {
  totalWishes: number
  fulfilledWishes: number
  notFulfilledWishes: number
  pendingWishes: number
  fulfillmentRate: number
}

export async function getWishFulfillmentInsights(locationId?: string): Promise<WishFulfillmentInsights> {
  const locationIds = await scopeLocationIds(locationId)
  const wishes = (await Promise.all(locationIds.map(id => getWishSubmissionsByLocation(id)))).flat()

  const fulfilled = wishes.filter(w => w.status === 'fulfilled')
  const notFulfilled = wishes.filter(w => w.status === 'not_fulfilled')
  const pending = wishes.filter(w => w.status === 'pending')
  const decided = fulfilled.length + notFulfilled.length

  return {
    totalWishes: wishes.length,
    fulfilledWishes: fulfilled.length,
    notFulfilledWishes: notFulfilled.length,
    pendingWishes: pending.length,
    fulfillmentRate: decided > 0 ? Math.round((fulfilled.length / decided) * 100) : 0,
  }
}

// ─── Auslastung & Überstunden ────────────────────────────────────────────────

export interface OvertimeHotspot {
  employeeId: string
  employeeName: string
  overtimeMinutes: number
}

export interface OvertimeTrendPoint {
  month: string
  label: string
  overtimeHours: number
}

export interface WorkloadInsights {
  avgWeeklyHoursTarget: number
  avgLoggedHoursTotal: number
  overtimeHotspots: OvertimeHotspot[]
  totalOvertimeHours: number
  overtimeTrend: OvertimeTrendPoint[]
  understaffedShiftSlots: number
  totalShiftSlots: number
  avgStaffingRate: number
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
const OVERTIME_TREND_MONTHS = 3

function overtimeMinutesForLog(minutes: number): number {
  return minutes > DAILY_TARGET_MINUTES ? minutes - DAILY_TARGET_MINUTES : 0
}

const DAILY_TARGET_MINUTES = 480 // 8h reference shift, consistent with existing time-tracking "isOver" logic

export async function getWorkloadInsights(locationId?: string): Promise<WorkloadInsights> {
  const locationIds = await scopeLocationIds(locationId)
  const allEmployees = await listEmployees()
  const employees = allEmployees.filter(e => e.role === 'employee' && e.locationId && locationIds.includes(e.locationId))
  const employeeIds = employees.map(e => e.id)

  const avgWeeklyHoursTarget = employees.length > 0
    ? Math.round(employees.reduce((s, e) => s + e.weeklyHours, 0) / employees.length)
    : 0

  const mockLogs = (await Promise.all(employeeIds.map(id => getTimeLogsByEmployee(id)))).flat()
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

  const totalOvertimeMinutes = Array.from(overtimeByEmployee.values()).reduce((s, m) => s + m, 0)

  const overtimeMinutesByMonth = new Map<string, number>()
  const now = new Date()
  const monthKeys: string[] = []
  for (let i = OVERTIME_TREND_MONTHS - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthKeys.push(key)
    overtimeMinutesByMonth.set(key, 0)
  }
  for (const log of mockLogs) {
    const key = log.date.slice(0, 7)
    if (overtimeMinutesByMonth.has(key)) {
      overtimeMinutesByMonth.set(key, overtimeMinutesByMonth.get(key)! + overtimeMinutesForLog(log.totalMinutes || 0))
    }
  }
  for (const entry of realEntries) {
    const key = `${entry.clockIn.getFullYear()}-${String(entry.clockIn.getMonth() + 1).padStart(2, '0')}`
    if (overtimeMinutesByMonth.has(key)) {
      const minutes = Math.round((entry.clockOut!.getTime() - entry.clockIn.getTime()) / 60000)
      overtimeMinutesByMonth.set(key, overtimeMinutesByMonth.get(key)! + overtimeMinutesForLog(minutes))
    }
  }
  const overtimeTrend: OvertimeTrendPoint[] = monthKeys.map(key => {
    const monthIndex = Number(key.slice(5, 7)) - 1
    return {
      month: key,
      label: MONTH_LABELS[monthIndex],
      overtimeHours: Math.round((overtimeMinutesByMonth.get(key)! / 60) * 10) / 10,
    }
  })

  const locationShifts = (await Promise.all(locationIds.map(id => listShiftsByLocation(id)))).flat()
  const relevantEntries = (await Promise.all(locationIds.map(id => getAllEntriesForLocation(id)))).flat()
  const slotKeys = new Set(relevantEntries.map(e => `${e.date}|${e.shiftId}`))

  let understaffedShiftSlots = 0
  let staffingRatioSum = 0
  let staffingRatioCount = 0
  for (const key of Array.from(slotKeys)) {
    const [date, shiftId] = key.split('|')
    const shift = locationShifts.find(s => s.id === shiftId)
    if (!shift) continue
    const assigned = relevantEntries.filter(e => e.date === date && e.shiftId === shiftId).length
    if (assigned < shift.minStaff) understaffedShiftSlots++
    if (shift.minStaff > 0) {
      staffingRatioSum += assigned / shift.minStaff
      staffingRatioCount++
    }
  }

  return {
    avgWeeklyHoursTarget,
    avgLoggedHoursTotal: employees.length > 0 ? Math.round(totalLoggedMinutes / 60 / employees.length) : 0,
    overtimeHotspots,
    totalOvertimeHours: Math.round((totalOvertimeMinutes / 60) * 10) / 10,
    overtimeTrend,
    understaffedShiftSlots,
    totalShiftSlots: slotKeys.size,
    avgStaffingRate: staffingRatioCount > 0 ? Math.round((staffingRatioSum / staffingRatioCount) * 100) : 0,
  }
}

export const ESCALATION_STAGE_ORDER = ESCALATION_ORDER
export const WORKFORCE_LEVEL_ORDER = LEVEL_ORDER
