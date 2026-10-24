import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'

const client = new Anthropic()

const SYSTEM_PROMPT = `Du bist ein KI-Assistent für intelligente Urlaubsplanung in Kindertagesstätten und Pflegestandorten.

Du erstellst faire, regelkonforme Urlaubspläne für Teams unter Berücksichtigung folgender Grundsätze:

## Pflichtregeln
1. Der Standort muss jederzeit ausreichend besetzt sein (Mindestbesetzung aus der Standortbeschreibung).
2. Ob und wie stark Mitarbeiter mit schulpflichtigen Kindern in den Schulferienzeiten priorisiert werden, richtet sich nach der von dem Standort gewählten Ferienregelung (siehe "Ferienregelung" im Nutzer-Prompt).
3. Jeder Mitarbeiter bekommt seinen vollen Urlaubsanspruch (vacationDaysTotal minus vacationDaysUsed = verbleibende Tage).
4. Gleichzeitige Abwesenheit wird durch die angegebenen Regeln begrenzt.

## Fairness
5. Die EINGEREICHTEN ANTRÄGE sind die Grundlage. Jeder Antrag nennt einen genauen Zeitraum; plane ihn so, wie er beantragt wurde, wo immer es die Pflichtregeln zulassen.
6. Bereits genehmigte Anträge ("status": "approved") stehen fest und dürfen NICHT verschoben werden. Plane um sie herum.
7. Bei Konflikten – zwei oder mehr Anträge für denselben Zeitraum, von denen nicht alle gehen – entscheide in dieser Reihenfolge:
   a) Anträge, die VOR der Antragsfrist eingereicht wurden, stehen gleichrangig gegen andere fristgerechte Anträge; ein Antrag NACH der Frist ist nachrangig gegenüber jedem fristgerechten.
   b) Unter fristgerechten Anträgen: wer in diesem Planungszeitraum bisher weniger Urlaub bekommen hat beziehungsweise mehr Resturlaub offen hat, geht vor.
   c) Danach die Ferienregelung für Mitarbeiter mit schulpflichtigen Kindern (siehe "Ferienregelung").
   d) Erst zuletzt der Zeitpunkt der Einreichung ("eingereichtAm").
   Benutze NIEMALS eine Selbsteinschätzung der Wichtigkeit als Rangfolge – es gibt keine.
8. Wo ein Antrag nicht so gehen kann wie beantragt, schlage einen möglichst NAHEN Zeitraum vor (gleiche Länge, wenige Tage verschoben) und sage im Feld "note", wie weit verschoben wurde und warum.
9. Zusätzliche, von dem Standort festgelegte Regeln (siehe "Zusatzregeln") sind verbindlich und müssen im Plan eingehalten werden.

## Qualitätsprüfung (vor der Ausgabe)
10. Prüfe nach der Planerstellung selbst, ob alle Pflichtregeln eingehalten wurden und wie viele ANTRÄGE unverändert so eingeplant werden konnten, wie sie beantragt wurden. Gib dieses Ergebnis im Feld "summary" aus: "totalCount" = Zahl der Anträge, "fulfilledCount" = Zahl der unverändert eingeplanten.
11. Wenn zwei oder mehr Mitarbeiter denselben Zeitraum beantragt hatten und nicht alle gehen konnten, erkläre im Feld "conflicts" nachvollziehbar, wer warum vorrangig berücksichtigt wurde (z.B. fristgerecht eingereicht gegenüber nachträglich, mehr offener Resturlaub, Schulferien mit Kindern).

## Sprache & Ton der Texte (reasoning, note, warnings, conflicts)
12. Diese Texte werden der STANDORTLEITUNG (Admin) angezeigt. Schreibe in der dritten Person über Mitarbeiter, niemals in der zweiten Person ("du", "dein").
13. Verwende AUSSCHLIESSLICH natürliches, allgemeinverständliches Deutsch. Interne Feldnamen/Werte wie "hasChildren", "remainingDays", "status", "approved" oder "eingereichtAm" dürfen NIEMALS wörtlich im Text vorkommen – beschreibe den Sachverhalt stattdessen in Worten (z.B. statt "status=approved" schreibe "ist bereits genehmigt", statt "hasChildren=true" schreibe "hat schulpflichtige Kinder").
14. Mische niemals Deutsch und Englisch in einem Satz.

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

/**
 * §231 Die Planung bekommt die ANTRÄGE, nicht Wunschmonate.
 *
 * Vorher standen hier `preferredMonths`, ein Freitextzeitraum und eine selbst
 * gesetzte `priority`. Aus „Juli" und „Juli" folgt keine Überschneidung, nur
 * ein Verdacht — und wer die eigenen Wünsche selbst bewertet, taugt nicht als
 * Rangfolge bei Streit. Ein Antrag trägt Datum und Einreichungszeitpunkt;
 * daran lässt sich beides entscheiden.
 */
interface VacationRequest {
  facilityDescription: string
  customRules?: string[]
  planningStart: string
  planningEnd: string
  maxConcurrent: number
  schoolHolidayPriorityMode?: 'always' | 'slight' | 'none'
  state: string
  /** Bis wann Anträge eingereicht sein sollten; `null`, wo keine Frist gesetzt ist. */
  antragsfrist?: string | null
  employees: {
    id: string
    name: string
    hasChildren: boolean
    remainingDays: number
    antraege: {
      startDate: string
      endDate: string
      days: number
      grund?: string
      status: string
      eingereichtAm: string
    }[]
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

  const { facilityDescription, customRules, planningStart, planningEnd, maxConcurrent, schoolHolidayPriorityMode = 'slight', state, employees, schoolHolidays, antragsfrist } = body

  const SCHOOL_HOLIDAY_MODE_INSTRUCTION: Record<'always' | 'slight' | 'none', string> = {
    always: 'Der Standort priorisiert Mitarbeiter mit schulpflichtigen Kindern in den Schulferien IMMER vor allen anderen Fairness-Kriterien (auch vor dem offenen Resturlaub). Plane für diese Mitarbeiter zuerst die Schulferienzeiten ein.',
    slight: 'Der Standort möchte Mitarbeiter mit schulpflichtigen Kindern in den Schulferien nur LEICHT bevorzugen – das ist lediglich ein Tie-Breaker bei sonst gleichwertigen Fällen, kein hartes Kriterium.',
    none: 'Der Standort möchte KEINE Priorisierung nach Schulferien. Behandle Mitarbeiter mit schulpflichtigen Kindern in den Schulferien genauso wie alle anderen Mitarbeiter.',
  }

  const userPrompt = `Erstelle einen Urlaubsplan für den Zeitraum ${planningStart} bis ${planningEnd}.

