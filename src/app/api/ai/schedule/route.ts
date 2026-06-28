import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import type { Employee, Shift, ShiftFairnessData, WishSubmission } from '@/lib/types'

const client = new Anthropic()

// Cached system prompt – stays in Claude's prompt cache for 5 min
const SYSTEM_PROMPT = `Du bist ein KI-Assistent für intelligente Dienstplanerstellung in Kindertagesstätten.

Du erstellst optimale Wochenpläne für Mitarbeiter unter Berücksichtigung folgender Regeln:

## Pflichtregel (müssen IMMER eingehalten werden)
1. Jeder Mitarbeiter bekommt genau EINEN Dienst pro Tag (oder keinen – Ruhetag).
2. Mindestbesetzung je Schicht und Tag muss erfüllt sein (minStaff-Wert pro Schicht).
3. Kein Mitarbeiter arbeitet mehr als 5 aufeinanderfolgende Tage.
4. Die Anzahl der Dienste pro Woche ergibt sich aus "wochenstunden" UND "tage_pro_woche" des Mitarbeiters (nicht aus einer pauschalen Stunden-pro-Dienst-Annahme): Dienste pro Woche ≈ tage_pro_woche, die tägliche Dienstdauer ergibt sich aus wochenstunden / tage_pro_woche zzgl. Pause. Ist "tage_pro_woche" nicht angegeben, gehe von 5 Arbeitstagen pro Woche aus.

## Individuelle Dienstzeiten (KEINE starren, für alle gleichen Schichtzeiten)
4a. OKUN Workforce verwaltet keine starren Standardschichten. Die in "Verfügbare Schichten" angegebene "zeit_richtwert" ist nur eine Orientierung für die Art des Dienstes (z.B. Frühdienst beginnt morgens) – sie gilt NICHT unverändert für jeden Mitarbeiter.
4b. Berechne für JEDE einzelne Zuweisung individuell eine realistische "startTime" und "endTime" (Format "HH:MM") auf Basis von: den Wochenstunden und Arbeitstagen pro Woche des Mitarbeiters (wochenstunden / tage_pro_woche ergibt die tägliche Soll-Arbeitszeit), den Öffnungszeiten/Arbeitszeiten/Pausenregeln aus der "Konfiguration des Standorts", und ggf. individuellen Angaben des Mitarbeiters (Persönliche Besonderheiten/Notizen/besondere Absprachen).
4c. Beispiel: Ein Mitarbeiter mit 35h/Woche auf 5 Tage hat täglich ca. 7h Nettoarbeitszeit; ein Vollzeit-Mitarbeiter mit 40h/Woche auf 5 Tage hat täglich ca. 8h. Beginnen beide einen Frühdienst zur Öffnungszeit (z.B. 06:00 Uhr), unterscheidet sich die Endzeit entsprechend (z.B. 13:30 Uhr vs. 14:30 Uhr) – die Schicht selbst (Art/Kategorie) bleibt dieselbe, die konkrete Zeit ist individuell.
4d. Bleibe innerhalb der Öffnungszeiten des Standorts, achte auf sinnvolle Übergaben zwischen Schichten und auf die in der Standort-Konfiguration angegebenen Pausenregeln.

## Fairness-Regeln
5. Früh/Spät/Mittel sollen langfristig fair verteilt sein (je ~40%/40%/20%).
6. Freitag-Spätdienst max. 2× pro Monat pro Mitarbeiter.
7. Montag-Frühdienst max. 3× pro Monat pro Mitarbeiter.
8. Mitarbeiter mit hohem "debt" (negative earlyDebt/lateDebt) bekommen Vorrang bei dieser Schichtart.
8a. Freitag-Frühdienst max. 3× pro Monat pro Mitarbeiter – wer das Limit in den letzten 4 Wochen schon erreicht oder überschritten hat, bekommt an diesem Freitag bevorzugt eine andere Schicht.
8b. Berücksichtige bei der Verteilung auch die Wochenenddienste der letzten 4 Wochen (Hinweis: der aktuelle Plan selbst umfasst nur Montag bis Freitag). Mitarbeiter, die in den letzten 4 Wochen bereits überdurchschnittlich viele Wochenenddienste hatten, sollen das in der Begründung berücksichtigt finden, sofern dies für die Verteilung der aktuellen Woche relevant ist.
8c. Berücksichtige die persönlichen Dienstpräferenzen jedes Mitarbeiters ("praeferenzen" in den Mitarbeiterdaten), sofern angegeben: bevorzugte Schichtarten, nicht verfügbare Wochentage (hart einzuhalten), Vermeidung von Frühdienst nach Spätdienst und maximale Anzahl an Folgetagen. Nicht verfügbare Wochentage und "kein Frühdienst nach Spätdienst" sind verbindlich einzuhalten; bevorzugte Schichtarten sind ein weiches Signal wie ein Wunsch.

## Wünsche (WishSubmissions)
9. Wünsche mit Importance "urgent" haben höchste Priorität, dann "important", dann "normal".
10. Bei Konflikt (gleicher Tag, gleiche Schicht, mehrere Wünsche): Wichtigkeit > historische Fairness > Einreichzeitpunkt (früher = besser).
11. Begründe bei Konflikten, wer den Vorzug erhält und warum.
11a. Manche Mitarbeiter haben zusätzlich freiwillige, persönliche Angaben hinterlegt ("staerken", "lebenssituation", "bevorzugte_gruppen", "bevorzugte_taetigkeiten", "besondere_absprachen" in den Mitarbeiterdaten). Berücksichtige diese als weiche Signale bei der Verteilung – z.B. besondere Absprachen einhalten, Rücksicht auf die angegebene Lebenssituation nehmen, Stärken in passenden Situationen einsetzen, bevorzugte Gruppen/Bereiche und bevorzugte Tätigkeiten nach Möglichkeit berücksichtigen – sofern dies nicht im Widerspruch zu Pflicht- oder Fairness-Regeln steht.
11b. Diese persönlichen Angaben sind freiwillig und liegen nicht für jeden Mitarbeiter vor. Das Fehlen solcher Angaben darf niemals als Nachteil gewertet werden.
11c. Falls eine "Konfiguration des Standorts (aus dem KI-Onboarding)" angegeben ist, sind diese Regeln verbindlich und dauerhaft gültig.
11d. Falls "Besonderheiten ausschließlich für diese eine Planungsperiode" angegeben sind, gelten diese mit hoher Priorität NUR für die aktuelle Woche und können dauerhafte Regeln für diese eine Planung temporär überschreiben.

## Sprache & Ton der Texte (reasoning, decisions[].message, warnings)
12. Diese Texte werden der STANDORTLEITUNG (Admin) angezeigt, NICHT den Mitarbeitern. Schreibe daher konsequent in der dritten Person über Mitarbeiter (z.B. "Maria Schmidt bekommt den Frühdienst, da..."), niemals in der zweiten Person ("du", "dein", "dich").
13. Verwende AUSSCHLIESSLICH natürliches, allgemeinverständliches Deutsch. Interne Feldnamen/Variablen wie "earlyDebt", "lateDebt", "midDebt", "fridayLateCnt", "mondayEarlyCnt", "fairnessScore", "debt" oder Mitarbeiter-IDs wie "emp1"/"emp2" dürfen NIEMALS im Text vorkommen – verwende stattdessen den echten Namen des Mitarbeiters und beschreibe den Sachverhalt in Worten (z.B. statt "earlyDebt: 2.5" schreibe "hatte zuletzt unterdurchschnittlich viele Frühdienste").
14. Mische niemals Deutsch und Englisch in einem Satz.

## Rückfrage nach Qualitätsprüfung (Schritt 8)
15. Prüfe nach der Erstellung deinen eigenen Plan auf sinnvolle Optimierungen, die eine echte Abwägung der Leitung erfordern (z.B. spürbare Reduzierung von Überstunden eines Mitarbeiters durch Tausch zweier Dienste, auf Kosten eines weicheren Signals wie einer Präferenz). Falls eine solche Verbesserung existiert, formuliere GENAU EINE kurze Ja/Nein-Frage dazu im Feld "decisionQuestion" (z.B. "Soll ich die Überstunden von Maria Schmidt reduzieren, indem ihr Frühdienst am Mittwoch mit dem Spätdienst von Klaus Becker getauscht wird?").
16. Falls keine derartige Entscheidung notwendig ist, setze "decisionQuestion" auf null. Stelle NIEMALS mehr als eine Rückfrage pro Antwort.
17. Falls dir im Abschnitt "Bestätigte Optimierung" mitgeteilt wird, dass die Leitung eine vorherige Rückfrage bereits mit JA beantwortet hat, wende diese Verbesserung im Plan an und setze "decisionQuestion" in dieser Antwort IMMER auf null – es erfolgen keine weiteren Rückfragen zu derselben Planung.

## Genehmigter Urlaub
18. Mitarbeiter mit genehmigtem Urlaub (siehe "Genehmigter Urlaub im Planungszeitraum") dürfen an den betroffenen Tagen KEINEN Dienst bekommen – behandle sie an diesen Tagen als nicht verfügbar.
19. Falls dadurch an einem Tag die Mindestbesetzung einer Schicht nicht erreicht werden kann, plane trotzdem den bestmöglichen Plan für alle anderen Tage/Schichten und formuliere GENAU EINE Rückfrage im Feld "fallback", ob für diesen Tag/diese Schicht eine Vertretungsanfrage erstellt werden soll. Gib dabei "date" (YYYY-MM-DD) und "shiftId" der unterbesetzten Schicht an. Falls keine Unterbesetzung durch Urlaub auftritt, setze "fallback" auf null.

## Krankheiten und gemeldete Abwesenheiten
18a. Mitarbeiter mit gemeldeter Krankheit oder sonstiger Abwesenheit (siehe "Gemeldete Abwesenheiten im Planungszeitraum") dürfen an den betroffenen Tagen ebenfalls KEINEN Dienst bekommen – behandle sie an diesen Tagen wie bei Urlaub als nicht verfügbar.
19a. Falls dadurch an einem Tag die Mindestbesetzung einer Schicht nicht erreicht werden kann und noch kein "fallback" für diesen Tag/diese Schicht aus Regel 19 gesetzt wurde, formuliere ebenfalls GENAU EINE Rückfrage im Feld "fallback" nach denselben Vorgaben wie in Regel 19.

## Transparente Entscheidungen (Schritt "decisions")
20. Damit die Leitung sich später für eine einzelne Schicht anzeigen lassen kann, warum genau diese Zuweisung getroffen wurde, gib bei JEDEM Eintrag mit "type": "assignment" zusätzlich "employeeId" und "date" (YYYY-MM-DD) der betroffenen Zuweisung an. Erstelle solche Einträge für die auffälligsten/wichtigsten Zuweisungen (z. B. Fairness-Ausgleich, erfüllte Wünsche, besondere Absprachen) – nicht für jede einzelne Schicht.
21. Einträge mit "type": "conflict" oder "warning" benötigen kein "employeeId"/"date".

## Output-Format (JSON, kein Markdown drumherum)
Antworte NUR mit einem gültigen JSON-Objekt in diesem Format:
{
  "schedule": {
    "YYYY-MM-DD": {
      "employeeId": { "shiftId": "string", "startTime": "HH:MM", "endTime": "HH:MM" }
    }
  },
  "reasoning": "Kurze Zusammenfassung der Planungslogik auf Deutsch (2–4 Sätze)",
  "decisions": [
    { "type": "assignment", "message": "Erklärung auf Deutsch", "employeeId": "string", "date": "YYYY-MM-DD" },
    { "type": "conflict" | "warning", "message": "Erklärung auf Deutsch" }
  ],
  "warnings": ["Warnung 1", "Warnung 2"],
  "decisionQuestion": "Ja/Nein-Frage auf Deutsch, oder null",
  "fallback": { "date": "YYYY-MM-DD", "shiftId": "string", "message": "Ja/Nein-Frage auf Deutsch zur Vertretungsanfrage" } | null
}

WICHTIG: Jeder "shiftId"-Wert MUSS exakt der "id" eines Eintrags aus "Verfügbare Schichten" entsprechen, und jeder Datums-Schlüssel im "schedule"-Objekt MUSS exakt einem Eintrag aus "Planungstage" entsprechen (gleiches "YYYY-MM-DD"-Format, keine zusätzlichen oder fehlenden Tage). Erfinde niemals eigene IDs oder Datumsformate.`

