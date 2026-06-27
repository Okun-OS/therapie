import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'

const client = new Anthropic()

const SYSTEM_PROMPT = `Du bist ein KI-Assistent für intelligente Urlaubsplanung in Kindertagesstätten und Pflegeeinrichtungen.

Du erstellst faire, regelkonforme Urlaubspläne für Teams unter Berücksichtigung folgender Grundsätze:

## Pflichtregeln
1. Die Einrichtung muss jederzeit ausreichend besetzt sein (Mindestbesetzung aus der Einrichtungsbeschreibung).
2. Ob und wie stark Mitarbeiter mit schulpflichtigen Kindern in den Schulferienzeiten priorisiert werden, richtet sich nach der von der Einrichtung gewählten Ferienregelung (siehe "Ferienregelung" im Nutzer-Prompt).
3. Jeder Mitarbeiter bekommt seinen vollen Urlaubsanspruch (vacationDaysTotal minus vacationDaysUsed = verbleibende Tage).
4. Gleichzeitige Abwesenheit wird durch die angegebenen Regeln begrenzt.

## Fairness
5. Präferenzen (bevorzugte Monate) werden so weit wie möglich erfüllt.
6. Bei Konflikten: hohe Priorität vor mittlerer vor niedriger Priorität, danach Mitarbeiter mit schulpflichtigen Kindern in Schulferienzeiten – wobei deren individuelle "Priorität Schulferien" (hoch/mittel/niedrig) die Rangfolge unter ihnen bestimmt.
7. Mitarbeiter mit niedrigem Resturlaub werden bevorzugt eingeplant.
8. Zusätzliche, von der Einrichtung festgelegte Regeln (siehe "Zusatzregeln") sind verbindlich und müssen im Plan eingehalten werden.

## Qualitätsprüfung (vor der Ausgabe)
9. Prüfe nach der Planerstellung selbst, ob alle Pflichtregeln eingehalten wurden und wie viele Mitarbeiterwünsche (bevorzugte Monate/Zeiträume) vollständig erfüllt werden konnten. Gib dieses Ergebnis im Feld "summary" aus.
10. Wenn zwei oder mehr Mitarbeiter denselben Zeitraum wollten und nicht alle berücksichtigt werden konnten, erkläre im Feld "conflicts" transparent und nachvollziehbar, wer warum vorrangig berücksichtigt wurde (z.B. höhere Priorität, weniger Resturlaub, höhere Schulferien-Priorität).

## Sprache & Ton der Texte (reasoning, note, warnings, conflicts)
11. Diese Texte werden der EINRICHTUNGSLEITUNG (Admin) angezeigt. Schreibe in der dritten Person über Mitarbeiter, niemals in der zweiten Person ("du", "dein").
12. Verwende AUSSCHLIESSLICH natürliches, allgemeinverständliches Deutsch. Interne Feldnamen/Werte wie "hasChildren", "priority", "priority-high", "remainingDays", "schoolHolidayPriority" dürfen NIEMALS wörtlich im Text vorkommen – beschreibe den Sachverhalt stattdessen in Worten (z.B. statt "priority=high" schreibe "hat hohe Priorität", statt "hasChildren=true" schreibe "hat schulpflichtige Kinder").
13. Mische niemals Deutsch und Englisch in einem Satz.

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
  "warnings": ["Warnung 1", "Warnung 2"],
  "summary": { "fulfillmentPercent": number, "fulfilledCount": number, "totalCount": number },
  "conflicts": [
    { "employeeNames": ["Name 1", "Name 2"], "reasoning": "warum wer vorrangig berücksichtigt wurde" }
  ]
}`

interface VacationRequest {
  facilityDescription: string
  customRules?: string[]
  planningStart: string
  planningEnd: string
  maxConcurrent: number
  schoolHolidayPriorityMode?: 'always' | 'slight' | 'none'
  state: string
  employees: {
    id: string
    name: string
    hasChildren: boolean
    schoolHolidayPriority?: string
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
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' }, { status: 500 })
  }

  let body: VacationRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { facilityDescription, customRules, planningStart, planningEnd, maxConcurrent, schoolHolidayPriorityMode = 'slight', state, employees, schoolHolidays } = body

  const SCHOOL_HOLIDAY_MODE_INSTRUCTION: Record<'always' | 'slight' | 'none', string> = {
    always: 'Die Einrichtung priorisiert Mitarbeiter mit schulpflichtigen Kindern in den Schulferien IMMER vor allen anderen Fairness-Kriterien (auch vor "priority" und Resturlaub). Plane für diese Mitarbeiter zuerst die Schulferienzeiten ein.',
    slight: 'Die Einrichtung möchte Mitarbeiter mit schulpflichtigen Kindern in den Schulferien nur LEICHT bevorzugen – das ist lediglich ein Tie-Breaker bei sonst gleichwertigen Fällen, kein hartes Kriterium.',
    none: 'Die Einrichtung möchte KEINE Priorisierung nach Schulferien. Behandle Mitarbeiter mit schulpflichtigen Kindern in den Schulferien genauso wie alle anderen Mitarbeiter.',
  }

  const userPrompt = `Erstelle einen Urlaubsplan für den Zeitraum ${planningStart} bis ${planningEnd}.

## Einrichtungsbeschreibung und Regeln
${facilityDescription || 'Keine besonderen Angaben.'}

## Zusatzregeln (verbindlich)
${customRules && customRules.length > 0 ? customRules.map(r => `- ${r}`).join('\n') : 'Keine Zusatzregeln.'}

Maximale gleichzeitige Abwesenheit: ${maxConcurrent} Personen.
Bundesland für Schulferien: ${state}.

## Ferienregelung
${SCHOOL_HOLIDAY_MODE_INSTRUCTION[schoolHolidayPriorityMode]}

## Schulferien ${state} (relevant für Mitarbeiter mit Kindern)
${JSON.stringify(schoolHolidays, null, 2)}

## Mitarbeiter und Wünsche
${JSON.stringify(employees, null, 2)}

Hinweis: "remainingDays" = noch zu verplanende Urlaubstage im angegebenen Zeitraum. Plane möglichst viele davon ein.
${schoolHolidayPriorityMode !== 'none' ? 'Mitarbeiter mit hasChildren=true haben in Schulferienzeiten Vorrang (gemäß obiger Ferienregelung), abgestuft nach ihrer "schoolHolidayPriority" (hoch vor mittel vor niedrig).' : ''}

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
