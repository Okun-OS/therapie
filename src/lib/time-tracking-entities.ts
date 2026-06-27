// Echte Postgres-Persistenz für Zeiterfassung (ersetzt TIME_LOGS,
// OVERTIME_REQUESTS, ABSENCES und MONTHLY_CLOSINGS aus mock-data.ts). Server-only.
import { prisma } from './prisma'
import type { TimeLog, OvertimeRequest, Absence, HoursAccountSummary, MonthlyClosing } from './types'

function toTimeLog(row: any): TimeLog {
  return {
    id: row.id,
    employeeId: row.employeeId,
    date: row.date,
    clockIn: row.clockIn,
    clockOut: row.clockOut ?? undefined,
    totalMinutes: row.totalMinutes ?? undefined,
    breakMinutes: row.breakMinutes ?? undefined,
    breakStart: row.breakStart ?? undefined,
    note: row.note ?? undefined,
    locationId: row.locationId,
  }
}

function toOvertimeRequest(row: any): OvertimeRequest {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    locationId: row.locationId,
    date: row.date,
    timeLogId: row.timeLogId,
    overtimeMinutes: row.overtimeMinutes,
    reason: row.reason,
    comment: row.comment ?? undefined,
    status: row.status,
    approvedMinutes: row.approvedMinutes ?? undefined,
    adminComment: row.adminComment ?? undefined,
    respondedAt: row.respondedAt ?? undefined,
    respondedBy: row.respondedBy ?? undefined,
    submittedAt: row.submittedAt,
  }
}

function toAbsence(row: any): Absence {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    locationId: row.locationId,
    type: row.type,
    startDate: row.startDate,
    endDate: row.endDate,
    days: row.days,
    note: row.note ?? undefined,
    proofProvided: row.proofProvided,
    verificationStatus: row.verificationStatus,
    verifiedBy: row.verifiedBy ?? undefined,
    verifiedAt: row.verifiedAt ?? undefined,
    submittedAt: row.submittedAt,
  }
}

function toMonthlyClosing(row: any): MonthlyClosing {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    locationId: row.locationId,
    year: row.year,
    month: row.month,
    status: row.status,
    arbeitstage: row.arbeitstage,
    sollMinutes: row.sollMinutes,
    istMinutes: row.istMinutes,
    breakMinutes: row.breakMinutes,
    overtimeMinutes: row.overtimeMinutes,
    undertimeMinutes: row.undertimeMinutes,
    vacationDays: row.vacationDays,
    sickDays: row.sickDays,
    otherAbsenceDays: row.otherAbsenceDays,
    approvalsCount: row.approvalsCount,
    comments: row.comments as MonthlyClosing['comments'],
    reviewedBy: row.reviewedBy ?? undefined,
    reviewedAt: row.reviewedAt ?? undefined,
    releasedBy: row.releasedBy ?? undefined,
    releasedAt: row.releasedAt ?? undefined,
  }
}

export async function getTimeLogsByEmployee(employeeId: string): Promise<TimeLog[]> {
  const rows = await prisma.timeLog.findMany({ where: { employeeId }, orderBy: { date: 'desc' } })
  return rows.map(toTimeLog)
}

export async function listAllTimeLogs(): Promise<TimeLog[]> {
  const rows = await prisma.timeLog.findMany({ orderBy: { date: 'desc' } })
  return rows.map(toTimeLog)
}

export async function getTimeLogsByMonth(employeeId: string, year: number, month: number): Promise<TimeLog[]> {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  const rows = await prisma.timeLog.findMany({
    where: { employeeId, date: { startsWith: prefix } },
    orderBy: { date: 'asc' },
  })
  return rows.map(toTimeLog)
}

export async function getActiveTimeLog(employeeId: string): Promise<TimeLog | undefined> {
  const row = await prisma.timeLog.findFirst({ where: { employeeId, clockOut: null } })
  return row ? toTimeLog(row) : undefined
}

export async function addTimeLog(input: { employeeId: string; date: string; clockIn: string; locationId: string }): Promise<TimeLog> {
  const row = await prisma.timeLog.create({ data: input })
  return toTimeLog(row)
}

