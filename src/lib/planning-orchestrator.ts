import { prisma } from '@/lib/prisma'
import { buildRuleModel } from '@/lib/rule-model-service'
import { solvePlan } from '@/lib/planning-solver'
import { verifyPlan } from '@/lib/plan-verifier'
import type { GenerierterPlan, PlanBewertung, FreigabeEmpfehlung, PlanVariante } from '@/lib/company-model-types'

export interface PlanningResult {
  sessionId: string
  finalPlan: GenerierterPlan
  finalBewertung: PlanBewertung
  iterationen: number
  gesamtScore: number
}

export interface AlternativePlan {
  variante: PlanVariante
  plan: GenerierterPlan
  bewertung: PlanBewertung
}

// ─── Async background worker ───────────────────────────────────────────────────
// Called without await for async planning runs.  Railway's persistent Node.js
// process keeps the Promise alive even after the HTTP response is sent.

export async function runPlanningBackground(
  sessionId: string,
  locationId: string,
  customerId: string,
  von: string,
  bis: string,
  kontext?: string,
  overtimeDecisions?: Record<string, 'reduce' | 'normal' | 'compensate'>,
  includeAlternativen?: boolean,
): Promise<void> {
  try {
    await prisma.planningSession.update({ where: { id: sessionId }, data: { status: 'running' } })

    // ── Step 0: Auto-generate overtimeDecisions from PlanningPolicy + hoursBalance ──
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
              if (defaultMode === 'reduce') return e.hoursBalance > 0
              if (defaultMode === 'compensate') return e.hoursBalance < 0
              return false
            })
            .map(e => [e.id, defaultMode]),
        )
      }
    }

    // ── Step 1: Fetch existing schedule for the period (freeze past + change minimization) ──
    const today = new Date().toISOString().slice(0, 10)
    const existingEntries = await prisma.scheduleEntry.findMany({
      where: { locationId, date: { gte: von, lte: bis } },
      select: { employeeId: true, date: true, shiftId: true },
    })
    const existingSchedule = existingEntries.map(e => ({
      mitarbeiterId: e.employeeId,
      datum: e.date,
      schichtId: e.shiftId,
    }))
    // Past confirmed dates are frozen (cannot be changed by re-planning)
    const frozenDates = Array.from(new Set(existingEntries.map(e => e.date).filter(d => d < today)))

    // ── Step 2: Build rule model ────────────────────────────────────────────────
    await prisma.planningSession.update({ where: { id: sessionId }, data: { status: 'verifying' } })

    const ruleModel = await buildRuleModel(
      locationId, customerId, von, bis,
      sessionId, kontext, undefined, effectiveOvertimeDecisions,
      existingSchedule, frozenDates,
    )
    await prisma.planningSession.update({
      where: { id: sessionId },
      data: { ruleModelSnap: ruleModel as object },
    })

    // ── Step 3: CP-SAT solve ────────────────────────────────────────────────────
    const plan = await solvePlan(ruleModel)

    if (plan.eintraege.length === 0) {
      const reason = plan.decisions?.[0]?.beschreibung
        ?? (ruleModel.schichten.length === 0
          ? 'Keine Schichten im Regelmodell.'
          : ruleModel.mitarbeiter.length === 0
          ? 'Keine aktiven Mitarbeiter für diesen Standort.'
          : 'Solver konnte keinen Plan erstellen — alle Mitarbeiter sind nicht verfügbar.')
      await prisma.planningSession.update({
        where: { id: sessionId },
        data: { status: 'no_feasible_solution', solverDiagnosis: reason },
      })
      return
    }

    // ── Step 4: Verify ─────────────────────────────────────────────────────────
    const start = Date.now()
    let bewertung = verifyPlan(plan, ruleModel)
    const durationMs = Date.now() - start

    // ── Step 4b: Apply PlanningPolicy score override ───────────────────────────
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

    // ── Step 5: Handle plan alternatives ───────────────────────────────────────
    let alternativen: AlternativePlan[] | undefined
    if (includeAlternativen) {
      const variants: PlanVariante[] = ['mitarbeiterfreundlich', 'maximal_fair']
      alternativen = []
      for (const variante of variants) {
        try {
          const altPlan = await solvePlan({ ...ruleModel, planVariante: variante })
          if (altPlan.eintraege.length > 0) {
            const altBewertung = verifyPlan(altPlan, ruleModel)
            alternativen.push({ variante, plan: altPlan, bewertung: altBewertung })
          }
        } catch {
          // Skip failed variant — don't fail entire run
        }
      }
    }

    // ── Step 6: Persist ────────────────────────────────────────────────────────
    await prisma.planningIteration.create({
      data: {
        sessionId,
        nummer: 1,
        planJson: plan as object,
        bewertung: bewertung as object,
        durationMs,
      },
    })

    await prisma.planningSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        finalPlan: plan as object,
        finalScore: bewertung.gesamtScore,
        freigabeEmpfehlung: bewertung.freigabeEmpfehlung,
        bewertungSnap: { bewertung, alternativen } as object,
        completedAt: new Date(),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const isInfeasible = message.toLowerCase().includes('infeasib') || message.toLowerCase().includes('kein gültiger plan')
    await prisma.planningSession.update({
      where: { id: sessionId },
      data: {
        status: isInfeasible ? 'no_feasible_solution' : 'failed',
        solverDiagnosis: message,
      },
    })
  }
}

