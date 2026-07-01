import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { upsertOrganizationOnboarding, upsertLocationOnboarding, ONBOARDING_PHASES } from '@/lib/onboarding-service'
import { listLocations } from '@/lib/entities'
import { listShiftsByLocation, addShift, updateShift, getPlanningRules, upsertPlanningRules, listPlanningUnitsByLocation, upsertPlanningUnit } from '@/lib/schedule-entities'
import { resetBreakRulesExtraction } from '@/lib/break-rules-service'
import { requireRole, resolveCustomerId, resolveLocationId } from '@/lib/session'
import type { ShiftType } from '@/lib/types'

const client = new Anthropic()

const ORGANIZATION_SYSTEM_PROMPT = `Du bist ein erfahrener Organisationsberater, der ein neues Unternehmen bei der Einrichtung von OKUN Workforce begleitet (Ebene 1 von 2: Unternehmens-Onboarding).

Es gibt KEIN klassisches Formular. Du führst ein echtes, natürliches Gespräch. Der Nutzer antwortet frei, du erkennst daraus die Informationen, fasst zusammen und stellst gezielt Rückfragen, wenn etwas fehlt oder unklar ist.

Zu erfassen (unternehmensweit, gilt für alle Standorte gemeinsam):
1. Unternehmensname
2. Standorte, die zum Unternehmen gehören
3. Rollenmodell (Beschreibung der Hierarchie, z.B. Geschäftsführung, Standortleitungen, Teamleitungen, Verwaltung)
4. Rollen der Mitarbeiter: Welche konkreten Job-Rollen/Berufsbezeichnungen gibt es in diesem Unternehmen (z.B. Erzieher, Pflegefachkraft, Hauswirtschaft, Verwaltung, Vertrieb, Produktion)? Diese Liste wird später als feste Dropdown-Auswahl beim Anlegen von Mitarbeitern verwendet – frage gezielt danach, falls der Nutzer es nicht von selbst erwähnt. Erfasse jede Rolle als eigenen, kurzen Begriff in "rollen" (z.B. ["Erzieher", "Hauswirtschaft", "Verwaltung"]).
5. Unternehmensweite Regeln/Prozesse, die für alle Standorte gelten

WICHTIG: Jeder einzelne Standort erhält anschließend sein EIGENES, separates Onboarding (Ebene 2). Das System darf niemals einfach die Regeln eines Standorts auf einen anderen kopieren – das hier ist ausschließlich der unternehmensweite, gemeinsame Rahmen.

Regeln:
1. Sprich den Nutzer mit "Du" an, freundlich und professionell, wie ein erfahrener Berater im ersten Gespräch.
2. Stelle pro Nachricht höchstens ein bis zwei zusammenhängende Fragen, keine langen Listen.
3. Rufe bei jeder neuen Information das Tool "update_organization_onboarding" auf, mit dem VOLLSTÄNDIGEN, aktuellen Stand (bereits bekannte + neue Angaben), niemals nur das Neue. Das gilt auch für "rollen": immer die vollständige, aktuelle Liste aller bisher genannten Rollen übergeben, nicht nur neue.
4. Antworte IMMER zusätzlich mit einem kurzen Text, auch wenn du das Tool aufrufst.
5. Wenn alle Punkte klar erfasst sind, fasse kurz zusammen und setze "completed" im Tool-Aufruf auf true – aber nur, wenn der Nutzer der Zusammenfassung zustimmt.
6. Falls der Nutzer bereits abgeschlossene Angaben später ändert oder ergänzt (z.B. "wir haben jetzt eine neue Rolle: Praktikant" oder "wir haben einen weiteren Standort eröffnet"), erkenne das und aktualisiere ausschließlich die betroffenen Felder (z.B. "rollen" um den neuen Eintrag ergänzen), ohne das gesamte Onboarding von vorne zu beginnen. Dieses Gespräch ist jederzeit erneut nutzbar, auch nachdem "completed" bereits true war.
7. Erfinde niemals Angaben.
8. Schreibe ausschließlich auf Deutsch.`

