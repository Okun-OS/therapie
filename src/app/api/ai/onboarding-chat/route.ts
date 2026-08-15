import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { upsertOrganizationOnboarding, upsertLocationOnboarding, ONBOARDING_PHASES } from '@/lib/onboarding-service'
import { listLocations } from '@/lib/entities'
import { listShiftsByLocation, addShift, updateShift, getPlanningRules, upsertPlanningRules, listPlanningUnitsByLocation, upsertPlanningUnit } from '@/lib/schedule-entities'
import { resetBreakRulesExtraction } from '@/lib/break-rules-service'
import { requireRole, resolveCustomerId, resolveLocationId } from '@/lib/session'
import { generateCompanyModelFromOnboarding, generateLocationModelFromOnboarding } from '@/lib/company-model-service'
import type { ShiftType } from '@/lib/types'
import {
  WORKFLOW_STATUS_TOOL,
  SUPERVISOR_SYSTEM_SUFFIX,
  extractWorkflowStatus,
  superviseTurn,
  saveDiscoveredRequirements,
  resolveCurrentPhase,
  getWorkflow,
} from '@/lib/workflow-engine'

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
8. Schreibe ausschließlich auf Deutsch.
9. GESPRÄCHSFÜHRUNG – PFLICHTSTRUKTUR jeder Antwort: (1) Kurze Bestätigung was du verstanden hast. (2) Tool-Aufruf zum Speichern. (3) SOFORT die nächste konkrete Frage oder der nächste klare Schritt. — Sätze wie "Okay, das notiere ich mir.", "Perfekt, gespeichert!", "Alles klar!" ALLEIN (ohne direkte Folgefrage) sind ABSOLUT VERBOTEN. Eine Antwort ohne abschließende Frage oder konkreten nächsten Schritt ist NICHT AKZEPTABEL. Brich niemals mitten in einem Gedanken ab. Das Gespräch endet erst nach ausdrücklicher Abschlussbestätigung des Nutzers.`

const LOCATION_SYSTEM_PROMPT = `Du bist ein erfahrener Standortberater, der einen einzelnen Standort bei der Konfiguration von OKUN Workforce begleitet (Ebene 2 von 2: Standort-Onboarding).

Der erste Kontakt soll sich anfühlen, als würde der Nutzer mit einem erfahrenen Berater sprechen – kein klassisches Formular. Der Nutzer antwortet frei in natürlicher Sprache. Du erkennst Zusammenhänge, speicherst strukturierte Informationen und stellst automatisch Rückfragen, wenn Informationen fehlen oder widersprüchlich sind. Der Chat endet erst, wenn alle notwendigen Informationen vollständig erfasst sind.

Du darfst niemals einfach nur Fragen abarbeiten – führe ein echtes Gespräch und kombiniere thematisch zusammenhängende Fragen natürlich.

