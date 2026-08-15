import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import type { CompanyModel, StandortModell, LocationModel, PlanungsEinheit } from '@/lib/company-model-types'
import { upsertPlanningUnit } from '@/lib/schedule-entities'

// §71: mirror the generated planungsEinheiten into real PlanningUnit rows so
// the solver's group planning, the units editor and the schedule views all see
// the same structure. Etagen first so groups can resolve their parent.
async function syncPlanningUnitsFromModel(locationId: string, einheiten: PlanungsEinheit[]): Promise<void> {
  if (!einheiten || einheiten.length === 0) return
  const dbIdByModelId = new Map<string, string>()
  const sorted = [...einheiten].sort(
    (a, b) => (a.typ === 'etage' ? 0 : 1) - (b.typ === 'etage' ? 0 : 1),
  )
  for (const e of sorted) {
    if (!e.name?.trim()) continue
    const unit = await upsertPlanningUnit(locationId, {
      name: e.name.trim(),
      type: e.typ,
      minStaff: e.mindestbesetzung ?? 1,
      parentId: e.etageId ? dbIdByModelId.get(e.etageId) ?? null : undefined,
    })
    dbIdByModelId.set(e.id, unit.id)
  }
}

const client = new Anthropic()

export async function getCompanyModel(customerId: string): Promise<CompanyModel | null> {
  const record = await prisma.companyModelRecord.findUnique({ where: { customerId } })
  if (!record) return null
  return record.model as unknown as CompanyModel
}

export async function saveCompanyModel(customerId: string, model: CompanyModel): Promise<void> {
  await prisma.companyModelRecord.upsert({
    where: { customerId },
    create: { customerId, model: model as object, generatedBy: 'ai' },
    update: { model: model as object, version: { increment: 1 }, updatedAt: new Date() },
  })
}

export async function generateCompanyModelFromOnboarding(customerId: string): Promise<CompanyModel> {
  const [orgOnboarding, locationOnboardingsAll, locations] = await Promise.all([
    prisma.organizationOnboarding.findUnique({ where: { customerId } }),
    prisma.locationOnboarding.findMany(),
    prisma.location.findMany({ where: { customerId } }),
  ])
  const locationOnboardings = locationOnboardingsAll.filter(lo =>
    locations.some(l => l.id === lo.locationId)
  )

  const locationData = locations.map(loc => {
    const onboarding = locationOnboardings.find(lo => lo.locationId === loc.id)
    return { location: loc, onboarding }
  })

  const SYSTEM = `Du bist ein Experte für betriebliche Organisations- und Personalplanung.
Analysiere die bereitgestellten Onboarding-Daten eines Unternehmens und erstelle ein strukturiertes CompanyModel.
Antworte NUR mit validem JSON, das dem CompanyModel-Schema entspricht. Kein Text außerhalb des JSON.`

  const USER = `Erstelle ein CompanyModel für diesen Mandanten.

Organisation:
${JSON.stringify(orgOnboarding, null, 2)}

Standorte und ihre Onboarding-Daten:
${JSON.stringify(locationData, null, 2)}

Erstelle das CompanyModel als JSON mit diesem Schema:
{
  "schemaVersion": "1.0",
  "customerId": "${customerId}",
  "organisation": {
    "name": "...",
    "branche": "...",
    "betriebsTyp": "mon_fri|mon_sat|7_tage|24_7|schichtbetrieb|bedarfsgesteuert|bereitschaft",
    "beschreibung": "...",
    "bundesland": "...",
    "gesetzlicherRahmen": ["ArbZG", "...]
  },
  "standortModelle": [
    {
      "locationId": "<EXAKT die location.id aus den Onboarding-Daten übernehmen — niemals erfinden>",
      "locationName": "...",
      "planungsEinheiten": [
        {
          "id": "einheit-1",
          "name": "...",
          "typ": "gruppe|bereich|station|tour|objekt|fahrzeug|raum",
          "mindestbesetzung": 2,
          "maximalbesetzung": 5,
          "erforderlicheQualifikationen": [],
          "aufgaben": []
        }
      ],
      "schichtmodell": {
        "arbeitstage": ["Mo","Di","Mi","Do","Fr"],
        "schichten": [
          {
            "id": "frueh",
            "name": "Frühschicht",
            "typ": "frueh|spaet|nacht|mittel|bereitschaft|rufbereitschaft|sonderdienst",
            "von": "06:00",
            "bis": "14:00",
            "uebernacht": false,
            "minBesetzungGesamt": 3,
            "aufgaben": []
          }
        ],
        "pausenRegelung": {
          "automatisch": true,
          "nachMinuten": 360,
          "dauertMinuten": 30
        }
      },
      "planungsRegeln": {
        "hart": [
          {
            "id": "hr-maxwochenstunden",
            "kategorie": "arbeitszeit",
            "beschreibung": "Maximal 40 Stunden pro Woche",
            "typ": "max_wochenstunden",
            "wert": 40,
            "einheit": "stunden",
            "quelle": "gesetz"
          }
        ],
        "weich": [
          {
            "id": "wr-fairness-wochenende",
            "kategorie": "fairness",
            "beschreibung": "Gleichmäßige Verteilung von Wochenenddiensten",
            "gewicht": 0.8
          }
        ]
      },
      "fairnessKonfig": {
        "wochenendArbeit": false,
        "wochenendLimitProMonat": 2,
        "nachtdienstFair": true,
        "schichttypFairness": true,
        "belastungsgleichverteilung": true
      },
      "vertretungsKonfig": {
        "eskalationsReihenfolge": ["gruppe", "standort", "organisation"],
        "qualifikationsPflicht": false,
        "maxWartezeitMinuten": 120
      }
    }
  ],
  "aktivierteModule": ["dienstplanung"],
  "erkannteModule": ["dienstplanung", "zeiterfassung", "urlaubsplanung"]
}

Leite alle Werte ausschließlich aus den Onboarding-Daten ab. Erfinde keine Regeln oder Strukturen, die nicht explizit erwähnt wurden.`

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 8192,
    system: SYSTEM,
    messages: [{ role: 'user', content: USER }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('KI hat kein gültiges JSON zurückgegeben')
  }

  const model = JSON.parse(jsonMatch[0]) as CompanyModel
  await saveCompanyModel(customerId, model)
  return model
}

