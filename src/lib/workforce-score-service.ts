import { prisma } from './prisma'
import { getScheduleByEmployee, getShiftById } from './schedule-entities'
import { listEmployees, getEmployeesByLocation } from './entities'
import {
  getLevelForPoints,
  getNextLevel,
  OVERTIME_MAX_DAILY_POINTS,
  OVERTIME_MIN_MINUTES,
  PUNCTUALITY_TOLERANCE_MINUTES,
  SCORE_POINTS,
  SCORE_REASON_LABEL,
  SHORT_NOTICE_HOURS,
  type ScoreEventType,
  type WorkforceLevel,
} from './workforce-score-constants'
import type { SubstitutionRequest, SubstitutionCandidate } from '@prisma/client'

function timeStringToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

async function awardScoreEvent(employeeId: string, type: ScoreEventType, relatedId: string | null, points?: number) {
  try {
    await prisma.scoreEvent.create({
      data: {
        employeeId,
        type,
        relatedId,
        points: points ?? SCORE_POINTS[type],
        reason: SCORE_REASON_LABEL[type],
      },
    })
  } catch (err: unknown) {
    const code = (err as { code?: string }).code
    if (code !== 'P2002') throw err
  }
}

async function findShiftForEntry(employeeId: string, date: string) {
  const entries = await getScheduleByEmployee(employeeId)
  const entry = entries.find(e => e.date === date)
  if (!entry) return null
  return (await getShiftById(entry.shiftId)) ?? null
}

export async function recordClockIn(employeeId: string, date: string, locationId: string, clockIn: Date) {
  const created = await prisma.timeClockEntry.create({
    data: { employeeId, date, locationId, clockIn },
  })

  const shift = await findShiftForEntry(employeeId, date)
  if (shift) {
    const plannedMinutes = timeStringToMinutes(shift.startTime)
    const actualMinutes = clockIn.getHours() * 60 + clockIn.getMinutes()
    if (Math.abs(actualMinutes - plannedMinutes) <= PUNCTUALITY_TOLERANCE_MINUTES) {
      await awardScoreEvent(employeeId, 'punctual_clock_in', created.id)
    }
  }

  return created
}

export async function recordClockOut(timeClockEntryId: string, clockOut: Date) {
  const updated = await prisma.timeClockEntry.update({
    where: { id: timeClockEntryId },
    data: { clockOut },
  })

  const shift = await findShiftForEntry(updated.employeeId, updated.date)
  if (shift) {
    const plannedMinutes = timeStringToMinutes(shift.endTime)
    const actualMinutes = clockOut.getHours() * 60 + clockOut.getMinutes()
    const diff = actualMinutes - plannedMinutes

    if (Math.abs(diff) <= PUNCTUALITY_TOLERANCE_MINUTES) {
      await awardScoreEvent(updated.employeeId, 'punctual_clock_out', updated.id)
    } else if (diff >= OVERTIME_MIN_MINUTES) {
      const points = Math.min(diff, OVERTIME_MAX_DAILY_POINTS)
      await awardScoreEvent(updated.employeeId, 'overtime_stayed', updated.id, points)
    }
  }

  return updated
}

export async function awardSubstitutionAcceptance(request: SubstitutionRequest, candidate: SubstitutionCandidate) {
  const shiftStart = new Date(`${request.date}T${request.startTime}:00`)
  const hoursUntilShift = (shiftStart.getTime() - request.createdAt.getTime()) / (1000 * 60 * 60)
  const shortNotice = hoursUntilShift <= SHORT_NOTICE_HOURS

  await awardScoreEvent(
    candidate.employeeId,
    shortNotice ? 'substitution_accepted_short_notice' : 'substitution_accepted',
    candidate.id,
  )
}

export interface ScoreSummary {
  employeeId: string
  points: number
  level: WorkforceLevel
  nextLevel: WorkforceLevel | null
}

export async function getEmployeeScoreSummary(employeeId: string): Promise<ScoreSummary> {
  const result = await prisma.scoreEvent.aggregate({
    where: { employeeId },
    _sum: { points: true },
  })
  const points = result._sum.points ?? 0
  const level = getLevelForPoints(points)
  return { employeeId, points, level, nextLevel: getNextLevel(level) }
}

export interface LeaderboardEntry {
  employeeId: string
  employeeName: string
  points: number
  level: WorkforceLevel
}

async function buildLeaderboard(employeeIds: string[], customerId?: string): Promise<LeaderboardEntry[]> {
  if (employeeIds.length === 0) return []

  const [grouped, allEmployees] = await Promise.all([
    prisma.scoreEvent.groupBy({
      by: ['employeeId'],
      where: { employeeId: { in: employeeIds } },
      _sum: { points: true },
    }),
    listEmployees(customerId),
  ])
  const pointsByEmployee = new Map(grouped.map(g => [g.employeeId, g._sum.points ?? 0]))
  const nameByEmployee = new Map(allEmployees.map(e => [e.id, e.name]))

  return employeeIds
    .map(id => {
      const points = pointsByEmployee.get(id) ?? 0
      return {
        employeeId: id,
        employeeName: nameByEmployee.get(id) ?? id,
        points,
        level: getLevelForPoints(points),
      }
    })
    .sort((a, b) => b.points - a.points)
}

export async function getLeaderboardByLocation(locationId: string): Promise<LeaderboardEntry[]> {
  const employees = await getEmployeesByLocation(locationId)
  return buildLeaderboard(employees.map(e => e.id))
}

export async function getOrganizationLeaderboard(customerId?: string): Promise<LeaderboardEntry[]> {
  const allEmployees = await listEmployees(customerId)
  return buildLeaderboard(allEmployees.filter(e => e.active).map(e => e.id), customerId)
}

export async function getAllLevelBonusConfigs() {
  return prisma.levelBonusConfig.findMany()
}

export async function setLevelBonusText(level: WorkforceLevel, bonusText: string) {
  return prisma.levelBonusConfig.upsert({
    where: { level },
    update: { bonusText },
    create: { level, bonusText },
  })
}