// Finds the first balanced {...} object in text, tolerating any stray prose/markdown
// the model may add before or after it despite being instructed to return only JSON.
function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
    } else if (ch === '{') {
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

interface ScheduleRequest {
  employees: Employee[]
  shifts: Shift[]
  fairnessData: ShiftFairnessData[]
  wishSubmissions: WishSubmission[]
  weekDates: string[]
  locationId?: string
  locationName: string
  facilityDescription?: string
  confirmedDecisionQuestion?: string
  approvedVacations?: { employeeId: string; employeeName: string; startDate: string; endDate: string }[]
  reportedAbsences?: { employeeId: string; employeeName: string; startDate: string; endDate: string; type: string }[]
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' }, { status: 500 })
  }

  let body: ScheduleRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { employees, shifts, fairnessData, wishSubmissions, weekDates, locationId, locationName, facilityDescription, confirmedDecisionQuestion, approvedVacations, reportedAbsences } = body

  const activeEmployees = employees.filter(e => e.role === 'employee' && e.active)

  // weekDates is a flat Mon–Fri list across one or more weeks; each week contributes exactly 5 entries.
  const weekStarts = weekDates.filter((_, idx) => idx % 5 === 0)

  const customerId = await resolveCustomerId(session)

  const [locationOnboarding, periodNotes, organizationOnboarding] = locationId
    ? await Promise.all([
        prisma.locationOnboarding.findUnique({ where: { locationId } }),
        prisma.schedulingPeriodNote.findMany({ where: { locationId, weekStart: { in: weekStarts } } }),
        customerId ? prisma.organizationOnboarding.findUnique({ where: { customerId } }) : Promise.resolve(null),
      ])
    : [null, [], null]

  const humanContexts = activeEmployees.length > 0
    ? await prisma.employeeHumanContext.findMany({
        where: { employeeId: { in: activeEmployees.map(e => e.id) } },
      })
    : []

  const employeeSummary = activeEmployees.map(emp => {
    const fd = fairnessData.find(f => f.employeeId === emp.id)
    const hc = humanContexts.find(h => h.employeeId === emp.id)
    return {
      id: emp.id,
      name: emp.name,
      wochenstunden: emp.weeklyHours,
      tage_pro_woche: emp.workDaysPerWeek ?? 5,
      frueh_unterversorgung: fd ? Math.round(fd.earlyDebt * 10) / 10 : 0,
      spaet_unterversorgung: fd ? Math.round(fd.lateDebt * 10) / 10 : 0,
      mittel_unterversorgung: fd ? Math.round(fd.midDebt * 10) / 10 : 0,
      freitag_spaetdienste_letzte_4_wochen: fd?.fridayLateCnt ?? 0,
      montag_fruehdienste_letzte_4_wochen: fd?.mondayEarlyCnt ?? 0,
      freitag_fruehdienste_letzte_4_wochen: fd?.fridayEarlyCnt ?? 0,
      wochenenddienste_letzte_4_wochen: fd?.weekendCnt ?? 0,
      fairness_punktzahl: fd?.fairnessScore ?? 100,
      ...(emp.preferences && {
        praeferenzen: {
          bevorzugte_schichten: emp.preferences.preferredShifts,
          nicht_verfuegbare_wochentage: emp.preferences.unavailableDays,
          kein_frueh_nach_spaet: emp.preferences.noEarlyAfterLate ?? false,
          ...(emp.preferences.maxConsecutiveDays !== undefined && { maximale_folgetage: emp.preferences.maxConsecutiveDays }),
          ...(emp.preferences.notes && { notizen: emp.preferences.notes }),
        },
      }),
      ...(hc?.strengths.length && { staerken: hc.strengths }),
      ...(hc?.lifeCircumstances.length && { lebenssituation: hc.lifeCircumstances }),
      ...(hc?.preferredGroups.length && { bevorzugte_gruppen: hc.preferredGroups }),
      ...(hc?.preferredActivities.length && { bevorzugte_taetigkeiten: hc.preferredActivities }),
      ...(hc?.shiftPreferences.length && { schicht_vorlieben_freiwillig: hc.shiftPreferences }),
      ...(hc?.agreements && { besondere_absprachen: hc.agreements }),
    }
  })

  const shiftSummary = shifts.map(s => ({
    id: s.id,
    name: s.name,
    type: s.type,
    zeit_richtwert: `${s.startTime}–${s.endTime}`,
    minStaff: s.minStaff,
  }))

  const organizationSection = organizationOnboarding ? `
## Unternehmensweite Vorgaben (aus dem KI-Unternehmens-Onboarding, gilt für alle Standorte)
${[
    organizationOnboarding.rollenmodell && `Rollenmodell: ${organizationOnboarding.rollenmodell}`,
    organizationOnboarding.unternehmensweiteRegeln && `Unternehmensweite Regeln: ${organizationOnboarding.unternehmensweiteRegeln}`,
  ].filter(Boolean).join('\n')}` : ''

  const onboardingSection = locationOnboarding ? `
## Konfiguration des Standorts (aus dem KI-Standort-Onboarding, gilt dauerhaft als Wissensbasis dieses Standorts)
${[
    locationOnboarding.einrichtungsart && `Art des Standorts: ${locationOnboarding.einrichtungsart}`,
    locationOnboarding.organisationsstruktur && `Organisationsstruktur (Gruppen/Bereiche/Teams): ${locationOnboarding.organisationsstruktur}`,
    locationOnboarding.personalstruktur && `Personalstruktur: ${locationOnboarding.personalstruktur}`,
    locationOnboarding.arbeitszeiten && `Arbeitszeiten/Dienstzeiten/Öffnungszeiten: ${locationOnboarding.arbeitszeiten}`,
    locationOnboarding.dienstplanlogik && `Dienstplanlogik: ${locationOnboarding.dienstplanlogik}`,
    locationOnboarding.pausenlogik && `Pausenlogik: ${locationOnboarding.pausenlogik}`,
    locationOnboarding.wiederkehrendeAufgaben && `Wiederkehrende Aufgaben: ${locationOnboarding.wiederkehrendeAufgaben}`,
    locationOnboarding.individuelleRegeln.length > 0 && `Individuelle Regeln:\n${locationOnboarding.individuelleRegeln.map(r => `- ${r}`).join('\n')}`,
    locationOnboarding.vertretungsregeln && `Vertretungsregeln: ${locationOnboarding.vertretungsregeln}`,
    locationOnboarding.urlaubslogik && `Urlaubslogik: ${locationOnboarding.urlaubslogik}`,
    locationOnboarding.zeiterfassung && `Zeiterfassung: ${locationOnboarding.zeiterfassung}`,
    locationOnboarding.besonderheiten && `Sonstige Besonderheiten (Standortbeschreibung): ${locationOnboarding.besonderheiten}`,
  ].filter(Boolean).join('\n')}

Dies ist die dauerhafte Wissensbasis dieses Standorts – leite daraus automatisch Dienstzeiten, Schichten, Arbeitsmodelle und Regeln ab und beachte sie verbindlich bei der Planung, auch wenn nicht jedes Feld ausgefüllt ist.` : ''

  const periodNotesSection = periodNotes.length > 0 ? `
## Besonderheiten ausschließlich für diese eine Planungsperiode
${periodNotes.map(n => `- ${n.note}`).join('\n')}

Diese Hinweise gelten NUR für die aktuelle Planungsperiode und überschreiben bei Bedarf temporär die Standardregeln. Sie gelten nicht für künftige Perioden.` : ''

  const vacationSection = approvedVacations && approvedVacations.length > 0 ? `
## Genehmigter Urlaub im Planungszeitraum
${JSON.stringify(approvedVacations, null, 2)}

Diese Mitarbeiter sind an den genannten Tagen (startDate bis endDate, jeweils inklusive) nicht verfügbar.` : ''

  const absenceSection = reportedAbsences && reportedAbsences.length > 0 ? `
## Gemeldete Abwesenheiten im Planungszeitraum
${JSON.stringify(reportedAbsences, null, 2)}

Diese Mitarbeiter sind an den genannten Tagen (startDate bis endDate, jeweils inklusive) krankheitsbedingt oder anderweitig abwesend und nicht verfügbar.` : ''

  const wishSummary = wishSubmissions.map(w => ({
    employeeId: w.employeeId,
    employeeName: w.employeeName,
    date: w.date,
    preferredShiftType: w.preferredShiftType,
    importance: w.importance,
    reason: w.reason,
    submittedAt: w.submittedAt,
  }))

  const userPrompt = `Erstelle einen Dienstplan für den Zeitraum ${weekDates[0]} bis ${weekDates[weekDates.length - 1]} (${weekStarts.length} ${weekStarts.length === 1 ? 'Woche' : 'Wochen'}) für den Standort "${locationName}".

## Mitarbeiter (mit Fairness-Daten aus den letzten 4 Wochen)
${JSON.stringify(employeeSummary, null, 2)}

Hinweis: "id" wird NUR als Schlüssel im "schedule"-Objekt der Antwort verwendet, niemals in reasoning/decisions/warnings. Höherer "_unterversorgung"-Wert = Mitarbeiter sollte diese Schicht öfter bekommen, negativer Wert = hat diese Schicht schon überdurchschnittlich oft gehabt – beschreibe das in reasoning/decisions/warnings immer in eigenen Worten, nie mit dem Feldnamen.

## Verfügbare Schichten (Kategorien – "zeit_richtwert" ist nur eine Orientierung, KEINE für alle Mitarbeiter gleiche Zeitvorgabe, siehe Regel 4a–4d)
${JSON.stringify(shiftSummary, null, 2)}

## Planungstage
${JSON.stringify(weekDates)}

## Dienstwünsche der Mitarbeiter
${wishSummary.length > 0 ? JSON.stringify(wishSummary, null, 2) : 'Keine Wünsche eingereicht.'}
${vacationSection}
${absenceSection}
${organizationSection}
${onboardingSection}
${periodNotesSection}
${facilityDescription ? `
## Besondere Standortbeschreibung vom Teamleiter
${facilityDescription}

Beachte diese Standortbeschreibung besonders beim Erstellen des Plans. Leite daraus zusätzliche Planungsregeln ab und wende sie an.` : ''}
${confirmedDecisionQuestion ? `
## Bestätigte Optimierung
Die Leitung hat folgende Rückfrage aus einer vorherigen Planung mit JA beantwortet: "${confirmedDecisionQuestion}"
Erstelle den Plan so, dass diese Verbesserung umgesetzt wird. Setze "decisionQuestion" in dieser Antwort auf null.` : ''}
Antworte ausschließlich mit dem JSON-Objekt. Kein Markdown, kein Text davor oder danach.`

  // The schedule grid (employees × days) dominates response size; scale the
  // token budget with it instead of a fixed cap that truncates longer periods.
  const cellCount = activeEmployees.length * weekDates.length
  const maxTokens = Math.min(32000, Math.max(8192, 2000 + cellCount * 130))

  try {
    // Use streaming: the Anthropic SDK refuses non-streaming calls whose maxTokens
    // implies a request that could take longer than 10 minutes (our dynamic
    // maxTokens can exceed that threshold for long planning periods).
    const stream = client.messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: maxTokens,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    })
    const response = await stream.finalMessage()

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''

    if (response.stop_reason === 'max_tokens') {
      console.error('schedule: AI response truncated at max_tokens', { rawLength: rawText.length })
      return NextResponse.json({ error: 'KI-Antwort wurde abgeschnitten (zu lang für den Planungszeitraum) – bitte einen kürzeren Zeitraum wählen oder erneut versuchen', raw: rawText }, { status: 502 })
    }

    // Extract the JSON object even if the model added stray text/markdown around it
    const jsonCandidate = extractJsonObject(rawText) ?? rawText.trim()

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(jsonCandidate)
    } catch {
      console.error('schedule: AI did not return valid JSON', { rawText })
      return NextResponse.json({ error: 'KI hat kein gültiges JSON zurückgegeben', raw: rawText }, { status: 502 })
    }

    const validShiftIds = new Set(shifts.map(s => s.id))
    const validDates = new Set(weekDates)
    const validEmployeeIds = new Set(activeEmployees.map(e => e.id))
    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/

    const rawSchedule = parsed.schedule
    const sanitizedSchedule: Record<string, Record<string, { shiftId: string; startTime?: string; endTime?: string }>> = {}
    let droppedCount = 0
    let totalCount = 0

    if (rawSchedule && typeof rawSchedule === 'object') {
      for (const [date, byEmployee] of Object.entries(rawSchedule as Record<string, unknown>)) {
        if (!validDates.has(date) || !byEmployee || typeof byEmployee !== 'object') {
          droppedCount += Object.keys(byEmployee && typeof byEmployee === 'object' ? byEmployee : {}).length
          continue
        }
        for (const [employeeId, value] of Object.entries(byEmployee as Record<string, unknown>)) {
          totalCount++
          if (!validEmployeeIds.has(employeeId)) { droppedCount++; continue }
          const assignment = typeof value === 'string' ? { shiftId: value } : (value as Record<string, unknown> | null)
          const shiftId = assignment && typeof assignment.shiftId === 'string' ? assignment.shiftId : undefined
          if (!shiftId || !validShiftIds.has(shiftId)) { droppedCount++; continue }
          const startTime = typeof assignment?.startTime === 'string' && timePattern.test(assignment.startTime) ? assignment.startTime : undefined
          const endTime = typeof assignment?.endTime === 'string' && timePattern.test(assignment.endTime) ? assignment.endTime : undefined
          if (!sanitizedSchedule[date]) sanitizedSchedule[date] = {}
          sanitizedSchedule[date][employeeId] = { shiftId, startTime, endTime }
        }
      }
    }

    if (droppedCount > 0) {
      console.error('schedule: AI returned invalid entries', { droppedCount, totalCount })
    }

    const rawDateCount = rawSchedule && typeof rawSchedule === 'object' ? Object.keys(rawSchedule).length : 0
    const sanitizedDateCount = Object.keys(sanitizedSchedule).length
    if ((totalCount > 0 && droppedCount === totalCount) || (rawDateCount > 0 && sanitizedDateCount === 0)) {
      console.error('schedule: AI returned no usable schedule', { rawDateCount, sanitizedDateCount, totalCount, droppedCount })
      return NextResponse.json({ error: 'KI hat keine gültigen Zuweisungen zurückgegeben (unbekannte IDs/Daten)', raw: rawText }, { status: 502 })
    }

    return NextResponse.json({ ...parsed, schedule: sanitizedSchedule })
  } catch (err: unknown) {
    console.error('schedule', err)
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
