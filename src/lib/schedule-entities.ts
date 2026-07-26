// Echte Postgres-Persistenz für Dienstplanung (ersetzt SHIFTS, SCHEDULE_ENTRIES,
// SWAP_REQUESTS und WISH_SUBMISSIONS aus mock-data.ts). Server-only.
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import type { Shift, ScheduleEntry, SwapRequest, WishSubmission, ShiftType, WishImportance, LocationPlanningRules, PlanningUnit } from './types'

const DEFAULT_PLANNING_RULES: Omit<LocationPlanningRules, 'locationId'> = {
  maxWeeklyHours: 40,
  restHours: 11,
  maxConsecutiveDays: 5,
  fridayLateMax: 2,
  mondayEarlyMax: 3,
  fridayEarlyMax: 3,
  weekendMax: 2,
  considerWishes: true,
  balanceHoursAccount: true,
  autoBreakDeduction: false,
  breakThresholdMinutes: 360,
  breakDeductionMinutes: 30,
}

function toPlanningRules(row: any): LocationPlanningRules {
  return {
    locationId: row.locationId,
    maxWeeklyHours: row.maxWeeklyHours,
    restHours: row.restHours,
    maxConsecutiveDays: row.maxConsecutiveDays,
    fridayLateMax: row.fridayLateMax,
    mondayEarlyMax: row.mondayEarlyMax,
    fridayEarlyMax: row.fridayEarlyMax,
    weekendMax: row.weekendMax,
    considerWishes: row.considerWishes,
    balanceHoursAccount: row.balanceHoursAccount,
    autoBreakDeduction: row.autoBreakDeduction,
    breakThresholdMinutes: row.breakThresholdMinutes,
    breakDeductionMinutes: row.breakDeductionMinutes,
    breakRulesExtractedAt: row.breakRulesExtractedAt ? row.breakRulesExtractedAt.toISOString() : undefined,
  }
}

function toShift(row: any): Shift {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    startTime: row.startTime,
    endTime: row.endTime,
    color: row.color,
    bgColor: row.bgColor,
    minStaff: row.minStaff,
    locationId: row.locationId,
  }
}

function toScheduleEntry(row: any): ScheduleEntry {
  return {
    id: row.id,
    employeeId: row.employeeId,
    shiftId: row.shiftId,
    date: row.date,
    locationId: row.locationId,
    status: row.status,
    note: row.note ?? undefined,
    reason: row.reason ?? undefined,
    startTime: row.startTime ?? undefined,
    endTime: row.endTime ?? undefined,
    gruppe: row.gruppe ?? undefined,
    funktion: row.funktion ?? undefined,
    isSubstitution: row.isSubstitution ?? false,
    substitutionFor: row.substitutionFor ?? undefined,
    taskBlocks: (row.taskBlocks as ScheduleEntry['taskBlocks']) ?? undefined,
  }
}

function toSwapRequest(row: any): SwapRequest {
  return {
    id: row.id,
    requesterId: row.requesterId,
    requesterName: row.requesterName,
    requesterDate: row.requesterDate,
    requesterShiftId: row.requesterShiftId,
    targetEmployeeId: row.targetEmployeeId,
    targetEmployeeName: row.targetEmployeeName,
    targetDate: row.targetDate,
    targetShiftId: row.targetShiftId,
    message: row.message ?? undefined,
    status: row.status,
    submittedAt: row.submittedAt,
    respondedAt: row.respondedAt ?? undefined,
    locationId: row.locationId,
  }
}

function toWishSubmission(row: any): WishSubmission {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    locationId: row.locationId,
    date: row.date,
    preferredShiftType: row.preferredShiftType,
    reason: row.reason ?? undefined,
    importance: row.importance,
    submittedAt: row.submittedAt,
    status: row.status,
    conflictInfo: (row.conflictInfo as WishSubmission['conflictInfo']) ?? undefined,
  }
}

export async function listShiftsByLocation(locationId: string): Promise<Shift[]> {
  const rows = await prisma.shift.findMany({ where: { locationId } })
  return rows.map(toShift)
}

