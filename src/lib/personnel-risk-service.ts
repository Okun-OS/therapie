import { prisma } from './prisma'
import { EMPLOYEES, LOCATIONS, SHIFTS, TIME_LOGS, VACATION_REQUESTS } from './mock-data'
import { getFairnessInsights } from './fairness'
import { getRiskLevel, type RiskLevel } from './risk-constants'

function scopeLocationIds(locationId?: string): string[] {
  return locationId ? [locationId] : LOCATIONS.map(l => l.id)
}

export interface EmployeeRisk {
  employeeId: string
  employeeName: string
  score: number
  level: RiskLevel
  reasons: string[]
}

const DAILY_TARGET_MINUTES = 480

async function getOvertimeHoursByEmployee(employeeIds: string[]): Promise<Map<string, number>> {
  const overtimeMinutes = new Map<string, number>()
  if (employeeIds.length === 0) return overtimeMinutes

  for (const log of TIME_LOGS.filter(t => employeeIds.includes(t.employeeId))) {
    const minutes = log.totalMinutes || 0
    if (minutes > DAILY_TARGET_MINUTES) {
      overtimeMinutes.set(log.employeeId, (overtimeMinutes.get(log.employeeId) ?? 0) + (minutes - DAILY_TARGET_MINUTES))
    }
  }

  const realEntries = await prisma.timeClockEntry.findMany({ where: { employeeId: { in: employeeIds }, clockOut: { not: null } } })
  for (const entry of realEntries) {
    const minutes = Math.round((entry.clockOut!.getTime() - entry.clockIn.getTime()) / 60000)
    if (minutes > DAILY_TARGET_MINUTES) {
      overtimeMinutes.set(entry.employeeId, (overtimeMinutes.get(entry.employeeId) ?? 0) + (minutes - DAILY_TARGET_MINUTES))
    }
  }

  const overtimeHours = new Map<string, number>()
  for (const [id, minutes] of Array.from(overtimeMinutes)) overtimeHours.set(id, minutes / 60)
  return overtimeHours
}

// ─── Burnout-Risiko ──────────────────────────────────────────────────────────

export async function getBurnoutRisks(locationId?: string): Promise<EmployeeRisk[]> {
  const locationIds = scopeLocationIds(locationId)
  const employees = EMPLOYEES.filter(e => e.role === 'employee' && e.active && e.locationId && locationIds.includes(e.locationId))
  const fairnessData = getFairnessInsights(locationId)
  const overtimeHours = await getOvertimeHoursByEmployee(employees.map(e => e.id))

  return employees.map(emp => {
    const fd = fairnessData.find(f => f.employeeId === emp.id)
    const hours = Math.round((overtimeHours.get(emp.id) ?? 0) * 10) / 10
    const issuesCnt = fd?.issues.length ?? 0
    const fairnessScore = fd?.fairnessScore ?? 100

    const overtimeScore = Math.min(40, hours * 4)
    const issuesScore = Math.min(30, issuesCnt * 10)
    const fairnessScorePenalty = Math.max(0, (60 - fairnessScore) * 0.5)
    const score = Math.round(Math.min(100, overtimeScore + issuesScore + fairnessScorePenalty))

    const reasons: string[] = []
    if (hours > 0) reasons.push(`${hours}h Überstunden in den letzten 4 Wochen`)
    if (issuesCnt > 0) reasons.push(`${issuesCnt} Fairness-Auffälligkeit${issuesCnt > 1 ? 'en' : ''} (z. B. Wochenend- oder Sonderdienste)`)
    if (fairnessScore < 60) reasons.push(`Niedriger Fairness-Score (${fairnessScore})`)
    if (reasons.length === 0) reasons.push('Keine auffälligen Belastungssignale')

    return { employeeId: emp.id, employeeName: emp.name, score, level: getRiskLevel(score), reasons }
  }).sort((a, b) => b.score - a.score)
}

// ─── Kündigungs-/Fluktuationsrisiko ─────────────────────────────────────────

