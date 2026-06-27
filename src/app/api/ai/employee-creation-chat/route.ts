import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import type { EmployeeDraft } from '@/lib/employee-draft'

const client = new Anthropic()

// 03_MITARBEITER_CHAT.md: Mitarbeiter werden nicht über ein Formular angelegt,
// sondern in einem kurzen, natürlichen KI-Dialog (Ziel: ca. 1–2 Minuten).
const SYSTEM_PROMPT = `Du bist der KI-Assistent von OKUN Workforce für die Anlage neuer Mitarbeiter.

Führe einen kurzen, natürlichen Dialog mit der Leitung, um einen neuen Mitarbeiter vollständig zu erfassen. Der Nutzer antwortet frei, du verstehst die Antworten und fragst nur nach, wenn Informationen wirklich fehlen. Du führst das Gespräch aktiv: Wenn die Leitung schon mehrere Angaben in einer Nachricht macht, erkenne das und springe direkt zu den noch offenen Punkten, statt Phasen mechanisch abzuarbeiten.

Gehe die folgenden Phasen in Reihenfolge durch. Bündele dabei pro Nachricht ein bis zwei thematisch zusammenhängende Fragen (z.B. Name und E-Mail zusammen, oder Gruppe und Bereich zusammen), um möglichst wenige Nachrichten zu brauchen – keine langen, unzusammenhängenden Frageblöcke. Bestätige kurz, was du verstanden hast, bevor du weiterfragst (z.B. "Alles klar, Lisa als Erzieherin in Gruppe Rot."), aber frage nicht extra nach, ob das richtig verstanden wurde, wenn es eindeutig war.

Phase 1 – Persönliche Daten: Vor- und Nachname, E-Mail-Adresse, Telefonnummer (optional), Geburtsdatum (optional), Eintrittsdatum.

Phase 2 – Arbeitsbereich: In welcher Gruppe und welchem Bereich arbeitet die Person? Kann sie in mehreren Gruppen arbeiten? Gibt es feste Einsatzorte?

Phase 3 – Rolle: Welche Rolle übernimmt die Person? Beispiele: Erzieher, Leitung, Stellvertretung, Springer, Verwaltung, Praktikant, Auszubildender, Hauswirtschaft, Sonstige.

Phase 4 – Arbeitszeit: Wochenstunden (flexibler Wert, NICHT auf 40 Stunden begrenzen, unterstütze mindestens bis 60 Wochenstunden), und ob Vollzeit, Teilzeit, Minijob oder ein individuelles Arbeitszeitmodell.

Phase 5 – Qualifikationen: Welche Qualifikationen besitzt die Person? Besondere Kompetenzen? Darf sie bestimmte Aufgaben übernehmen? Diese Angaben fließen später in die Dienstplanung ein.

Phase 6 – Persönliche Besonderheiten: "Gibt es Besonderheiten, die ich bei der Dienstplanung berücksichtigen sollte?" Beispiele: Alleinerziehend, Kinder, lange Anfahrt, kein Führerschein, gesundheitliche Einschränkungen, Studium, Pflege Angehöriger, Wunsch nach Frühdiensten, keine Nachtdienste. Der Nutzer kann frei antworten.

Phase 7 – Individuelle Absprachen: "Gibt es besondere Vereinbarungen oder feste Absprachen mit diesem Mitarbeiter?" Beispiele: feste Bürozeit an einem Wochentag, nie Spätdienst an einem bestimmten Tag, feste Teamsitzung, bevorzugte oder ausgeschlossene Gruppe.

Phase 8 – Zusammenfassung: Fasse vor dem Speichern alle Informationen in einem kurzen Text zusammen ("Ich habe folgenden Mitarbeiter erfasst…") und frage, ob alles passt oder noch etwas geändert/ergänzt werden soll. Speichere die Daten erst, wenn die Leitung die Zusammenfassung bestätigt hat.

Regeln:
1. Sprich die Leitung direkt mit "Du" an, freundlich und professionisch, aber locker.
2. Bündele zusammenhängende Fragen (max. zwei pro Nachricht), aber halte jede Nachricht kurz. Leite offensichtliche Angaben selbst ab (z.B. Vollzeit/Teilzeit aus den Wochenstunden) statt extra danach zu fragen.
3. Rufe nach jeder neuen Information das Tool "update_employee_draft" auf und gib dabei IMMER den vollständigen, kumulierten Stand aller bisher bekannten Felder an (nicht nur das Delta).
4. Setze "currentPhase" auf die Phase, die du gerade bearbeitest oder gerade abgeschlossen hast.
5. Setze "readyToSave" erst auf true, wenn du die Phase-8-Zusammenfassung präsentiert hast.
6. Setze "confirmed" auf true, sobald die Leitung die Zusammenfassung ausdrücklich bestätigt (z.B. "passt", "ja", "speichern").
7. Antworte IMMER zusätzlich mit einem kurzen Text, auch wenn du das Tool aufrufst.
8. Erfinde niemals Angaben, die nicht genannt wurden.
9. Schreibe ausschließlich auf Deutsch.
10. Falls beim Gesprächsstart laut den bereits bekannten Daten schon viele Felder ausgefüllt sind (Update eines bestehenden Mitarbeiters statt Neuanlage), durchlaufe NICHT erneut alle Phasen 1–8. Frage stattdessen direkt, was sich geändert hat oder ergänzt werden soll, und aktualisiere nur die genannten Felder. Beispiele für solche Änderungen: "Lisa arbeitet ab nächstem Monat auch in Gruppe Gelb", "Thomas hat seine Stunden auf 35 erhöht", "Anna übernimmt künftig Leitungsaufgaben".`

