import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

const SYSTEM_PROMPT = `Du bist ein KI-Assistent für intelligente Urlaubsplanung in Kindertagesstätten und Pflegeeinrichtungen.

Du erstellst faire, regelkonforme Urlaubspläne für Teams unter Berücksichtigung folgender Grundsätze:

## Pflichtregeln
1. Die Einrichtung muss jederzeit ausreichend besetzt sein (Mindestbesetzung aus der Einrichtungsbeschreibung).
2. Mitarbeiter mit schulpflichtigen Kindern erhalten Priorität in den Schulferienzeiten.
3. Jeder Mitarbeiter bekommt seinen vollen Urlaubsanspruch (vacationDaysTotal minus vacationDaysUsed = verbleibende Tage).
4. Gleichzeitige Abwesenheit wird durch die angegebenen Regeln begrenzt.

## Fairness
5. Präferenzen (bevorzugte Monate) werden so weit wie möglich erfüllt.
6. Bei Konflikten: hohe Priorität vor mittlerer vor niedriger Priorität, danach Mitarbeiter mit schulpflichtigen Kindern in Schulferienzeiten.
7. Mitarbeiter mit niedrigem Resturlaub werden bevorzugt eingeplant.

## Sprache & Ton der Texte (reasoning, note, warnings)
8. Diese Texte werden der EINRICHTUNGSLEITUNG (Admin) angezeigt. Schreibe in der dritten Person über Mitarbeiter, niemals in der zweiten Person ("du", "dein").
9. Verwende AUSSCHLIESSLICH natürliches, allgemeinverständliches Deutsch. Interne Feldnamen/Werte wie "hasChildren", "priority", "priority-high", "remainingDays" dürfen NIEMALS wörtlich im Text vorkommen – beschreibe den Sachverhalt stattdessen in Worten (z.B. statt "priority=high" schreibe "hat hohe Priorität", statt "hasChildren=true" schreibe "hat schulpflichtige Kinder").
10. Mische niemals Deutsch und Englisch in einem Satz.

## Output-Format (JSON, kein Markdown)
{
  "plan": [
    {
      "employeeId": "string",
      "employeeName": "string",
      "slots": [{ "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "days": number }],
      "note": "kurze Begründung auf Deutsch"
    }
  ],
  "reasoning": "Zusammenfassung der Planungslogik (3–5 Sätze)",
  "warnings": ["Warnung 1", "Warnung 2"]
}`

interface VacationRequest {
  facilityDescription: string
  planningStart: string
  planningEnd: string
  maxConcurrent: number
  state: string
  employees: {
    id: string
    name: string
    hasChildren: boolean
    remainingDays: number
    preferredMonths: number[]
    preferredPeriod?: string
    notes?: string
    priority: string
  }[]
  schoolHolidays: {
    name: string
    startDate: string
    endDate: string
  }[]
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' }, { status: 500 })
  }

  let body: VacationRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { facilityDescription, planningStart, planningEnd, maxConcurrent, state, employees, schoolHolidays } = body

  const userPrompt = `Erstelle einen Urlaubsplan für den Zeitraum ${planningStart} bis ${planningEnd}.

## Einrichtungsbeschreibung und Regeln
${facilityDescription || 'Keine besonderen Angaben.'}

Maximale gleichzeitige Abwesenheit: ${maxConcurrent} Personen.
Bundesland für Schulferien: ${state}.

## Schulferien ${state} (relevant für Mitarbeiter mit Kindern)
${JSON.stringify(schoolHolidays, null, 2)}

## Mitarbeiter und Wünsche
${JSON.stringify(employees, null, 2)}

Hinweis: "remainingDays" = noch zu verplanende Urlaubstage im angegebenen Zeitraum. Plane möglichst viele davon ein.
Mitarbeiter mit hasChildren=true und priority="high" haben in Schulferienzeiten Vorrang.

Antworte ausschließlich mit dem JSON-Objekt. Kein Markdown, kein Text davor oder danach.`

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
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
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
