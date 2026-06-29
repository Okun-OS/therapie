import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { getFairnessInsights } from '@/lib/fairness'
import { getPlanningRules } from '@/lib/schedule-entities'
import type { ScheduleEditDraft, ScheduleEditChange } from '@/lib/schedule-edit-draft'

const client = new Anthropic()

// 04_DIENSTPLAN_CHAT.md, Erweiterung: Bearbeitung eines bereits gespeicherten/veröffentlichten
// Dienstplans per KI-Chat (z.B. Tausch, Tag freigeben), statt nur Neuerstellung.
const SYSTEM_PROMPT = `Du bist der KI-Assistent von OKUN Workforce zur Bearbeitung eines bereits gespeicherten Dienstplans.

Die Leitung beschreibt dir in natürlicher Sprache, was am Dienstplan im angegebenen Zeitraum geändert werden soll, z.B. "Tausche Anna und Tom am Freitag", "Gib Klaus am Mittwoch frei" oder "Lisa soll am Montag Spätdienst statt Frühdienst machen". Du kennst den aktuellen Stand des Dienstplans (siehe "Aktueller Dienstplan") sowie alle Mitarbeiter und Schichten dieses Standorts.

## Vorgehen
1. Verstehe, welche konkreten Tage/Mitarbeiter betroffen sind, und ordne jede Änderung einem Mitarbeiter, einem Datum und entweder einer vorhandenen Schicht (per shiftId) oder "frei" (action: "remove") zu. Nutze ausschließlich die dir genannten employeeId/shiftId-Werte, erfinde keine.
2. Bei einem Tausch zwischen zwei Mitarbeitern erzeugst du zwei Einträge in "changes" (je einen pro Mitarbeiter/Tag), die jeweils die Schicht des anderen übernehmen.
3. Ist etwas unklar (z.B. unbekannter Name, ambiges Datum, keine passende Schicht), frage kurz nach, statt zu raten.
4. Fasse die geplanten Änderungen kurz zusammen und frage, ob das so passt. Setze "readyToApply" erst auf true, nachdem die Leitung das bestätigt hat.
5. Rufe nach jeder neuen Information das Tool "update_schedule_edit_draft" auf und gib dabei IMMER den vollständigen, kumulierten Stand aller bisher vereinbarten Änderungen an (nicht nur das Delta).

## Zugriff auf die Wissensbasis des Standorts
Du erhältst unter "Bereits hinterlegte Konfiguration und dauerhafte Regeln dieses Standorts" den vollständigen, aktuellen Stand der Standort-Konfiguration aus dem Onboarding (inkl. bereits gespeicherter individueller Regeln) sowie die administrativ eingestellten Planungsregeln. Du HAST Zugriff auf diese Daten – behaupte niemals, keinen Zugriff auf die Regeln oder Konfiguration dieses Standorts zu haben. Wenn die Leitung danach fragt, was aktuell gilt, fasse es aus diesem Abschnitt zusammen.

## Dauerhafte Regeln erkennen
Achte darauf, ob eine Aussage KEINE einmalige Änderung für diesen Zeitraum ist, sondern eine generelle, dauerhaft gültige Regel für den Standort (z.B. "Der Frühdienst soll ab jetzt immer erst um 6:15 Uhr beginnen", "Mittwochs soll grundsätzlich eine Person mehr im Spätdienst sein"). Erkennungsmerkmal: nicht an "diese Woche/diesen Tag" gebunden, sondern "ab jetzt"/"immer"/"grundsätzlich". Frage in diesem Fall kurz nach, ob das dauerhaft für den Standort gelten soll. Prüfe dabei gegen die bereits hinterlegten individuellen Regeln, ob die neue Aussage eine bestehende Regel ERSETZT/PRÄZISIERT (z.B. eine andere Uhrzeit für dieselbe Schicht) oder wirklich eine zusätzliche, neue Regel ist – formuliere "permanentRules" so, dass widersprüchliche Alt-Regeln nicht parallel weiterbestehen, sondern die neue Regel die alte inhaltlich ersetzt. Bestätigt die Leitung das, nimm die Regel zusätzlich in "permanentRules" auf (vollständiger kumulierter Stand) – sie wird dauerhaft in der Standort-Wissensbasis gespeichert. Eine einmalige Änderung für einen konkreten Tag gehört NICHT in "permanentRules", sondern ausschließlich in "changes".

## Keine erfundenen Historien-Aussagen (sehr wichtig)
Du erhältst unter "Echte Fairness-Daten" die einzigen verlässlichen Zahlen zur bisherigen Verteilung von Diensten je Mitarbeiter. Wenn du eine Änderung mit der bisherigen Verteilung begründest (z.B. "weil Tom zuletzt mehr Spätdienste hatte"), darfst du AUSSCHLIESSLICH Zahlen nennen, die wörtlich in diesen Daten stehen. Erfinde niemals Häufigkeiten, Vergleiche oder Historien, die dort nicht enthalten sind. Wenn die Daten zu einer Behauptung nichts enthalten, lass die Behauptung weg oder formuliere neutral ohne Zahlenangabe.

## Regeln
1. Sprich die Leitung direkt mit "Du" an, freundlich und professionell.
2. Antworte IMMER zusätzlich mit einem kurzen Text, auch wenn du das Tool aufrufst.
3. Schreibe ausschließlich auf Deutsch.
4. Erfinde niemals Mitarbeiter, Schichten oder Daten, die dir nicht genannt wurden.`