export async function updateTimeLog(id: string, updates: Partial<TimeLog>): Promise<TimeLog | undefined> {
  const { id: _ignored, ...data } = updates as any
  const row = await prisma.timeLog.update({ where: { id }, data }).catch(() => null)
  return row ? toTimeLog(row) : undefined
}

export async function startBreak(employeeId: string): Promise<void> {
  const log = await getActiveTimeLog(employeeId)
  if (!log) return
  await updateTimeLog(log.id, { breakStart: new Date().toTimeString().slice(0, 5) })
}

export async function endBreak(employeeId: string): Promise<void> {
  const log = await getActiveTimeLog(employeeId)
  if (!log || !log.breakStart) return
  const [bh, bm] = log.breakStart.split(':').map(Number)
  const now = new Date()
  const minutes = Math.max(0, (now.getHours() * 60 + now.getMinutes()) - (bh * 60 + bm))
  await updateTimeLog(log.id, { breakMinutes: (log.breakMinutes ?? 0) + minutes, breakStart: undefined })
}

function standardDailyMinutes(weeklyHours: number): number {
  return (weeklyHours / 5) * 60
}

function workdaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate()
  let count = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month - 1, d).getDay()
    if (day !== 0 && day !== 6) count++
  }
  return count
}

export async function addOvertimeRequest(input: {
  employeeId: string
  employeeName: string
  locationId: string
  date: string
  timeLogId: string
  overtimeMinutes: number
  reason: string
  comment?: string
}): Promise<OvertimeRequest> {
  const row = await prisma.overtimeRequest.create({
    data: { ...input, status: 'pending', submittedAt: new Date().toISOString() },
  })
  return toOvertimeRequest(row)
}

export async function respondToOvertimeRequest(
  id: string,
  status: 'approved' | 'denied' | 'partial',
  respondedBy: string,
  approvedMinutes?: number,
  adminComment?: string
): Promise<void> {
  const existing = await prisma.overtimeRequest.findUnique({ where: { id } })
  if (!existing) return
  await prisma.overtimeRequest.update({
    where: { id },
    data: {
      status,
      approvedMinutes: status === 'denied' ? 0 : (approvedMinutes ?? existing.overtimeMinutes),
      adminComment,
      respondedAt: new Date().toISOString(),
      respondedBy,
    },
  })
}

export async function getOvertimeRequestsByLocation(locationId: string): Promise<OvertimeRequest[]> {
  const rows = await prisma.overtimeRequest.findMany({ where: { locationId }, orderBy: { submittedAt: 'desc' } })
  return rows.map(toOvertimeRequest)
}

export async function getOvertimeRequestsByEmployee(employeeId: string): Promise<OvertimeRequest[]> {
  const rows = await prisma.overtimeRequest.findMany({ where: { employeeId }, orderBy: { submittedAt: 'desc' } })
  return rows.map(toOvertimeRequest)
}

export async function addAbsence(input: {
  employeeId: string
  employeeName: string
  locationId: string
  type: Absence['type']
  startDate: string
  endDate: string
  days: number
  note?: string
  proofProvided: boolean
}): Promise<Absence> {
  const row = await prisma.absence.create({
    data: { ...input, verificationStatus: 'offen', submittedAt: new Date().toISOString() },
  })
  return toAbsence(row)
}

export async function updateAbsence(id: string, updates: Partial<Absence>): Promise<Absence | undefined> {
  const { id: _ignored, ...data } = updates as any
  const row = await prisma.absence.update({ where: { id }, data }).catch(() => null)
  return row ? toAbsence(row) : undefined
}

export async function listAllAbsences(): Promise<Absence[]> {
  const rows = await prisma.absence.findMany({ orderBy: { submittedAt: 'desc' } })
  return rows.map(toAbsence)
}

export async function getAbsencesByLocation(locationId: string): Promise<Absence[]> {
  const rows = await prisma.absence.findMany({ where: { locationId }, orderBy: { submittedAt: 'desc' } })
  return rows.map(toAbsence)
}

