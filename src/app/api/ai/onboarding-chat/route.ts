import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { upsertOrganizationOnboarding, upsertLocationOnboarding, ONBOARDING_PHASES } from '@/lib/onboarding-service'
import { listLocations } from '@/lib/entities'
import { requireRole } from '@/lib/session'

const client = new Anthropic()

const ORGANIZATION_SYSTEM_PROMPT = `Du bist ein erfahrener Organisationsberater, der einen neuen Träger bei der Einrichtung von Open Workforce begleitet (Ebene 1 von 2: Träger-Onboarding).

Es gibt KEIN klassisches Formular. Du führst ein echtes, natürliches Gespräch. Der Nutzer antwortet frei, du erkennst daraus die Informationen, fasst zusammen und stellst gezielt Rückfragen, wenn etwas fehlt oder unklar ist.

Zu erfassen (trägerweit, gilt für alle Einrichtungen gemeinsam):
1. Trägername
2. Standorte/Einrichtungen, die zum Träger gehören
3. Rollenmodell (z.B. Geschäftsführung, Einrichtungsleitungen, Teamleitungen, Verwaltung)
4. Unternehmensweite Regeln/Prozesse, die für alle Einrichtungen gelten

WICHTIG: Jede einzelne Einrichtung erhält anschließend ihr EIGENES, separates Onboarding (Ebene 2). Das System darf niemals einfach die Regeln einer Einrichtung auf eine andere kopieren – das hier ist ausschließlich der trägerweite, gemeinsame Rahmen.

Regeln:
1. Sprich den Nutzer mit "Du" an, freundlich und professionell, wie ein erfahrener Berater im ersten Gespräch.
2. Stelle pro Nachricht höchstens ein bis zwei zusammenhängende Fragen, keine langen Listen.
3. Rufe bei jeder neuen Information das Tool "update_organization_onboarding" auf, mit dem VOLLSTÄNDIGEN, aktuellen Stand (bereits bekannte + neue Angaben), niemals nur das Neue.
4. Antworte IMMER zusätzlich mit einem kurzen Text, auch wenn du das Tool aufrufst.
5. Wenn alle vier Punkte klar erfasst sind, fasse kurz zusammen und setze "completed" im Tool-Aufruf auf true – aber nur, wenn der Nutzer der Zusammenfassung zustimmt.
6. Erfinde niemals Angaben.
7. Schreibe ausschließlich auf Deutsch.`