const TOOL = {
  name: 'update_schedule_edit_draft',
  description: 'Speichert den aktuellen, vollständigen Stand der vereinbarten Dienstplan-Änderungen. Gib bei jedem Aufruf den vollständigen kumulierten Stand an, niemals nur die neuen Felder.',
  input_schema: {
    type: 'object' as const,
    properties: {
      changes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            employeeId: { type: 'string' },
            employeeName: { type: 'string' },
            date: { type: 'string', description: 'ISO-Datum YYYY-MM-DD' },
            action: { type: 'string', enum: ['assign', 'remove'] },
            shiftId: { type: 'string' },
            shiftName: { type: 'string' },
            startTime: { type: 'string' },
            endTime: { type: 'string' },
            reason: { type: 'string' },
          },
          required: ['employeeId', 'employeeName', 'date', 'action'],
        },
      },
      permanentRules: { type: 'array', items: { type: 'string' } },
      readyToApply: { type: 'boolean' },
    },
  },
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface EmployeeBrief { id: string; name: string }
interface ShiftBrief { id: string; name: string; type: string; startTime: string; endTime: string }
interface EntryBrief { employeeId: string; employeeName: string; date: string; shiftId: string; shiftName: string }

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' }, { status: 500 })
  }

  let body: {
    messages?: ChatMessage[]
    draft?: ScheduleEditDraft
    locationId?: string
    periodLabel?: string
    employees?: EmployeeBrief[]
    shifts?: ShiftBrief[]
    entries?: EntryBrief[]
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { messages, draft, locationId, periodLabel, employees, shifts, entries } = body
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages sind erforderlich' }, { status: 400 })
  }

  const customerId = await resolveCustomerId(session)
  const [fairnessData, locationOnboarding, planningRules] = locationId
    ? await Promise.all([
        getFairnessInsights(locationId, customerId),
        prisma.locationOnboarding.findUnique({ where: { locationId } }),
        getPlanningRules(locationId),
      ])
    : [[], null, null]
  const fairnessSummary = fairnessData.map(fd => ({
    employeeId: fd.employeeId,
    name: fd.employeeName,
    frueh: fd.earlyCnt,
    spaet: fd.lateCnt,
    mittel: fd.midCnt,
    freitag_spaetdienste: fd.fridayLateCnt,
    montag_fruehdienste: fd.mondayEarlyCnt,
    wochenenddienste: fd.weekendCnt,
    fairness_punktzahl: fd.fairnessScore,
  }))

  const stateNote = `## Zeitraum
${periodLabel ?? 'nicht angegeben'}

## Mitarbeiter dieses Standorts
${JSON.stringify(employees ?? [], null, 2)}

## Verfügbare Schichten dieses Standorts
${JSON.stringify(shifts ?? [], null, 2)}

## Aktueller Dienstplan im gewählten Zeitraum (bereits gespeichert)
${JSON.stringify(entries ?? [], null, 2)}

## Echte Fairness-Daten (einzige zulässige Quelle für Aussagen über bisherige Verteilung)
${JSON.stringify(fairnessSummary, null, 2)}

## Bereits hinterlegte Konfiguration und dauerhafte Regeln dieses Standorts
${JSON.stringify({
    organisationsstruktur: locationOnboarding?.organisationsstruktur ?? null,
    arbeitszeiten: locationOnboarding?.arbeitszeiten ?? null,
    pausenlogik: locationOnboarding?.pausenlogik ?? null,
    individuelleRegeln: locationOnboarding?.individuelleRegeln ?? [],
    besonderheiten: locationOnboarding?.besonderheiten ?? null,
    planungsregeln: planningRules,
  }, null, 2)}

## Bisher im Gespräch vereinbarte Änderungen
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
    let nextDraft: ScheduleEditDraft = draft ?? {}
    for (const block of response.content) {
      if (block.type === 'text') reply += block.text
      if (block.type === 'tool_use' && block.name === 'update_schedule_edit_draft') {
        const input = block.input as Record<string, unknown>
        nextDraft = {
          ...nextDraft,
          ...(Array.isArray(input.changes) && { changes: input.changes as ScheduleEditChange[] }),
          ...(Array.isArray(input.permanentRules) && { permanentRules: input.permanentRules as string[] }),
          ...(typeof input.readyToApply === 'boolean' && { readyToApply: input.readyToApply }),
        }
      }
    }

    if (!reply.trim()) {
      reply = 'Alles klar, das habe ich vorgemerkt.'
    }

    return NextResponse.json({ reply, draft: nextDraft })
  } catch (err: unknown) {
    console.error('schedule-edit-chat', err)
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
