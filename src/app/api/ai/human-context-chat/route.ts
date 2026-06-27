import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { upsertHumanContext } from '@/lib/human-context-service'
import { requireRole } from '@/lib/session'

const client = new Anthropic()

// Cached system prompt – stays in Claude's prompt cache for 5 min
const SYSTEM_PROMPT = `Du bist der persönliche KI-Assistent von Open Workforce für freiwillige, persönliche Angaben von Mitarbeitenden.

Dein Ziel ist es, in einem lockeren, natürlichen Gespräch herauszufinden:
1. Persönliche Stärken (z.B. Elternkommunikation, Dokumentation, U3-Erfahrung, Vorschularbeit, Krisensituationen, Organisation, Einarbeitung neuer Kollegen, Verwaltung, Leitungsaufgaben).
2. Persönliche Lebenssituation, falls die Person das teilen möchte (z.B. Alleinerziehend, Kinder, Pflege von Angehörigen, Studium, lange Anfahrt, gesundheitliche Einschränkungen, regelmäßige Arzttermine, besondere familiäre Situationen).
3. Bevorzugte Gruppen oder Bereiche, in denen die Person gerne eingesetzt wird.
4. Bevorzugte Tätigkeiten, die die Person besonders gerne übernimmt (z.B. Dokumentation, Elternarbeit, Vorbereitung von Aktivitäten, Verwaltungsaufgaben).
5. Schicht-Vorlieben, also weiche, freiwillige Wünsche zur Schichtlage (z.B. "Arbeitet lieber im Frühdienst", "Arbeitet lieber im Spätdienst", "Möchte möglichst wenig Wochenenddienste"). Das ist etwas anderes als die festen Pflichtangaben zur Arbeitszeit, die schon beim Anlegen erfasst wurden – hier geht es um zusätzliche, weiche Präferenzen.
6. Besondere Absprachen mit der Leitung (z.B. feste freie Tage, kein Spätdienst an bestimmten Wochentagen, fester Einsatzort).

Regeln:
1. Sprich die Person direkt mit "Du" an, in einem freundlichen, lockeren, aber professionellen Ton.
2. Stelle pro Nachricht nur EINE Frage. Keine langen Frageblöcke oder Formulare.
3. Erkläre kurz und konkret, warum du etwas fragst, bevor du fragst (z.B. "Damit die Dienstplanung darauf Rücksicht nehmen kann, frage ich...").
4. Alles ist absolut freiwillig. Wenn die Person ausweicht, ablehnt oder das Thema wechseln möchte, akzeptiere das sofort ohne nachzuhaken, und gehe zum nächsten Thema über oder beende das Gespräch freundlich.
5. Wenn neue Informationen genannt werden, rufe das Tool "update_human_context" auf. Gib dabei IMMER die vollständige, aktuelle Liste je Feld an (bereits bekannte + neue Einträge zusammen), niemals nur die neuen Einträge.
6. Antworte IMMER zusätzlich mit einem kurzen Text an die Person, auch wenn du das Tool aufrufst.
7. Wenn alle Themen behandelt wurden oder die Person das Gespräch beenden möchte, bedanke dich kurz und weise darauf hin, dass alle Angaben jederzeit im Profil geändert oder gelöscht werden können.
8. Erfinde niemals Angaben, die die Person nicht gemacht hat.
9. Schreibe ausschließlich auf Deutsch.`

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' }, { status: 500 })
  }

  let body: { employeeId?: string; messages?: ChatMessage[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { employeeId, messages } = body
  if (!employeeId || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'employeeId und messages sind erforderlich' }, { status: 400 })
  }

  const existing = await prisma.employeeHumanContext.findUnique({ where: { employeeId } })

  const stateNote = `## Bereits bekannte Angaben dieses Mitarbeiters (aus dem Profil oder früheren Gesprächen)
${JSON.stringify({
    strengths: existing?.strengths ?? [],
    lifeCircumstances: existing?.lifeCircumstances ?? [],
    preferredGroups: existing?.preferredGroups ?? [],
    preferredActivities: existing?.preferredActivities ?? [],
    shiftPreferences: existing?.shiftPreferences ?? [],
    agreements: existing?.agreements ?? null,
  }, null, 2)}

Frage nicht erneut nach Dingen, die hier schon stehen. Baue darauf auf.`

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: stateNote },
      ],
      tools: [
        {
          name: 'update_human_context',
          description: 'Speichert die im Gespräch genannten freiwilligen persönlichen Informationen. Gib bei jedem Aufruf die vollständige, kumulierte Liste je Feld an (bisherige + neue Einträge), niemals nur die neuen.',
          input_schema: {
            type: 'object',
            properties: {
              strengths: { type: 'array', items: { type: 'string' } },
              lifeCircumstances: { type: 'array', items: { type: 'string' } },
              preferredGroups: { type: 'array', items: { type: 'string' } },
              preferredActivities: { type: 'array', items: { type: 'string' } },
              shiftPreferences: { type: 'array', items: { type: 'string' } },
              agreements: { type: 'string' },
            },
          },
        },
      ],
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    let reply = ''
    let savedContext: Awaited<ReturnType<typeof upsertHumanContext>> | null = existing
    for (const block of response.content) {
      if (block.type === 'text') reply += block.text
      if (block.type === 'tool_use' && block.name === 'update_human_context') {
        const input = block.input as Record<string, unknown>
        savedContext = await upsertHumanContext(employeeId, {
          strengths: Array.isArray(input.strengths) ? input.strengths as string[] : undefined,
          lifeCircumstances: Array.isArray(input.lifeCircumstances) ? input.lifeCircumstances as string[] : undefined,
          preferredGroups: Array.isArray(input.preferredGroups) ? input.preferredGroups as string[] : undefined,
          preferredActivities: Array.isArray(input.preferredActivities) ? input.preferredActivities as string[] : undefined,
          shiftPreferences: Array.isArray(input.shiftPreferences) ? input.shiftPreferences as string[] : undefined,
          agreements: typeof input.agreements === 'string' ? input.agreements : undefined,
        })
      }
    }

    if (!reply.trim()) {
      reply = 'Danke, das habe ich gespeichert!'
    }

    return NextResponse.json({ reply, context: savedContext })
  } catch (err: unknown) {
    console.error('human-context-chat', err)
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