const LOCATION_SYSTEM_PROMPT = `Du bist ein erfahrener Einrichtungsberater, der eine einzelne Einrichtung (Standort) bei der Konfiguration von Open Workforce begleitet (Ebene 2 von 2: Einrichtungs-Onboarding).

Der erste Kontakt soll sich anfühlen, als würde der Nutzer mit einem erfahrenen Berater sprechen – kein klassisches Formular. Der Nutzer antwortet frei in natürlicher Sprache. Du erkennst Zusammenhänge, speicherst strukturierte Informationen und stellst automatisch Rückfragen, wenn Informationen fehlen oder widersprüchlich sind. Der Chat endet erst, wenn alle notwendigen Informationen vollständig erfasst sind.

Du darfst niemals einfach nur Fragen abarbeiten – führe ein echtes Gespräch und kombiniere thematisch zusammenhängende Fragen natürlich.

Die 12 Phasen, die du im Laufe des Gesprächs abdecken musst (du darfst die Reihenfolge an das Gespräch anpassen):
1. Einrichtung verstehen: Art der Einrichtung (Kita, Wohngruppe, Pflege, Jugendhilfe, Behindertenhilfe, ambulante Dienste, ...).
2. Organisationsstruktur: Gruppen, Bereiche, Teams, Abteilungen, Wohnbereiche, Funktionsräume.
3. Mitarbeiterstruktur: Rollen wie Leitung, Teamleitung, Springer, Auszubildende, Praktikanten, Verwaltung.
4. Arbeitszeiten: Öffnungszeiten, Dienstmodelle (Früh/Spät/Nacht/24h), Bereitschaft, Wochenenden, Feiertage.
5. Dienstplanlogik: Mindestbesetzung, benötigte Qualifikationen, gesetzliche Vorgaben, feste/flexible Schichtmodelle.
6. Pausenlogik: automatisch geplant oder selbst verwaltet, Dauer, früheste/späteste Lage, feste Regeln.
7. Wiederkehrende Aufgaben: z.B. Bürozeit, Dokumentation, Teamsitzung, Elterngespräche, Übergaben.
8. Individuelle Regeln: freie Beschreibung von Besonderheiten (z.B. "Gruppe Rot braucht morgens zwei Fachkräfte"). Speichere jede Regel als eigenen, klar formulierten Satz in "individuelleRegeln".
9. Vertretungsregeln: Vorgehen bei Krankheit – Springer, andere Gruppen, freiwillige Übernahme, Prioritäten.
10. Urlaubslogik: gleichzeitige Urlaube, Sperrzeiten, Ferienregeln, Prioritäten, Gruppenregeln.
11. Zeiterfassung: Einstempeln, Vertrauensarbeitszeit, Genehmigungspflicht für Überstunden, automatischer Pausenabzug.
12. Abschluss: Stelle GENAU diese offene Frage, bevor du zusammenfasst: "Gibt es Besonderheiten oder Regeln, die ich noch nicht abgefragt habe, die ich aber kennen muss, um eure Einrichtung korrekt zu planen?" – die Antwort speicherst du in "besonderheiten". Danach erstellst du eine übersichtliche Zusammenfassung aller erfassten Informationen und fragst, ob alles korrekt ist oder noch etwas ergänzt/korrigiert werden soll.

Regeln:
1. Sprich den Nutzer mit "Du" an, freundlich, kompetent, professionell.
2. Stelle pro Nachricht nur ein bis zwei zusammenhängende Fragen, keine Frageblöcke.
3. Rufe bei jeder neuen Information das Tool "update_location_onboarding" auf. Felder, die du dabei aktualisierst, MÜSSEN den vollständigen, aktuellen Stand enthalten (bereits Bekanntes + Neues), niemals nur das Neue. Trage in "completedPhases" alle Phasen-Keys ein, die inhaltlich ausreichend abgedeckt sind (phase1 … phase12).
4. Antworte IMMER zusätzlich mit einem kurzen Text, auch wenn du das Tool aufrufst.
5. Der Chat darf erst enden bzw. "completed" darf erst auf true gesetzt werden, wenn alle 12 Phasen abgedeckt sind UND der Nutzer der Abschluss-Zusammenfassung ausdrücklich zugestimmt hat.
6. Falls der Nutzer bereits abgeschlossene Angaben später ändert ("Lernfähigkeit", z.B. "wir eröffnen ab nächstem Monat eine weitere Gruppe"), erkenne das und aktualisiere die betroffenen Felder, ohne von vorne zu beginnen.
7. Erfinde niemals Angaben, die nicht genannt wurden.
8. Schreibe ausschließlich auf Deutsch.`

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const ORG_TOOL = {
  name: 'update_organization_onboarding',
  description: 'Speichert die trägerweiten Onboarding-Angaben. Immer den vollständigen, aktuellen Stand je Feld angeben.',
  input_schema: {
    type: 'object' as const,
    properties: {
      traegerName: { type: 'string' },
      rollenmodell: { type: 'string' },
      unternehmensweiteRegeln: { type: 'string' },
      completed: { type: 'boolean', description: 'true nur nach ausdrücklicher Bestätigung durch den Nutzer' },
    },
  },
}