## Standortbeschreibung und Regeln
${facilityDescription || 'Keine besonderen Angaben.'}

## Zusatzregeln (verbindlich)
${customRules && customRules.length > 0 ? customRules.map(r => `- ${r}`).join('\n') : 'Keine Zusatzregeln.'}

Maximale gleichzeitige Abwesenheit: ${maxConcurrent} Personen.
Bundesland für Schulferien: ${state}.

## Ferienregelung
${SCHOOL_HOLIDAY_MODE_INSTRUCTION[schoolHolidayPriorityMode]}

## Schulferien ${state} (relevant für Mitarbeiter mit Kindern)
${JSON.stringify(schoolHolidays, null, 2)}

## Antragsfrist
${antragsfrist
    ? `Anträge sollten bis zum ${antragsfrist} eingereicht sein. Alles, was bis dahin `
      + 'einging, ist gleichrangig; ein später eingereichter Antrag ist nachrangig '
      + 'gegenüber jedem fristgerechten.'
    : 'Es ist keine Frist gesetzt. Dann entscheidet bei Konflikten der Zeitpunkt der '
      + 'Einreichung als letztes Kriterium.'}

## Mitarbeiter und ihre eingereichten Anträge
${JSON.stringify(employees, null, 2)}

Hinweis: "remainingDays" = noch zu verplanende Urlaubstage im angegebenen Zeitraum.
Hinweis: Ein Antrag mit "status": "approved" ist bereits genehmigt und steht fest.
Wer gar keinen Antrag eingereicht hat, bekommt in diesem Plan keinen Urlaub — das ist richtig und keine Lücke; erwähne es im Feld "warnings", wenn dadurch Resturlaub offen bleibt.
${schoolHolidayPriorityMode !== 'none' ? 'Mitarbeiter mit schulpflichtigen Kindern haben in Schulferienzeiten Vorrang gemäß obiger Ferienregelung.' : ''}

Antworte ausschließlich mit dem JSON-Objekt. Kein Markdown, kein Text davor oder danach.`

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
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
    console.error('vacation', err)
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
