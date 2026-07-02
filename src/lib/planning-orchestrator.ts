import { prisma } from '@/lib/prisma'
import { buildRuleModel } from '@/lib/rule-model-service'
import { solvePlan } from '@/lib/planning-solver'
import { evaluatePlan } from '@/lib/plan-evaluator'
import type { GenerierterPlan, PlanBewertung } from '@/lib/company-model-types'

const MAX_ITERATIONS = 3
const MIN_ACCEPTABLE_SCORE = 70

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
  let iterationNummer = 0
  let vorherigeBewertung: string | undefined

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      iterationNummer = i + 1
      const start = Date.now()

      const ruleModel = await buildRuleModel(
        locationId,
        customerId,
        von,
        bis,
        session.id,
        kontext,
        vorherigeBewertung,
      )

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
          nummer: iterationNummer,
          planJson: plan as object,
          bewertung: bewertung as object,
          durationMs,
        },
      })

      if (!bestBewertung || bewertung.gesamtScore > bestBewertung.gesamtScore) {
        bestPlan = plan
        bestBewertung = bewertung
      }

      const hasCritical = bewertung.verletzungen.some(v => v.schwere === 'kritisch')
      const hasHigh = bewertung.verletzungen.some(v => v.schwere === 'hoch')

      if (!hasCritical && !hasHigh && bewertung.gesamtScore >= MIN_ACCEPTABLE_SCORE) {
        break
      }

      vorherigeBewertung = JSON.stringify({
        score: bewertung.gesamtScore,
        verletzungen: bewertung.verletzungen,
        vorschlaege: bewertung.optimierungsVorschlaege,
      })
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
