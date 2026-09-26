// Echte Postgres-Persistenz für Urlaub (ersetzt VACATION_REQUESTS,
// VACATION_PREFERENCES und VACATION_RULES aus mock-data.ts). Server-only.
import { prisma } from './prisma'
import { countWorkdays } from './workdays'
import { getEmployeesByLocation, getLocationById } from './entities'
import type { VacationRequest, VacationPlanPreference, VacationRules, VacationPlanEntry, Employee, ClosurePeriod } from './types'

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

/** Setzt den Status eines Antrags und gleicht das Urlaubskonto (Employee.vacationDaysUsed)
 * ab, damit der Saldo immer den tatsächlich genehmigten Anträgen entspricht – egal ob
 * erstmalig genehmigt/abgelehnt oder eine frühere Entscheidung korrigiert wird. */
export async function setVacationRequestStatus(id: string, status: 'approved' | 'denied', respondedBy: string): Promise<VacationRequest | null> {
  const existing = await prisma.vacationRequest.findUnique({ where: { id } })
  if (!existing) return null

  const row = await prisma.vacationRequest.update({
    where: { id },
    data: { status, respondedAt: new Date().toISOString().split('T')[0], respondedBy },
  })

  if (status === 'approved' && existing.status !== 'approved') {
    await prisma.employee.update({ where: { id: existing.employeeId }, data: { vacationDaysUsed: { increment: existing.days } } }).catch(() => null)
  } else if (status === 'denied' && existing.status === 'approved') {
    await prisma.employee.update({ where: { id: existing.employeeId }, data: { vacationDaysUsed: { decrement: existing.days } } }).catch(() => null)
  }

  return toVacationRequest(row)
}

/** Berechnet die tatsächlich abzuziehenden Urlaubstage (nur Arbeitstage, siehe
 * lib/workdays.ts) und legt den Antrag damit an – days aus dem Client-Body wird
 * bewusst ignoriert, damit die Berechnung serverseitig autoritativ bleibt. */
export async function addVacationRequest(input: {
  employeeId: string
  employeeName: string
  locationId: string
  locationName: string
  startDate: string
  endDate: string
  reason?: string
}, employee?: Pick<Employee, 'preferences'> | null, state?: string): Promise<VacationRequest> {
  const days = countWorkdays(input.startDate, input.endDate, employee, state)
  const row = await prisma.vacationRequest.create({
    data: { ...input, days, status: 'pending', submittedAt: new Date().toISOString().split('T')[0] },
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

// ─── Schließzeiten / Pflichturlaub ───────────────────────────────────────────

function toClosurePeriod(row: any): ClosurePeriod {
  return {
    id: row.id,
    locationId: row.locationId,
    name: row.name,
    startDate: row.startDate,
    endDate: row.endDate,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function listClosurePeriodsByLocation(locationId: string): Promise<ClosurePeriod[]> {
  const rows = await prisma.closurePeriod.findMany({ where: { locationId }, orderBy: { startDate: 'asc' } })
  return rows.map(toClosurePeriod)
}

export async function deleteClosurePeriod(id: string): Promise<void> {
  await prisma.closurePeriod.delete({ where: { id } }).catch(() => null)
}

/** Legt für einen einzelnen Mitarbeiter den Pflichturlaubs-Antrag einer
 * Schließzeit an, sofern er im Zeitraum tatsächliche Arbeitstage hat und noch
 * keinen (sich überlappenden) Antrag für diese Schließzeit besitzt. Status
 * 'approved' + respondedBy 'System (Schließzeit)' erfüllen "beantragt und
 * genehmigt" – die einfachere der zwei vom Auftrag vorgesehenen Varianten,
 * weil so jede bestehende Urlaubsauswertung (Konto, Übersicht, Reports) den
 * Pflichturlaub ohne Sonderfall-Behandlung korrekt mitzählt. */
async function applyClosureToEmployee(closure: { locationId: string; name: string; startDate: string; endDate: string }, employee: Employee, state?: string): Promise<void> {
  const already = await prisma.vacationRequest.findFirst({
    where: { employeeId: employee.id, startDate: closure.startDate, endDate: closure.endDate, reason: `Pflichturlaub: ${closure.name}` },
  })
  if (already) return

  const days = countWorkdays(closure.startDate, closure.endDate, employee, state)
  if (days <= 0) return

  const location = await getLocationById(closure.locationId)
  const today = new Date().toISOString().split('T')[0]
  await prisma.$transaction([
    prisma.vacationRequest.create({
      data: {
        employeeId: employee.id,
        employeeName: employee.name,
        locationId: closure.locationId,
        locationName: location?.name ?? '',
        startDate: closure.startDate,
        endDate: closure.endDate,
        days,
        reason: `Pflichturlaub: ${closure.name}`,
        status: 'approved',
        submittedAt: today,
        respondedAt: today,
        respondedBy: 'System (Schließzeit)',
      },
    }),
    prisma.employee.update({ where: { id: employee.id }, data: { vacationDaysUsed: { increment: days } } }),
  ])
}

/** Wendet eine Schließzeit auf alle aktiven Mitarbeiter ihres Standorts an. */
export async function applyClosurePeriodToLocationEmployees(closure: ClosurePeriod): Promise<void> {
  const [employees, location] = await Promise.all([
    getEmployeesByLocation(closure.locationId),
    getLocationById(closure.locationId),
  ])
  for (const employee of employees) {
    await applyClosureToEmployee(closure, employee, location?.state)
  }
}

export async function addClosurePeriod(input: { locationId: string; name: string; startDate: string; endDate: string; createdBy: string }): Promise<ClosurePeriod> {
  const row = await prisma.closurePeriod.create({ data: input })
  const closure = toClosurePeriod(row)
  await applyClosurePeriodToLocationEmployees(closure)
  return closure
}

/** Übernimmt alle bestehenden, noch nicht abgelaufenen Schließzeiten eines
 * Standorts für einen neu angelegten Mitarbeiter automatisch in dessen
 * Urlaubskonto. */
export async function applyExistingClosuresToNewEmployee(employee: Employee, state?: string): Promise<void> {
  if (!employee.locationId) return
  const today = new Date().toISOString().split('T')[0]
  const closures = await prisma.closurePeriod.findMany({ where: { locationId: employee.locationId, endDate: { gte: today } } })
  for (const row of closures) {
    await applyClosureToEmployee(toClosurePeriod(row), employee, state)
  }
}