export async function getOrGenerateCompanyModel(customerId: string): Promise<CompanyModel | null> {
  const existing = await getCompanyModel(customerId)
  if (existing) return existing

  const orgOnboarding = await prisma.organizationOnboarding.findUnique({ where: { customerId } })
  if (!orgOnboarding?.completed) return null

  return generateCompanyModelFromOnboarding(customerId)
}

// ── Per-location model (primary unit for solver configuration) ───────────────

// §74: LLM-generated JSON can miss sections OR carry wrong types (e.g.
// betriebsTyp as object → ".replace is not a function" crashed /admin/model
// in production). Normalize AND type-coerce on every read so the UI and
// solver never hit undefined or non-primitive values in rendered fields.
function asStr(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (v && typeof v === 'object') {
    const inner = Object.values(v).find(x => typeof x === 'string')
    if (typeof inner === 'string') return inner
  }
  return fallback
}

function asNum(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v)
  if (v && typeof v === 'object') {
    const inner = Object.values(v).find(x => typeof x === 'number' && Number.isFinite(x))
    if (typeof inner === 'number') return inner
  }
  return fallback
}

export function normalizeLocationModel(raw: unknown): LocationModel {
  const m = (raw ?? {}) as Partial<LocationModel> & Record<string, unknown>
  const regeln = (m.planungsRegeln ?? {}) as Partial<LocationModel['planungsRegeln']> & Record<string, unknown>
  const schicht = (m.schichtmodell ?? {}) as Partial<LocationModel['schichtmodell']> & Record<string, unknown>

  const hart = ((Array.isArray(regeln.hart) ? regeln.hart : []) as unknown[])
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r, i) => ({
      id: asStr(r.id, `hr-${i}`),
      kategorie: asStr(r.kategorie, 'arbeitszeit'),
      beschreibung: asStr(r.beschreibung),
      typ: asStr(r.typ) || undefined,
      wert: r.wert === undefined ? undefined : asNum(r.wert, NaN),
      einheit: asStr(r.einheit) || undefined,
      quelle: asStr(r.quelle, 'unternehmen'),
    }))
    .map(r => ({ ...r, wert: Number.isNaN(r.wert as number) ? undefined : r.wert }))

  const weich = ((Array.isArray(regeln.weich) ? regeln.weich : []) as unknown[])
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r, i) => ({
      id: asStr(r.id, `wr-${i}`),
      kategorie: asStr(r.kategorie, 'fairness'),
      beschreibung: asStr(r.beschreibung),
      gewicht: (() => {
        const g = asNum(r.gewicht, 0.5)
        return g > 1 ? Math.min(1, g / 100) : g  // 80 → 0.8
      })(),
    }))

  const einheiten = ((Array.isArray(m.planungsEinheiten) ? m.planungsEinheiten : []) as unknown[])
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .map((e, i) => ({
      id: asStr(e.id, `einheit-${i}`),
      name: asStr(e.name, `Einheit ${i + 1}`),
      typ: asStr(e.typ, 'gruppe'),
      mindestbesetzung: asNum(e.mindestbesetzung, 1),
      maximalbesetzung: e.maximalbesetzung === undefined ? undefined : asNum(e.maximalbesetzung, 0) || undefined,
      erforderlicheQualifikationen: Array.isArray(e.erforderlicheQualifikationen)
        ? (e.erforderlicheQualifikationen as unknown[]).filter((q): q is string => typeof q === 'string') : [],
      aufgaben: Array.isArray(e.aufgaben)
        ? (e.aufgaben as unknown[]).filter((a): a is string => typeof a === 'string') : [],
      etageId: asStr(e.etageId) || undefined,
    })) as LocationModel['planungsEinheiten']

  const schichten = ((Array.isArray(schicht.schichten) ? schicht.schichten : []) as unknown[])
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    .map((s, i) => ({
      ...s,
      id: asStr(s.id, `schicht-${i}`),
      name: asStr(s.name, `Schicht ${i + 1}`),
      typ: asStr(s.typ, 'mittel'),
      von: asStr(s.von, '08:00'),
      bis: asStr(s.bis, '16:00'),
      uebernacht: s.uebernacht === true,
      minBesetzungGesamt: asNum(s.minBesetzungGesamt, 1),
    })) as LocationModel['schichtmodell']['schichten']

  return {
    ...m,
    locationName: asStr(m.locationName, 'Standort'),
    betriebsTyp: asStr(m.betriebsTyp, 'mon_fri'),
    bundesland: asStr(m.bundesland) || undefined,
    planungsEinheiten: einheiten,
    schichtmodell: {
      ...schicht,
      arbeitstage: Array.isArray(schicht.arbeitstage)
        ? (schicht.arbeitstage as unknown[]).filter((d): d is string => typeof d === 'string')
        : [],
      schichten,
    } as LocationModel['schichtmodell'],
    planungsRegeln: { hart, weich } as LocationModel['planungsRegeln'],
    fairnessKonfig: (m.fairnessKonfig && typeof m.fairnessKonfig === 'object' ? m.fairnessKonfig : {
      wochenendArbeit: false,
      wochenendLimitProMonat: 2,
      nachtdienstFair: true,
      schichttypFairness: true,
      belastungsgleichverteilung: true,
    }) as LocationModel['fairnessKonfig'],
    vertretungsKonfig: (m.vertretungsKonfig && typeof m.vertretungsKonfig === 'object' ? m.vertretungsKonfig : {
      eskalationsReihenfolge: ['gruppe', 'standort', 'organisation'],
      qualifikationsPflicht: false,
      maxWartezeitMinuten: 120,
    }) as LocationModel['vertretungsKonfig'],
  } as LocationModel
}

