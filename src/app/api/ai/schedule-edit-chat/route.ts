import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId, resolveLocationId } from '@/lib/session'
import { getFairnessInsights } from '@/lib/fairness'
import { getPlanningRules } from '@/lib/schedule-entities'
import type { ScheduleEditDraft, ScheduleEditChange } from '@/lib/schedule-edit-draft'

const client = new Anthropic()

// 04_DIENSTPLAN_CHAT.md, Erweiterung: Bearbeitung eines bereits gespeicherten/veröffentlichten
// Dienstplans per KI-Chat (z.B. Tausch, Tag freigeben), statt nur Neuerstellung.
const SYSTEM_PROMPT = `Du bist der KI-Assistent von OKUN Workforce zur Bearbeitung eines bereits gespeicherten Dienstplans.

Die Leitung beschreibt dir in EINER Nachricht, was am Dienstplan geändert werden soll. Du setzt es SOFORT um – kein Nachfragen, kein Bestätigen.

## Vorgehen (einmaliger Schritt)
1. Identifiziere alle betroffenen Mitarbeiter, Tage und Schichten anhand der bereitgestellten Daten.
2. Rufe das Tool update_schedule_edit_draft GENAU EINMAL auf mit ALLEN Änderungen. Setze readyToApply: true.
3. Schreibe 1–2 kurze Sätze, die zusammenfassen, was du geändert hast.

## Regeln
- Stelle KEINE Rückfragen. Leite Unklares aus dem Kontext ab.
- Nutze ausschließlich die bereitgestellten employeeId/shiftId-Werte – erfinde keine.
- Bei einem Tausch: erzeuge je einen change-Eintrag pro betroffenem Mitarbeiter.
- Plane niemanden an Tagen ein, für die Urlaub oder eine Abwesenheit eingetragen ist.
- Wenn ein Name mehrdeutig ist: wähle den wahrscheinlichsten Treffer und nenne ihn kurz im Text.
- Erkenne dauerhafte Regeln (Schlüsselwörter: "ab jetzt", "immer", "grundsätzlich") und lege sie in permanentRules ab. Einmalige Tagesänderungen gehören nur in changes.
- Antworte ausschließlich auf Deutsch.
- readyToApply ist immer true.

## Zugriff auf die Wissensbasis des Standorts
Du erhältst den vollständigen Stand der Standort-Konfiguration (Onboarding, individuelle Regeln, Planungsregeln). Du HAST Zugriff auf diese Daten.

## Mitarbeiterstammdaten und Einschränkungen
Du erhältst alle relevanten Planungsdaten pro Mitarbeiter: feste freie Tage (Feld "feste_freie_tage"), Arbeitstage, Qualifikationen, Schichtpräferenzen und Planungsnotizen. Du HAST Zugriff auf alle diese Daten. Schlage niemanden an einem festen freien Tag ein.

## Urlaub, Abwesenheiten und Wünsche
Du erhältst alle eingetragenen Urlaubs- und Abwesenheitstage. Schlage niemanden an diesen Tagen ein.

## Fairness-Daten
Wenn du eine Änderung mit bisheriger Dienstverteilung begründest, nutze ausschließlich die bereitgestellten Fairness-Zahlen – erfinde keine Häufigkeiten.`

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