export async function listAllShifts(): Promise<Shift[]> {
  const rows = await prisma.shift.findMany()
  return rows.map(toShift)
}

export async function getShiftById(id: string): Promise<Shift | undefined> {
  const row = await prisma.shift.findUnique({ where: { id } })
  return row ? toShift(row) : undefined
}

export async function addShift(input: {
  name: string
  type: ShiftType
  startTime: string
  endTime: string
  color: string
  bgColor: string
  minStaff: number
  locationId: string
}): Promise<Shift> {
  const row = await prisma.shift.create({ data: input })
  return toShift(row)
}

export async function setShiftMinStaff(shiftId: string, minStaff: number): Promise<void> {
  await prisma.shift.update({ where: { id: shiftId }, data: { minStaff } }).catch(() => null)
}

export async function updateShift(shiftId: string, fields: Partial<{
  name: string
  type: ShiftType
  startTime: string
  endTime: string
  color: string
  bgColor: string
  minStaff: number
}>): Promise<Shift | null> {
  const row = await prisma.shift.update({ where: { id: shiftId }, data: fields }).catch(() => null)
  return row ? toShift(row) : null
}

export async function deleteShift(shiftId: string): Promise<void> {
  await prisma.shift.delete({ where: { id: shiftId } }).catch(() => null)
}

export async function getScheduleByEmployee(employeeId: string): Promise<ScheduleEntry[]> {
  const rows = await prisma.scheduleEntry.findMany({ where: { employeeId } })
  return rows.map(toScheduleEntry)
}

export async function getScheduleByLocationAndWeek(locationId: string, weekStart: string): Promise<ScheduleEntry[]> {
  const start = new Date(weekStart + 'T00:00:00')
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const rows = await prisma.scheduleEntry.findMany({ where: { locationId } })
  return rows.filter(r => {
    const d = new Date(r.date + 'T00:00:00')
    return d >= start && d <= end
  }).map(toScheduleEntry)
}

/** Alle Einträge eines Standorts, unabhängig vom Zeitraum – wird u.a. für die
 * Fairness-Berechnung über mehrere Wochen sowie Belegungsprüfungen genutzt. */
export async function getAllEntriesForLocation(locationId: string): Promise<ScheduleEntry[]> {
  const rows = await prisma.scheduleEntry.findMany({ where: { locationId } })
  return rows.map(toScheduleEntry)
}

export async function listAllScheduleEntries(): Promise<ScheduleEntry[]> {
  const rows = await prisma.scheduleEntry.findMany()
  return rows.map(toScheduleEntry)
}

/** Persistiert einen KI-generierten Dienstplan ({ employeeId: { date: shiftId } })
 * für die angegebene Woche; ersetzt vorhandene Einträge derselben Woche/Standort. */
export interface ScheduleAssignment {
  shiftId: string
  startTime?: string
  endTime?: string
  gruppe?: string
  funktion?: string
  isSubstitution?: boolean
  substitutionFor?: string
  taskBlocks?: ScheduleEntry['taskBlocks']
}