const LOCATION_TOOL = {
  name: 'update_location_onboarding',
  description: 'Speichert die Onboarding-Angaben dieser Einrichtung. Immer den vollständigen, aktuellen Stand je Feld angeben (kumulativ, nicht nur das Neue).',
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
      completedPhases: { type: 'array', items: { type: 'string', enum: ONBOARDING_PHASES.map(p => p.key) } },
      completed: { type: 'boolean', description: 'true nur nach ausdrücklicher Bestätigung der Abschluss-Zusammenfassung durch den Nutzer' },
    },
  },
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['company', 'okun'])
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
  if (!session.customerId) {
    return NextResponse.json({ error: 'Kein Mandant für diesen Nutzer hinterlegt' }, { status: 400 })
  }
  const customerId = session.customerId

  const isOrganization = scope === 'organization'

  try {
    let stateNote: string
    let systemPrompt: string
    let tool: typeof ORG_TOOL | typeof LOCATION_TOOL

    if (isOrganization) {
      const existing = await prisma.organizationOnboarding.findUnique({ where: { customerId } })
      stateNote = `## Bereits bekannte trägerweite Angaben\n${JSON.stringify({
        traegerName: existing?.traegerName ?? null,
        rollenmodell: existing?.rollenmodell ?? null,
        unternehmensweiteRegeln: existing?.unternehmensweiteRegeln ?? null,
        completed: existing?.completed ?? false,
      }, null, 2)}\n\nBaue darauf auf, frage nicht erneut nach bereits Bekanntem.`
      systemPrompt = ORGANIZATION_SYSTEM_PROMPT
      tool = ORG_TOOL
    } else {
      const allLocations = await listLocations(customerId)
      const location = allLocations.find(l => l.id === scope)
      if (!location) {
        return NextResponse.json({ error: 'Unbekannte Einrichtung' }, { status: 404 })
      }
      const existing = await prisma.locationOnboarding.findUnique({ where: { locationId: scope } })
      stateNote = `## Einrichtung\nName: ${location.name} (${location.city})\n\n## Bereits bekannte Angaben zu dieser Einrichtung\n${JSON.stringify({
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
        completedPhases: existing?.completedPhases ?? [],
        completed: existing?.completed ?? false,
      }, null, 2)}\n\nBaue darauf auf, frage nicht erneut nach bereits Bekanntem. Noch offene Phasen: ${ONBOARDING_PHASES.filter(p => !(existing?.completedPhases ?? []).includes(p.key)).map(p => p.label).join(', ') || 'keine – alle Phasen abgedeckt'}.`
      systemPrompt = LOCATION_SYSTEM_PROMPT
      tool = LOCATION_TOOL
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1536,
      system: [
        { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: stateNote },
      ],
      tools: [tool],
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
        } else {
          savedState = await upsertLocationOnboarding(scope, {
            einrichtungsart: typeof input.einrichtungsart === 'string' ? input.einrichtungsart : undefined,
            organisationsstruktur: typeof input.organisationsstruktur === 'string' ? input.organisationsstruktur : undefined,
            personalstruktur: typeof input.personalstruktur === 'string' ? input.personalstruktur : undefined,
            arbeitszeiten: typeof input.arbeitszeiten === 'string' ? input.arbeitszeiten : undefined,
            dienstplanlogik: typeof input.dienstplanlogik === 'string' ? input.dienstplanlogik : undefined,
            pausenlogik: typeof input.pausenlogik === 'string' ? input.pausenlogik : undefined,
            wiederkehrendeAufgaben: typeof input.wiederkehrendeAufgaben === 'string' ? input.wiederkehrendeAufgaben : undefined,
            individuelleRegeln: Array.isArray(input.individuelleRegeln) ? input.individuelleRegeln as string[] : undefined,
            vertretungsregeln: typeof input.vertretungsregeln === 'string' ? input.vertretungsregeln : undefined,
            urlaubslogik: typeof input.urlaubslogik === 'string' ? input.urlaubslogik : undefined,
            zeiterfassung: typeof input.zeiterfassung === 'string' ? input.zeiterfassung : undefined,
            besonderheiten: typeof input.besonderheiten === 'string' ? input.besonderheiten : undefined,
            completedPhases: Array.isArray(input.completedPhases) ? input.completedPhases as string[] : undefined,
            completed: typeof input.completed === 'boolean' ? input.completed : undefined,
          })
        }
      }
    }

    if (!reply.trim()) {
      reply = 'Danke, das habe ich gespeichert!'
    }

    return NextResponse.json({ reply, state: savedState })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
