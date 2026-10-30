// Echte Postgres-Persistenz für Zeiterfassung (ersetzt TIME_LOGS,
// OVERTIME_REQUESTS, ABSENCES und MONTHLY_CLOSINGS aus mock-data.ts). Server-only.
import { prisma } from './prisma'
import { uhrzeitIn } from './zeitzone'
import { nettoSumme, zuSpeicherndeMinuten } from './arbeitszeit'
import { arbeitstageDerFehlzeit, stundenProAusfalltag } from './ausfallstunden'
import { AU_ARTEN } from './bem'
import type { TimeLog, OvertimeRequest, Absence, HoursAccountSummary, MonthlyClosing } from './types'
import { Fachfehler } from './fachfehler'

function toTimeLog(row: any): TimeLog {
  return {
    id: row.id,
    employeeId: row.employeeId,
    date: row.date,
    clockIn: row.clockIn,
    clockInAt: row.clockInAt ? row.clockInAt.toISOString() : undefined,
    clockOut: row.clockOut ?? undefined,
    totalMinutes: row.totalMinutes ?? undefined,
    breakMinutes: row.breakMinutes ?? undefined,
    breakStart: row.breakStart ?? undefined,
    breakStartAt: row.breakStartAt ? row.breakStartAt.toISOString() : undefined,
    note: row.note ?? undefined,
    locationId: row.locationId,
    // §204 Ohne diese drei Zeilen war die Nachfrage aus §203 write-only.
    grundKommen: row.grundKommen ?? undefined,
    grundGehen: row.grundGehen ?? undefined,
    abweichung: row.abweichung ?? undefined,
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

export async function getTimeLogById(id: string): Promise<TimeLog | undefined> {
  const row = await prisma.timeLog.findUnique({ where: { id } })
  return row ? toTimeLog(row) : undefined
}

export async function getActiveTimeLog(employeeId: string): Promise<TimeLog | undefined> {
  const row = await prisma.timeLog.findFirst({ where: { employeeId, clockOut: null } })
  return row ? toTimeLog(row) : undefined
}

export async function addTimeLog(input: { employeeId: string; date: string; clockIn: string; locationId: string }): Promise<TimeLog> {
  const row = await prisma.timeLog.create({ data: { ...input, clockInAt: new Date() } })
  return toTimeLog(row)
}

export async function updateTimeLog(id: string, updates: { [K in keyof Partial<TimeLog>]: TimeLog[K] | null }): Promise<TimeLog | undefined> {
  const { id: _ignored, ...data } = updates as any
  const row = await prisma.timeLog.update({ where: { id }, data }).catch(() => null)
  return row ? toTimeLog(row) : undefined
}

export async function startBreak(employeeId: string): Promise<void> {
  const log = await getActiveTimeLog(employeeId)
  if (!log) return
  const now = new Date()
  // §203 Betriebszeitzone, nicht die des Servers — siehe `src/lib/zeitzone.ts`.
  await updateTimeLog(log.id, { breakStart: uhrzeitIn(now), breakStartAt: now.toISOString() })
}

export async function endBreak(employeeId: string): Promise<void> {
  const log = await getActiveTimeLog(employeeId)
  if (!log || !log.breakStart) return
  const startInstant = log.breakStartAt ? new Date(log.breakStartAt) : new Date(`${log.date}T${log.breakStart}:00`)
  const minutes = Math.max(0, Math.round((Date.now() - startInstant.getTime()) / 60000))
  await updateTimeLog(log.id, { breakMinutes: (log.breakMinutes ?? 0) + minutes, breakStart: null, breakStartAt: null })
}

function standardDailyMinutes(weeklyHours: number): number {
  return (weeklyHours / 5) * 60
}

/**
 * Die Arbeitstage eines Monats — bei einem LAUFENDEN Monat nur bis heute.
 *
 * §243 DER FEHLER, DER DAHINTERSTAND
 * Gezählt wurde immer der ganze Monat. Für einen Monat, der noch läuft, heißt
 * das: Tage, an denen noch niemand hätte arbeiten können, stehen schon im
 * Soll. Gemeldet wurde die Folge —
 *
 *     Soll 112h · Ist 6h 10min · Minusstunden 105h 50min
 *
 * am 29. Oktober, also kurz vor Monatsende. Am 1. eines Monats wären es
 * sofort volle 112 Stunden Minus gewesen, ohne dass irgendetwas versäumt
 * worden wäre. Eine Zahl, die einen Rückstand behauptet, bevor die Zeit
 * vergangen ist, ist keine Auskunft, sondern ein Vorwurf.
 *
 * `heute` wird übergeben und nicht hier bestimmt: Sonst hinge die Rechnung an
 * der Uhr des Servers und ließe sich nicht prüfen.
 */
function workdaysInMonth(year: number, month: number, heute?: Date): number {
  const daysInMonth = new Date(year, month, 0).getDate()
  /*
   * Nur der laufende Monat wird abgeschnitten. Ein vergangener Monat zählt
   * voll — sonst stimmte der Monatsabschluss nicht mehr, und ein künftiger
   * zählt ebenfalls voll, weil dort noch gar nichts erfasst sein kann und eine
   * Null gegen eine Null keine Aussage ergäbe.
   */
  const stichtag = heute
    && heute.getFullYear() === year && heute.getMonth() + 1 === month
    ? Math.min(heute.getDate(), daysInMonth)
    : daysInMonth

  let count = 0
  for (let d = 1; d <= stichtag; d++) {
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

export async function getHoursAccountSummary(
  employeeId: string, year: number, month: number, weeklyHours: number = 40,
  /**
   * §243 Der Stichtag für einen laufenden Monat.
   *
   * Übergeben statt hier bestimmt, damit sich die Rechnung prüfen lässt und
   * nicht an der Uhr des Servers hängt. Fehlt er, zählt der ganze Monat — das
   * ist der richtige Fall für einen Monatsabschluss.
   */
  heute: Date = new Date(),
): Promise<HoursAccountSummary> {
  const logs = await getTimeLogsByMonth(employeeId, year, month)
  // §206 Nicht noch einmal die Pause abziehen — siehe `src/lib/arbeitszeit.ts`.
  const istMinutes = nettoSumme(logs)
  const breakMinutes = logs.reduce((s, t) => s + (t.breakMinutes ?? 0), 0)
  const prefix = `${year}-${String(month).padStart(2, '0')}`

  const overtimeRequests = await prisma.overtimeRequest.findMany({
    where: { employeeId, status: { in: ['approved', 'partial'] }, date: { startsWith: prefix } },
  })
  const overtimeMinutes = overtimeRequests.reduce((s, o) => s + (o.approvedMinutes ?? 0), 0)

  const absences = await prisma.absence.findMany({ where: { employeeId, startDate: { startsWith: prefix } } })

  /*
   * §227 Arbeitstage zählen, nicht Kalendertage.
   *
   * Die Maske zum Krankmelden fragt „seit wann, voraussichtlich bis wann" und
   * schickt die KALENDERTAGE mit: Wer von Montag bis Sonntag krank ist, meldet
   * sieben. Hier wurde damit das Monatssoll gekürzt — eine Woche Krankheit
   * nahm sieben Arbeitstage weg, obwohl es nur fünf gab. Das Stundenkonto
   * stand danach um zwei Tagesschichten im Plus, für jede Krankmeldung über
   * ein Wochenende neu.
   *
   * Gezählt wird gegen die Arbeitstage DIESER Person: Wer dienstags fest frei
   * hat, verliert an einem kranken Dienstag nichts.
   */
  const person = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { workDaysPerWeek: true, fixedOffDays: true, weeklyHours: true },
  })
  const profil = await prisma.employeePlanningProfile.findUnique({
    where: { employeeId }, select: { planungsStundenSoll: true, tagesmuster: true },
  })
  const ausfallPerson = {
    weeklyHours: person?.weeklyHours ?? weeklyHours,
    planungsStundenSoll: profil?.planungsStundenSoll ?? null,
    tagesmuster: profil?.tagesmuster,
    workDaysPerWeek: person?.workDaysPerWeek ?? null,
    fixedOffDays: person?.fixedOffDays ?? null,
  }
  const arbeitstage = (a: { startDate: string; endDate: string }) =>
    arbeitstageDerFehlzeit(ausfallPerson, a.startDate, a.endDate)

  const sickDays = absences.filter(a => AU_ARTEN.includes(a.type))
    .reduce((s, a) => s + arbeitstage(a), 0)
  const otherAbsenceDays = absences.filter(a => !AU_ARTEN.includes(a.type))
    .reduce((s, a) => s + arbeitstage(a), 0)

  const vacationRequests = await prisma.vacationRequest.findMany({
    where: { employeeId, status: 'approved', startDate: { startsWith: prefix } },
  })
  const vacationDays = vacationRequests.reduce((s, v) => s + v.days, 0)

  // Soll-Arbeitstage abzüglich Urlaub/Krankheit/sonstiger Abwesenheit (jetzt als reine Arbeitstage gezählt)
  const sollDays = Math.max(0,
    workdaysInMonth(year, month, heute) - vacationDays - sickDays - otherAbsenceDays)
  /*
   * §227 Der Tagessatz kommt aus `ausfallstunden.ts`, nicht aus
   * `standardDailyMinutes(weeklyHours)`.
   *
   * Letzteres teilt immer durch fünf. Für Heike — 30 Stunden auf vier Tage —
   * ergab das ein Tagessoll von sechs Stunden, obwohl sie siebeneinhalb
   * arbeitet. Ihr Konto wuchs damit an jedem gearbeiteten Tag um anderthalb
   * Stunden, die niemand genehmigt hatte.
   */
  const tagesStunden = stundenProAusfalltag(ausfallPerson)
  const sollMinutes = tagesStunden > 0
    ? Math.round(sollDays * tagesStunden * 60)
    : sollDays * standardDailyMinutes(weeklyHours)
  const undertimeMinutes = Math.max(0, sollMinutes - istMinutes)

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

  /*
   * §243 Der Monatsabschluss rechnet den GANZEN Monat.
   *
   * Die Kürzung auf „bis heute" gilt der laufenden Anzeige: Dort wäre ein Soll
   * für Tage, die noch nicht stattgefunden haben, ein Vorwurf ohne Anlass.
   * Ein Abschluss sagt dagegen etwas über den vollen Monat aus, und sein Saldo
   * wandert dauerhaft ins Stundenkonto. Würde er mitten im Monat mit gekürztem
   * Soll festgeschrieben, fehlte der Rest für immer.
   *
   * Deshalb hier ein Stichtag, der sicher hinter dem Monatsende liegt.
   */
  const nachMonatsende = new Date(year, month, 1)
  const summary = await getHoursAccountSummary(
    employeeId, year, month, employeeInfo?.weeklyHours, nachMonatsende)
  // §206 Tage, nicht Buchungen: Wer vormittags und nachmittags stempelt,
  // hat einen Arbeitstag, nicht zwei.
  const arbeitstage = new Set(
    (await getTimeLogsByMonth(employeeId, year, month)).map(l => l.date)).size
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
  if (closing.status === 'freigegeben') {
    throw new Fachfehler('Monat ist bereits freigegeben – keine Korrektur mehr möglich')
  }

  const logUpdates: any = { ...updates }
  const clockIn = updates.clockIn ?? log.clockIn
  const clockOut = updates.clockOut ?? log.clockOut
  if (clockOut) {
    /*
     * §206 Die Pause gehört heraus — hier stand sie noch drin.
     *
     * Das war die Wurzel: Die Stempeluhr schreibt `totalMinutes` NETTO, diese
     * Korrektur schrieb BRUTTO. Dieselbe Spalte, zwei Bedeutungen. Die
     * Lohnabrechnung nimmt den Wert unverändert als bezahlte Zeit — eine von
     * der Leitung korrigierte Buchung wurde damit zu hoch bezahlt, und zwar
     * genau um die Pause.
     *
     * Über Mitternacht wird mitgerechnet: Ein Nachtdienst von 22:00 bis 06:00
     * ist acht Stunden, nicht minus sechzehn. Vorher ergab er null.
     */
    const [inH, inM] = clockIn.split(':').map(Number)
    const [outH, outM] = clockOut.split(':').map(Number)
    const von = inH * 60 + inM
    const bis = outH * 60 + outM
    const anwesend = bis >= von ? bis - von : bis + 24 * 60 - von
    const pause = updates.breakMinutes ?? log.breakMinutes ?? 0
    logUpdates.totalMinutes = zuSpeicherndeMinuten(anwesend, pause)
  }
  const updatedLog = await prisma.timeLog.update({ where: { id: timeLogId }, data: logUpdates })

  const monthLogs = await getTimeLogsByMonth(closing.employeeId, closing.year, closing.month)
  const istMinutes = nettoSumme(monthLogs)  // §206
  const breakMinutes = monthLogs.reduce((s, t) => s + (t.breakMinutes ?? 0), 0)
  const arbeitstage = new Set(monthLogs.map(l => l.date)).size  // §206
  const undertimeMinutes = Math.max(0, closing.sollMinutes - istMinutes)
  const comments = [
    ...(closing.comments as MonthlyClosing['comments']),
    { author: correctedBy, text: `Korrektur am ${formatDateGerman(updatedLog.date)}: ${formatTimeLogChange(toTimeLog(updatedLog))}`, at: new Date().toISOString() },
  ]

  await prisma.monthlyClosing.update({
    where: { id: closingId },
    data: {
      istMinutes,
      arbeitstage,
      breakMinutes,
      undertimeMinutes,
      comments,
      status: closing.status === 'offen' ? 'geprueft' : closing.status,
      reviewedBy: correctedBy,
      reviewedAt: new Date().toISOString(),
    },
  })
}

export async function backfillTimeLog(
  input: { employeeId: string; date: string; clockIn: string; clockOut: string; breakMinutes?: number; note?: string; locationId: string },
  createdBy: string
): Promise<TimeLog> {
  const year = Number(input.date.slice(0, 4))
  const month = Number(input.date.slice(5, 7))
  const closing = await prisma.monthlyClosing.findUnique({ where: { employeeId_year_month: { employeeId: input.employeeId, year, month } } })
  if (closing?.status === 'freigegeben') {
    throw new Fachfehler('Monat ist bereits freigegeben – keine Nacherfassung mehr möglich')
  }

  /*
   * §206 Der dritte Schreibweg — und er war genauso falsch wie die Korrektur.
   *
   * Die Nacherfassung der Leitung schrieb `totalMinutes` brutto, die
   * Stempeluhr netto. Dieselbe Spalte, und die Lohnabrechnung nimmt sie
   * unverändert als bezahlte Zeit: Jede nacherfasste Schicht wurde um die
   * eingetragene Pause zu hoch bezahlt.
   *
   * Dazu ergab ein Nachtdienst von 22:00 bis 06:00 null Minuten, weil über
   * Mitternacht nicht gerechnet wurde.
   */
  const [inH, inM] = input.clockIn.split(':').map(Number)
  const [outH, outM] = input.clockOut.split(':').map(Number)
  const von = inH * 60 + inM
  const bis = outH * 60 + outM
  const anwesend = bis >= von ? bis - von : bis + 24 * 60 - von
  const totalMinutes = zuSpeicherndeMinuten(anwesend, input.breakMinutes ?? 0)

  const row = await prisma.timeLog.create({
    data: {
      employeeId: input.employeeId,
      date: input.date,
      clockIn: input.clockIn,
      clockOut: input.clockOut,
      totalMinutes,
      breakMinutes: input.breakMinutes ?? 0,
      note: input.note,
      locationId: input.locationId,
    },
  })

  if (closing) {
    const monthLogs = await getTimeLogsByMonth(input.employeeId, year, month)
    const istMinutes = nettoSumme(monthLogs)  // §206
    const breakMinutesSum = monthLogs.reduce((s, t) => s + (t.breakMinutes ?? 0), 0)
    // §206 Mitführen, nicht einfrieren: Der Wert wurde beim Anlegen des
    // Monats gesetzt und danach nie wieder — in einem Monat ohne Stempelung
    // stand dauerhaft „0", auch nachdem Zeiten nacherfasst worden waren.
    const arbeitstage = new Set(monthLogs.map(l => l.date)).size
    const undertimeMinutes = Math.max(0, closing.sollMinutes - istMinutes)
    const comments = [
      ...(closing.comments as MonthlyClosing['comments']),
      { author: createdBy, text: `Nacherfassung für ${formatDateGerman(input.date)}: ${formatTimeLogChange(toTimeLog(row))}`, at: new Date().toISOString() },
    ]
    await prisma.monthlyClosing.update({
      where: { id: closing.id },
      data: {
        istMinutes,
        arbeitstage,
        breakMinutes: breakMinutesSum,
        undertimeMinutes,
        comments,
        status: closing.status === 'offen' ? 'geprueft' : closing.status,
        reviewedBy: createdBy,
        reviewedAt: new Date().toISOString(),
      },
    })
  }

  return toTimeLog(row)
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
