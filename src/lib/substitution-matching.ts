import { getScheduleByEmployee, listShiftsByLocation } from './schedule-entities'
import { getVacationRequestsByEmployee } from './vacation-entities'
import { calculateFairnessData } from './fairness'
import { listEmployees } from './entities'
import { prisma } from './prisma'
import type { Employee } from './types'
import type { EscalationStage } from './substitution-constants'

export type { EscalationStage } from './substitution-constants'

export interface MatchCandidate {
  employeeId: string
  employeeName: string
  matchScore: number
  matchReasons: string[]
}

interface RequestContext {
  locationId: string
  groupId?: string | null
  date: string
  startTime: string
  endTime: string
  qualification?: string | null
}

async function isAvailable(employeeId: string, date: string): Promise<boolean> {
  const entries = await getScheduleByEmployee(employeeId)
  const hasShift = entries.some(e => e.date === date)
  if (hasShift) return false
  const vacations = await getVacationRequestsByEmployee(employeeId)
  const onVacation = vacations.some(v => v.status === 'approved' && v.startDate <= date && date <= v.endDate)
  return !onVacation
}

async function candidatePool(stage: EscalationStage, ctx: RequestContext): Promise<Employee[]> {
  const allEmployees = await listEmployees()
  const active = allEmployees.filter(e => e.role === 'employee' && e.active)
  const profiles = await prisma.employeeProfile.findMany()
  const profileMap = new Map(profiles.map(p => [p.employeeId, p]))

  switch (stage) {
    case 'group':
      return active.filter(e => e.locationId === ctx.locationId && profileMap.get(e.id)?.groupId === ctx.groupId)
    case 'location':
      return active.filter(e => e.locationId === ctx.locationId)
    case 'organization':
      return active
    case 'springerpool':
      return active.filter(e => profileMap.get(e.id)?.isSpringer)
  }
}

export async function findCandidates(
  stage: EscalationStage,
  ctx: RequestContext,
  limit = 5,
  excludeEmployeeIds: string[] = [],
): Promise<MatchCandidate[]> {
  const pool = await candidatePool(stage, ctx)
  const eligible = pool.filter(e => !excludeEmployeeIds.includes(e.id))
  const availability = await Promise.all(eligible.map(e => isAvailable(e.id, ctx.date)))
  const available = eligible.filter((_, idx) => availability[idx])
  if (available.length === 0) return []

  const profiles = await prisma.employeeProfile.findMany({ where: { employeeId: { in: available.map(e => e.id) } } })
  const profileMap = new Map(profiles.map(p => [p.employeeId, p]))

  const entriesPerEmployee = await Promise.all(available.map(e => getScheduleByEmployee(e.id)))
  const allEntries = entriesPerEmployee.flat()
  const entryLocationIds = Array.from(new Set(allEntries.map(e => e.locationId)))
  const allShifts = (await Promise.all(entryLocationIds.map(id => listShiftsByLocation(id)))).flat()
  const fairness = calculateFairnessData(available, allEntries, allShifts)
  const fairnessMap = new Map(fairness.map(f => [f.employeeId, f]))

  const recentCounts = await prisma.substitutionCandidate.groupBy({
    by: ['employeeId'],
    where: { employeeId: { in: available.map(e => e.id) }, responseStatus: 'accepted' },
    _count: { employeeId: true },
  })
  const recentMap = new Map(recentCounts.map(r => [r.employeeId, r._count.employeeId]))

  const scored = available.map(emp => {
    const profile = profileMap.get(emp.id)
    const reasons: string[] = []
    let score = 40 // baseline: verfügbar und qualifiziert für die Rolle

    if (ctx.qualification && emp.position === ctx.qualification) {
      score += 25
      reasons.push(`Qualifikation "${ctx.qualification}" passt genau`)
    } else if (ctx.qualification && profile?.qualifications.includes(ctx.qualification)) {
      score += 20
      reasons.push(`Hat Zusatzqualifikation "${ctx.qualification}"`)
    } else if (ctx.qualification) {
      score -= 10
    }

    if (emp.locationId === ctx.locationId) {
      score += 10
      reasons.push('Arbeitet bereits an diesem Standort')
    }
    if (ctx.groupId && profile?.groupId === ctx.groupId) {
      score += 10
      reasons.push('Gehört zur gleichen Gruppe')
    }

    const balance = emp.hoursBalance ?? 0
    if (balance < 0) {
      score += 10
      reasons.push('Hat ein Minus-Stundenkonto und könnte die Stunden gut nutzen')
    } else if (balance > 20) {
      score -= 10
      reasons.push('Hat bereits viele Überstunden')
    }

    const recentAccepted = recentMap.get(emp.id) ?? 0
    if (recentAccepted === 0) {
      score += 10
      reasons.push('Hat in letzter Zeit noch keine Vertretung übernommen (faire Verteilung)')
    } else if (recentAccepted >= 3) {
      score -= 10
      reasons.push('Hat zuletzt bereits mehrere Vertretungen übernommen')
    }

    const fd = fairnessMap.get(emp.id)
    if (fd) {
      score += Math.round((fd.fairnessScore - 50) / 10)
    }

    if (profile?.isSpringer) {
      score += 5
      reasons.push('Ist als Springer hinterlegt')
    }

    score = Math.max(0, Math.min(100, Math.round(score)))

    return {
      employeeId: emp.id,
      employeeName: emp.name,
      matchScore: score,
      matchReasons: reasons.length > 0 ? reasons : ['Verfügbar im gewünschten Zeitraum'],
    }
  })

  scored.sort((a, b) => b.matchScore - a.matchScore)
  return scored.slice(0, limit)
}