interface EmployeeBrief { id: string; name: string; gruppe?: string; bereich?: string }
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
  const resolvedLocationId = locationId ?? (await resolveLocationId(session)) ?? undefined
  const [fairnessData, locationOnboarding, planningRules, vacationRows, absenceRows, wishRows, dbEmployees] = resolvedLocationId
    ? await Promise.all([
        getFairnessInsights(resolvedLocationId, customerId),
        prisma.locationOnboarding.findUnique({ where: { locationId: resolvedLocationId } }),
        getPlanningRules(resolvedLocationId),
        prisma.vacationRequest.findMany({ where: { locationId: resolvedLocationId, status: 'approved' } }),
        prisma.absence.findMany({ where: { locationId: resolvedLocationId } }),
        prisma.wishSubmission.findMany({ where: { locationId: resolvedLocationId, status: { in: ['pending', 'approved'] } } }),
        prisma.employee.findMany({ where: { locationId: resolvedLocationId, active: true } }),
      ])
    : [[], null, null, [], [], [], []]
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

  // Fetch planning profiles for all employees
  const empIds = (dbEmployees as { id: string }[]).map(e => e.id)
  const planningProfiles = empIds.length > 0
    ? await prisma.employeePlanningProfile.findMany({ where: { employeeId: { in: empIds } } })
    : []
  const profileByEmpId = new Map(planningProfiles.map(p => [p.employeeId, p]))

  // Build comprehensive per-employee constraints map
  type EmpDb = {
    id: string; name: string; weeklyHours: number; employmentType?: string | null
    fixedOffDays: string[]; workDays: string[]; workDaysPerWeek?: number | null
    qualifications: string[]
  }
  const empNames = new Map((dbEmployees as EmpDb[]).map(e => [e.id, e.name]))
  const empConstraints = (dbEmployees as EmpDb[]).map(emp => {
    const profile = profileByEmpId.get(emp.id)
    return {
      id: emp.id,
      name: emp.name,
      wochenstunden: emp.weeklyHours,
      ...(emp.employmentType && { beschaeftigungsart: emp.employmentType }),
      ...(emp.fixedOffDays.length > 0 && { feste_freie_tage: emp.fixedOffDays }),
      ...(emp.workDays.length > 0 && { arbeitstage: emp.workDays }),
      ...(emp.workDaysPerWeek && { tage_pro_woche: emp.workDaysPerWeek }),
      ...(emp.qualifications.length > 0 && { qualifikationen: emp.qualifications }),
      ...(profile?.shiftPreference && profile.shiftPreference !== 'keine' && { schichtpraeferenz: profile.shiftPreference }),
      ...(profile?.weekendRule && { wochenend_regelung: profile.weekendRule }),
      ...(profile?.maxConsecutiveDays && profile.maxConsecutiveDays > 0 && { max_aufeinanderfolgende_tage: profile.maxConsecutiveDays }),
      ...(profile?.planningNote && { planungsnotiz: profile.planningNote }),
    }
  })

  // Per-employee vacation / absence / wish data
  type VacRow = { employeeId: string; startDate: string; endDate: string }
  type AbsRow = { employeeId: string; startDate: string; endDate: string; type?: string }
  type WishRow = { employeeId: string; date: string; preferredShiftType: string; importance?: string }
  const absenceByEmp = new Map<string, { urlaub: string[]; nichtVerfuegbar: string[]; wuensche: { datum: string; typ: string; prioritaet?: string }[] }>()
  for (const v of vacationRows as VacRow[]) {
    if (!absenceByEmp.has(v.employeeId)) absenceByEmp.set(v.employeeId, { urlaub: [], nichtVerfuegbar: [], wuensche: [] })
    absenceByEmp.get(v.employeeId)!.urlaub.push(`${v.startDate} bis ${v.endDate}`)
  }
  for (const a of absenceRows as AbsRow[]) {
    if (!absenceByEmp.has(a.employeeId)) absenceByEmp.set(a.employeeId, { urlaub: [], nichtVerfuegbar: [], wuensche: [] })
    const label = a.type ? `${a.startDate} bis ${a.endDate} (${a.type})` : `${a.startDate} bis ${a.endDate}`
    absenceByEmp.get(a.employeeId)!.nichtVerfuegbar.push(label)
  }
  for (const w of wishRows as WishRow[]) {
    if (!absenceByEmp.has(w.employeeId)) absenceByEmp.set(w.employeeId, { urlaub: [], nichtVerfuegbar: [], wuensche: [] })
    absenceByEmp.get(w.employeeId)!.wuensche.push({ datum: w.date, typ: w.preferredShiftType, ...(w.importance && w.importance !== 'normal' && { prioritaet: w.importance }) })
  }
  const empAbsenceMap = Array.from(absenceByEmp.entries())
    .map(([id, data]) => ({
      id,
      name: empNames.get(id) ?? id,
      ...(data.urlaub.length > 0 && { urlaub: data.urlaub }),
      ...(data.nichtVerfuegbar.length > 0 && { nichtVerfuegbar: data.nichtVerfuegbar }),
      ...(data.wuensche.length > 0 && { wuensche: data.wuensche }),
    }))

  const stateNote = `## Zeitraum
${periodLabel ?? 'nicht angegeben'}

## Mitarbeiter dieses Standorts (vollständige Stammdaten)
${JSON.stringify(empConstraints.length > 0 ? empConstraints : (employees ?? []), null, 2)}

## Verfügbare Schichten dieses Standorts
${JSON.stringify(shifts ?? [], null, 2)}

## Aktueller Dienstplan im gewählten Zeitraum (bereits gespeichert)
${JSON.stringify(entries ?? [], null, 2)}

## Urlaub, Abwesenheiten und Wünsche der Mitarbeiter
${empAbsenceMap.length > 0 ? JSON.stringify(empAbsenceMap, null, 2) : '(keine eingetragenen Urlaube, Abwesenheiten oder Wünsche)'}

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
    // Keep only the last 12 messages — stateNote already carries the full current
    // context (draft, schedule, employees), so old history adds noise and token cost.
    // Also trim from the start so the first message is always from 'user'
    // (Anthropic API requirement) and guard against empty content fields.
    const recentMessages = messages.slice(-12)
    const firstUserIdx = recentMessages.findIndex(m => m.role === 'user')
    const safeMessages = (firstUserIdx > 0 ? recentMessages.slice(firstUserIdx) : recentMessages)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content || 'ok' }))
      .filter(m => m.content.trim().length > 0)

    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: stateNote },
      ],
      tools: [TOOL],
      messages: safeMessages,
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
