import { prisma } from '@/lib/prisma'
import { buildRuleModel } from '@/lib/rule-model-service'
import { solvePlan } from '@/lib/planning-solver'
import { evaluatePlan } from '@/lib/plan-evaluator'
import { correctPlan } from '@/lib/plan-corrector'
import type { GenerierterPlan, PlanBewertung } from '@/lib/company-model-types'

const MIN_ACCEPTABLE_SCORE = 75
const MAX_CORRECTION_ROUNDS = 2

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

  try {
    // ── Step 1: Build rule model from DB (once) ─────────────────────────────
    const ruleModel = await buildRuleModel(locationId, customerId, von, bis, session.id, kontext)
    await prisma.planningSession.update({
      where: { id: session.id },
      data: { ruleModelSnap: ruleModel as object },
    })

    // ── Step 2: Algorithmic solve ────────────────────────────────────────────
    let plan = await solvePlan(ruleModel)

    // Guard: if the solver returned nothing meaningful, give an actionable error
    if (plan.eintraege.length === 0) {
      const reason = ruleModel.schichten.length === 0
        ? 'Keine Schichten im Regelmodell — bitte Onboarding abschließen oder Schichten manuell anlegen.'
        : ruleModel.mitarbeiter.length === 0
        ? 'Keine aktiven Mitarbeiter für diesen Standort gefunden.'
        : 'Solver hat keinen Dienstplan erstellen können — alle Mitarbeiter sind im gewählten Zeitraum nicht verfügbar (Urlaub, Abwesenheit oder Stundenlimit).'
      throw new Error(reason)
    }

    // ── Step 3: AI evaluation + correction loop ──────────────────────────────
    for (let round = 0; round <= MAX_CORRECTION_ROUNDS; round++) {
      iterationNummer = round + 1
      const start = Date.now()

      // AI evaluates the plan
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
      const hasHigh     = bewertung.verletzungen.some(v => v.schwere === 'hoch')
      const isGoodEnough = !hasCritical && !hasHigh && bewertung.gesamtScore >= MIN_ACCEPTABLE_SCORE

      if (isGoodEnough || round === MAX_CORRECTION_ROUNDS) break

      // ── Step 4: Code-based corrector fixes what AI found wrong ─────────────
      plan = correctPlan(plan, bewertung, ruleModel)
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