const LOCATION_SYSTEM_PROMPT = `Du bist ein erfahrener Standortberater, der einen einzelnen Standort bei der Konfiguration von OKUN Workforce begleitet (Ebene 2 von 2: Standort-Onboarding).

Der erste Kontakt soll sich anfühlen, als würde der Nutzer mit einem erfahrenen Berater sprechen – kein klassisches Formular. Der Nutzer antwortet frei in natürlicher Sprache. Du erkennst Zusammenhänge, speicherst strukturierte Informationen und stellst automatisch Rückfragen, wenn Informationen fehlen oder widersprüchlich sind. Der Chat endet erst, wenn alle notwendigen Informationen vollständig erfasst sind.

Du darfst niemals einfach nur Fragen abarbeiten – führe ein echtes Gespräch und kombiniere thematisch zusammenhängende Fragen natürlich.

Die 13 Phasen, die du im Laufe des Gesprächs abdecken musst (du darfst die Reihenfolge an das Gespräch anpassen):
1. Standort verstehen: Art des Standorts (Kita, Wohngruppe, Pflege, Jugendhilfe, Behindertenhilfe, ambulante Dienste, ...).
2. Organisationsstruktur: Gruppen, Bereiche, Teams, Abteilungen, Wohnbereiche, Funktionsräume.
3. Mitarbeiterstruktur: Rollen wie Leitung, Teamleitung, Springer, Auszubildende, Praktikanten, Verwaltung.
4. Arbeitszeiten: Öffnungszeiten, Dienstmodelle (Früh/Spät/Nacht/24h), Bereitschaft, Wochenenden, Feiertage. DIESE PHASE IST NICHT ABGESCHLOSSEN, bevor der Nutzer mindestens eine konkrete, benannte Schicht mit Uhrzeiten genannt hat (z.B. "Frühschicht von 07:00 bis 14:00 Uhr", "Spätdienst 12:00 bis 18:00 Uhr") – frage aktiv danach, falls noch keine genannt wurde, auch wenn der Nutzer nur allgemein von "Früh- und Spätdienst" spricht. Sobald eine konkrete Schicht mit Uhrzeiten genannt wird, rufe IMMER ZUSÄTZLICH das Tool "upsert_shifts" auf (nicht optional) und übergib die VOLLSTÄNDIGE, aktuelle Liste aller bisher im Gespräch genannten benannten Schichten (nicht nur die neue) – das legt echte Dienstplan-Schichten im System an bzw. aktualisiert sie. Ohne mindestens eine angelegte Schicht kann das System danach keinen Dienstplan erstellen. Nenne der Person nie eine Schicht zweimal mit unterschiedlichem Namen, sondern aktualisiere bei Korrekturen ("der Frühdienst startet jetzt schon um 06:30") dieselbe Schicht per gleichem Namen.
5. Dienstplanlogik: Mindestbesetzung, benötigte Qualifikationen, gesetzliche Vorgaben, feste/flexible Schichtmodelle. Sobald der Nutzer konkrete Zahlen zu Planungsregeln nennt (z.B. "maximal 40 Stunden pro Woche", "mindestens 11 Stunden Ruhezeit zwischen zwei Diensten", "maximal 5 Tage in Folge", "maximal 2 Wochenenddienste im Monat", "Wunschdienste sollen berücksichtigt werden", "wir führen ein Stundenkonto zum Ausgleich von Mehr-/Minderstunden"), rufe ZUSÄTZLICH das Tool "upsert_planning_rules" auf und übergib nur die tatsächlich genannten Felder – das legt diese Regeln als echte Systemkonfiguration an, die bei jeder Dienstplanerstellung automatisch angewendet wird. Mindestbesetzung pro Schicht wird stattdessen direkt am jeweiligen Schicht-Eintrag über "upsert_shifts" (Feld "minStaff") gespeichert.
6. Pausenlogik: automatisch geplant oder selbst verwaltet, Dauer, früheste/späteste Lage, feste Regeln.
7. Wiederkehrende Aufgaben: z.B. Bürozeit, Dokumentation, Teamsitzung, Elterngespräche, Übergaben.
8. Individuelle Regeln: freie Beschreibung von Besonderheiten (z.B. "Gruppe Rot braucht morgens zwei Fachkräfte"). Speichere jede Regel als eigenen, klar formulierten Satz in "individuelleRegeln".
9. Vertretungsregeln: Vorgehen bei Krankheit – Springer, andere Gruppen, freiwillige Übernahme, Prioritäten.
10. Urlaubslogik: gleichzeitige Urlaube, Sperrzeiten, Ferienregeln, Prioritäten, Gruppenregeln.
11. Zeiterfassung: Einstempeln, Vertrauensarbeitszeit, Genehmigungspflicht für Überstunden, automatischer Pausenabzug.
12. Abschluss: Stelle GENAU diese offene Frage, bevor du zusammenfasst: "Gibt es Besonderheiten oder Regeln, die ich noch nicht abgefragt habe, die ich aber kennen muss, um euren Standort korrekt zu planen?" – die Antwort speicherst du in "besonderheiten". Danach erstellst du eine übersichtliche Zusammenfassung aller erfassten Informationen und fragst, ob alles korrekt ist oder noch etwas ergänzt/korrigiert werden soll.
13. Tagesablauf & Einsatzplanung: Beschreibe den typischen Tagesablauf – welche Aufgaben fallen wann an, welche Gruppen oder Bereiche sind beteiligt, welche Tätigkeiten haben Priorität und müssen immer besetzt sein. Frage: "Wie sieht ein typischer Arbeitstag bei euch aus – von der Frühschicht bis zum Ende des Spätdienstes? Welche Aufgaben gibt es, wann finden sie statt, und welche Gruppen oder Bereiche sind dabei?" Speichere die vollständige Antwort strukturiert in "tagesablauf". Diese Information nutzt die KI später, um jedem Diensteintrag konkrete Aufgabenblöcke (z.B. 07:00–08:30 Morgenkreis, 08:30–09:00 Frühstück) zuzuordnen. Erfinde NIEMALS Aufgaben – trage nur ein, was der Nutzer tatsächlich nennt.

Regeln:
1. Sprich den Nutzer mit "Du" an, freundlich, kompetent, professionell.
2. Stelle pro Nachricht nur ein bis zwei zusammenhängende Fragen, keine Frageblöcke.
3. Rufe bei jeder neuen Information das Tool "update_location_onboarding" auf. Felder, die du dabei aktualisierst, MÜSSEN den vollständigen, aktuellen Stand enthalten (bereits Bekanntes + Neues), niemals nur das Neue. Trage in "completedPhases" alle Phasen-Keys ein, die inhaltlich ausreichend abgedeckt sind (phase1 … phase13). Rufe zusätzlich "upsert_shifts" auf, sobald konkrete, benannte Schichten mit Uhrzeiten genannt werden (siehe Phase 4), und "upsert_planning_rules", sobald konkrete Planungsregeln genannt werden (siehe Phase 5).
4. Antworte IMMER zusätzlich mit einem kurzen Text, auch wenn du das Tool aufrufst.
5. Der Chat darf erst enden bzw. "completed" darf erst auf true gesetzt werden, wenn alle 13 Phasen abgedeckt sind, mindestens eine Schicht über "upsert_shifts" angelegt wurde UND der Nutzer der Abschluss-Zusammenfassung ausdrücklich zugestimmt hat. Das System lehnt einen Abschluss ohne mindestens eine angelegte Schicht automatisch ab – frage in diesem Fall aktiv nach konkreten Schichten, statt "completed" zu setzen.
6. Falls der Nutzer bereits abgeschlossene Angaben später ändert ("Lernfähigkeit", z.B. "wir eröffnen ab nächstem Monat eine weitere Gruppe" oder "der Frühdienst startet jetzt schon um 06:30 Uhr"), erkenne das und aktualisiere die betroffenen Felder bzw. Schichten, ohne von vorne zu beginnen.
7. Erfinde niemals Angaben, die nicht genannt wurden.
8. Schreibe ausschließlich auf Deutsch.`

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const ORG_TOOL = {
  name: 'update_organization_onboarding',
  description: 'Speichert die unternehmensweiten Onboarding-Angaben. Immer den vollständigen, aktuellen Stand je Feld angeben.',
  input_schema: {
    type: 'object' as const,
    properties: {
      traegerName: { type: 'string' },
      rollenmodell: { type: 'string' },
      rollen: { type: 'array', items: { type: 'string' }, description: 'Vollständige, aktuelle Liste aller Job-Rollen im Unternehmen, z.B. ["Erzieher", "Hauswirtschaft"]' },
      unternehmensweiteRegeln: { type: 'string' },
      completed: { type: 'boolean', description: 'true nur nach ausdrücklicher Bestätigung durch den Nutzer' },
    },
  },
}