export async function getAbsencesByEmployee(employeeId: string): Promise<Absence[]> {
  const rows = await prisma.absence.findMany({ where: { employeeId }, orderBy: { submittedAt: 'desc' } })
  return rows.map(toAbsence)
}

export async function getHoursAccountSummary(employeeId: string, year: number, month: number, weeklyHours: number = 40): Promise<HoursAccountSummary> {
  const logs = await getTimeLogsByMonth(employeeId, year, month)
  const istMinutes = logs.reduce((s, t) => s + (t.totalMinutes ?? 0) - (t.breakMinutes ?? 0), 0)
  const breakMinutes = logs.reduce((s, t) => s + (t.breakMinutes ?? 0), 0)
  const sollMinutes = workdaysInMonth(year, month) * standardDailyMinutes(weeklyHours)
  const prefix = `${year}-${String(month).padStart(2, '0')}`

  const overtimeRequests = await prisma.overtimeRequest.findMany({
    where: { employeeId, status: { in: ['approved', 'partial'] }, date: { startsWith: prefix } },
  })
  const overtimeMinutes = overtimeRequests.reduce((s, o) => s + (o.approvedMinutes ?? 0), 0)
  const undertimeMinutes = Math.max(0, sollMinutes - istMinutes)

  const absences = await prisma.absence.findMany({ where: { employeeId, startDate: { startsWith: prefix } } })
  const sickDays = absences.filter(a => a.type === 'krankheit').reduce((s, a) => s + a.days, 0)
  const otherAbsenceDays = absences.filter(a => a.type !== 'krankheit').reduce((s, a) => s + a.days, 0)

  const vacationRequests = await prisma.vacationRequest.findMany({
    where: { employeeId, status: 'approved', startDate: { startsWith: prefix } },
  })
  const vacationDays = vacationRequests.reduce((s, v) => s + v.days, 0)

  return { employeeId, year, month, sollMinutes, istMinutes, breakMinutes, overtimeMinutes, undertimeMinutes, vacationDays, sickDays, otherAbsenceDays }
}

export async function getOrCreateMonthlyClosing(
  employeeId: string,
  year: number,
  month: number,
  employeeInfo?: { name: string; locationId?: string; weeklyHours: number }
): Promise<MonthlyClosing> {
  const existing = await prisma.monthlyClosing.findUnique({ where: { employeeId_year_month: { employeeId, year, month } } })
  if (existing) return toMonthlyClosing(existing)

  const summary = await getHoursAccountSummary(employeeId, year, month, employeeInfo?.weeklyHours)
  const arbeitstage = (await getTimeLogsByMonth(employeeId, year, month)).length
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  const approvalsCount = await prisma.overtimeRequest.count({
    where: { employeeId, status: { not: 'pending' }, date: { startsWith: prefix } },
  })

  const row = await prisma.monthlyClosing.create({
    data: {
      employeeId,
      employeeName: employeeInfo?.name ?? employeeId,
      locationId: employeeInfo?.locationId ?? '',
      year,
      month,
      status: 'offen',
      arbeitstage,
      sollMinutes: summary.sollMinutes,
      istMinutes: summary.istMinutes,
      breakMinutes: summary.breakMinutes,
      overtimeMinutes: summary.overtimeMinutes,
      undertimeMinutes: summary.undertimeMinutes,
      vacationDays: summary.vacationDays,
      sickDays: summary.sickDays,
      otherAbsenceDays: summary.otherAbsenceDays,
      approvalsCount,
      comments: [],
    },
  })
  return toMonthlyClosing(row)
}

export async function addMonthlyClosingComment(id: string, author: string, text: string): Promise<void> {
  const closing = await prisma.monthlyClosing.findUnique({ where: { id } })
  if (!closing) return
  const comments = [...(closing.comments as MonthlyClosing['comments']), { author, text, at: new Date().toISOString() }]
  await prisma.monthlyClosing.update({
    where: { id },
    data: {
      comments,
      status: closing.status === 'offen' ? 'geprueft' : closing.status,
      reviewedBy: author,
      reviewedAt: new Date().toISOString(),
    },
  })
}