export async function saveScheduleForWeek(
  locationId: string,
  weekDates: string[],
  assignments: Record<string, Record<string, string | ScheduleAssignment>>,
  reasons?: Record<string, string>,
  status = 'confirmed',
): Promise<void> {
  await prisma.scheduleEntry.deleteMany({ where: { locationId, date: { in: weekDates } } })
  const rows: {
    employeeId: string; shiftId: string; date: string; locationId: string; status: string
    reason?: string; startTime?: string; endTime?: string
    gruppe?: string; funktion?: string; isSubstitution?: boolean; substitutionFor?: string
    taskBlocks?: Prisma.InputJsonValue | typeof Prisma.DbNull
  }[] = []
  for (const [employeeId, byDate] of Object.entries(assignments)) {
    for (const [date, value] of Object.entries(byDate)) {
      const assignment: ScheduleAssignment = typeof value === 'string' ? { shiftId: value } : value
      rows.push({
        employeeId,
        shiftId: assignment.shiftId,
        date,
        locationId,
        status,
        reason: reasons?.[`${employeeId}|${date}`],
        startTime: assignment.startTime,
        endTime: assignment.endTime,
        gruppe: assignment.gruppe,
        funktion: assignment.funktion,
        isSubstitution: assignment.isSubstitution ?? false,
        substitutionFor: assignment.substitutionFor,
        taskBlocks: assignment.taskBlocks !== undefined ? (assignment.taskBlocks as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      })
    }
  }
  if (rows.length > 0) await prisma.scheduleEntry.createMany({ data: rows })
}

export interface ScheduleEditChange {
  employeeId: string
  date: string
  action: 'assign' | 'remove'
  shiftId?: string
  startTime?: string
  endTime?: string
  reason?: string
  gruppe?: string
  funktion?: string
  isSubstitution?: boolean
  substitutionFor?: string
  taskBlocks?: ScheduleEntry['taskBlocks']
}

/** Wendet gezielte Einzeländerungen auf einen bereits gespeicherten Dienstplan an (z.B. aus
 * dem Dienstplan-Editier-Chat) – im Gegensatz zu saveScheduleForWeek() werden dabei nur die
 * genannten Tage/Mitarbeiter berührt, der Rest der Woche bleibt unangetastet. */
export async function applyScheduleEdits(locationId: string, changes: ScheduleEditChange[]): Promise<ScheduleEntry[]> {
  const results: ScheduleEntry[] = []
  for (const change of changes) {
    const existing = await prisma.scheduleEntry.findFirst({ where: { locationId, employeeId: change.employeeId, date: change.date } })
    if (change.action === 'remove') {
      if (existing) await prisma.scheduleEntry.delete({ where: { id: existing.id } })
      continue
    }
    if (!change.shiftId) continue
    const data = {
      employeeId: change.employeeId,
      shiftId: change.shiftId,
      date: change.date,
      locationId,
      status: 'confirmed',
      reason: change.reason,
      startTime: change.startTime,
      endTime: change.endTime,
      gruppe: change.gruppe,
      funktion: change.funktion,
      isSubstitution: change.isSubstitution ?? false,
      substitutionFor: change.substitutionFor,
      taskBlocks: change.taskBlocks !== undefined ? (change.taskBlocks as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
    }
    const row = existing
      ? await prisma.scheduleEntry.update({ where: { id: existing.id }, data })
      : await prisma.scheduleEntry.create({ data })
    results.push(toScheduleEntry(row))
  }
  return results
}

export async function getSwapRequestsByEmployee(employeeId: string): Promise<SwapRequest[]> {
  const rows = await prisma.swapRequest.findMany({
    where: { OR: [{ requesterId: employeeId }, { targetEmployeeId: employeeId }] },
    orderBy: { submittedAt: 'desc' },
  })
  return rows.map(toSwapRequest)
}

export async function addSwapRequest(input: {
  requesterId: string
  requesterName: string
  requesterDate: string
  requesterShiftId: string
  targetEmployeeId: string
  targetEmployeeName: string
  targetDate: string
  targetShiftId: string
  message?: string
  locationId: string
}): Promise<SwapRequest> {
  const row = await prisma.swapRequest.create({
    data: { ...input, status: 'pending', submittedAt: new Date().toISOString() },
  })
  return toSwapRequest(row)
}

export async function respondToSwapRequest(id: string, status: 'accepted' | 'declined'): Promise<void> {
  await prisma.swapRequest.update({
    where: { id },
    data: { status, respondedAt: new Date().toISOString() },
  }).catch(() => null)
}

export async function getWishSubmissionsByEmployee(employeeId: string): Promise<WishSubmission[]> {
  const rows = await prisma.wishSubmission.findMany({ where: { employeeId }, orderBy: { submittedAt: 'desc' } })
  return rows.map(toWishSubmission)
}

export async function getWishSubmissionsByLocation(locationId: string): Promise<WishSubmission[]> {
  const rows = await prisma.wishSubmission.findMany({ where: { locationId }, orderBy: { submittedAt: 'desc' } })
  return rows.map(toWishSubmission)
}

export async function addWishSubmission(input: {
  employeeId: string
  employeeName: string
  locationId: string
  date: string
  preferredShiftType: ShiftType
  reason?: string
  importance: WishImportance
}): Promise<WishSubmission> {
  const row = await prisma.wishSubmission.create({
    data: { ...input, submittedAt: new Date().toISOString(), status: 'pending' },
  })
  return toWishSubmission(row)
}

export async function updateWishSubmission(id: string, updates: Partial<WishSubmission>): Promise<void> {
  const { id: _ignored, ...data } = updates as any
  await prisma.wishSubmission.update({ where: { id }, data }).catch(() => null)
}

/** Liefert die Planungsregeln eines Standorts; fällt auf Systemstandard zurück,
 * solange der Standort noch keine eigenen Regeln gespeichert hat. */
export async function getPlanningRules(locationId: string): Promise<LocationPlanningRules> {
  const row = await prisma.locationPlanningRules.findUnique({ where: { locationId } })
  return row ? toPlanningRules(row) : { locationId, ...DEFAULT_PLANNING_RULES }
}

// ─── PlanningUnit CRUD ──────────────────────────────────────────────────────

function toPlanningUnit(row: any): PlanningUnit {
  return {
    id: row.id,
    locationId: row.locationId,
    name: row.name,
    type: row.type,
    description: row.description ?? undefined,
    capacity: row.capacity ?? undefined,
    address: row.address ?? undefined,
    notes: row.notes ?? undefined,
    sortOrder: row.sortOrder,
  }
}

export async function listPlanningUnitsByLocation(locationId: string): Promise<PlanningUnit[]> {
  const rows = await prisma.planningUnit.findMany({ where: { locationId }, orderBy: { sortOrder: 'asc' } })
  return rows.map(toPlanningUnit)
}

export async function upsertPlanningUnit(locationId: string, entry: {
  name: string
  type?: string
  description?: string
  capacity?: number
  address?: string
  notes?: string
  sortOrder?: number
}): Promise<PlanningUnit> {
  const existing = await prisma.planningUnit.findFirst({ where: { locationId, name: { equals: entry.name, mode: 'insensitive' } } })
  if (existing) {
    const row = await prisma.planningUnit.update({
      where: { id: existing.id },
      data: {
        type: entry.type ?? existing.type,
        description: entry.description ?? existing.description,
        capacity: entry.capacity ?? existing.capacity,
        address: entry.address ?? existing.address,
        notes: entry.notes ?? existing.notes,
        sortOrder: entry.sortOrder ?? existing.sortOrder,
      },
    })
    return toPlanningUnit(row)
  }
  const row = await prisma.planningUnit.create({
    data: { locationId, name: entry.name, type: entry.type ?? 'bereich', description: entry.description, capacity: entry.capacity, address: entry.address, notes: entry.notes, sortOrder: entry.sortOrder ?? 0 },
  })
  return toPlanningUnit(row)
}

export async function deletePlanningUnit(id: string): Promise<void> {
  await prisma.planningUnit.delete({ where: { id } }).catch(() => null)
}

export async function deleteAllPlanningUnitsForLocation(locationId: string): Promise<void> {
  await prisma.planningUnit.deleteMany({ where: { locationId } })
}

export async function upsertPlanningRules(
  locationId: string,
  update: Partial<Omit<LocationPlanningRules, 'locationId'>>,
): Promise<LocationPlanningRules> {
  const existing = await prisma.locationPlanningRules.findUnique({ where: { locationId } })
  const base = existing ? toPlanningRules(existing) : { locationId, ...DEFAULT_PLANNING_RULES }
  const { locationId: _ignored, breakRulesExtractedAt, ...data } = { ...base, ...update }
  const row = await prisma.locationPlanningRules.upsert({
    where: { locationId },
    create: { locationId, ...data, breakRulesExtractedAt: breakRulesExtractedAt ? new Date(breakRulesExtractedAt) : undefined },
    update: { ...data, breakRulesExtractedAt: breakRulesExtractedAt ? new Date(breakRulesExtractedAt) : undefined },
  })
  return toPlanningRules(row)
}