const LOCATION_TOOL = {
  name: 'update_location_onboarding',
  description: 'Speichert die Onboarding-Angaben dieses Standorts. Immer den vollständigen, aktuellen Stand je Feld angeben (kumulativ, nicht nur das Neue).',
  input_schema: {
    type: 'object' as const,
    properties: {
      einrichtungsart: { type: 'string' },
      organisationsstruktur: { type: 'string' },
      personalstruktur: { type: 'string' },
      arbeitszeiten: { type: 'string' },
      dienstplanlogik: { type: 'string' },
      pausenlogik: { type: 'string' },
      wiederkehrendeAufgaben: { type: 'string' },
      individuelleRegeln: { type: 'array', items: { type: 'string' } },
      vertretungsregeln: { type: 'string' },
      urlaubslogik: { type: 'string' },
      zeiterfassung: { type: 'string' },
      besonderheiten: { type: 'string' },
      tagesablauf: { type: 'string', description: 'Typischer Tagesablauf des Standorts: welche Aufgaben fallen wann an, welche Gruppen/Bereiche sind beteiligt, Prioritäten. Wird von der KI genutzt, um jedem Diensteintrag konkrete Aufgabenblöcke zuzuordnen.' },
      completedPhases: { type: 'array', items: { type: 'string', enum: ONBOARDING_PHASES.map(p => p.key) } },
      completed: { type: 'boolean', description: 'true nur nach ausdrücklicher Bestätigung der Abschluss-Zusammenfassung durch den Nutzer' },
    },
  },
}

