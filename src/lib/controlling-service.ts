import { EMPLOYEES, LOCATIONS, OVERTIME_REQUESTS, getHoursAccountSummary } from './mock-data'
import {
  getAbsenceInsights, getSubstitutionInsights, getPunctualityInsights, getWorkloadInsights,
  getSicknessInsights, getPersonnelOverview, getWishFulfillmentInsights,
  type SicknessInsights, type PersonnelOverview,
} from './workforce-insights-service'
import { getBurnoutRisks, getFluctuationRisks, getUnderstaffingRisk, type EmployeeRisk, type UnderstaffingRiskDay } from './personnel-risk-service'
import { getFairnessInsights } from './fairness'

function scopeLocationIds(locationId?: string): string[] {
  return locationId ? [locationId] : LOCATIONS.map(l => l.id)
}

export type StatusLevel = 'green' | 'yellow' | 'red'

export interface StatusItem {
  level: StatusLevel
  message: string
}

export interface OvertimeHotspotSummary {
  employeeId: string
  employeeName: string
  hours: number
}

export interface ControllingSnapshot {
  employeeCount: number
  pendingVacationRequests: number
  openSubstitutionRequests: number
  overtimeHotspots: OvertimeHotspotSummary[]
  criticalUnderstaffingDays: UnderstaffingRiskDay[]
  highBurnoutRisks: EmployeeRisk[]
  highFluctuationRisks: EmployeeRisk[]
  fairnessIssueCount: number
  personnelOverview: PersonnelOverview & { openSubstitutions: number }
  sickness: SicknessInsights
  kpis: {
    fillRate: number
    avgTimeToFillHours: number | null
    approvalRate: number
    punctualClockInRate: number
    avgWeeklyHoursTarget: number
    avgLoggedHoursTotal: number
    understaffedShiftSlots: number
    totalShiftSlots: number
    overtimeHours: number
    undertimeHours: number
    sicknessRate: number
    vacationRate: number
    avgUtilizationRate: number
    scheduleStabilityRate: number
    wishFulfillmentRate: number
    avgFairnessScore: number
    avgStaffingRate: number
  }
  statusItems: StatusItem[]
  recommendations: string[]
  tasks: string[]
}

function getCurrentUndertimeHours(employeeIds: string[]): number {
  if (employeeIds.length === 0) return 0
  const now = new Date()
  const totalMinutes = employeeIds.reduce(
    (s, id) => s + getHoursAccountSummary(id, now.getFullYear(), now.getMonth() + 1).undertimeMinutes,
    0
  )
  return Math.round((totalMinutes / 60) * 10) / 10
}

