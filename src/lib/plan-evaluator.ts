import Anthropic from '@anthropic-ai/sdk'
import type { PlanningRuleModel, GenerierterPlan, PlanBewertung, FreigabeEmpfehlung } from '@/lib/company-model-types'

const client = new Anthropic()

const EVALUATOR_SYSTEM = `Du bist ein unabhängiger Qualitätsprüfer für Dienstpläne.
Du bewertest einen erstellten Dienstplan gegen das Regelmodell und gibst strukturiertes Feedback.

Antworte AUSSCHLIESSLICH mit validem JSON. Kein Text außerhalb des JSON.

Das JSON muss diesem Schema entsprechen:
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
  "optimierungsVorschlaege": [
    {
      "typ": "tausch|verschiebung|anpassung|regel",
      "beschreibung": "string",
      "erwarteteVerbesserung": 0-20
    }
  ],
  "freigabeEmpfehlung": "freigeben|optimieren|ueberarbeiten",
  "zusammenfassung": "string"
}

Bewertungskriterien:
- regelkonformitaet: Einhaltung aller harten Regeln (Urlaub, Ruhezeiten, Maxstunden)
- fairness: Gleichmäßige Verteilung von belastenden Diensten
- abdeckung: Erfüllung aller Besetzungsminima
- wunscherfuellung: Berücksichtigung von Dienstwünschen
- qualitaet: Gesamtqualität (Kontinuität, Planung, Transparenz)

freigabeEmpfehlung:
- "freigeben": gesamtScore >= 80 UND keine kritischen Verletzungen
- "optimieren": gesamtScore 60-79 ODER nur niedrige/mittlere Verletzungen
- "ueberarbeiten": gesamtScore < 60 ODER kritische/hohe Verletzungen vorhanden`

export async function evaluatePlan(
  plan: GenerierterPlan,
  ruleModel: PlanningRuleModel,
): Promise<PlanBewertung> {
  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    system: EVALUATOR_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Bewerte diesen Dienstplan gegen das Regelmodell:

REGELMODELL:
${JSON.stringify(ruleModel, null, 2)}

ERSTELLTER PLAN:
${JSON.stringify(plan, null, 2)}`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return {
      gesamtScore: 50,
      kategorien: { regelkonformitaet: 50, fairness: 50, abdeckung: 50, wunscherfuellung: 50, qualitaet: 50 },
      verletzungen: [],
      optimierungsVorschlaege: [],
      freigabeEmpfehlung: 'optimieren' as FreigabeEmpfehlung,
      zusammenfassung: 'Bewertung konnte nicht geparst werden',
    }
  }

  const bewertung = JSON.parse(jsonMatch[0]) as PlanBewertung

  // Enforce freigabeEmpfehlung rules
  const hasCritical = bewertung.verletzungen.some(v => v.schwere === 'kritisch')
  const hasHigh = bewertung.verletzungen.some(v => v.schwere === 'hoch')
  if (hasCritical || (hasHigh && bewertung.gesamtScore < 60)) {
    bewertung.freigabeEmpfehlung = 'ueberarbeiten'
  } else if (bewertung.gesamtScore >= 80 && !hasCritical) {
    bewertung.freigabeEmpfehlung = 'freigeben'
  } else {
    bewertung.freigabeEmpfehlung = 'optimieren'
  }

  return bewertung
}