const SHIFTS_TOOL = {
  name: 'upsert_shifts',
  description: 'Legt benannte Dienstplan-Schichten dieses Standorts als echte Systemdaten an bzw. aktualisiert sie. Immer die VOLLSTÄNDIGE, aktuelle Liste aller bisher im Gespräch genannten benannten Schichten übergeben (kumulativ, nicht nur die neue/geänderte).',
  input_schema: {
    type: 'object' as const,
    properties: {
      shifts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'z.B. "Frühschicht", "Spätdienst"' },
            type: { type: 'string', enum: ['early', 'mid', 'late', 'night'], description: 'early=Frühschicht, mid=mittig/Kernzeit, late=Spätdienst, night=Nachtdienst' },
            startTime: { type: 'string', description: 'Format HH:MM' },
            endTime: { type: 'string', description: 'Format HH:MM' },
            minStaff: { type: 'number', description: 'Mindestbesetzung, falls genannt' },
          },
          required: ['name', 'type', 'startTime', 'endTime'],
        },
      },
    },
    required: ['shifts'],
  },
}

const PLANNING_RULES_TOOL = {
  name: 'upsert_planning_rules',
  description: 'Speichert die Dienstplan-Regeln (Rotation, Ruhezeiten, Wochenstunden, Wunschberücksichtigung, Stundenausgleich) dieses Standorts als echte Systemkonfiguration, die bei jeder Dienstplanerstellung automatisch angewendet wird. Nur tatsächlich genannte Felder übergeben; nicht genannte Felder bleiben unverändert.',
  input_schema: {
    type: 'object' as const,
    properties: {
      maxWeeklyHours: { type: 'number', description: 'Maximale Wochenstunden pro Mitarbeiter' },
      restHours: { type: 'number', description: 'Mindestruhezeit zwischen zwei Diensten in Stunden' },
      maxConsecutiveDays: { type: 'number', description: 'Maximale Anzahl aufeinanderfolgender Arbeitstage' },
      fridayLateMax: { type: 'number', description: 'Maximale Anzahl Spätdienste am Freitag pro Mitarbeiter im Monat' },
      mondayEarlyMax: { type: 'number', description: 'Maximale Anzahl Frühdienste am Montag pro Mitarbeiter im Monat' },
      fridayEarlyMax: { type: 'number', description: 'Maximale Anzahl Frühdienste am Freitag pro Mitarbeiter im Monat' },
      weekendMax: { type: 'number', description: 'Maximale Anzahl Wochenenddienste pro Mitarbeiter im Monat' },
      considerWishes: { type: 'boolean', description: 'Sollen Wunschdienste bei der Planung berücksichtigt werden?' },
      balanceHoursAccount: { type: 'boolean', description: 'Soll ein Stundenkonto zum Ausgleich von Mehr-/Minderstunden geführt werden?' },
    },
  },
}