export async function getControllingSnapshot(locationId?: string): Promise<ControllingSnapshot> {
  const locationIds = scopeLocationIds(locationId)
  const employees = EMPLOYEES.filter(e => e.role === 'employee' && e.active && e.locationId && locationIds.includes(e.locationId))
  const employeeCount = employees.length

  const [absence, substitution, punctuality, workload, burnout, fluctuation, fairness, sickness, personnelOverview, wishFulfillment] = await Promise.all([
    Promise.resolve(getAbsenceInsights(locationId)),
    getSubstitutionInsights(locationId),
    getPunctualityInsights(locationId),
    getWorkloadInsights(locationId),
    getBurnoutRisks(locationId),
    getFluctuationRisks(locationId),
    getFairnessInsights(locationId),
    Promise.resolve(getSicknessInsights(locationId)),
    Promise.resolve(getPersonnelOverview(locationId)),
    Promise.resolve(getWishFulfillmentInsights(locationId)),
  ])
  const understaffing = getUnderstaffingRisk(locationId, 7)

  const highBurnoutRisks = burnout.filter(r => r.level === 'hoch')
  const highFluctuationRisks = fluctuation.filter(r => r.level === 'hoch')
  const fairnessIssueCount = fairness.filter(f => f.issues.length > 0).length
  const criticalUnderstaffingDays = understaffing.riskDays
  const overtimeHotspots: OvertimeHotspotSummary[] = workload.overtimeHotspots.map(h => ({
    employeeId: h.employeeId,
    employeeName: h.employeeName,
    hours: Math.round((h.overtimeMinutes / 60) * 10) / 10,
  }))

  const undertimeHours = getCurrentUndertimeHours(employees.map(e => e.id))
  const avgUtilizationRate = workload.avgWeeklyHoursTarget > 0
    ? Math.round((workload.avgLoggedHoursTotal / workload.avgWeeklyHoursTarget) * 100)
    : 0
  const scheduleStabilityRate = workload.totalShiftSlots > 0
    ? Math.max(0, Math.round(100 - (substitution.totalRequests / workload.totalShiftSlots) * 100))
    : 100
  const avgFairnessScore = fairness.length > 0
    ? Math.round(fairness.reduce((s, f) => s + f.fairnessScore, 0) / fairness.length)
    : 100

  const pendingOvertimeRequests = OVERTIME_REQUESTS.filter(o => locationIds.includes(o.locationId) && o.status === 'pending').length

  const statusItems: StatusItem[] = []
  statusItems.push(
    criticalUnderstaffingDays.length > 0
      ? { level: 'red', message: `Kritische Mindestbesetzung an ${criticalUnderstaffingDays.length} Tag${criticalUnderstaffingDays.length > 1 ? 'en' : ''} in den nächsten 7 Tagen` }
      : { level: 'green', message: 'Keine kritischen Personalausfälle in den nächsten 7 Tagen' }
  )
  if (overtimeHotspots.length > 0) {
    statusItems.push({ level: 'yellow', message: `${overtimeHotspots[0].employeeName} hat aktuell ${overtimeHotspots[0].hours}h Überstunden` })
  }
  statusItems.push(
    absence.pendingRequests > 0
      ? { level: 'yellow', message: absence.pendingRequests > 1 ? `${absence.pendingRequests} Urlaubsanträge warten auf Freigabe` : '1 Urlaubsantrag wartet auf Freigabe' }
      : { level: 'green', message: 'Alle Urlaubsanträge sind entschieden' }
  )
  if (substitution.openRequests > 0) {
    statusItems.push({ level: 'yellow', message: `${substitution.openRequests} offene Vertretungsanfrage${substitution.openRequests > 1 ? 'n' : ''}` })
  } else {
    statusItems.push({ level: 'green', message: 'Keine offenen Vertretungsanfragen' })
  }
  if (highBurnoutRisks.length > 0) {
    statusItems.push({ level: 'red', message: `${highBurnoutRisks.length} Mitarbeiter mit hohem Burnout-Risiko` })
  }
  if (sickness.currentlyAbsentCount > 0) {
    statusItems.push({ level: 'yellow', message: `${sickness.currentlyAbsentCount} Mitarbeiter aktuell krank/abwesend` })
  }

  const recommendations: string[] = []
  if (criticalUnderstaffingDays.length > 0) {
    recommendations.push(`Vertretung für ${criticalUnderstaffingDays[0].date} (${criticalUnderstaffingDays[0].locationName}) organisieren`)
  }
  if (overtimeHotspots.length > 0) {
    recommendations.push(`Überstunden von ${overtimeHotspots[0].employeeName} in den nächsten Wochen reduzieren`)
  }
  if (absence.pendingRequests > 0) {
    recommendations.push(`${absence.pendingRequests} offene Urlaubsanträge prüfen`)
  }
  if (substitution.openRequests > 0) {
    recommendations.push(`${substitution.openRequests} offene Vertretungsanfragen verfolgen`)
  }
  if (highFluctuationRisks.length > 0) {
    recommendations.push(`Gespräch mit ${highFluctuationRisks[0].employeeName} (erhöhtes Fluktuationsrisiko) erwägen`)
  }
  if (recommendations.length === 0) {
    recommendations.push('Keine dringenden Maßnahmen erforderlich')
  }

  const tasks: string[] = []
  if (absence.pendingRequests > 0) {
    tasks.push(`${absence.pendingRequests} Urlaubsantrag${absence.pendingRequests > 1 ? 'e' : ''} freigeben`)
  }
  if (sickness.openVerifications > 0) {
    tasks.push(`${sickness.openVerifications} Krankmeldung${sickness.openVerifications > 1 ? 'en' : ''} verifizieren`)
  }
  if (pendingOvertimeRequests > 0) {
    tasks.push(pendingOvertimeRequests > 1 ? `${pendingOvertimeRequests} Überstundenanträge genehmigen` : '1 Überstundenantrag genehmigen')
  }
  if (substitution.openRequests > 0) {
    tasks.push(`${substitution.openRequests} offene Vertretungsanfrage${substitution.openRequests > 1 ? 'n' : ''} bearbeiten`)
  }
  if (highBurnoutRisks.length > 0) {
    tasks.push(`Gespräch mit ${highBurnoutRisks.length} Mitarbeiter${highBurnoutRisks.length > 1 ? 'n' : ''} mit hohem Burnout-Risiko führen`)
  }
  if (criticalUnderstaffingDays.length > 0) {
    tasks.push(`Mindestbesetzung an ${criticalUnderstaffingDays.length} Tag${criticalUnderstaffingDays.length > 1 ? 'en' : ''} sicherstellen`)
  }
  if (tasks.length === 0) {
    tasks.push('Keine offenen Aufgaben')
  }

  return {
    employeeCount,
    pendingVacationRequests: absence.pendingRequests,
    openSubstitutionRequests: substitution.openRequests,
    overtimeHotspots,
    criticalUnderstaffingDays,
    highBurnoutRisks,
    highFluctuationRisks,
    fairnessIssueCount,
    personnelOverview: { ...personnelOverview, openSubstitutions: substitution.openRequests },
    sickness,
    kpis: {
      fillRate: substitution.fillRate,
      avgTimeToFillHours: substitution.avgTimeToFillHours,
      approvalRate: absence.approvalRate,
      punctualClockInRate: punctuality.punctualClockInRate,
      avgWeeklyHoursTarget: workload.avgWeeklyHoursTarget,
      avgLoggedHoursTotal: workload.avgLoggedHoursTotal,
      understaffedShiftSlots: workload.understaffedShiftSlots,
      totalShiftSlots: workload.totalShiftSlots,
      overtimeHours: workload.totalOvertimeHours,
      undertimeHours,
      sicknessRate: sickness.sicknessRate,
      vacationRate: absence.vacationRate,
      avgUtilizationRate,
      scheduleStabilityRate,
      wishFulfillmentRate: wishFulfillment.fulfillmentRate,
      avgFairnessScore,
      avgStaffingRate: workload.avgStaffingRate,
    },
    statusItems,
    recommendations,
    tasks,
  }
}
