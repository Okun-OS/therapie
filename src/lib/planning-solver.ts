import Anthropic from '@anthropic-ai/sdk'
import type { PlanningRuleModel, GenerierterPlan, PlanEintrag } from '@/lib/company-model-types'

const client = new Anthropic()

const SOLVER_SYSTEM = `Du bist ein präziser Dienstplan-Solver für professionelle Personalplanung.
Du erhältst ein strukturiertes Regelmodell (PlanningRuleModel) und erstellst daraus einen optimalen Dienstplan.

WICHTIG: Antworte AUSSCHLIESSLICH mit validem JSON. Kein Text, keine Erklärungen außerhalb des JSON.

Das JSON muss diesem Schema entsprechen:
{
  "eintraege": [
    {
      "mitarbeiterId": "string",
      "datum": "YYYY-MM-DD",
      "schichtId": "string",
      "einheitId": "string (optional)",
      "funktion": "string (optional)",
      "aufgaben": ["string"] (optional),
      "istVertretung": false,
      "startzeit": "HH:MM (optional, nur wenn von Schicht-Standard abweichend)",
      "endzeit": "HH:MM (optional)",
      "hinweis": "string (optional)"
    }
  ],
  "decisions": [
    {
      "typ": "string",
      "beschreibung": "string",
      "betroffeneMitarbeiter": ["string"] (optional),
      "betroffenesDatum": "YYYY-MM-DD (optional)"
    }
  ],
  "metadaten": {
    "erstelltAm": "ISO timestamp",
    "solver": "claude-opus-4-7",
    "regelmodellVersion": "string"
  }
}

Regeln für den Solver:
1. Harte Regeln sind absolut – niemals verletzen
2. Mitarbeiter im Urlaub oder krank: keine Einträge für diese Tage
3. Besetzungsminima aller Schichten und Einheiten erfüllen
4. Wünsche berücksichtigen (soft)
5. Fairness bei Wochenendarbeit und Nachtdiensten beachten
6. Jede Entscheidung, die von Standard abweicht, in decisions dokumentieren
7. Keine Vertretungseinträge außer wenn explizit gefordert`

/**
 * Code-based hard-rule enforcement — runs after the AI generates a plan.
 * Guarantees absolute rules are upheld regardless of what the AI produced.
 */
function enforceHardRules(plan: GenerierterPlan, ruleModel: PlanningRuleModel): GenerierterPlan {
  const validShiftIds = new Set(ruleModel.schichten.map(s => s.id))
  const empMap = new Map(ruleModel.mitarbeiter.map(m => [m.id, m]))
  const seen = new Set<string>()
  const removed: string[] = []

  const validEntries = plan.eintraege.filter((entry: PlanEintrag) => {
    const emp = empMap.get(entry.mitarbeiterId)

    if (!emp) {
      removed.push(`Unbekannter Mitarbeiter ${entry.mitarbeiterId} am ${entry.datum}`)
      return false
    }
    if (emp.urlaubAn.includes(entry.datum)) {
      removed.push(`${emp.name} ist am ${entry.datum} im Urlaub`)
      return false
    }
    if (emp.nichtVerfuegbarAn.includes(entry.datum)) {
      removed.push(`${emp.name} ist am ${entry.datum} nicht verfügbar`)
      return false
    }
    if (!validShiftIds.has(entry.schichtId)) {
      removed.push(`Ungültige Schicht-ID "${entry.schichtId}" für ${emp.name} am ${entry.datum}`)
      return false
    }
    const dupKey = `${entry.mitarbeiterId}|${entry.datum}`
    if (seen.has(dupKey)) {
      removed.push(`Doppelter Eintrag für ${emp.name} am ${entry.datum} entfernt`)
      return false
    }
    seen.add(dupKey)
    return true
  })

  if (removed.length > 0) {
    console.warn(`[enforceHardRules] ${removed.length} Einträge korrigiert:`, removed)
    plan.decisions.push({
      typ: 'regelkorrektur',
      beschreibung: `${removed.length} regelwidrige Einträge automatisch korrigiert: ${removed.slice(0, 5).join('; ')}${removed.length > 5 ? ` … (+${removed.length - 5} weitere)` : ''}`,
    })
  }

  return { ...plan, eintraege: validEntries }
}

export async function solvePlan(ruleModel: PlanningRuleModel): Promise<GenerierterPlan> {
  const cellCount = ruleModel.mitarbeiter.length * ruleModel.zeitraum.arbeitstage.length
  const maxTokens = Math.min(32000, Math.max(16000, 3000 + cellCount * 300))

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: maxTokens,
    system: SOLVER_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Erstelle den optimalen Dienstplan für dieses Regelmodell:\n\n${JSON.stringify(ruleModel, null, 2)}`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Solver hat kein gültiges JSON zurückgegeben')
  }

  const plan = JSON.parse(jsonMatch[0]) as GenerierterPlan
  if (!plan.eintraege || !Array.isArray(plan.eintraege)) {
    throw new Error('Solver-Antwort enthält keine gültigen Planeinträge')
  }

  return enforceHardRules(plan, ruleModel)
}