const PLANNING_UNITS_TOOL = {
  name: 'upsert_planning_units',
  description: 'Legt benannte Planungseinheiten dieses Standorts als echte Systemdaten an bzw. aktualisiert sie. Rufe dieses Tool auf, sobald der Nutzer konkrete Namen für Gruppen, Bereiche, Objekte, Touren, Fahrzeuge, Maschinen, Räume, Stationen o.ä. nennt. Immer die VOLLSTÄNDIGE, aktuelle Liste aller bisher genannten Einheiten übergeben (kumulativ). Erfinde niemals Einheitennamen – nur tatsächlich genannte.',
  input_schema: {
    type: 'object' as const,
    properties: {
      units: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'z.B. "Gruppe Sonnenschein", "Objekt Musterstraße 12", "Tour A"' },
            type: { type: 'string', enum: ['gruppe', 'bereich', 'objekt', 'tour', 'fahrzeug', 'maschine', 'raum', 'station', 'aufgabenblock', 'sonstiges'], description: 'Art der Planungseinheit' },
            description: { type: 'string', description: 'Optionale Beschreibung' },
            capacity: { type: 'number', description: 'Kapazität / Belegungsgröße, falls genannt' },
            address: { type: 'string', description: 'Adresse (z.B. bei Reinigungsobjekten), falls genannt' },
            notes: { type: 'string', description: 'Sonstige Hinweise zur Einheit' },
          },
          required: ['name', 'type'],
        },
      },
    },
    required: ['units'],
  },
}