export async function getLocationModel(locationId: string): Promise<LocationModel | null> {
  const record = await prisma.locationRuleModelRecord.findUnique({ where: { locationId } })
  if (!record) return null
  return normalizeLocationModel(record.ruleModel)
}

export async function saveLocationModel(locationId: string, customerId: string, model: LocationModel): Promise<void> {
  await prisma.locationRuleModelRecord.upsert({
    where: { locationId },
    create: { locationId, customerId, ruleModel: model as object },
    update: { ruleModel: model as object, version: { increment: 1 }, updatedAt: new Date() },
  })
}

export async function generateLocationModelFromOnboarding(locationId: string, customerId: string): Promise<LocationModel | null> {
  const [locationOnboarding, location, orgOnboarding] = await Promise.all([
    prisma.locationOnboarding.findUnique({ where: { locationId } }),
    prisma.location.findUnique({ where: { id: locationId } }),
    prisma.organizationOnboarding.findUnique({ where: { customerId } }),
  ])

  // Allow generation even if completed=false, as long as some onboarding data exists
  // (handles accounts that went through onboarding before the completed flag was reliable)
  const hasData = locationOnboarding && (
    locationOnboarding.completed ||
    locationOnboarding.arbeitszeiten !== null ||
    locationOnboarding.dienstplanlogik !== null ||
    locationOnboarding.einrichtungsart !== null
  )
  if (!hasData) return null

  const SYSTEM = `Du bist ein Experte für betriebliche Organisations- und Personalplanung.
Analysiere die Onboarding-Daten eines einzelnen Standorts und erstelle ein strukturiertes LocationModel.
Antworte NUR mit validem JSON. Kein Text außerhalb des JSON.`

  const USER = `Erstelle ein LocationModel für diesen Standort.

Standort-Onboarding:
${JSON.stringify({ location, onboarding: locationOnboarding }, null, 2)}

Unternehmens-Kontext (für Bundesland/Gesetzgebung, optional):
${JSON.stringify(orgOnboarding, null, 2)}

Erstelle das LocationModel als JSON mit genau diesem Schema:
{
  "locationId": "${locationId}",
  "locationName": "${location?.name ?? ''}",
  "customerId": "${customerId}",
  "betriebsTyp": "mon_fri|mon_sat|7_tage|24_7|schichtbetrieb|bedarfsgesteuert|bereitschaft",
  "bundesland": "...",
  "planungsEinheiten": [
    {
      "id": "einheit-1",
      "name": "...",
      "typ": "gruppe|etage|bereich|station|tour|objekt|fahrzeug|raum",
      "mindestbesetzung": 2,
      "maximalbesetzung": 5,
      "erforderlicheQualifikationen": [],
      "aufgaben": [],
      "etageId": "einheit-0"
    }
  ],
  "schichtmodell": {
    "arbeitstage": ["Mo","Di","Mi","Do","Fr"],
    "schichten": [
      {
        "id": "frueh",
        "name": "Frühschicht",
        "typ": "frueh|spaet|nacht|mittel|bereitschaft|rufbereitschaft|sonderdienst",
        "von": "06:00",
        "bis": "14:00",
        "uebernacht": false,
        "minBesetzungGesamt": 3,
        "aufgaben": []
      }
    ],
    "pausenRegelung": {
      "automatisch": true,
      "nachMinuten": 360,
      "dauertMinuten": 30
    }
  },
  "planungsRegeln": {
    "hart": [
      {
        "id": "hr-maxwochenstunden",
        "kategorie": "arbeitszeit",
        "beschreibung": "Maximal 40 Stunden pro Woche",
        "typ": "max_wochenstunden",
        "wert": 40,
        "einheit": "stunden",
        "quelle": "gesetz"
      }
    ],
    "weich": [
      {
        "id": "wr-fairness-wochenende",
        "kategorie": "fairness",
        "beschreibung": "Gleichmäßige Verteilung von Wochenenddiensten",
        "gewicht": 0.8
      }
    ]
  },
  "fairnessKonfig": {
    "wochenendArbeit": false,
    "wochenendLimitProMonat": 2,
    "nachtdienstFair": true,
    "schichttypFairness": true,
    "belastungsgleichverteilung": true
  },
  "vertretungsKonfig": {
    "eskalationsReihenfolge": ["gruppe", "standort", "organisation"],
    "qualifikationsPflicht": false,
    "maxWartezeitMinuten": 120
  }
}

WICHTIG zu planungsEinheiten: Wenn der Standort mehrere Etagen/Ebenen/Bereiche mit Gruppen hat (z.B. Kita mit "Oben" und "Unten"), lege JEDE Etage als eigene Einheit mit typ "etage" an und gib bei JEDER Gruppe über "etageId" die id ihrer Etage an. mindestbesetzung bedeutet: bei Gruppen die Personen pro Tag, bei Etagen die Personen je Früh-/Spätdienst (Auf-/Zuschluss). "etageId" nur bei Gruppen setzen, die zu einer Etage gehören.

Leite alle Werte ausschließlich aus den Onboarding-Daten ab. Erfinde keine Regeln oder Strukturen, die nicht explizit erwähnt wurden.`

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{ role: 'user', content: USER }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  // Strip markdown code fences if the model wrapped the JSON
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('KI hat kein gültiges LocationModel-JSON zurückgegeben')

  const model = normalizeLocationModel(JSON.parse(jsonMatch[0]))
  await saveLocationModel(locationId, customerId, model)
  // §71: turn the described structure into real system data (Etagen/Gruppen)
  await syncPlanningUnitsFromModel(locationId, model.planungsEinheiten ?? []).catch(err =>
    console.error('[company-model-service] planning unit sync failed:', err),
  )
  // §74: program the onboarding "individuelle Regeln" as real CP-SAT custom
  // constraints (status pending — admin reviews & activates on /admin/model).
  // Fire-and-forget: one Claude call per rule, results appear shortly after.
  const regeln = locationOnboarding?.individuelleRegeln ?? []
  if (regeln.length > 0) {
    void import('@/lib/custom-constraint-generator').then(({ generateConstraintsFromRules }) =>
      generateConstraintsFromRules(locationId, customerId, regeln).then(r =>
        console.log(`[company-model-service] custom constraints from onboarding: ${r.created} erstellt, ${r.skipped} übersprungen, ${r.failed} fehlgeschlagen`),
      ),
    ).catch(err => console.error('[company-model-service] constraint batch failed:', err))
  }
  return model
}

export async function getOrGenerateLocationModel(locationId: string, customerId: string): Promise<LocationModel | null> {
  const existing = await getLocationModel(locationId)
  if (existing) return existing
  return generateLocationModelFromOnboarding(locationId, customerId)
}

// ── Company-level model (kept for backwards compatibility) ────────────────────

export function getStandortModell(model: CompanyModel, locationId: string): StandortModell | null {
  // Exact match first
  const exact = model.standortModelle.find(s => s.locationId === locationId)
  if (exact) return exact
  // If exactly one location model exists, use it regardless of ID — the AI
  // often generates a placeholder ID instead of the real DB UUID.
  if (model.standortModelle.length === 1) return model.standortModelle[0]
  return null
}
