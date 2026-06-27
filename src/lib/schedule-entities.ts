// Echte Postgres-Persistenz für Dienstplanung (ersetzt SHIFTS, SCHEDULE_ENTRIES,
// SWAP_REQUESTS und WISH_SUBMISSIONS aus mock-data.ts). Server-only.
import { prisma } from './prisma'
import type { Shift, ScheduleEntry, SwapRequest, WishSubmission, ShiftType, WishImportance } from './types'

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
export async function saveScheduleForWeek(
  locationId: string,
  weekDates: string[],
  assignments: Record<string, Record<string, string>>,
  reasons?: Record<string, string>,
): Promise<void> {
  await prisma.scheduleEntry.deleteMany({ where: { locationId, date: { in: weekDates } } })
  const rows: { employeeId: string; shiftId: string; date: string; locationId: string; status: string; reason?: string }[] = []
  for (const [employeeId, byDate] of Object.entries(assignments)) {
    for (const [date, shiftId] of Object.entries(byDate)) {
      rows.push({ employeeId, shiftId, date, locationId, status: 'confirmed', reason: reasons?.[`${employeeId}|${date}`] })
    }
  }
  if (rows.length > 0) await prisma.scheduleEntry.createMany({ data: rows })
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
