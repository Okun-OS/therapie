// Leitet aus der frei formulierten Pausenlogik eines Standorts (LocationOnboarding.pausenlogik)
// deterministische Abzugsregeln ab (automatisch ja/nein, Schwelle, Abzugsminuten) und wendet sie
// beim Ausstempeln an. Die Extraktion läuft einmalig pro Standort (und erneut nach Änderung der
// Pausenlogik), das Ergebnis wird dauerhaft auf LocationPlanningRules gespeichert.
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from './prisma'
import { getPlanningRules, upsertPlanningRules } from './schedule-entities'
import type { LocationPlanningRules } from './types'

const client = new Anthropic()

const BREAK_RULES_TOOL = {
  name: 'extract_break_rules',
  description: 'Speichert die aus der Pausenlogik-Beschreibung abgeleiteten, deterministischen Abzugsregeln.',
  input_schema: {
    type: 'object' as const,
    properties: {
      autoBreakDeduction: { type: 'boolean', description: 'true, wenn Pausen automatisch vom System abgezogen werden sollen, ohne dass Mitarbeiter sie manuell über Start/Ende erfassen. false, wenn Mitarbeiter ihre Pausen selbst erfassen (Vertrauensarbeitszeit/manuell) oder die Logik unklar ist.' },
      breakThresholdMinutes: { type: 'number', description: 'Arbeitsminuten, ab denen die automatische Pause abgezogen wird (z.B. 6 Stunden = 360).' },
      breakDeductionMinutes: { type: 'number', description: 'Anzahl Minuten, die automatisch abgezogen werden (z.B. 30).' },
    },
    required: ['autoBreakDeduction', 'breakThresholdMinutes', 'breakDeductionMinutes'],
  },
}

interface ExtractedBreakRules {
  autoBreakDeduction: boolean
  breakThresholdMinutes: number
  breakDeductionMinutes: number
}

const FALLBACK_RULES: ExtractedBreakRules = { autoBreakDeduction: false, breakThresholdMinutes: 360, breakDeductionMinutes: 30 }

async function extractBreakRules(pausenlogikText: string): Promise<ExtractedBreakRules> {
  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 256,
    tools: [BREAK_RULES_TOOL],
    tool_choice: { type: 'tool', name: 'extract_break_rules' },
    system: 'Du analysierst die frei formulierte Pausenlogik-Beschreibung eines Standorts aus dessen Onboarding und leitest daraus exakte, deterministische Regeln für den automatischen Pausenabzug bei der Zeiterfassung ab. Beispiel: "Pausen werden automatisch nach 6 Stunden abgezogen" → autoBreakDeduction=true, breakThresholdMinutes=360, breakDeductionMinutes=30 (gesetzlicher Standard, falls keine Minutenzahl genannt wird). Falls der Text beschreibt, dass Mitarbeiter ihre Pause selbst über Start/Ende-Buttons erfassen, oder keine klare automatische Regel erkennbar ist, setze autoBreakDeduction=false. Erfinde keine Zahlen, die nicht im Text stehen oder als gesetzlicher Standard gelten (Deutschland: ab 6h 30min, ab 9h 45min Pause).',
    messages: [{ role: 'user', content: `Pausenlogik-Text dieses Standorts:\n"""\n${pausenlogikText}\n"""` }],
  })
  const block = response.content.find(b => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') return FALLBACK_RULES
  const input = block.input as Record<string, unknown>
  return {
    autoBreakDeduction: typeof input.autoBreakDeduction === 'boolean' ? input.autoBreakDeduction : false,
    breakThresholdMinutes: typeof input.breakThresholdMinutes === 'number' && input.breakThresholdMinutes > 0 ? Math.round(input.breakThresholdMinutes) : FALLBACK_RULES.breakThresholdMinutes,
    breakDeductionMinutes: typeof input.breakDeductionMinutes === 'number' && input.breakDeductionMinutes > 0 ? Math.round(input.breakDeductionMinutes) : FALLBACK_RULES.breakDeductionMinutes,
  }
}

/** Stellt sicher, dass für diesen Standort eine KI-Extraktion der Pausenlogik gelaufen ist, und
 * liefert die aktuellen (ggf. frisch extrahierten) Planungsregeln zurück. Läuft nur einmal pro
 * Standort, solange resetBreakRulesExtraction() nicht erneut aufgerufen wurde. */
export async function ensureBreakRulesExtracted(locationId: string): Promise<LocationPlanningRules> {
  const rules = await getPlanningRules(locationId)
  if (rules.breakRulesExtractedAt) return rules

  const onboarding = await prisma.locationOnboarding.findUnique({ where: { locationId }, select: { pausenlogik: true } })
  const text = onboarding?.pausenlogik?.trim()

  if (!text) {
    return upsertPlanningRules(locationId, { breakRulesExtractedAt: new Date().toISOString() })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return rules
  }

  try {
    const extracted = await extractBreakRules(text)
    return upsertPlanningRules(locationId, { ...extracted, breakRulesExtractedAt: new Date().toISOString() })
  } catch (err) {
    console.error('break-rules-extraction', err)
    return rules
  }
}

/** Markiert die Pausenlogik-Extraktion eines Standorts als veraltet, z.B. nachdem der Nutzer im
 * Onboarding-Chat die Pausenlogik-Beschreibung geändert hat. Beim nächsten Ausstempeln wird sie
 * dann automatisch neu durchgeführt. */
export async function resetBreakRulesExtraction(locationId: string): Promise<void> {
  await prisma.locationPlanningRules.updateMany({ where: { locationId }, data: { breakRulesExtractedAt: null } })
}

/** Liefert die beim Ausstempeln tatsächlich anzuwendenden Pausenminuten: manuell über
 * Start/Ende-Pause erfasste Zeiten haben immer Vorrang vor der automatischen Abzugsregel. */
export async function computeBreakMinutesForClockOut(locationId: string, existingBreakMinutes: number, totalMinutes: number): Promise<number> {
  if (existingBreakMinutes > 0) return existingBreakMinutes
  const rules = await ensureBreakRulesExtracted(locationId)
  if (rules.autoBreakDeduction && totalMinutes >= rules.breakThresholdMinutes) {
    return rules.breakDeductionMinutes
  }
  return existingBreakMinutes
}
