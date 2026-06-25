import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getControllingSnapshot } from '@/lib/controlling-service'

const client = new Anthropic()

// Cached system prompt – stays in Claude's prompt cache for 5 min
const SYSTEM_PROMPT = `Du bist der KI-Controlling-Assistent von Open Workforce, einer Dienstplan-Software für soziale Einrichtungen.

Du beantwortest Fragen der Führungskraft ausschließlich anhand der bereitgestellten Live-Daten (JSON), die als Nachricht mitgeschickt werden.

Regeln:
1. Antworte präzise, auf Deutsch, in maximal 4 Sätzen.
2. Erfinde keine Zahlen, Mitarbeiter oder Standorte, die nicht in den Daten vorkommen.
3. Wenn die Daten eine Frage nicht beantworten können, sage das ehrlich und schlage vor, wo die Führungskraft stattdessen nachsehen könnte (z. B. Dienstplan, Zeiterfassung, Urlaubsanträge).
4. Schreibe in der dritten Person über Mitarbeiter, niemals in der zweiten Person.`

interface AskRequest {
  question: string
  locationId?: string
  scope?: string
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' }, { status: 500 })
  }

  let body: AskRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { question, locationId, scope } = body
  if (!question || typeof question !== 'string') {
    return NextResponse.json({ error: 'Frage fehlt' }, { status: 400 })
  }

  const effectiveLocationId = scope === 'organization' ? undefined : locationId
  const snapshot = await getControllingSnapshot(effectiveLocationId)

  const userPrompt = `## Live-Daten der Personalsituation (JSON)
${JSON.stringify(snapshot, null, 2)}

## Frage der Führungskraft
${question}

Antworte ausschließlich auf Basis der obigen Daten.`

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    })

    const answer = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ answer })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
