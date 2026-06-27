import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'

const client = new Anthropic()

const SYSTEM_PROMPT = `Du bist ein KI-Assistent, der der Standortleitung eine Empfehlung zu einem einzelnen, während des Jahres eingereichten Urlaubsantrag gibt.

Bewerte den Antrag anhand von:
- Verbleibendem Urlaubsanspruch des Mitarbeiters
- Anderen bereits genehmigten Abwesenheiten im selben Zeitraum am selben Standort (Mindestbesetzung/maximale gleichzeitige Abwesenheit)
- Den Standortregeln und Zusatzregeln

## Sprache & Ton
Schreibe in der dritten Person über den Mitarbeiter, niemals in der zweiten Person ("du", "dein"). Verwende ausschließlich natürliches, allgemeinverständliches Deutsch. Interne Feldnamen dürfen niemals wörtlich im Text vorkommen.

## Output-Format (JSON, kein Markdown)
{
  "stance": "empfehlung_genehmigen" | "empfehlung_pruefen" | "empfehlung_ablehnen",
  "reasoning": "kurze Begründung (1-3 Sätze)"
}`

interface RecommendationRequest {
  facilityDescription?: string
  customRules?: string[]
  maxConcurrent?: number
  request: {
    employeeName: string
    startDate: string
    endDate: string
    days: number
    reason?: string
    remainingDays: number
  }
  overlapping: {
    employeeName: string
    startDate: string
    endDate: string
  }[]
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' }, { status: 500 })
  }

  let body: RecommendationRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { facilityDescription, customRules, maxConcurrent, request, overlapping } = body
  if (!request) {
    return NextResponse.json({ error: 'request ist erforderlich' }, { status: 400 })
  }

  const userPrompt = `## Standortregeln
${facilityDescription || 'Keine besonderen Angaben.'}
Maximale gleichzeitige Abwesenheit: ${maxConcurrent ?? 'nicht angegeben'} Personen.

## Zusatzregeln
${customRules && customRules.length > 0 ? customRules.map(r => `- ${r}`).join('\n') : 'Keine Zusatzregeln.'}

## Zu bewertender Antrag
${JSON.stringify(request, null, 2)}

## Bereits genehmigte, überlappende Abwesenheiten im selben Zeitraum
${overlapping.length > 0 ? JSON.stringify(overlapping, null, 2) : 'Keine.'}

Antworte ausschließlich mit dem JSON-Objekt. Kein Markdown, kein Text davor oder danach.`

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 512,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userPrompt }],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = rawText.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'KI hat kein gültiges JSON zurückgegeben', raw: rawText }, { status: 502 })
    }

    return NextResponse.json(parsed)
  } catch (err: unknown) {
    console.error('vacation-recommendation', err)
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