const SHIFT_TYPE_DEFAULTS: Record<ShiftType, { color: string; bgColor: string }> = {
  early: { color: '#0E6B6F', bgColor: '#E5FAFA' },
  mid: { color: '#C89C5B', bgColor: '#F8EFE2' },
  late: { color: '#3A3F42', bgColor: '#E8ECEF' },
  night: { color: '#26292B', bgColor: '#C9D0D4' },
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' }, { status: 500 })
  }

  let body: { scope?: string; messages?: ChatMessage[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { scope, messages } = body
  if (!scope || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'scope und messages sind erforderlich' }, { status: 400 })
  }
  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Mandant für diesen Nutzer hinterlegt' }, { status: 400 })
  }

  const isOrganization = scope === 'organization'

  if (session.role === 'admin') {
    if (isOrganization) {
      return NextResponse.json({ error: 'Keine Berechtigung für das Unternehmens-Onboarding' }, { status: 403 })
    }
    const ownLocationId = await resolveLocationId(session)
    if (!ownLocationId || ownLocationId !== scope) {
      return NextResponse.json({ error: 'Keine Berechtigung für diesen Standort' }, { status: 403 })
    }
  }

  try {
    let stateNote: string
    let systemPrompt: string
    let tools: (typeof ORG_TOOL | typeof LOCATION_TOOL | typeof SHIFTS_TOOL | typeof PLANNING_RULES_TOOL | typeof PLANNING_UNITS_TOOL)[]
    let existingPausenlogik: string | null = null
    let existingIndividuelleRegeln: string[] = []

    if (isOrganization) {
      const [existing, customer] = await Promise.all([
        prisma.organizationOnboarding.findUnique({ where: { customerId } }),
        prisma.customer.findUnique({ where: { id: customerId }, select: { roles: true } }),
      ])
      stateNote = `## Bereits bekannte unternehmensweite Angaben\n${JSON.stringify({
        traegerName: existing?.traegerName ?? null,
        rollenmodell: existing?.rollenmodell ?? null,
        rollen: customer?.roles ?? [],
        unternehmensweiteRegeln: existing?.unternehmensweiteRegeln ?? null,
        completed: existing?.completed ?? false,
      }, null, 2)}\n\nBaue darauf auf, frage nicht erneut nach bereits Bekanntem. Dieses Gespräch kann jederzeit erneut geführt werden, auch wenn "completed" bereits true ist – behandle spätere Ergänzungen/Änderungen dann gemäß Regel 6.`
      systemPrompt = ORGANIZATION_SYSTEM_PROMPT
      tools = [ORG_TOOL]
    } else {
      const allLocations = await listLocations(customerId)
      const location = allLocations.find(l => l.id === scope)
      if (!location) {
        return NextResponse.json({ error: 'Unbekannter Standort' }, { status: 404 })
      }
      const [existing, existingShifts, planningRules, existingPlanningUnits] = await Promise.all([
        prisma.locationOnboarding.findUnique({ where: { locationId: scope } }),
        listShiftsByLocation(scope),
        getPlanningRules(scope),
        listPlanningUnitsByLocation(scope),
      ])
      existingPausenlogik = existing?.pausenlogik ?? null
      existingIndividuelleRegeln = existing?.individuelleRegeln ?? []
      stateNote = `## Standort\nName: ${location.name} (${location.city})\n\n## Bereits bekannte Angaben zu diesem Standort\n${JSON.stringify({
        einrichtungsart: existing?.einrichtungsart ?? null,
        organisationsstruktur: existing?.organisationsstruktur ?? null,
        personalstruktur: existing?.personalstruktur ?? null,
        arbeitszeiten: existing?.arbeitszeiten ?? null,
        dienstplanlogik: existing?.dienstplanlogik ?? null,
        pausenlogik: existing?.pausenlogik ?? null,
        wiederkehrendeAufgaben: existing?.wiederkehrendeAufgaben ?? null,
        individuelleRegeln: existing?.individuelleRegeln ?? [],
        vertretungsregeln: existing?.vertretungsregeln ?? null,
        urlaubslogik: existing?.urlaubslogik ?? null,
        zeiterfassung: existing?.zeiterfassung ?? null,
        besonderheiten: existing?.besonderheiten ?? null,
        tagesablauf: existing?.tagesablauf ?? null,
        completedPhases: existing?.completedPhases ?? [],
        completed: existing?.completed ?? false,
        bereitsAngelegteSchichten: existingShifts.map(s => ({ name: s.name, type: s.type, startTime: s.startTime, endTime: s.endTime, minStaff: s.minStaff })),
        planungsregeln: planningRules,
        bereitsAngelegtePlanungseinheiten: existingPlanningUnits.map(u => ({ name: u.name, type: u.type, description: u.description })),
      }, null, 2)}\n\nBaue darauf auf, frage nicht erneut nach bereits Bekanntem. Noch offene Phasen: ${ONBOARDING_PHASES.filter(p => !(existing?.completedPhases ?? []).includes(p.key)).map(p => p.label).join(', ') || 'keine – alle Phasen abgedeckt'}.\n\nWICHTIG: Es sind aktuell ${existingShifts.length} Schicht(en) im System angelegt. ${existingShifts.length === 0 ? 'Phase 4 ist damit NICHT abgeschlossen – frage aktiv nach mindestens einer konkreten, benannten Schicht mit Uhrzeiten und rufe "upsert_shifts" auf, bevor du den Abschluss vorschlägst. Das System lehnt "completed: true" ohne mindestens eine Schicht automatisch ab.' : 'Phase 4 kann als abgedeckt gelten.'}\n\nPlanungseinheiten: Sobald der Nutzer konkrete Namen für Gruppen, Bereiche, Objekte, Touren, Fahrzeuge, Maschinen, Räume oder Stationen nennt, rufe IMMER ZUSÄTZLICH "upsert_planning_units" auf. Erfinde NIEMALS eigene Einheitennamen. Es sind aktuell ${existingPlanningUnits.length} Planungseinheit(en) im System angelegt.`
      systemPrompt = LOCATION_SYSTEM_PROMPT
      tools = [LOCATION_TOOL, SHIFTS_TOOL, PLANNING_RULES_TOOL, PLANNING_UNITS_TOOL]
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1536,
      system: [
        { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: stateNote },
      ],
      tools,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    let reply = ''
    let savedState: unknown = null
    for (const block of response.content) {
      if (block.type === 'text') reply += block.text
      if (block.type === 'tool_use' && (block.name === 'update_organization_onboarding' || block.name === 'update_location_onboarding')) {
        const input = block.input as Record<string, unknown>
        if (isOrganization) {
          savedState = await upsertOrganizationOnboarding(customerId, {
            traegerName: typeof input.traegerName === 'string' ? input.traegerName : undefined,
            rollenmodell: typeof input.rollenmodell === 'string' ? input.rollenmodell : undefined,
            unternehmensweiteRegeln: typeof input.unternehmensweiteRegeln === 'string' ? input.unternehmensweiteRegeln : undefined,
            completed: typeof input.completed === 'boolean' ? input.completed : undefined,
          })
          if (Array.isArray(input.rollen)) {
            const rollen = (input.rollen as unknown[]).filter((r): r is string => typeof r === 'string' && r.trim().length > 0).map(r => r.trim())
            const deduped = Array.from(new Map(rollen.map(r => [r.toLowerCase(), r])).values())
            await prisma.customer.update({ where: { id: customerId }, data: { roles: deduped } })
          }
        } else {
          let nextIndividuelleRegeln: string[] | undefined
          if (Array.isArray(input.individuelleRegeln)) {
            const incoming = (input.individuelleRegeln as unknown[]).filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
            const merged = [...existingIndividuelleRegeln]
            for (const rule of incoming) {
              if (!merged.some(r => r.trim().toLowerCase() === rule.trim().toLowerCase())) merged.push(rule)
            }
            nextIndividuelleRegeln = incoming.length >= existingIndividuelleRegeln.length ? incoming : merged
            existingIndividuelleRegeln = nextIndividuelleRegeln
          }
          savedState = await upsertLocationOnboarding(scope, {
            einrichtungsart: typeof input.einrichtungsart === 'string' ? input.einrichtungsart : undefined,
            organisationsstruktur: typeof input.organisationsstruktur === 'string' ? input.organisationsstruktur : undefined,
            personalstruktur: typeof input.personalstruktur === 'string' ? input.personalstruktur : undefined,
            arbeitszeiten: typeof input.arbeitszeiten === 'string' ? input.arbeitszeiten : undefined,
            dienstplanlogik: typeof input.dienstplanlogik === 'string' ? input.dienstplanlogik : undefined,
            pausenlogik: typeof input.pausenlogik === 'string' ? input.pausenlogik : undefined,
            wiederkehrendeAufgaben: typeof input.wiederkehrendeAufgaben === 'string' ? input.wiederkehrendeAufgaben : undefined,
            individuelleRegeln: nextIndividuelleRegeln,
            vertretungsregeln: typeof input.vertretungsregeln === 'string' ? input.vertretungsregeln : undefined,
            urlaubslogik: typeof input.urlaubslogik === 'string' ? input.urlaubslogik : undefined,
            zeiterfassung: typeof input.zeiterfassung === 'string' ? input.zeiterfassung : undefined,
            besonderheiten: typeof input.besonderheiten === 'string' ? input.besonderheiten : undefined,
            tagesablauf: typeof input.tagesablauf === 'string' ? input.tagesablauf : undefined,
            completedPhases: Array.isArray(input.completedPhases) ? input.completedPhases as string[] : undefined,
            completed: typeof input.completed === 'boolean' ? input.completed : undefined,
          })
          if (typeof input.pausenlogik === 'string' && input.pausenlogik.trim() !== (existingPausenlogik ?? '').trim()) {
            await resetBreakRulesExtraction(scope)
          }
        }
      }
      if (block.type === 'tool_use' && block.name === 'upsert_shifts' && !isOrganization) {
        const input = block.input as { shifts?: unknown }
        if (Array.isArray(input.shifts)) {
          const existingShifts = await listShiftsByLocation(scope)
          for (const entry of input.shifts) {
            if (typeof entry !== 'object' || !entry) continue
            const { name, type, startTime, endTime, minStaff } = entry as Record<string, unknown>
            if (typeof name !== 'string' || !name.trim() || typeof startTime !== 'string' || typeof endTime !== 'string') continue
            const shiftType: ShiftType = (['early', 'mid', 'late', 'night'] as const).includes(type as ShiftType) ? type as ShiftType : 'mid'
            const match = existingShifts.find(s => s.name.trim().toLowerCase() === name.trim().toLowerCase())
            if (match) {
              await updateShift(match.id, {
                type: shiftType,
                startTime,
                endTime,
                ...(typeof minStaff === 'number' ? { minStaff } : {}),
              })
            } else {
              const defaults = SHIFT_TYPE_DEFAULTS[shiftType]
              await addShift({
                name: name.trim(),
                type: shiftType,
                startTime,
                endTime,
                color: defaults.color,
                bgColor: defaults.bgColor,
                minStaff: typeof minStaff === 'number' ? minStaff : 1,
                locationId: scope,
              })
            }
          }
        }
      }
      if (block.type === 'tool_use' && block.name === 'upsert_planning_units' && !isOrganization) {
        const input = block.input as { units?: unknown }
        if (Array.isArray(input.units)) {
          for (const entry of input.units) {
            if (typeof entry !== 'object' || !entry) continue
            const { name, type, description, capacity, address, notes } = entry as Record<string, unknown>
            if (typeof name !== 'string' || !name.trim()) continue
            const unitType = typeof type === 'string' ? type : 'bereich'
            await upsertPlanningUnit(scope, {
              name: name.trim(),
              type: unitType,
              description: typeof description === 'string' ? description : undefined,
              capacity: typeof capacity === 'number' ? capacity : undefined,
              address: typeof address === 'string' ? address : undefined,
              notes: typeof notes === 'string' ? notes : undefined,
            })
          }
        }
      }
      if (block.type === 'tool_use' && block.name === 'upsert_planning_rules' && !isOrganization) {
        const input = block.input as Record<string, unknown>
        const update: Partial<{
          maxWeeklyHours: number
          restHours: number
          maxConsecutiveDays: number
          fridayLateMax: number
          mondayEarlyMax: number
          fridayEarlyMax: number
          weekendMax: number
          considerWishes: boolean
          balanceHoursAccount: boolean
        }> = {}
        for (const key of ['maxWeeklyHours', 'restHours', 'maxConsecutiveDays', 'fridayLateMax', 'mondayEarlyMax', 'fridayEarlyMax', 'weekendMax'] as const) {
          if (typeof input[key] === 'number') update[key] = input[key] as number
        }
        for (const key of ['considerWishes', 'balanceHoursAccount'] as const) {
          if (typeof input[key] === 'boolean') update[key] = input[key] as boolean
        }
        if (Object.keys(update).length > 0) {
          await upsertPlanningRules(scope, update)
        }
      }
    }

    if (!isOrganization) {
      const [shiftCount, latestOnboarding] = await Promise.all([
        prisma.shift.count({ where: { locationId: scope } }),
        prisma.locationOnboarding.findUnique({ where: { locationId: scope } }),
      ])
      const wasMarkedDone = latestOnboarding && (latestOnboarding.completed || latestOnboarding.completedPhases.includes('phase4'))
      if (shiftCount === 0 && wasMarkedDone) {
        savedState = await upsertLocationOnboarding(scope, {
          completedPhases: latestOnboarding!.completedPhases.filter(p => p !== 'phase4'),
          completed: false,
        })
        reply += '\n\nEin Hinweis: Bevor der Standort abgeschlossen werden kann, brauche ich noch mindestens eine konkrete, benannte Schicht mit Uhrzeiten (z.B. "Frühschicht von 07:00 bis 14:00 Uhr") – ohne diese Information kann das System noch keinen Dienstplan erstellen. Welche Schichten gibt es bei euch?'
      }
    }

    if (!reply.trim()) {
      reply = 'Danke, das habe ich gespeichert!'
    }

    return NextResponse.json({ reply, state: savedState })
  } catch (err: unknown) {
    console.error('onboarding-chat', err)
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
