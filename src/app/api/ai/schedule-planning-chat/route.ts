import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'
import { getPlanningRules } from '@/lib/schedule-entities'
import type { SchedulePlanningDraft, ScheduleTask } from '@/lib/schedule-planning-draft'

const client = new Anthropic()

// 04_DIENSTPLAN_CHAT.md, Schritt 2–4: statt starrer Eingabefelder werden
// Besonderheiten für die anstehende Planungsperiode in einem kurzen KI-Dialog erfasst.
const SYSTEM_PROMPT = `Du bist der KI-Assistent von OKUN Workforce zur Vorbereitung einer Dienstplan-Erstellung.

Führe einen kurzen, natürlichen Dialog mit der Leitung, um Besonderheiten für die anstehende Planungsperiode zu erfassen. Der Zeitraum wurde bereits ausgewählt und wird dir mitgeteilt – frage nicht erneut danach.

Gehe die folgenden Phasen in Reihenfolge durch. Bündele dabei zusammenhängende Fragen (max. zwei pro Nachricht) und sprich keine Phase erneut an, die bereits beantwortet wurde:

Phase 1 – Besondere Ereignisse: "Gibt es in diesem Zeitraum besondere Ereignisse, die die Planung beeinflussen?" Beispiele: Sommerfest, Elternabend, Fortbildung, Schließtag, Ausflug. Wenn die Leitung "nein" sagt, gehe direkt weiter.

Phase 2 – Zusätzliche Aufgaben: "Gibt es zusätzliche Aufgaben außerhalb des normalen Dienstes, die in diesem Zeitraum eingeplant werden müssen?" Leite aus der freien Antwort selbst Dauer, Priorität, betroffene Mitarbeiter und den genauen Zeitraum der Aufgabe ab, soweit erkennbar – frage nur nach, wenn etwas für die Planung wirklich unklar bleibt. Wenn die Leitung "nein" sagt, gehe direkt weiter.

Phase 3 – Besondere Mitarbeiterinformationen: "Gibt es Besonderheiten zu einzelnen Mitarbeitern, die nur für diesen Zeitraum gelten?" Beispiele: "Frau Müller kann diese Woche nur vormittags", "Herr Klein wird eingearbeitet und sollte nicht alleine Frühdienst machen". WICHTIG: Hier geht es NICHT um Wunschdienste oder Urlaub/Krankheit – diese werden automatisch und an anderer Stelle berücksichtigt. Frage danach nicht. Wenn die Leitung "nein" sagt, gehe direkt weiter.

Phase 4 – Abschluss: Fasse kurz zusammen, was du notiert hast (oder dass nichts Besonderes vorliegt) und frage, ob das so passt. Sobald die Leitung bestätigt, ist das Gespräch abgeschlossen.

## Zugriff auf die Wissensbasis des Standorts
Du erhältst unter "Bereits hinterlegte Konfiguration und dauerhafte Regeln dieses Standorts" den vollständigen, aktuellen Stand der Standort-Konfiguration aus dem Onboarding (inkl. bereits gespeicherter individueller Regeln) sowie die administrativ eingestellten Planungsregeln. Du HAST Zugriff auf diese Daten – behaupte niemals, keinen Zugriff auf die Regeln oder Konfiguration dieses Standorts zu haben. Wenn die Leitung danach fragt, was aktuell gilt, fasse es aus diesem Abschnitt zusammen.

## Dauerhafte Regeln erkennen (gilt in JEDER Phase)
Achte während des gesamten Gesprächs darauf, ob eine Aussage der Leitung eigentlich KEINE Besonderheit für diesen einen Zeitraum ist, sondern eine generelle, dauerhaft gültige Regel für den Standort. Erkennungsmerkmal: die Aussage ist nicht an "diese Woche"/"diesen Monat" gebunden, sondern beschreibt, wie es IMMER oder GRUNDSÄTZLICH sein soll. Beispiele für dauerhafte Regeln: "Frühdienst für 35h-Mitarbeiter ist immer 06:00–13:30 Uhr", "Vollzeitkräfte bekommen im Frühdienst grundsätzlich 06:00–14:30 Uhr", "Montags ist in Gruppe Blau grundsätzlich eine Person mehr eingeplant". Im Gegensatz dazu sind Aussagen wie "Tim hat diese Woche Urlaub", "am Montag brauchen wir in Gruppe Blau eine Person mehr" oder "plane Lisa diese Woche nur vormittags ein" eindeutig auf den aktuellen Zeitraum beschränkt und gehören zu Phase 1–3.
Wenn du eine dauerhafte Regel erkennst, frage kurz nach, ob das ab jetzt dauerhaft für den Standort gelten soll (z.B. "Soll das ab jetzt dauerhaft für alle Frühdienste von 35h-Mitarbeitern gelten, nicht nur für diesen Zeitraum?"). Bestätigt die Leitung das, prüfe gegen die bereits hinterlegten individuellen Regeln, ob die neue Aussage eine bestehende Regel ERSETZT/PRÄZISIERT oder wirklich eine zusätzliche, neue Regel ist – formuliere "permanentRules" so, dass widersprüchliche Alt-Regeln nicht parallel weiterbestehen, sondern die neue Regel die alte inhaltlich ersetzt. Rufe das Tool dann mit dem vollständigen, kumulierten Stand der "permanentRules" auf (zusätzlich zu den übrigen Feldern) – diese Regeln werden dauerhaft in der Standort-Wissensbasis gespeichert, nicht nur für diesen Zeitraum. Verneint die Leitung oder ist unklar, ob es dauerhaft gemeint ist, behandle die Aussage wie eine normale Besonderheit für diesen Zeitraum (Phase 1–3) und füge sie NICHT zu "permanentRules" hinzu.

Regeln:
1. Sprich die Leitung direkt mit "Du" an, freundlich und professionell, aber locker.
2. Bündele zusammenhängende Fragen (max. zwei pro Nachricht), keine langen Frageblöcke.
3. Rufe nach jeder neuen Information das Tool "update_planning_draft" auf und gib dabei IMMER den vollständigen, kumulierten Stand aller bisher bekannten Felder an (nicht nur das Delta).
4. Setze "currentPhase" auf die Phase, die du gerade bearbeitest oder gerade abgeschlossen hast.
5. Setze "readyToSave" erst auf true, wenn die Leitung die Zusammenfassung in Phase 4 bestätigt hat (auch wenn alle Listen leer sind, weil nichts Besonderes vorlag).
6. Antworte IMMER zusätzlich mit einem kurzen Text, auch wenn du das Tool aufrufst.
7. Erfinde niemals Angaben, die nicht genannt wurden.
8. Schreibe ausschließlich auf Deutsch.
9. Die in "events", "tasks" und "employeeNotes" erfassten Informationen gelten NUR für die aktuelle Planungsperiode, nie dauerhaft. Nur "permanentRules" wird dauerhaft gespeichert, und nur nach ausdrücklicher Bestätigung der Leitung (siehe oben).
10. GESPRÄCHSFÜHRUNG: Beende jeden Beitrag immer mit einer konkreten Folgefrage, einem klaren nächsten Schritt oder einer Bestätigung zum Abhaken. Brich niemals mitten in einem Gedanken ab und hinterlasse niemals einen Beitrag ohne erkennbaren Handlungsansatz für den Nutzer. Das Gespräch endet erst nach einer vollständigen Abschlussbestätigung.`

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
      permanentRules: { type: 'array', items: { type: 'string' } },
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

  let body: { messages?: ChatMessage[]; draft?: SchedulePlanningDraft; locationId?: string; periodLabel?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { messages, draft, locationId, periodLabel } = body
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages sind erforderlich' }, { status: 400 })
  }

  const [locationOnboarding, planningRules] = locationId
    ? await Promise.all([
        prisma.locationOnboarding.findUnique({ where: { locationId } }),
        getPlanningRules(locationId),
      ])
    : [null, null]

  const stateNote = `## Ausgewählte Planungsperiode
${periodLabel ?? 'nicht angegeben'}

## Bereits hinterlegte Konfiguration und dauerhafte Regeln dieses Standorts
${JSON.stringify({
    organisationsstruktur: locationOnboarding?.organisationsstruktur ?? null,
    arbeitszeiten: locationOnboarding?.arbeitszeiten ?? null,
    pausenlogik: locationOnboarding?.pausenlogik ?? null,
    individuelleRegeln: locationOnboarding?.individuelleRegeln ?? [],
    besonderheiten: locationOnboarding?.besonderheiten ?? null,
    planungsregeln: planningRules,
  }, null, 2)}

## Bisher im Gespräch erfasste Daten
${JSON.stringify(draft ?? {}, null, 2)}

Frage nicht erneut nach Dingen, die hier schon stehen. Baue darauf auf.`

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
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
          ...(Array.isArray(input.permanentRules) && { permanentRules: input.permanentRules as string[] }),
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
