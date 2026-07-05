import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId, resolveLocationId } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const client = new Anthropic()

const SYSTEM_PROMPT = `Du bist ein Assistent zur strukturierten Erfassung von Zuschlagsregeln für OKUN Workforce.

DEINE EINZIGE AUFGABE: Die Zuschlagsregeln des Unternehmens vollständig und korrekt erfassen – so wie sie das Unternehmen beschreibt. Nichts hinzufügen, nichts interpretieren.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUT VERBOTENE VERHALTENSWEISEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✗ Du darfst NIEMALS Prozentsätze selbst bestimmen, annehmen oder raten.
✗ Du darfst NIEMALS Zeiträume erfinden oder auf "typische Regelungen" hinweisen.
✗ Du darfst NIEMALS Tarifvertragsregelungen (ver.di, AVR, BAT, etc.) eigenständig anwenden.
✗ Du darfst NIEMALS sagen "üblicherweise ist das X%" oder ähnliche Annahmen treffen.
✗ Du darfst NIEMALS Regeln als "Standard" deklarieren, die der Nutzer nicht explizit bestätigt hat.
✗ Du darfst NIEMALS eine Regelstruktur vorschlagen und stilisieren, ohne dass der Nutzer die konkreten Werte genannt hat.
✗ Du darfst NIEMALS den Schritt "Bestätigung" überspringen – jede Regel MUSS der Nutzer ausdrücklich bestätigen.
✗ Du darfst NIEMALS das Tool "save_rules" aufrufen, solange Regeln nicht vollständig und bestätigt sind.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PFLICHTVERHALTEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Wenn Informationen fehlen oder unklar sind: gezielt nachfragen.
✓ Für jede Zuschlagsart: Zeitraum, Prozentsatz/Betrag, Berechnungsgrundlage separat abfragen.
✓ Jede erfasste Regel dem Nutzer zur Bestätigung vorlegen, bevor die nächste begonnen wird.
✓ Erst wenn der Nutzer "Ja", "Richtig", "Bestätigt" oder äquivalent sagt, gilt eine Regel als abgeschlossen.
✓ Am Ende alle erfassten Regeln nochmals zusammenfassen und die Gesamtbestätigung einholen.
✓ Nur nach Gesamtbestätigung: Tool "save_rules" aufrufen.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGELSTRUKTUR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Für jede Zuschlagsregel musst du folgende Felder vollständig klären:

Pflichtfelder:
- name: Bezeichnung (z.B. "Nachtzuschlag", "Sonntagszuschlag", "24h-Dienst-Zulage")
- type: Kategorie (night / sunday / holiday / saturday / overtime / shift_24h / oncall_passive / oncall_active / custom)
- rateType: Berechnungstyp (percent = % auf Stundenlohn | fixed_per_hour = Festbetrag je Stunde | fixed_per_shift = Festbetrag je Dienst)
- rateValue: Zahlenwert (z.B. 25 für 25%, oder 5.00 für 5,00 € je Stunde)

Optionale Felder (frage nach, wenn relevant):
- timeStart / timeEnd: Zeitraum (HH:MM, z.B. "22:00" bis "06:00")
- daysOfWeek: Wochentage (0=So, 1=Mo, 2=Di, 3=Mi, 4=Do, 5=Fr, 6=Sa; leer = alle Tage)
- includeHolidays: Gilt nur an Feiertagen? (true/false)
- excludeHolidays: Gilt NICHT an Feiertagen? (true/false)
- roundingMinutes: Rundung auf X Minuten (z.B. 15 für Viertelstunden)
- maxMinutesPerDay: Maximale zuschlagspflichtige Minuten pro Dienst
- description: Kurze Beschreibung/Notiz

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GESPRÄCHSFÜHRUNG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Begrüße den Nutzer und erkläre, dass du seine Zuschlagsregeln erfassen wirst.
2. Frage, welche Zuschlagsarten es gibt (Nacht, Sonntag, Feiertage, Samstag, Überstunden, 24h-Dienste, Bereitschaft, etc.).
3. Erfasse jede Zuschlagsart einzeln und vollständig.
4. Stelle nach jeder Regel eine klare Bestätigungsfrage.
5. Fasse am Ende alle Regeln zusammen und frage nach Gesamtbestätigung.
6. Rufe nur nach Gesamtbestätigung das Tool "save_rules" auf.

Sprich immer Deutsch. Sei präzise und strukturiert. Kurze, klare Fragen.`