export async function getFluctuationRisks(locationId?: string): Promise<EmployeeRisk[]> {
  const locationIds = scopeLocationIds(locationId)
  const employees = EMPLOYEES.filter(e => e.role === 'employee' && e.active && e.locationId && locationIds.includes(e.locationId))
  const fairnessData = getFairnessInsights(locationId)
  const employeeIds = employees.map(e => e.id)

  const candidateGroups = employeeIds.length > 0
    ? await prisma.substitutionCandidate.groupBy({
        by: ['employeeId', 'responseStatus'],
        where: { employeeId: { in: employeeIds } },
        _count: { _all: true },
      })
    : []

  return employees.map(emp => {
    const vacations = VACATION_REQUESTS.filter(v => v.employeeId === emp.id)
    const denied = vacations.filter(v => v.status === 'denied').length
    const decided = vacations.filter(v => v.status === 'approved' || v.status === 'denied').length
    const denialRate = decided > 0 ? denied / decided : 0

    const own = candidateGroups.filter(g => g.employeeId === emp.id)
    const accepted = own.find(g => g.responseStatus === 'accepted')?._count._all ?? 0
    const declined = own.find(g => g.responseStatus === 'declined')?._count._all ?? 0
    const decidedOffers = accepted + declined
    const declineRate = decidedOffers > 0 ? declined / decidedOffers : 0

    const fd = fairnessData.find(f => f.employeeId === emp.id)
    const issuesCnt = fd?.issues.length ?? 0

    const score = Math.round(Math.min(100, denialRate * 40 + declineRate * 40 + Math.min(20, issuesCnt * 7)))

    const reasons: string[] = []
    if (denied > 0) reasons.push(`${denied} von ${decided} Urlaubsanträgen abgelehnt`)
    if (declined > 0) reasons.push(`${declined} von ${decidedOffers} Vertretungsangeboten abgelehnt`)
    if (issuesCnt > 0) reasons.push(`${issuesCnt} Fairness-Auffälligkeit${issuesCnt > 1 ? 'en' : ''}`)
    if (reasons.length === 0) reasons.push('Keine auffälligen Unzufriedenheitssignale')

    return { employeeId: emp.id, employeeName: emp.name, score, level: getRiskLevel(score), reasons }
  }).sort((a, b) => b.score - a.score)
}

// ─── Unterbesetzungsrisiko ───────────────────────────────────────────────────

export interface UnderstaffingRiskDay {
  date: string
  locationId: string
  locationName: string
  availableStaff: number
  requiredMinStaff: number
  deficit: number
}

export interface UnderstaffingInsights {
  windowDays: number
  riskDays: UnderstaffingRiskDay[]
}

export function getUnderstaffingRisk(locationId?: string, windowDays = 21): UnderstaffingInsights {
  const locationIds = scopeLocationIds(locationId)
  const riskDays: UnderstaffingRiskDay[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const locId of locationIds) {
    const location = LOCATIONS.find(l => l.id === locId)
    const employees = EMPLOYEES.filter(e => e.role === 'employee' && e.active && e.locationId === locId)
    const requiredMinStaff = SHIFTS.filter(s => s.locationId === locId).reduce((s, sh) => s + sh.minStaff, 0)
    const relevantVacations = VACATION_REQUESTS.filter(v => v.locationId === locId && (v.status === 'approved' || v.status === 'pending'))

    for (let i = 0; i < windowDays; i++) {
      const day = new Date(today)
      day.setDate(today.getDate() + i)
      const dow = day.getDay()
      if (dow === 0 || dow === 6) continue // shift plan only covers Mon-Fri, see admin/schedule weekDates slicing
      const dateStr = day.toISOString().split('T')[0]

      const onVacation = relevantVacations.filter(v => v.startDate <= dateStr && dateStr <= v.endDate).length
      const availableStaff = employees.length - onVacation
      const deficit = requiredMinStaff - availableStaff

      if (deficit > 0) {
        riskDays.push({ date: dateStr, locationId: locId, locationName: location?.name ?? locId, availableStaff, requiredMinStaff, deficit })
      }
    }
  }

  riskDays.sort((a, b) => a.date.localeCompare(b.date))
  return { windowDays, riskDays: riskDays.slice(0, 15) }
}
