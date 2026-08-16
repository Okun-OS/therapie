import type { PlanningRuleModel, GenerierterPlan } from '@/lib/company-model-types'

export async function solvePlan(ruleModel: PlanningRuleModel): Promise<GenerierterPlan> {
  const solverUrl = process.env.SOLVER_SERVICE_URL
  if (!solverUrl) {
    throw new Error(
      'Solver-Service nicht konfiguriert. Bitte SOLVER_SERVICE_URL als Umgebungsvariable setzen ' +
      '(Beispiel: http://localhost:8080 für lokale Entwicklung).',
    )
  }

  // §86: Der Solver läuft als eigener Dienst. Nach einem Deploy, einem Neustart
  // oder aus dem Ruhezustand heraus antwortet das Railway-Gateway kurzzeitig mit
  // 502/503/504, obwohl der Dienst gleich darauf bereit ist. Statt den Nutzer
  // mit "HTTP 502" abzuweisen: aufwärmen und mit Backoff erneut versuchen.
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

  const warmUp = async () => {
    try {
      await fetch(`${solverUrl}/health`, { signal: AbortSignal.timeout(5_000) })
    } catch { /* egal — nur ein Weckruf */ }
  }

  const ATTEMPTS = 3
  const RETRY_STATUS = new Set([502, 503, 504])
  let resp: Response | null = null
  let lastProblem = ''

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      resp = await fetch(`${solverUrl}/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleModel),
        signal: AbortSignal.timeout(60_000),
      })
    } catch (err) {
      lastProblem = `nicht erreichbar (${err instanceof Error ? err.message : String(err)})`
      resp = null
    }

    if (resp && resp.ok) break

    if (resp && !RETRY_STATUS.has(resp.status)) {
      // Echter Fehler des Solvers (z.B. 400/500) — kein Wiederholen
      let detail = ''
      try { detail = (await resp.json()).detail ?? '' } catch { /* ignore */ }
      throw new Error(`Solver-Service Fehler (HTTP ${resp.status})${detail ? ': ' + detail : ''}`)
    }

    if (resp) lastProblem = `Gateway-Fehler HTTP ${resp.status}`
    if (attempt < ATTEMPTS) {
      console.warn(`[planning-solver] Versuch ${attempt}/${ATTEMPTS} fehlgeschlagen (${lastProblem}) — warte und wecke den Dienst`)
      await warmUp()
      await sleep(attempt * 3_000) // 3s, dann 6s
    }
  }

  if (!resp || !resp.ok) {
    throw new Error(
      `Der Rechendienst für Dienstpläne war nicht erreichbar (${lastProblem}). ` +
      'Er startet nach einer Aktualisierung kurz neu — bitte in etwa einer Minute erneut versuchen. ' +
      'Bleibt es dabei, prüfe in Railway, ob der Dienst "solver" läuft.',
    )
  }

  const plan = await resp.json() as GenerierterPlan

  // Surface INFEASIBLE diagnosis as a structured error
  const infeasibleDecision = plan.decisions?.find(d => d.typ === 'infeasible')
  if (infeasibleDecision) {
    throw new Error(infeasibleDecision.beschreibung)
  }

  return plan
}
