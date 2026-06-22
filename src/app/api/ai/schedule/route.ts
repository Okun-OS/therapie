import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import type { Employee, Shift, ShiftFairnessData, WishSubmission } from '@/lib/types'

const client = new Anthropic()

// Cached system prompt – stays in Claude's prompt cache for 5 min
const SYSTEM_PROMPT = `Du bist ein KI-Assistent für intelligente Dienstplanerstellung in Kindertagesstätten.

Du erstellst optimale Wochenpläne für Mitarbeiter unter Berücksichtigung folgender Regeln:

## Pflichtregel (müssen IMMER eingehalten werden)
1. Jeder Mitarbeiter bekommt genau EINEN Dienst pro Tag (oder keinen – Ruhetag).
2. Mindestbesetzung je Schicht und Tag muss erfüllt sein (minStaff-Wert pro Schicht).
3. Kein Mitarbeiter arbeitet mehr als 5 aufeinanderfolgende Tage.
4. Wochenarbeitszeit wird geachtet: 20h/Woche → ~2–3 Dienste, 30h → ~4 Dienste, 40h → ~5 Dienste.

## Fairness-Regeln
5. Früh/Spät/Mittel sollen langfristig fair verteilt sein (je ~40%/40%/20%).
6. Freitag-Spätdienst max. 2× pro Monat pro Mitarbeiter.
7. Montag-Frühdienst max. 3× pro Monat pro Mitarbeiter.
8. Mitarbeiter mit hohem "debt" (negative earlyDebt/lateDebt) bekommen Vorrang bei dieser Schichtart.

## Wünsche (WishSubmissions)
9. Wünsche mit Importance "urgent" haben höchste Priorität, dann "important", dann "normal".
10. Bei Konflikt (gleicher Tag, gleiche Schicht, mehrere Wünsche): Wichtigkeit > historische Fairness > Einreichzeitpunkt (früher = besser).
11. Begründe bei Konflikten, wer den Vorzug erhält und warum.

## Sprache & Ton der Texte (reasoning, decisions[].message, warnings)
12. Diese Texte werden der EINRICHTUNGSLEITUNG (Admin) angezeigt, NICHT den Mitarbeitern. Schreibe daher konsequent in der dritten Person über Mitarbeiter (z.B. "Maria Schmidt bekommt den Frühdienst, da..."), niemals in der zweiten Person ("du", "dein", "dich").
13. Verwende AUSSCHLIESSLICH natürliches, allgemeinverständliches Deutsch. Interne Feldnamen/Variablen wie "earlyDebt", "lateDebt", "midDebt", "fridayLateCnt", "mondayEarlyCnt", "fairnessScore", "debt" oder Mitarbeiter-IDs wie "emp1"/"emp2" dürfen NIEMALS im Text vorkommen – verwende stattdessen den echten Namen des Mitarbeiters und beschreibe den Sachverhalt in Worten (z.B. statt "earlyDebt: 2.5" schreibe "hatte zuletzt unterdurchschnittlich viele Frühdienste").
14. Mische niemals Deutsch und Englisch in einem Satz.

## Output-Format (JSON, kein Markdown drumherum)
Antworte NUR mit einem gültigen JSON-Objekt in diesem Format:
{
  "schedule": {
    "YYYY-MM-DD": {
      "employeeId": "shiftId"
    }
  },
  "reasoning": "Kurze Zusammenfassung der Planungslogik auf Deutsch (2–4 Sätze)",
  "decisions": [
    { "type": "assignment" | "conflict" | "warning", "message": "Erklärung auf Deutsch" }
  ],
  "warnings": ["Warnung 1", "Warnung 2"]
}`

interface ScheduleRequest {
  employees: Employee[]
  shifts: Shift[]
  fairnessData: ShiftFairnessData[]
  wishSubmissions: WishSubmission[]
  weekDates: string[]
  locationName: string
  facilityDescription?: string
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' }, { status: 500 })
  }

  let body: ScheduleRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { employees, shifts, fairnessData, wishSubmissions, weekDates, locationName, facilityDescription } = body

  const activeEmployees = employees.filter(e => e.role === 'employee' && e.active)

  const employeeSummary = activeEmployees.map(emp => {
    const fd = fairnessData.find(f => f.employeeId === emp.id)
    return {
      id: emp.id,
      name: emp.name,
      wochenstunden: emp.weeklyHours,
      frueh_unterversorgung: fd ? Math.round(fd.earlyDebt * 10) / 10 : 0,
      spaet_unterversorgung: fd ? Math.round(fd.lateDebt * 10) / 10 : 0,
      mittel_unterversorgung: fd ? Math.round(fd.midDebt * 10) / 10 : 0,
      freitag_spaetdienste_letzte_4_wochen: fd?.fridayLateCnt ?? 0,
      montag_fruehdienste_letzte_4_wochen: fd?.mondayEarlyCnt ?? 0,
      fairness_punktzahl: fd?.fairnessScore ?? 100,
    }
  })

  const shiftSummary = shifts.map(s => ({
    id: s.id,
    name: s.name,
    type: s.type,
    time: `${s.startTime}–${s.endTime}`,
    minStaff: s.minStaff,
  }))

  const wishSummary = wishSubmissions.map(w => ({
    employeeId: w.employeeId,
    employeeName: w.employeeName,
    date: w.date,
    preferredShiftType: w.preferredShiftType,
    importance: w.importance,
    reason: w.reason,
    submittedAt: w.submittedAt,
  }))

  const userPrompt = `Erstelle einen Dienstplan für die Woche ${weekDates[0]} bis ${weekDates[weekDates.length - 1]} für den Standort "${locationName}".

## Mitarbeiter (mit Fairness-Daten aus den letzten 4 Wochen)
${JSON.stringify(employeeSummary, null, 2)}

Hinweis: "id" wird NUR als Schlüssel im "schedule"-Objekt der Antwort verwendet, niemals in reasoning/decisions/warnings. Höherer "_unterversorgung"-Wert = Mitarbeiter sollte diese Schicht öfter bekommen, negativer Wert = hat diese Schicht schon überdurchschnittlich oft gehabt – beschreibe das in reasoning/decisions/warnings immer in eigenen Worten, nie mit dem Feldnamen.

## Verfügbare Schichten
${JSON.stringify(shiftSummary, null, 2)}

## Planungstage
${JSON.stringify(weekDates)}

## Dienstwünsche der Mitarbeiter
${wishSummary.length > 0 ? JSON.stringify(wishSummary, null, 2) : 'Keine Wünsche eingereicht.'}
${facilityDescription ? `
## Besondere Einrichtungsbeschreibung vom Teamleiter
${facilityDescription}

Beachte diese Einrichtungsbeschreibung besonders beim Erstellen des Plans. Leite daraus zusätzliche Planungsregeln ab und wende sie an.` : ''}
Antworte ausschließlich mit dem JSON-Objekt. Kein Markdown, kein Text davor oder danach.`

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''

    // Strip any accidental markdown code fences
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
