import { getOvertimeRequestsByLocation, getHoursAccountSummary } from './time-tracking-entities'
import { getAllEntriesForLocation } from './schedule-entities'
import { getVacationRequestsByLocation } from './vacation-entities'
import { listEmployees, listLocations } from './entities'
import {
  getAbsenceInsights, getSubstitutionInsights, getPunctualityInsights, getWorkloadInsights,
  getSicknessInsights, getPersonnelOverview, getWishFulfillmentInsights,
  type SicknessInsights, type PersonnelOverview, type OvertimeTrendPoint,
} from './workforce-insights-service'
import { getBurnoutRisks, getFluctuationRisks, getUnderstaffingRisk, type EmployeeRisk, type UnderstaffingRiskDay } from './personnel-risk-service'
import { getFairnessInsights } from './fairness'
import { toDateString, addDays, formatDate } from './utils'

async function scopeLocationIds(locationId?: string, customerId?: string): Promise<string[]> {
  return locationId ? [locationId] : (await listLocations(customerId)).map(l => l.id)
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
  overtimeTrend: OvertimeTrendPoint[]
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

async function getCurrentUndertimeHours(employees: { id: string; weeklyHours: number }[]): Promise<number> {
  if (employees.length === 0) return 0
  const now = new Date()
  const summaries = await Promise.all(
    employees.map(e => getHoursAccountSummary(e.id, now.getFullYear(), now.getMonth() + 1, e.weeklyHours))
  )
  const totalMinutes = summaries.reduce((s, summary) => s + summary.undertimeMinutes, 0)
  return Math.round((totalMinutes / 60) * 10) / 10
}

export async function getControllingSnapshot(locationId?: string, customerId?: string): Promise<ControllingSnapshot> {
  const locationIds = await scopeLocationIds(locationId, customerId)
  const allEmployees = await listEmployees(customerId)
  const employees = allEmployees.filter(e => e.role === 'employee' && e.active && e.locationId && locationIds.includes(e.locationId))
  const employeeCount = employees.length

  const [absence, substitution, punctuality, workload, burnout, fluctuation, fairness, sickness, personnelOverview, wishFulfillment] = await Promise.all([
    Promise.resolve(getAbsenceInsights(locationId, customerId)),
    getSubstitutionInsights(locationId, customerId),
    getPunctualityInsights(locationId, customerId),
    getWorkloadInsights(locationId, customerId),
    getBurnoutRisks(locationId, customerId),
    getFluctuationRisks(locationId, customerId),
    getFairnessInsights(locationId, customerId),
    Promise.resolve(getSicknessInsights(locationId, customerId)),
    Promise.resolve(getPersonnelOverview(locationId, customerId)),
    Promise.resolve(getWishFulfillmentInsights(locationId, customerId)),
  ])
  const understaffing = await getUnderstaffingRisk(locationId, customerId, 7)

  const highBurnoutRisks = burnout.filter(r => r.level === 'hoch')
  const highFluctuationRisks = fluctuation.filter(r => r.level === 'hoch')
  const fairnessIssueCount = fairness.filter(f => f.issues.length > 0).length
  const criticalUnderstaffingDays = understaffing.riskDays
  const overtimeHotspots: OvertimeHotspotSummary[] = workload.overtimeHotspots.map(h => ({
    employeeId: h.employeeId,
    employeeName: h.employeeName,
    hours: Math.round((h.overtimeMinutes / 60) * 10) / 10,
  }))

  const undertimeHours = await getCurrentUndertimeHours(employees)
  const avgUtilizationRate = workload.avgWeeklyHoursTarget > 0
    ? Math.round((workload.avgLoggedHoursTotal / workload.avgWeeklyHoursTarget) * 100)
    : 0
  const scheduleStabilityRate = workload.totalShiftSlots > 0
    ? Math.max(0, Math.round(100 - (substitution.totalRequests / workload.totalShiftSlots) * 100))
    : 100
  const avgFairnessScore = fairness.length > 0
    ? Math.round(fairness.reduce((s, f) => s + f.fairnessScore, 0) / fairness.length)
    : 100

  const overtimeRequestsByLocation = await Promise.all(locationIds.map(id => getOvertimeRequestsByLocation(id)))
  const pendingOvertimeRequests = overtimeRequestsByLocation.flat().filter(o => o.status === 'pending').length

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
  if (sickness.groupHotspots.length > 0) {
    statusItems.push({ level: 'yellow', message: `In Gruppe ${sickness.groupHotspots[0].gruppe} häufen sich Krankmeldungen (${sickness.groupHotspots[0].rate}%)` })
  }
  const overtimeTrend = workload.overtimeTrend
  const overtimeRising = overtimeTrend.length === 3 && overtimeTrend[2].overtimeHours > overtimeTrend[0].overtimeHours
    && overtimeTrend[1].overtimeHours >= overtimeTrend[0].overtimeHours
  if (overtimeRising) {
    statusItems.push({ level: 'yellow', message: `Überstunden steigen seit ${overtimeTrend[0].label} kontinuierlich an` })
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
  if (sickness.groupHotspots.length > 0) {
    recommendations.push(`Engpass in Gruppe ${sickness.groupHotspots[0].gruppe} prüfen (Krankheitsquote ${sickness.groupHotspots[0].rate}%)`)
  }
  if (overtimeRising) {
    recommendations.push('Steigenden Überstundentrend der letzten Monate gegensteuern')
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
    overtimeTrend,
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

export interface EarlyWarning {
  type: string
  title: string
  body: string
}

function hasDateOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

export async function getEarlyWarnings(locationId?: string, customerId?: string): Promise<EarlyWarning[]> {
  const locationIds = await scopeLocationIds(locationId, customerId)
  const snapshot = await getControllingSnapshot(locationId, customerId)
  const warnings: EarlyWarning[] = []

  if (snapshot.criticalUnderstaffingDays.length > 0) {
    const d = snapshot.criticalUnderstaffingDays[0]
    warnings.push({
      type: 'critical-understaffing',
      title: 'Kritische Mindestbesetzung',
      body: `Am ${formatDate(d.date)} droht in ${d.locationName} eine Unterbesetzung (${d.availableStaff}/${d.requiredMinStaff} Mitarbeiter verfügbar).`,
    })
  }

  if (snapshot.kpis.sicknessRate >= 10) {
    warnings.push({
      type: 'high-sickness-rate',
      title: 'Hohe Krankheitsquote',
      body: `Die Krankheitsquote liegt aktuell bei ${snapshot.kpis.sicknessRate}%.`,
    })
  }

  if (snapshot.overtimeHotspots.length > 0 && (snapshot.overtimeHotspots.length >= 3 || snapshot.overtimeHotspots[0].hours >= 20)) {
    warnings.push({
      type: 'high-overtime',
      title: 'Viele offene Überstunden',
      body: `${snapshot.overtimeHotspots[0].employeeName} hat aktuell ${snapshot.overtimeHotspots[0].hours}h Überstunden, insgesamt ${snapshot.overtimeHotspots.length} Mitarbeiter betroffen.`,
    })
  }

  if (snapshot.pendingVacationRequests > 0) {
    warnings.push({
      type: 'open-vacation-requests',
      title: 'Offene Urlaubsanträge',
      body: snapshot.pendingVacationRequests > 1
        ? `${snapshot.pendingVacationRequests} Urlaubsanträge warten auf Entscheidung.`
        : '1 Urlaubsantrag wartet auf Entscheidung.',
    })
  }

  if (snapshot.personnelOverview.openPositions > 0) {
    warnings.push({
      type: 'personnel-shortage',
      title: 'Personalmangel',
      body: `${snapshot.personnelOverview.openPositions} offene Stelle${snapshot.personnelOverview.openPositions > 1 ? 'n' : ''} sind aktuell unbesetzt.`,
    })
  }

  const today = toDateString(new Date())
  const in7Days = addDays(today, 7)
  const [allLocations, allEmployeesForWarnings] = await Promise.all([listLocations(customerId), listEmployees(customerId)])
  const scopedLocations = allLocations.filter(l => locationIds.includes(l.id))
  const entriesByLocation = await Promise.all(scopedLocations.map(l => getAllEntriesForLocation(l.id)))
  const locationsWithoutScheduling = scopedLocations.filter((l, idx) => {
    const hasActiveEmployees = allEmployeesForWarnings.some(e => e.role === 'employee' && e.active && e.locationId === l.id)
    if (!hasActiveEmployees) return false
    return !entriesByLocation[idx].some(s => s.date >= today && s.date <= in7Days)
  })
  if (locationsWithoutScheduling.length > 0) {
    warnings.push({
      type: 'missing-scheduling',
      title: 'Fehlende Dienstplanung',
      body: `Für ${locationsWithoutScheduling[0].name} ist für die nächsten 7 Tage noch kein Dienstplan erstellt.`,
    })
  }

  const relevantVacationRequests = (await Promise.all(locationIds.map(id => getVacationRequestsByLocation(id))))
    .flat()
    .filter(v => v.status !== 'denied')
  let vacationConflict: { a: typeof relevantVacationRequests[number]; b: typeof relevantVacationRequests[number] } | null = null
  for (let i = 0; i < relevantVacationRequests.length && !vacationConflict; i++) {
    for (let j = i + 1; j < relevantVacationRequests.length; j++) {
      const a = relevantVacationRequests[i]
      const b = relevantVacationRequests[j]
      if (a.locationId === b.locationId && a.employeeId !== b.employeeId && hasDateOverlap(a.startDate, a.endDate, b.startDate, b.endDate)) {
        vacationConflict = { a, b }
        break
      }
    }
  }
  if (vacationConflict) {
    warnings.push({
      type: 'vacation-planning-conflict',
      title: 'Konflikte in der Urlaubsplanung',
      body: `${vacationConflict.a.employeeName} und ${vacationConflict.b.employeeName} (${vacationConflict.a.locationName}) haben überlappende Urlaubszeiträume beantragt.`,
    })
  }

  return warnings
}