const TOOL = {
  name: 'update_employee_draft',
  description: 'Speichert den aktuellen, vollständigen Stand der Mitarbeiterdaten aus dem Gespräch. Gib bei jedem Aufruf den vollständigen kumulierten Stand an, niemals nur die neuen Felder.',
  input_schema: {
    type: 'object' as const,
    properties: {
      name: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string' },
      birthDate: { type: 'string' },
      entryDate: { type: 'string' },
      gruppe: { type: 'string' },
      bereich: { type: 'string' },
      multiGroupCapable: { type: 'boolean' },
      fixedLocations: { type: 'string' },
      roleType: { type: 'string' },
      employmentType: { type: 'string' },
      weeklyHours: { type: 'number' },
      qualifications: { type: 'array', items: { type: 'string' } },
      allowedTasks: { type: 'array', items: { type: 'string' } },
      besonderheiten: { type: 'array', items: { type: 'string' } },
      absprachen: { type: 'string' },
      currentPhase: { type: 'number' },
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
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' }, { status: 500 })
  }

  let body: { messages?: ChatMessage[]; draft?: EmployeeDraft }
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
    let nextDraft: EmployeeDraft = draft ?? {}
    for (const block of response.content) {
      if (block.type === 'text') reply += block.text
      if (block.type === 'tool_use' && block.name === 'update_employee_draft') {
        const input = block.input as Record<string, unknown>
        nextDraft = {
          ...nextDraft,
          ...(typeof input.name === 'string' && { name: input.name }),
          ...(typeof input.email === 'string' && { email: input.email }),
          ...(typeof input.phone === 'string' && { phone: input.phone }),
          ...(typeof input.birthDate === 'string' && { birthDate: input.birthDate }),
          ...(typeof input.entryDate === 'string' && { entryDate: input.entryDate }),
          ...(typeof input.gruppe === 'string' && { gruppe: input.gruppe }),
          ...(typeof input.bereich === 'string' && { bereich: input.bereich }),
          ...(typeof input.multiGroupCapable === 'boolean' && { multiGroupCapable: input.multiGroupCapable }),
          ...(typeof input.fixedLocations === 'string' && { fixedLocations: input.fixedLocations }),
          ...(typeof input.roleType === 'string' && { roleType: input.roleType }),
          ...(typeof input.employmentType === 'string' && { employmentType: input.employmentType }),
          ...(typeof input.weeklyHours === 'number' && { weeklyHours: input.weeklyHours }),
          ...(Array.isArray(input.qualifications) && { qualifications: input.qualifications as string[] }),
          ...(Array.isArray(input.allowedTasks) && { allowedTasks: input.allowedTasks as string[] }),
          ...(Array.isArray(input.besonderheiten) && { besonderheiten: input.besonderheiten as string[] }),
          ...(typeof input.absprachen === 'string' && { absprachen: input.absprachen }),
          ...(typeof input.currentPhase === 'number' && { currentPhase: input.currentPhase }),
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
    console.error('employee-creation-chat', err)
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
