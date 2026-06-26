import { prisma } from './prisma'
import { findCandidates, type MatchCandidate } from './substitution-matching'
import { ESCALATION_ORDER, type EscalationStage } from './substitution-constants'
import { notifyEmployee } from './notify'
import { getLocationById } from './entities'
import { awardSubstitutionAcceptance } from './workforce-score-service'
import type { SubstitutionRequest } from '@prisma/client'

function nextStage(stage: EscalationStage): EscalationStage | null {
  const idx = ESCALATION_ORDER.indexOf(stage)
  return ESCALATION_ORDER[idx + 1] ?? null
}

async function notifyCandidates(request: SubstitutionRequest, candidates: MatchCandidate[]): Promise<void> {
  const location = await getLocationById(request.locationId)
  const title = 'Vertretung gesucht'
  const body = `${location?.name ?? 'Eine Einrichtung'} benötigt am ${request.date} von ${request.startTime} bis ${request.endTime} Uhr Vertretung.`

  await Promise.all(
    candidates.map(c =>
      notifyEmployee(c.employeeId, { type: 'substitution_request', title, body, requestId: request.id }),
    ),
  )
}

async function runStage(request: SubstitutionRequest, stage: EscalationStage): Promise<void> {
  const alreadyContacted = await prisma.substitutionCandidate.findMany({
    where: { requestId: request.id },
    select: { employeeId: true },
  })
  const candidates = await findCandidates(stage, request, 5, alreadyContacted.map(c => c.employeeId))

  if (candidates.length === 0) {
    const next = nextStage(stage)
    if (next) {
      await prisma.substitutionRequest.update({ where: { id: request.id }, data: { escalationStage: next } })
      await runStage({ ...request, escalationStage: next }, next)
    }
    return
  }

  await prisma.substitutionRequest.update({ where: { id: request.id }, data: { escalationStage: stage } })
  await prisma.substitutionCandidate.createMany({
    data: candidates.map(c => ({
      requestId: request.id,
      employeeId: c.employeeId,
      employeeName: c.employeeName,
      matchScore: c.matchScore,
      matchReasons: c.matchReasons,
      escalationStage: stage,
    })),
  })
  await notifyCandidates(request, candidates)
}

export interface CreateSubstitutionInput {
  locationId: string
  groupId?: string
  date: string
  startTime: string
  endTime: string
  qualification?: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  note?: string
  createdBy: string
}

export async function createSubstitutionRequest(input: CreateSubstitutionInput) {
  const request = await prisma.substitutionRequest.create({ data: { ...input, escalationStage: 'group' } })
  await runStage(request, 'group')
  return prisma.substitutionRequest.findUnique({ where: { id: request.id }, include: { candidates: true } })
}

export async function escalateRequest(requestId: string) {
  const request = await prisma.substitutionRequest.findUnique({ where: { id: requestId } })
  if (!request || request.status !== 'open') throw new Error('Anfrage ist nicht mehr offen')

  const next = nextStage(request.escalationStage as EscalationStage)
  if (!next) throw new Error('Bereits auf höchster Eskalationsstufe (Springerpool)')

  await prisma.substitutionCandidate.updateMany({
    where: { requestId, responseStatus: 'pending' },
    data: { responseStatus: 'expired' },
  })
  await runStage(request, next)
  return prisma.substitutionRequest.findUnique({ where: { id: requestId }, include: { candidates: true } })
}

export async function respondToCandidate(requestId: string, employeeId: string, action: 'accept' | 'decline') {
  const candidate = await prisma.substitutionCandidate.findUnique({
    where: { requestId_employeeId: { requestId, employeeId } },
  })
  if (!candidate || candidate.responseStatus !== 'pending') throw new Error('Diese Anfrage ist nicht mehr gültig')

  if (action === 'accept') {
    await prisma.$transaction([
      prisma.substitutionCandidate.update({
        where: { id: candidate.id },
        data: { responseStatus: 'accepted', respondedAt: new Date() },
      }),
      prisma.substitutionRequest.update({
        where: { id: requestId },
        data: { status: 'filled', filledByEmployeeId: employeeId, filledAt: new Date() },
      }),
      prisma.substitutionCandidate.updateMany({
        where: { requestId, responseStatus: 'pending' },
        data: { responseStatus: 'expired' },
      }),
    ])

    const request = await prisma.substitutionRequest.findUnique({ where: { id: requestId } })
    if (request) {
      await awardSubstitutionAcceptance(request, candidate)
      await notifyEmployee(request.createdBy, {
        type: 'substitution_filled',
        title: 'Vertretung gefunden',
        body: `${candidate.employeeName} hat die Vertretung am ${request.date} übernommen.`,
        requestId,
      })
    }
  } else {
    await prisma.substitutionCandidate.update({
      where: { id: candidate.id },
      data: { responseStatus: 'declined', respondedAt: new Date() },
    })

    const remaining = await prisma.substitutionCandidate.count({ where: { requestId, responseStatus: 'pending' } })
    const request = await prisma.substitutionRequest.findUnique({ where: { id: requestId } })
    if (remaining === 0 && request && request.status === 'open') {
      const next = nextStage(request.escalationStage as EscalationStage)
      if (next) await runStage(request, next)
    }
  }

  return prisma.substitutionRequest.findUnique({ where: { id: requestId }, include: { candidates: true } })
}
