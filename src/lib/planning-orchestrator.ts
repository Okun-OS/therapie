import { prisma } from '@/lib/prisma'
import { buildRuleModel } from '@/lib/rule-model-service'
import { solvePlan } from '@/lib/planning-solver'
import { evaluatePlan } from '@/lib/plan-evaluator'
import type { GenerierterPlan, PlanBewertung } from '@/lib/company-model-types'

const MAX_ITERATIONS = 1

export interface PlanningResult {
  sessionId: string
  finalPlan: GenerierterPlan
  finalBewertung: PlanBewertung
  iterationen: number
  gesamtScore: number
}

export async function runPlanningSession(
  locationId: string,
  customerId: string,
  von: string,
  bis: string,
  kontext?: string,
): Promise<PlanningResult> {
  const session = await prisma.planningSession.create({
    data: {
      locationId,
      customerId,
      zeitraumVon: von,
      zeitraumBis: bis,
      status: 'running',
      ruleModelSnap: {},
    },
  })

  let bestPlan: GenerierterPlan | null = null
  let bestBewertung: PlanBewertung | null = null
  const iterationNummer = 1

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const start = Date.now()

      const ruleModel = await buildRuleModel(locationId, customerId, von, bis, session.id, kontext)

      if (i === 0) {
        await prisma.planningSession.update({
          where: { id: session.id },
          data: { ruleModelSnap: ruleModel as object },
        })
      }

      const plan = await solvePlan(ruleModel)
      const bewertung = await evaluatePlan(plan, ruleModel)
      const durationMs = Date.now() - start

      await prisma.planningIteration.create({
        data: {
          sessionId: session.id,
          nummer: i + 1,
          planJson: plan as object,
          bewertung: bewertung as object,
          durationMs,
        },
      })

      if (!bestBewertung || bewertung.gesamtScore > bestBewertung.gesamtScore) {
        bestPlan = plan
        bestBewertung = bewertung
      }
    }

    await prisma.planningSession.update({
      where: { id: session.id },
      data: {
        status: 'completed',
        finalPlan: bestPlan as object,
        finalScore: bestBewertung?.gesamtScore ?? 0,
        completedAt: new Date(),
      },
    })

    return {
      sessionId: session.id,
      finalPlan: bestPlan!,
      finalBewertung: bestBewertung!,
      iterationen: iterationNummer,
      gesamtScore: bestBewertung?.gesamtScore ?? 0,
    }
  } catch (err) {
    await prisma.planningSession.update({
      where: { id: session.id },
      data: { status: 'failed' },
    })
    throw err
  }
}
