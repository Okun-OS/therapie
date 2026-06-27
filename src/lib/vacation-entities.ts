// Echte Postgres-Persistenz für Urlaub (ersetzt VACATION_REQUESTS,
// VACATION_PREFERENCES und VACATION_RULES aus mock-data.ts). Server-only.
import { prisma } from './prisma'
import type { VacationRequest, VacationPlanPreference, VacationRules, VacationPlanEntry } from './types'

function toVacationRequest(row: any): VacationRequest {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    locationId: row.locationId,
    locationName: row.locationName,
    startDate: row.startDate,
    endDate: row.endDate,
    days: row.days,
    reason: row.reason ?? undefined,
    status: row.status,
    submittedAt: row.submittedAt,
    respondedAt: row.respondedAt ?? undefined,
    respondedBy: row.respondedBy ?? undefined,
  }
}

function toVacationPreference(row: any): VacationPlanPreference {
  return {
    employeeId: row.employeeId,
    hasChildren: row.hasChildren,
    schoolHolidayPriority: (row.schoolHolidayPriority as VacationPlanPreference['schoolHolidayPriority']) ?? undefined,
    preferredMonths: row.preferredMonths,
    preferredPeriod: row.preferredPeriod ?? undefined,
    notes: row.notes ?? undefined,
    priority: row.priority,
  }
}

function toVacationRules(row: any): VacationRules {
  return {
    facilityDescription: row.facilityDescription,
    maxConcurrent: row.maxConcurrent,
    customRules: row.customRules,
    schoolHolidayPriorityMode: row.schoolHolidayPriorityMode,
  }
}

// Schließt überfällige, noch unbeantwortete Anträge automatisch ab, damit sie
// nicht für immer als "Ausstehend" stehen bleiben.
export async function autoProcessPastDueVacationRequests(): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  await prisma.vacationRequest.updateMany({
    where: { status: 'pending', endDate: { lt: today } },
    data: { status: 'approved', respondedAt: today, respondedBy: 'System (automatisch)' },
  })
}

export async function listAllVacationRequests(): Promise<VacationRequest[]> {
  const rows = await prisma.vacationRequest.findMany()
  return rows.map(toVacationRequest)
}

export async function getVacationRequestsByLocation(locationId: string): Promise<VacationRequest[]> {
  const rows = await prisma.vacationRequest.findMany({ where: { locationId } })
  return rows.map(toVacationRequest)
}

export async function getVacationRequestsByEmployee(employeeId: string): Promise<VacationRequest[]> {
  const rows = await prisma.vacationRequest.findMany({ where: { employeeId } })
  return rows.map(toVacationRequest)
}

export async function setVacationRequestStatus(id: string, status: 'approved' | 'denied', respondedBy: string): Promise<void> {
  await prisma.vacationRequest.update({
    where: { id },
    data: { status, respondedAt: new Date().toISOString().split('T')[0], respondedBy },
  }).catch(() => null)
}

export async function addVacationRequest(input: {
  employeeId: string
  employeeName: string
  locationId: string
  locationName: string
  startDate: string
  endDate: string
  days: number
  reason?: string
}): Promise<VacationRequest> {
  const row = await prisma.vacationRequest.create({
    data: { ...input, status: 'pending', submittedAt: new Date().toISOString().split('T')[0] },
  })
  return toVacationRequest(row)
}

export async function getVacationRules(locationId: string): Promise<VacationRules | null> {
  const row = await prisma.vacationRules.findUnique({ where: { locationId } })
  return row ? toVacationRules(row) : null
}

export async function setVacationRules(locationId: string, rules: VacationRules): Promise<void> {
  await prisma.vacationRules.upsert({
    where: { locationId },
    create: { locationId, ...rules },
    update: { ...rules },
  })
}

export async function listAllVacationPreferences(): Promise<VacationPlanPreference[]> {
  const rows = await prisma.vacationPlanPreference.findMany()
  return rows.map(toVacationPreference)
}

export async function getVacationPreference(employeeId: string): Promise<VacationPlanPreference | null> {
  const row = await prisma.vacationPlanPreference.findUnique({ where: { employeeId } })
  return row ? toVacationPreference(row) : null
}

export async function setVacationPreference(pref: VacationPlanPreference): Promise<void> {
  const { employeeId, ...data } = pref
  await prisma.vacationPlanPreference.upsert({
    where: { employeeId },
    create: { employeeId, ...data },
    update: data,
  })
}

// Schritt 6 "Freigabe": macht aus einem generierten Jahresplan echte, bereits
// genehmigte Urlaubsanträge, damit sie Mitarbeitern angezeigt werden und von
// künftiger Dienstplangenerierung berücksichtigt werden.
export async function publishVacationPlan(locationId: string, locationName: string, entries: VacationPlanEntry[]): Promise<VacationRequest[]> {
  const created: VacationRequest[] = []
  const today = new Date().toISOString().split('T')[0]
  for (const entry of entries) {
    for (const slot of entry.slots) {
      const row = await prisma.vacationRequest.create({
        data: {
          employeeId: entry.employeeId,
          employeeName: entry.employeeName,
          locationId,
          locationName,
          startDate: slot.startDate,
          endDate: slot.endDate,
          days: slot.days,
          reason: entry.note,
          status: 'approved',
          submittedAt: today,
          respondedAt: today,
          respondedBy: 'KI-Jahresurlaubsplanung',
        },
      })
      created.push(toVacationRequest(row))
    }
  }
  return created
}
