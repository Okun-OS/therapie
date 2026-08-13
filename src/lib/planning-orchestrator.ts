import { prisma } from '@/lib/prisma'
import { buildRuleModel } from '@/lib/rule-model-service'
import { solvePlan } from '@/lib/planning-solver'
import { verifyPlan } from '@/lib/plan-verifier'
import type { GenerierterPlan, PlanBewertung, FreigabeEmpfehlung } from '@/lib/company-model-types'

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
  overtimeDecisions?: Record<string, 'reduce' | 'normal' | 'compensate'>,
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

  try {
    // ── Step 0: Auto-generate overtimeDecisions from PlanningPolicy + hoursBalance ──
    // When no manual overtimeDecisions are passed, use the location's defaultOvertimeHandling
    // from PlanningPolicy together with each employee's current hoursBalance to decide
    // whether to reduce, compensate, or use normal target hours for this planning run.
    let effectiveOvertimeDecisions = overtimeDecisions
    if (!effectiveOvertimeDecisions) {
      const policy = await prisma.planningPolicy.findUnique({ where: { locationId } })
      const defaultMode = (policy?.defaultOvertimeHandling ?? 'normal') as 'reduce' | 'normal' | 'compensate'
      if (defaultMode !== 'normal') {
        const employees = await prisma.employee.findMany({
          where: { locationId, active: true },
          select: { id: true, hoursBalance: true },
        })
        effectiveOvertimeDecisions = Object.fromEntries(
          employees
            .filter(e => {
              // Only auto-apply when the sign matches the policy direction
              if (defaultMode === 'reduce') return e.hoursBalance > 0        // has surplus → reduce
              if (defaultMode === 'compensate') return e.hoursBalance < 0   // has deficit → compensate
              return false
            })
            .map(e => [e.id, defaultMode]),
        )
      }
    }

    // ── Step 1: Build rule model from DB ────────────────────────────────────────
    const ruleModel = await buildRuleModel(
      locationId, customerId, von, bis,
      session.id, kontext, undefined, effectiveOvertimeDecisions,
    )
    await prisma.planningSession.update({
      where: { id: session.id },
      data: { ruleModelSnap: ruleModel as object },
    })

    // ── Step 2: CP-SAT solve (single pass, no fallback, no LLM repair) ─────────
    const plan = await solvePlan(ruleModel)

    if (plan.eintraege.length === 0) {
      const solverDecision = plan.decisions?.[0]?.beschreibung
      const reason = solverDecision
        ?? (ruleModel.schichten.length === 0
          ? 'Keine Schichten im Regelmodell — bitte Onboarding abschließen oder Schichten manuell anlegen.'
          : ruleModel.mitarbeiter.length === 0
          ? 'Keine aktiven Mitarbeiter für diesen Standort gefunden.'
          : 'Solver hat keinen Dienstplan erstellen können — alle Mitarbeiter sind im gewählten Zeitraum nicht verfügbar (Urlaub, Abwesenheit oder Stundenlimit).')
      throw new Error(reason)
    }

    // ── Step 3: Deterministic verification — no LLM ─────────────────────────────
    const start = Date.now()
    let bewertung = verifyPlan(plan, ruleModel)
    const durationMs = Date.now() - start

    // ── Step 3b: Apply PlanningPolicy (minAutoApproveScore override) ────────────
    const policy = await prisma.planningPolicy.findUnique({ where: { locationId } })
    if (policy && bewertung.freigabeEmpfehlung === 'freigeben') {
      const threshold = policy.minAutoApproveScore
      if (bewertung.gesamtScore < threshold) {
        const overrideEmpfehlung: FreigabeEmpfehlung = bewertung.gesamtScore >= threshold * 0.85 ? 'optimieren' : 'ueberarbeiten'
        bewertung = {
          ...bewertung,
          freigabeEmpfehlung: overrideEmpfehlung,
          zusammenfassung: bewertung.zusammenfassung.replace(
            'Freigabe empfohlen',
            overrideEmpfehlung === 'optimieren' ? 'Optimierung möglich' : 'Überarbeitung erforderlich',
          ) + ` (Policy: min. ${threshold} Punkte)`,
        }
      }
    }

    // ── Step 4: Persist results ─────────────────────────────────────────────────
    await prisma.planningIteration.create({
      data: {
        sessionId: session.id,
        nummer: 1,
        planJson: plan as object,
        bewertung: bewertung as object,
        durationMs,
      },
    })

    await prisma.planningSession.update({
      where: { id: session.id },
      data: {
        status: 'completed',
        finalPlan: plan as object,
        finalScore: bewertung.gesamtScore,
        completedAt: new Date(),
      },
    })

    return {
      sessionId: session.id,
      finalPlan: plan,
      finalBewertung: bewertung,
      iterationen: 1,
      gesamtScore: bewertung.gesamtScore,
    }
  } catch (err) {
    await prisma.planningSession.update({
      where: { id: session.id },
      data: { status: 'failed' },
    })
    throw err
  }
}
