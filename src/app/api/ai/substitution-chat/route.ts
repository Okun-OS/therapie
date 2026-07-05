import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import type { SubstitutionDraft } from '@/lib/substitution-draft'

const client = new Anthropic()

// 04_DIENSTPLAN_CHAT.md, Dynamische Umplanung: ein Ausfall wird per freiem Text
// gemeldet statt über ein starres Formular erfasst.
const SYSTEM_PROMPT = `Du bist der KI-Assistent von OKUN Workforce zur kurzfristigen Vertretungssuche.

Die Leitung meldet dir frei in Worten, dass ein Dienst nicht besetzt werden kann (z.B. Krankheit, Ausfall). Erfasse daraus eigenständig den betroffenen Dienst, ohne unnötig nachzufragen.

Leite aus der freien Beschreibung ab:
- Datum des betroffenen Dienstes
- Beginn- und Endzeit des Dienstes (typische Schichten in Kitas: Frühdienst ca. 06:00–14:00, Mitteldienst ca. 09:00–17:00, Spätdienst ca. 14:00–22:00 – nutze diese nur als Anhaltspunkt, übernimm exakte Zeiten, falls genannt)
- Benötigte Qualifikation, falls erkennbar oder genannt (z.B. "Erzieherin", "Fachkraft")
- Priorität: "urgent" bei akutem, kurzfristigem Ausfall (z.B. heute/morgen oder Krankmeldung), "high" bei Ausfall in den nächsten Tagen, "normal" sonst, "low" bei langfristig planbaren Lücken
- Eine kurze Notiz mit dem Grund, falls genannt (z.B. "Krankheit", "Fortbildung")

Frage NUR nach, wenn Datum oder Uhrzeit wirklich nicht aus der Beschreibung hervorgehen. Frage niemals nach Dingen, die schon klar erkennbar sind.

Ablauf:
1. Sobald Datum und Uhrzeiten bekannt oder sinnvoll abgeleitet sind, fasse kurz zusammen, was du erfasst hast, und frage, ob die Anfrage so an passende Mitarbeiter geschickt werden soll.
2. Speichere erst, wenn die Leitung diese Zusammenfassung ausdrücklich bestätigt (z.B. "ja", "passt", "schick es raus").

Regeln:
1. Sprich die Leitung direkt mit "Du" an, freundlich, professionell, aber knapp – hier zählt Schnelligkeit.
2. Bündele zusammenhängende Rückfragen (max. zwei pro Nachricht) statt nacheinander einzeln zu fragen. Frage nichts zwischendurch doppelt ab.
3. Rufe nach jeder neuen Information das Tool "update_substitution_draft" auf und gib dabei IMMER den vollständigen, kumulierten Stand aller bisher bekannten Felder an (nicht nur das Delta).
4. Setze "readyToSave" erst auf true, wenn du die Zusammenfassung präsentiert hast.
5. Setze "confirmed" auf true, sobald die Leitung die Zusammenfassung ausdrücklich bestätigt.
6. Antworte IMMER zusätzlich mit einem kurzen Text, auch wenn du das Tool aufrufst.
7. Erfinde niemals Angaben, die nicht genannt wurden oder sich nicht sinnvoll ableiten lassen.
8. Schreibe ausschließlich auf Deutsch.
9. GESPRÄCHSFÜHRUNG: Beende jeden Beitrag immer mit einer konkreten Folgefrage, einem klaren nächsten Schritt oder einer Bestätigung zum Abhaken. Brich niemals mitten in einem Gedanken ab und hinterlasse niemals einen Beitrag ohne erkennbaren Handlungsansatz für den Nutzer. Das Gespräch endet erst nach einer vollständigen Abschlussbestätigung.`

const TOOL = {
  name: 'update_substitution_draft',
  description: 'Speichert den aktuellen, vollständigen Stand der erfassten Vertretungsanfrage. Gib bei jedem Aufruf den vollständigen kumulierten Stand an, niemals nur die neuen Felder.',
  input_schema: {
    type: 'object' as const,
    properties: {
      date: { type: 'string' },
      startTime: { type: 'string' },
      endTime: { type: 'string' },
      qualification: { type: 'string' },
      priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
      note: { type: 'string' },
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
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' }, { status: 500 })
  }

  let body: { messages?: ChatMessage[]; draft?: SubstitutionDraft }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { messages, draft } = body
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages sind erforderlich' }, { status: 400 })
  }

  const stateNote = `## Bisher im Gespräch erfasste Daten
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
    let nextDraft: SubstitutionDraft = draft ?? {}
    for (const block of response.content) {
      if (block.type === 'text') reply += block.text
      if (block.type === 'tool_use' && block.name === 'update_substitution_draft') {
        const input = block.input as Record<string, unknown>
        nextDraft = {
          ...nextDraft,
          ...(typeof input.date === 'string' && { date: input.date }),
          ...(typeof input.startTime === 'string' && { startTime: input.startTime }),
          ...(typeof input.endTime === 'string' && { endTime: input.endTime }),
          ...(typeof input.qualification === 'string' && { qualification: input.qualification }),
          ...(typeof input.priority === 'string' && { priority: input.priority as SubstitutionDraft['priority'] }),
          ...(typeof input.note === 'string' && { note: input.note }),
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
    console.error('substitution-chat', err)
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