// ─── Synchronous planning (for callers that need the result immediately) ───────

export async function runPlanningSession(
  locationId: string,
  customerId: string,
  von: string,
  bis: string,
  kontext?: string,
  overtimeDecisions?: Record<string, 'reduce' | 'normal' | 'compensate'>,
  includeAlternativen?: boolean,
): Promise<PlanningResult & { alternativen?: AlternativePlan[] }> {
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
    // ── Step 0: Auto-generate overtimeDecisions ─────────────────────────────────
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
              if (defaultMode === 'reduce') return e.hoursBalance > 0
              if (defaultMode === 'compensate') return e.hoursBalance < 0
              return false
            })
            .map(e => [e.id, defaultMode]),
        )
      }
    }

    // ── Step 1: Fetch existing schedule (freeze past + change minimization) ─────
    const today = new Date().toISOString().slice(0, 10)
    const existingEntries = await prisma.scheduleEntry.findMany({
      where: { locationId, date: { gte: von, lte: bis } },
      select: { employeeId: true, date: true, shiftId: true },
    })
    const existingSchedule = existingEntries.map(e => ({
      mitarbeiterId: e.employeeId,
      datum: e.date,
      schichtId: e.shiftId,
    }))
    const frozenDates = Array.from(new Set(existingEntries.map(e => e.date).filter(d => d < today)))

    // ── Step 2: Build rule model ────────────────────────────────────────────────
    const ruleModel = await buildRuleModel(
      locationId, customerId, von, bis,
      session.id, kontext, undefined, effectiveOvertimeDecisions,
      existingSchedule, frozenDates,
    )
    await prisma.planningSession.update({
      where: { id: session.id },
      data: { ruleModelSnap: ruleModel as object },
    })

    // ── Step 3: CP-SAT solve (single pass, no fallback, no LLM repair) ─────────
    const plan = await solvePlan(ruleModel)

    if (plan.eintraege.length === 0) {
      const solverDecision = plan.decisions?.[0]?.beschreibung
      const reason = solverDecision
        ?? (ruleModel.schichten.length === 0
          ? 'Keine Schichten im Regelmodell — bitte Onboarding abschließen oder Schichten manuell anlegen.'
          : ruleModel.mitarbeiter.length === 0
          ? 'Keine aktiven Mitarbeiter für diesen Standort gefunden.'
          : 'Solver hat keinen Dienstplan erstellen können — alle Mitarbeiter sind im gewählten Zeitraum nicht verfügbar (Urlaub, Abwesenheit oder Stundenlimit).')
      await prisma.planningSession.update({
        where: { id: session.id },
        data: { status: 'no_feasible_solution', solverDiagnosis: reason },
      })
      throw new Error(reason)
    }

    // ── Step 4: Deterministic verification — no LLM ─────────────────────────────
    const start = Date.now()
    let bewertung = verifyPlan(plan, ruleModel)
    const durationMs = Date.now() - start

    // ── Step 4b: Apply PlanningPolicy (minAutoApproveScore override) ────────────
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

    // ── Step 5: Handle plan alternatives ───────────────────────────────────────
    let alternativen: AlternativePlan[] | undefined
    if (includeAlternativen) {
      const variants: PlanVariante[] = ['mitarbeiterfreundlich', 'maximal_fair']
      alternativen = []
      for (const variante of variants) {
        try {
          const altPlan = await solvePlan({ ...ruleModel, planVariante: variante })
          if (altPlan.eintraege.length > 0) {
            const altBewertung = verifyPlan(altPlan, ruleModel)
            alternativen.push({ variante, plan: altPlan, bewertung: altBewertung })
          }
        } catch {
          // Skip failed variant
        }
      }
    }

    // ── Step 6: Persist results ─────────────────────────────────────────────────
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
        freigabeEmpfehlung: bewertung.freigabeEmpfehlung,
        bewertungSnap: { bewertung, alternativen } as object,
        completedAt: new Date(),
      },
    })

    return {
      sessionId: session.id,
      finalPlan: plan,
      finalBewertung: bewertung,
      iterationen: 1,
      gesamtScore: bewertung.gesamtScore,
      alternativen,
    }
  } catch (err) {
    await prisma.planningSession.update({
      where: { id: session.id },
      data: { status: 'failed' },
    })
    throw err
  }
}