function formatDateGerman(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${d}.${m}.${y}`
}

function formatTimeLogChange(log: TimeLog): string {
  return `${log.clockIn}–${log.clockOut ?? '?'} Uhr${log.breakMinutes ? `, ${log.breakMinutes} Min. Pause` : ''}`
}

export async function correctMonthlyClosingTimeLog(
  closingId: string,
  timeLogId: string,
  updates: Partial<Pick<TimeLog, 'clockIn' | 'clockOut' | 'breakMinutes' | 'note'>>,
  correctedBy: string
): Promise<void> {
  const closing = await prisma.monthlyClosing.findUnique({ where: { id: closingId } })
  const log = await prisma.timeLog.findUnique({ where: { id: timeLogId } })
  if (!closing || !log) return

  const logUpdates: any = { ...updates }
  const clockIn = updates.clockIn ?? log.clockIn
  const clockOut = updates.clockOut ?? log.clockOut
  if (clockOut) {
    const [inH, inM] = clockIn.split(':').map(Number)
    const [outH, outM] = clockOut.split(':').map(Number)
    logUpdates.totalMinutes = Math.max(0, (outH * 60 + outM) - (inH * 60 + inM))
  }
  const updatedLog = await prisma.timeLog.update({ where: { id: timeLogId }, data: logUpdates })

  const monthLogs = await getTimeLogsByMonth(closing.employeeId, closing.year, closing.month)
  const istMinutes = monthLogs.reduce((s, t) => s + (t.totalMinutes ?? 0) - (t.breakMinutes ?? 0), 0)
  const breakMinutes = monthLogs.reduce((s, t) => s + (t.breakMinutes ?? 0), 0)
  const undertimeMinutes = Math.max(0, closing.sollMinutes - istMinutes)
  const comments = [
    ...(closing.comments as MonthlyClosing['comments']),
    { author: correctedBy, text: `Korrektur am ${formatDateGerman(updatedLog.date)}: ${formatTimeLogChange(toTimeLog(updatedLog))}`, at: new Date().toISOString() },
  ]

  await prisma.monthlyClosing.update({
    where: { id: closingId },
    data: {
      istMinutes,
      breakMinutes,
      undertimeMinutes,
      comments,
      status: closing.status === 'offen' ? 'geprueft' : closing.status,
      reviewedBy: correctedBy,
      reviewedAt: new Date().toISOString(),
    },
  })
}

/** Gibt den Monatsabschluss frei und liefert das Saldo-Delta (in Stunden), das
 * der Caller über entities.ts (applyHoursBalanceDelta) auf das echte Stundenkonto
 * des Mitarbeiters anwenden muss – dieses Modul darf Employee/Postgres-Employee
 * nicht direkt anfassen (siehe entities.ts). */
export async function releaseMonthlyClosing(id: string, releasedBy: string): Promise<{ employeeId: string; deltaHours: number } | undefined> {
  const closing = await prisma.monthlyClosing.findUnique({ where: { id } })
  if (!closing || closing.status === 'freigegeben') return undefined

  await prisma.monthlyClosing.update({
    where: { id },
    data: { status: 'freigegeben', releasedBy, releasedAt: new Date().toISOString() },
  })

  // Erst mit der Freigabe fließt der tatsächlich erfasste Saldo des Monats
  // (Ist minus Soll, abzüglich genehmigter Überstunden) in das offizielle
  // Stundenkonto des Mitarbeiters ein.
  const netMinutes = (closing.istMinutes + closing.overtimeMinutes) - closing.sollMinutes
  return { employeeId: closing.employeeId, deltaHours: netMinutes / 60 }
}

export async function getMonthlyClosingsByLocation(locationId: string): Promise<MonthlyClosing[]> {
  const rows = await prisma.monthlyClosing.findMany({ where: { locationId }, orderBy: [{ year: 'desc' }, { month: 'desc' }] })
  return rows.map(toMonthlyClosing)
}

export async function getMonthlyClosingsByEmployee(employeeId: string): Promise<MonthlyClosing[]> {
  const rows = await prisma.monthlyClosing.findMany({ where: { employeeId }, orderBy: [{ year: 'desc' }, { month: 'desc' }] })
  return rows.map(toMonthlyClosing)
}