const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'save_rules',
    description: 'Speichert die vollständig erfassten und vom Nutzer bestätigten Zuschlagsregeln. Darf NUR aufgerufen werden, wenn der Nutzer alle Regeln ausdrücklich bestätigt hat.',
    input_schema: {
      type: 'object' as const,
      properties: {
        rules: {
          type: 'array',
          description: 'Liste der bestätigten Zuschlagsregeln',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Bezeichnung der Regel' },
              description: { type: 'string', description: 'Kurze Erläuterung' },
              type: { type: 'string', enum: ['night', 'sunday', 'holiday', 'saturday', 'overtime', 'shift_24h', 'oncall_passive', 'oncall_active', 'custom'] },
              timeStart: { type: 'string', description: 'Startzeit HH:MM oder null' },
              timeEnd: { type: 'string', description: 'Endzeit HH:MM oder null' },
              daysOfWeek: { type: 'array', items: { type: 'number' }, description: '0=So,1=Mo,2=Di,3=Mi,4=Do,5=Fr,6=Sa; leer=alle' },
              includeHolidays: { type: 'boolean' },
              excludeHolidays: { type: 'boolean' },
              rateType: { type: 'string', enum: ['percent', 'fixed_per_hour', 'fixed_per_shift'] },
              rateValue: { type: 'number', description: 'Prozentsatz oder Euro-Betrag' },
              priority: { type: 'number', description: 'Priorität bei Überschneidungen (0=niedrig)' },
              roundingMinutes: { type: 'number', description: '0 = keine Rundung' },
              maxMinutesPerDay: { type: 'number', description: 'Maximale Minuten pro Dienst, null = unbegrenzt' },
              sortOrder: { type: 'number' },
            },
            required: ['name', 'type', 'rateType', 'rateValue', 'daysOfWeek', 'includeHolidays', 'excludeHolidays', 'priority', 'roundingMinutes'],
          },
        },
        defaultHourlyWage: {
          type: 'number',
          description: 'Standard-Stundenlohn in Euro, falls vom Nutzer angegeben. Null wenn nicht genannt.',
        },
        summary: {
          type: 'string',
          description: 'Kurze Zusammenfassung der gespeicherten Regeln für den Nutzer.',
        },
      },
      required: ['rules', 'summary'],
    },
  },
]

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'customerId fehlt' }, { status: 400 })

  const locationId = await resolveLocationId(session)

  const { messages } = await req.json() as { messages: Anthropic.Messages.MessageParam[] }

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    messages,
  })

  // Handle tool use: save_rules
  for (const block of response.content) {
    if (block.type !== 'tool_use' || block.name !== 'save_rules') continue

    const input = block.input as {
      rules: {
        name: string
        description?: string
        type: string
        timeStart?: string
        timeEnd?: string
        daysOfWeek: number[]
        includeHolidays: boolean
        excludeHolidays: boolean
        rateType: string
        rateValue: number
        priority: number
        roundingMinutes: number
        maxMinutesPerDay?: number
        sortOrder?: number
      }[]
      defaultHourlyWage?: number
      summary: string
    }

    try {
      // Upsert rule set
      const existing = await prisma.surchargeRuleSet.findFirst({
        where: { customerId, locationId: locationId ?? null },
        select: { id: true },
      })

      let ruleSetId: string
      if (existing) {
        ruleSetId = existing.id
        await prisma.surchargeRuleSet.update({
          where: { id: ruleSetId },
          data: {
            defaultHourlyWage: input.defaultHourlyWage ?? null,
            onboardingCompleted: true,
            onboardingMessages: messages as object,
          },
        })
      } else {
        const created = await prisma.surchargeRuleSet.create({
          data: {
            customerId,
            locationId: locationId ?? null,
            defaultHourlyWage: input.defaultHourlyWage ?? null,
            onboardingCompleted: true,
            onboardingMessages: messages as object,
          },
        })
        ruleSetId = created.id
      }

      // Replace all rules
      await prisma.surchargeRule.deleteMany({ where: { ruleSetId } })
      if (input.rules.length > 0) {
        await prisma.surchargeRule.createMany({
          data: input.rules.map((r, i) => ({
            ruleSetId,
            name: r.name,
            description: r.description ?? null,
            type: r.type,
            timeStart: r.timeStart ?? null,
            timeEnd: r.timeEnd ?? null,
            daysOfWeek: r.daysOfWeek,
            includeHolidays: r.includeHolidays,
            excludeHolidays: r.excludeHolidays,
            rateType: r.rateType,
            rateValue: r.rateValue,
            priority: r.priority,
            roundingMinutes: r.roundingMinutes,
            maxMinutesPerDay: r.maxMinutesPerDay ?? null,
            isActive: true,
            sortOrder: r.sortOrder ?? i,
          })),
        })
      }

      return NextResponse.json({
        role: 'assistant',
        content: response.content,
        toolResult: { toolUseId: block.id, result: { ok: true, rulesCount: input.rules.length, summary: input.summary } },
        completed: true,
        rulesCount: input.rules.length,
      })
    } catch (err) {
      console.error('[surcharge-onboarding] save_rules error:', err)
      return NextResponse.json({
        role: 'assistant',
        content: response.content,
        toolResult: { toolUseId: block.id, result: { ok: false, error: 'Speichern fehlgeschlagen' } },
        completed: false,
      })
    }
  }

  return NextResponse.json({ role: 'assistant', content: response.content, completed: false })
}
