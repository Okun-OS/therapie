import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import type { SchedulePlanningDraft, ScheduleTask } from '@/lib/schedule-planning-draft'

const client = new Anthropic()

// 04_DIENSTPLAN_CHAT.md, Schritt 2–4: statt starrer Eingabefelder werden
// Besonderheiten für die anstehende Planungsperiode in einem kurzen KI-Dialog erfasst.
const SYSTEM_PROMPT = `Du bist der KI-Assistent von OKUN Workforce zur Vorbereitung einer Dienstplan-Erstellung.

Führe einen kurzen, natürlichen Dialog mit der Leitung, um Besonderheiten für die anstehende Planungsperiode zu erfassen. Der Zeitraum wurde bereits ausgewählt und wird dir mitgeteilt – frage nicht erneut danach.

Gehe die folgenden Phasen in Reihenfolge durch, jeweils mit höchstens einer Frage pro Nachricht:

Phase 1 – Besondere Ereignisse: "Gibt es in diesem Zeitraum besondere Ereignisse, die die Planung beeinflussen?" Beispiele: Sommerfest, Elternabend, Fortbildung, Schließtag, Ausflug. Wenn die Leitung "nein" sagt, gehe direkt weiter.

Phase 2 – Zusätzliche Aufgaben: "Gibt es zusätzliche Aufgaben außerhalb des normalen Dienstes, die in diesem Zeitraum eingeplant werden müssen?" Leite aus der freien Antwort selbst Dauer, Priorität, betroffene Mitarbeiter und den genauen Zeitraum der Aufgabe ab, soweit erkennbar – frage nur nach, wenn etwas für die Planung wirklich unklar bleibt. Wenn die Leitung "nein" sagt, gehe direkt weiter.

Phase 3 – Besondere Mitarbeiterinformationen: "Gibt es Besonderheiten zu einzelnen Mitarbeitern, die nur für diesen Zeitraum gelten?" Beispiele: "Frau Müller kann diese Woche nur vormittags", "Herr Klein wird eingearbeitet und sollte nicht alleine Frühdienst machen". WICHTIG: Hier geht es NICHT um Wunschdienste oder Urlaub/Krankheit – diese werden automatisch und an anderer Stelle berücksichtigt. Frage danach nicht. Wenn die Leitung "nein" sagt, gehe direkt weiter.

Phase 4 – Abschluss: Fasse kurz zusammen, was du notiert hast (oder dass nichts Besonderes vorliegt) und frage, ob das so passt. Sobald die Leitung bestätigt, ist das Gespräch abgeschlossen.

Regeln:
1. Sprich die Leitung direkt mit "Du" an, freundlich und professionell, aber locker.
2. Stelle pro Nachricht nur EINE Frage, keine langen Frageblöcke.
3. Rufe nach jeder neuen Information das Tool "update_planning_draft" auf und gib dabei IMMER den vollständigen, kumulierten Stand aller bisher bekannten Felder an (nicht nur das Delta).
4. Setze "currentPhase" auf die Phase, die du gerade bearbeitest oder gerade abgeschlossen hast.
5. Setze "readyToSave" erst auf true, wenn die Leitung die Zusammenfassung in Phase 4 bestätigt hat (auch wenn alle Listen leer sind, weil nichts Besonderes vorlag).
6. Antworte IMMER zusätzlich mit einem kurzen Text, auch wenn du das Tool aufrufst.
7. Erfinde niemals Angaben, die nicht genannt wurden.
8. Schreibe ausschließlich auf Deutsch.
9. Die hier erfassten Informationen gelten NUR für die aktuelle Planungsperiode, nie dauerhaft.`

const TOOL = {
  name: 'update_planning_draft',
  description: 'Speichert den aktuellen, vollständigen Stand der erfassten Planungsbesonderheiten. Gib bei jedem Aufruf den vollständigen kumulierten Stand an, niemals nur die neuen Felder.',
  input_schema: {
    type: 'object' as const,
    properties: {
      events: { type: 'array', items: { type: 'string' } },
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            duration: { type: 'string' },
            priority: { type: 'string' },
            affectedEmployees: { type: 'string' },
            period: { type: 'string' },
          },
          required: ['description'],
        },
      },
      employeeNotes: { type: 'array', items: { type: 'string' } },
      currentPhase: { type: 'number' },
      readyToSave: { type: 'boolean' },
    },
  },
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' }, { status: 500 })
  }

  let body: { messages?: ChatMessage[]; draft?: SchedulePlanningDraft; periodLabel?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { messages, draft, periodLabel } = body
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages sind erforderlich' }, { status: 400 })
  }

  const stateNote = `## Ausgewählte Planungsperiode
${periodLabel ?? 'nicht angegeben'}

## Bisher im Gespräch erfasste Daten
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
    let nextDraft: SchedulePlanningDraft = draft ?? {}
    for (const block of response.content) {
      if (block.type === 'text') reply += block.text
      if (block.type === 'tool_use' && block.name === 'update_planning_draft') {
        const input = block.input as Record<string, unknown>
        nextDraft = {
          ...nextDraft,
          ...(Array.isArray(input.events) && { events: input.events as string[] }),
          ...(Array.isArray(input.tasks) && { tasks: input.tasks as ScheduleTask[] }),
          ...(Array.isArray(input.employeeNotes) && { employeeNotes: input.employeeNotes as string[] }),
          ...(typeof input.currentPhase === 'number' && { currentPhase: input.currentPhase }),
          ...(typeof input.readyToSave === 'boolean' && { readyToSave: input.readyToSave }),
        }
      }
    }

    if (!reply.trim()) {
      reply = 'Danke, das habe ich notiert!'
    }

    return NextResponse.json({ reply, draft: nextDraft })
  } catch (err: unknown) {
    console.error('schedule-planning-chat', err)
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