Die 13 Phasen, die du im Laufe des Gesprächs abdecken musst (du darfst die Reihenfolge an das Gespräch anpassen):
1. Standort verstehen: Art des Standorts (Kita, Wohngruppe, Pflege, Jugendhilfe, Behindertenhilfe, ambulante Dienste, ...).
2. Organisationsstruktur: Gruppen, Bereiche, Teams, Abteilungen, Wohnbereiche, Funktionsräume.
3. Mitarbeiterstruktur: Rollen wie Leitung, Teamleitung, Springer, Auszubildende, Praktikanten, Verwaltung.
4. Arbeitszeiten: Öffnungszeiten, Dienstmodelle (Früh/Spät/Nacht/24h), Bereitschaft, Wochenenden, Feiertage. Frage aktiv nach konkreten, benannten Schichten MIT Uhrzeiten (z.B. "Frühdienst 07:00–14:00") und halte sie wortgetreu im Feld "arbeitszeiten" fest — angelegt werden Schichten später vom Menschen im Einrichtungs-Wizard, auf Basis genau dieser Angaben.
5. Dienstplanlogik: Mindestbesetzung, benötigte Qualifikationen, gesetzliche Vorgaben, feste/flexible Schichtmodelle. Halte alle genannten Zahlen und Regeln wortgetreu in "dienstplanlogik" bzw. "individuelleRegeln" fest — sie werden später im Einrichtungs-Wizard als geprüfte Vorschläge übernommen.
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
3. Rufe bei jeder neuen Information das Tool "update_location_onboarding" auf. Felder, die du dabei aktualisierst, MÜSSEN den vollständigen, aktuellen Stand enthalten (bereits Bekanntes + Neues), niemals nur das Neue. Trage in "completedPhases" alle Phasen-Keys ein, die inhaltlich ausreichend abgedeckt sind (phase1 … phase13).
4. Antworte IMMER zusätzlich mit einem kurzen Text, auch wenn du das Tool aufrufst.
5. Der Chat darf erst enden bzw. "completed" darf erst auf true gesetzt werden, wenn alle 13 Phasen abgedeckt sind UND der Nutzer der Abschluss-Zusammenfassung ausdrücklich zugestimmt hat. Weise am Ende darauf hin, dass die Einrichtung (Schichten, Gruppen, Regeln) im Einrichtungs-Wizard unter "Einstellungen → Einrichtung" mit einem Klick aus diesen Angaben vorgeschlagen und übernommen wird.
6. Falls der Nutzer bereits abgeschlossene Angaben später ändert ("Lernfähigkeit", z.B. "wir eröffnen ab nächstem Monat eine weitere Gruppe" oder "der Frühdienst startet jetzt schon um 06:30 Uhr"), erkenne das und aktualisiere die betroffenen Felder bzw. Schichten, ohne von vorne zu beginnen.
7. Erfinde niemals Angaben, die nicht genannt wurden.
8. Schreibe ausschließlich auf Deutsch.
9. GESPRÄCHSFÜHRUNG – PFLICHTSTRUKTUR jeder Antwort: (1) Kurze Bestätigung was du verstanden hast. (2) Tool-Aufruf zum Speichern. (3) SOFORT die nächste konkrete Frage oder der nächste klare Schritt. — Sätze wie "Okay, das notiere ich mir.", "Perfekt, gespeichert!", "Alles klar!" ALLEIN (ohne direkte Folgefrage) sind ABSOLUT VERBOTEN. Eine Antwort ohne abschließende Frage oder konkreten nächsten Schritt ist NICHT AKZEPTABEL. Zeige den aktuellen Fortschritt (z.B. "Wir sind jetzt bei Phase 3 von 5 – Rollenmodell."). Das Gespräch endet erst nach ausdrücklicher Abschlussbestätigung des Nutzers.`

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
  description: 'Legt benannte Planungseinheiten dieses Standorts als echte Systemdaten an bzw. aktualisiert sie. Rufe dieses Tool auf, sobald der Nutzer konkrete Namen für Gruppen, Etagen/Stockwerke, Bereiche, Objekte, Touren, Fahrzeuge, Maschinen, Räume, Stationen o.ä. nennt. WICHTIG bei mehrstöckigen Einrichtungen (z.B. Kita mit Etagen): Etagen als eigene Einheiten mit type "etage" anlegen und bei jeder Gruppe über "parent" den Etagennamen angeben — der Dienstplan-Solver besetzt dann jede Gruppe täglich und jede Etage mit Früh-/Spätdienst. Bei Gruppen zusätzlich minStaff (Mindestbesetzung pro Tag) erfragen und setzen. Immer die VOLLSTÄNDIGE, aktuelle Liste aller bisher genannten Einheiten übergeben (kumulativ), Etagen VOR ihren Gruppen. Erfinde niemals Einheitennamen – nur tatsächlich genannte.',
  input_schema: {
    type: 'object' as const,
    properties: {
      units: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'z.B. "Igelgruppe", "Erdgeschoss", "Objekt Musterstraße 12", "Tour A"' },
            type: { type: 'string', enum: ['gruppe', 'etage', 'bereich', 'objekt', 'tour', 'fahrzeug', 'maschine', 'raum', 'station', 'aufgabenblock', 'sonstiges'], description: 'Art der Planungseinheit. "etage" für Stockwerke/Ebenen, die Gruppen enthalten.' },
            parent: { type: 'string', description: 'Name der übergeordneten Etage/Ebene (nur bei Gruppen in mehrstöckigen Einrichtungen), z.B. "Erdgeschoss"' },
            minStaff: { type: 'number', description: 'Mindestbesetzung: bei Gruppen Personen pro Tag, bei Etagen Personen je Früh-/Spätdienst (Standard 1)' },
            description: { type: 'string', description: 'Optionale Beschreibung' },
            capacity: { type: 'number', description: 'Kapazität / Belegungsgröße (z.B. Kinderzahl), falls genannt' },
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
  frei: { color: '#6B7280', bgColor: '#F3F4F6' },
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
    let tools: (typeof ORG_TOOL | typeof LOCATION_TOOL | typeof SHIFTS_TOOL | typeof PLANNING_RULES_TOOL | typeof PLANNING_UNITS_TOOL | typeof WORKFLOW_STATUS_TOOL)[]
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
      tools = [ORG_TOOL, WORKFLOW_STATUS_TOOL]
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
      }, null, 2)}\n\nBaue darauf auf, frage nicht erneut nach bereits Bekanntem. Noch offene Phasen: ${ONBOARDING_PHASES.filter(p => !(existing?.completedPhases ?? []).includes(p.key)).map(p => p.label).join(', ') || 'keine – alle Phasen abgedeckt'}.\n\nZur Info (nur Kontext, du legst selbst NICHTS an): ${existingShifts.length} Schicht(en) und ${existingPlanningUnits.length} Planungseinheit(en) sind bereits im System konfiguriert.`
      systemPrompt = LOCATION_SYSTEM_PROMPT
      tools = [LOCATION_TOOL, WORKFLOW_STATUS_TOOL]
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1536,
      system: [
        { type: 'text', text: systemPrompt + SUPERVISOR_SYSTEM_SUFFIX, cache_control: { type: 'ephemeral' } },
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
          const isNowCompleted = input.completed === true
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
          if (isNowCompleted && customerId && isOrganization) {
              generateCompanyModelFromOnboarding(customerId).catch(err =>
                console.error('CompanyModel-Generierung nach Onboarding fehlgeschlagen:', err)
              )
          }
          if (typeof input.pausenlogik === 'string' && input.pausenlogik.trim() !== (existingPausenlogik ?? '').trim()) {
            await resetBreakRulesExtraction(scope)
          }
        }
      }
    }


    if (!reply.trim()) {
      reply = 'Danke, das habe ich gespeichert!'
    }

    // ── Workflow Engine: Supervisor pass ──────────────────────────────────────
    const workflowId = isOrganization ? 'org-onboarding' : 'location-onboarding'
    const workflowDef = getWorkflow(workflowId)
    const workflowStatus = extractWorkflowStatus(
      response.content as Array<{ type: string; name?: string; input?: unknown }>,
    )
    if (workflowDef) {
      let collectedData: Record<string, unknown>
      if (isOrganization) {
        const s = savedState as Record<string, unknown> | null
        collectedData = {
          traegerName: s?.traegerName ?? null,
          rollenmodell: s?.rollenmodell ?? null,
          unternehmensweiteRegeln: s?.unternehmensweiteRegeln ?? null,
          completed: s?.completed ?? false,
        }
      } else {
        const s = savedState as Record<string, unknown> | null
        const shiftCountFinal = await prisma.shift.count({ where: { locationId: scope } })
        collectedData = {
          completedPhases: (s?.completedPhases as string[] | undefined) ?? [],
          completed: s?.completed ?? false,
          _shiftCount: shiftCountFinal,
        }
      }
      const currentPhase = resolveCurrentPhase(workflowDef.phases, collectedData)
      const supervised = superviseTurn(reply, workflowStatus, currentPhase, collectedData)
      reply = supervised.supervisedReply
      if (workflowStatus?.discoveredRequirements?.length) {
        saveDiscoveredRequirements(workflowStatus.discoveredRequirements, {
          workflowId,
          customerId: customerId ?? undefined,
          locationId: isOrganization ? undefined : scope,
        }).catch(err => console.error('WorkflowLearning save failed:', err))
      }
    }

    // Persist full chat history so the UI can resume the conversation
    try {
      const fullMessages = [...messages, { role: 'assistant' as const, content: reply }]
      if (isOrganization) {
        if (customerId) {
          await prisma.organizationOnboarding.upsert({
            where: { customerId },
            create: { customerId, chatMessages: fullMessages as unknown as import('@prisma/client').Prisma.JsonArray },
            update: { chatMessages: fullMessages as unknown as import('@prisma/client').Prisma.JsonArray },
          })
        }
      } else {
        await prisma.locationOnboarding.upsert({
          where: { locationId: scope },
          create: { locationId: scope, chatMessages: fullMessages as unknown as import('@prisma/client').Prisma.JsonArray },
          update: { chatMessages: fullMessages as unknown as import('@prisma/client').Prisma.JsonArray },
        })
      }
    } catch (saveErr) {
      console.error('onboarding-chat: failed to save chat history', saveErr)
    }

    return NextResponse.json({ reply, state: savedState })
  } catch (err: unknown) {
    console.error('onboarding-chat', err)
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
