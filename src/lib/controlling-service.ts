import { EMPLOYEES, LOCATIONS } from './mock-data'
import { getAbsenceInsights, getSubstitutionInsights, getPunctualityInsights, getWorkloadInsights } from './workforce-insights-service'
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
  kpis: {
    fillRate: number
    avgTimeToFillHours: number | null
    approvalRate: number
    punctualClockInRate: number
    avgWeeklyHoursTarget: number
    avgLoggedHoursTotal: number
    understaffedShiftSlots: number
    totalShiftSlots: number
  }
  statusItems: StatusItem[]
  recommendations: string[]
}

export async function getControllingSnapshot(locationId?: string): Promise<ControllingSnapshot> {
  const locationIds = scopeLocationIds(locationId)
  const employeeCount = EMPLOYEES.filter(e => e.role === 'employee' && e.active && e.locationId && locationIds.includes(e.locationId)).length

  const [absence, substitution, punctuality, workload, burnout, fluctuation, fairness] = await Promise.all([
    Promise.resolve(getAbsenceInsights(locationId)),
    getSubstitutionInsights(locationId),
    getPunctualityInsights(locationId),
    getWorkloadInsights(locationId),
    getBurnoutRisks(locationId),
    getFluctuationRisks(locationId),
    Promise.resolve(getFairnessInsights(locationId)),
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

  return {
    employeeCount,
    pendingVacationRequests: absence.pendingRequests,
    openSubstitutionRequests: substitution.openRequests,
    overtimeHotspots,
    criticalUnderstaffingDays,
    highBurnoutRisks,
    highFluctuationRisks,
    fairnessIssueCount,
    kpis: {
      fillRate: substitution.fillRate,
      avgTimeToFillHours: substitution.avgTimeToFillHours,
      approvalRate: absence.approvalRate,
      punctualClockInRate: punctuality.punctualClockInRate,
      avgWeeklyHoursTarget: workload.avgWeeklyHoursTarget,
      avgLoggedHoursTotal: workload.avgLoggedHoursTotal,
      understaffedShiftSlots: workload.understaffedShiftSlots,
      totalShiftSlots: workload.totalShiftSlots,
    },
    statusItems,
    recommendations,
  }
}
