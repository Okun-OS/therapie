import type { PlanningRuleModel, GenerierterPlan } from '@/lib/company-model-types'

export async function solvePlan(ruleModel: PlanningRuleModel): Promise<GenerierterPlan> {
  const solverUrl = process.env.SOLVER_SERVICE_URL
  if (!solverUrl) {
    throw new Error(
      'Solver-Service nicht konfiguriert. Bitte SOLVER_SERVICE_URL als Umgebungsvariable setzen ' +
      '(Beispiel: http://localhost:8080 für lokale Entwicklung).',
    )
  }

  let resp: Response
  try {
    resp = await fetch(`${solverUrl}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ruleModel),
      signal: AbortSignal.timeout(40_000),
    })
  } catch (err) {
    throw new Error(
      `Solver-Service nicht erreichbar (${solverUrl}): ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  if (!resp.ok) {
    let detail = ''
    try { detail = (await resp.json()).detail ?? '' } catch { /* ignore */ }
    throw new Error(`Solver-Service Fehler (HTTP ${resp.status})${detail ? ': ' + detail : ''}`)
  }

  const plan = await resp.json() as GenerierterPlan

  // Surface INFEASIBLE diagnosis as a structured error
  const infeasibleDecision = plan.decisions?.find(d => d.typ === 'infeasible')
  if (infeasibleDecision) {
    throw new Error(infeasibleDecision.beschreibung)
  }

  return plan
}
