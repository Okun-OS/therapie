import Anthropic from '@anthropic-ai/sdk'
import type {
  PlanningRuleModel,
  GenerierterPlan,
  PlanBewertung,
  FreigabeEmpfehlung,
  RegelVerletzung,
} from '@/lib/company-model-types'

const client = new Anthropic()

const SYSTEM = `Du bist ein unabhängiger Qualitätsprüfer für Dienstpläne.
Du bewertest einen erstellten Dienstplan gegen das Regelmodell und gibst strukturiertes Feedback.

Antworte AUSSCHLIESSLICH mit validem JSON. Kein Text außerhalb des JSON.

Schema:
{
  "gesamtScore": 0-100,
  "kategorien": {
    "regelkonformitaet": 0-100,
    "fairness": 0-100,
    "abdeckung": 0-100,
    "wunscherfuellung": 0-100,
    "qualitaet": 0-100
  },
  "verletzungen": [
    {
      "schwere": "kritisch|hoch|mittel|niedrig",
      "regelId": "string",
      "beschreibung": "string",
      "betrifft": ["mitarbeiterId oder datum"]
    }
  ],
  "optimierungsVorschlaege": [],
  "freigabeEmpfehlung": "freigeben|optimieren|ueberarbeiten",
  "zusammenfassung": "string"
}

Bewertungskriterien:
- regelkonformitaet: Urlaub, Ruhezeiten, Max-Stunden, Folgetage eingehalten?
- fairness: Gleichmäßige Verteilung belastender Dienste (Nacht, Wochenende, Freitag-Spät)?
- abdeckung: Mindestbesetzung aller Schichten erfüllt?
- wunscherfuellung: Dienstwünsche der Mitarbeiter berücksichtigt?
- qualitaet: Gesamtplanung sinnvoll und konsistent?

freigabeEmpfehlung:
- "freigeben": Score ≥ 80 UND keine kritischen/hohen Verletzungen
- "optimieren": Score 60-79 ODER nur mittlere/niedrige Verletzungen
- "ueberarbeiten": Score < 60 ODER kritische/hohe Verletzungen vorhanden`

export async function evaluatePlan(
  plan: GenerierterPlan,
  ruleModel: PlanningRuleModel,
): Promise<PlanBewertung> {
  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Bewerte diesen Dienstplan:

REGELMODELL:
${JSON.stringify(ruleModel, null, 2)}

ERSTELLTER PLAN:
${JSON.stringify(plan, null, 2)}`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Kein JSON in Evaluator-Antwort')

    const bewertung = JSON.parse(jsonMatch[0]) as PlanBewertung

    // Enforce freigabeEmpfehlung rules deterministically
    const hasCritical = bewertung.verletzungen.some(v => v.schwere === 'kritisch')
    const hasHigh     = bewertung.verletzungen.some(v => v.schwere === 'hoch')
    if (hasCritical || (hasHigh && bewertung.gesamtScore < 60)) {
      bewertung.freigabeEmpfehlung = 'ueberarbeiten'
    } else if (bewertung.gesamtScore >= 80 && !hasCritical && !hasHigh) {
      bewertung.freigabeEmpfehlung = 'freigeben'
    } else {
      bewertung.freigabeEmpfehlung = 'optimieren'
    }

    return bewertung
  } catch {
    // Fallback: code-based minimum evaluation so the pipeline never crashes
    return codeBasedFallback(plan, ruleModel)
  }
}

// ─── Code-based fallback (used when AI call fails) ───────────────────────────

function shiftDurationHours(von: string, bis: string): number {
  const [sh, sm] = von.split(':').map(Number)
  const [eh, em] = bis.split(':').map(Number)
  const mins = eh * 60 + em - (sh * 60 + sm)
  return (mins <= 0 ? mins + 24 * 60 : mins) / 60
}

function codeBasedFallback(plan: GenerierterPlan, ruleModel: PlanningRuleModel): PlanBewertung {
  const { mitarbeiter, schichten, harteRegeln, zeitraum } = ruleModel
  const verletzungen: RegelVerletzung[] = []

  const maxWeeklyHours = harteRegeln.find(r => r.typ === 'max_wochenstunden')?.wert ?? 40

  const byEmp = new Map<string, typeof plan.eintraege>()
  for (const e of plan.eintraege) {
    if (!byEmp.has(e.mitarbeiterId)) byEmp.set(e.mitarbeiterId, [])
    byEmp.get(e.mitarbeiterId)!.push(e)
  }

  // Vacation / absence
  for (const emp of mitarbeiter) {
    for (const e of byEmp.get(emp.id) ?? []) {
      if (emp.urlaubAn.includes(e.datum)) {
        verletzungen.push({ schwere: 'kritisch', regelId: 'hr-urlaub', beschreibung: `${emp.name} hat Urlaub am ${e.datum}`, betrifft: [emp.id, e.datum] })
      }
    }
  }

  // Staffing coverage
  const byDayShift = new Map<string, number>()
  for (const e of plan.eintraege) {
    const key = `${e.datum}|${e.schichtId}`
    byDayShift.set(key, (byDayShift.get(key) ?? 0) + 1)
  }
  for (const day of zeitraum.arbeitstage) {
    for (const schicht of schichten) {
      const actual   = byDayShift.get(`${day}|${schicht.id}`) ?? 0
      const required = schicht.minBesetzungGesamt ?? 1
      if (actual < required) {
        verletzungen.push({ schwere: 'mittel', regelId: 'hr-mindestbesetzung', beschreibung: `Schicht „${schicht.name}" am ${day}: ${actual}/${required}`, betrifft: [day, schicht.id] })
      }
    }
  }

  const criticalCount = verletzungen.filter(v => v.schwere === 'kritisch').length
  const gesamtScore   = Math.max(0, 80 - criticalCount * 20 - verletzungen.length * 5)
  const freigabeEmpfehlung: FreigabeEmpfehlung = criticalCount > 0 ? 'ueberarbeiten' : gesamtScore >= 80 ? 'freigeben' : 'optimieren'

  return {
    gesamtScore,
    kategorien: { regelkonformitaet: gesamtScore, fairness: 70, abdeckung: 70, wunscherfuellung: 70, qualitaet: gesamtScore },
    verletzungen,
    optimierungsVorschlaege: [],
    freigabeEmpfehlung,
    zusammenfassung: `Automatische Bewertung (KI nicht erreichbar): ${verletzungen.length} Hinweise, Score ${gesamtScore}/100`,
  }
}
