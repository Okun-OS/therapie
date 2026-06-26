import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import type { VacationRulesDraft } from '@/lib/vacation-rules-draft'

const client = new Anthropic()

// 05_URLAUBSPLANUNG_CHAT.md, Schritt 1 "Urlaubsregeln erfassen": die Leitung
// beschreibt die Einrichtung und ihre Urlaubsregeln frei in Worten statt über ein starres Formular.
const SYSTEM_PROMPT = `Du bist der KI-Assistent von Open Workforce zur Erfassung der jährlichen Urlaubsplanungsregeln einer Einrichtung.

Die Leitung beschreibt dir frei in Worten ihre Einrichtung und die Regeln, die bei der Urlaubsplanung gelten sollen (z.B. Gruppenstruktur, Mindestbesetzung, wie viele Mitarbeiter maximal gleichzeitig Urlaub haben dürfen, besondere Feiertags- oder Sonderzeitregeln).

Leite daraus eigenständig ab:
- Eine kurze, zusammenfassende Einrichtungsbeschreibung inkl. aller genannten Besetzungs- und Strukturregeln
- Die maximale Anzahl an Mitarbeitern, die gleichzeitig Urlaub haben dürfen (als Zahl)
- Eine Liste einzelner, klar formulierter Zusatzregeln (z.B. "Über Weihnachten dürfen maximal 2 Personen gleichzeitig fehlen", "Springerpool-Mitglieder zählen nicht zur Mindestbesetzung"), falls genannt

Frage NUR nach, wenn die maximale gleichzeitige Abwesenheit wirklich nicht erkennbar ist. Frage niemals nach Dingen, die schon klar erkennbar sind.

Stelle außerdem IMMER einmal die Frage: "Sollen Mitarbeiter mit schulpflichtigen Kindern bei Urlauben während der Schulferien bevorzugt berücksichtigt werden?" Biete dabei drei Stufen an: "Immer priorisieren", "Nur leicht bevorzugen" oder "Keine Priorisierung". Setze danach "schoolHolidayPriorityMode" auf "always", "slight" bzw. "none".

Ablauf:
1. Sobald die wichtigsten Regeln (inkl. Ferienregelung) erfasst sind, fasse kurz zusammen, was du verstanden hast, und frage, ob das so für die diesjährige und künftige Planungen gespeichert werden soll.
2. Speichere erst, wenn die Leitung diese Zusammenfassung ausdrücklich bestätigt (z.B. "ja", "passt", "speichern").

Regeln:
1. Sprich die Leitung direkt mit "Du" an, freundlich und professionell.
2. Stelle pro Nachricht höchstens eine Frage.
3. Rufe nach jeder neuen Information das Tool "update_vacation_rules_draft" auf und gib dabei IMMER den vollständigen, kumulierten Stand aller bisher bekannten Felder an (nicht nur das Delta).
4. Setze "readyToSave" erst auf true, wenn du die Zusammenfassung präsentiert hast.
5. Setze "confirmed" auf true, sobald die Leitung die Zusammenfassung ausdrücklich bestätigt.
6. Antworte IMMER zusätzlich mit einem kurzen Text, auch wenn du das Tool aufrufst.
7. Erfinde niemals Regeln, die nicht genannt wurden oder sich nicht sinnvoll ableiten lassen.
8. Schreibe ausschließlich auf Deutsch. Diese Regeln gelten dauerhaft für alle künftigen Planungen, bis sie erneut geändert werden.`

const TOOL = {
  name: 'update_vacation_rules_draft',
  description: 'Speichert den aktuellen, vollständigen Stand der erfassten Urlaubsregeln. Gib bei jedem Aufruf den vollständigen kumulierten Stand an, niemals nur die neuen Felder.',
  input_schema: {
    type: 'object' as const,
    properties: {
      facilityDescription: { type: 'string' },
      maxConcurrent: { type: 'number' },
      customRules: { type: 'array', items: { type: 'string' } },
      schoolHolidayPriorityMode: { type: 'string', enum: ['always', 'slight', 'none'] },
      readyToSave: { type: 'boolean' },
      confirmed: { type: 'boolean' },
    },
  },
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' }, { status: 500 })
  }

  let body: { messages?: ChatMessage[]; draft?: VacationRulesDraft }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { messages, draft } = body
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages sind erforderlich' }, { status: 400 })
  }

  const stateNote = `## Bisher im Gespräch erfasste Regeln
${JSON.stringify(draft ?? {}, null, 2)}

Frage nicht erneut nach Dingen, die hier schon stehen. Baue darauf auf.`

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: stateNote },
      ],
      tools: [TOOL],
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    let reply = ''
    let nextDraft: VacationRulesDraft = draft ?? {}
    for (const block of response.content) {
      if (block.type === 'text') reply += block.text
      if (block.type === 'tool_use' && block.name === 'update_vacation_rules_draft') {
        const input = block.input as Record<string, unknown>
        nextDraft = {
          ...nextDraft,
          ...(typeof input.facilityDescription === 'string' && { facilityDescription: input.facilityDescription }),
          ...(typeof input.maxConcurrent === 'number' && { maxConcurrent: input.maxConcurrent }),
          ...(Array.isArray(input.customRules) && { customRules: input.customRules as string[] }),
          ...(typeof input.schoolHolidayPriorityMode === 'string' && { schoolHolidayPriorityMode: input.schoolHolidayPriorityMode as 'always' | 'slight' | 'none' }),
          ...(typeof input.readyToSave === 'boolean' && { readyToSave: input.readyToSave }),
          ...(typeof input.confirmed === 'boolean' && { confirmed: input.confirmed }),
        }
      }
    }

    if (!reply.trim()) {
      reply = 'Danke, das habe ich notiert!'
    }

    return NextResponse.json({ reply, draft: nextDraft })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
