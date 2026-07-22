import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import type { CompanyModel, StandortModell, LocationModel } from '@/lib/company-model-types'

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

export async function getLocationModel(locationId: string): Promise<LocationModel | null> {
  const record = await prisma.locationRuleModelRecord.findUnique({ where: { locationId } })
  if (!record) return null
  return record.ruleModel as unknown as LocationModel
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

Leite alle Werte ausschließlich aus den Onboarding-Daten ab. Erfinde keine Regeln oder Strukturen, die nicht explizit erwähnt wurden.`

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    system: SYSTEM,
    messages: [{ role: 'user', content: USER }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('KI hat kein gültiges LocationModel-JSON zurückgegeben')

  const model = JSON.parse(jsonMatch[0]) as LocationModel
  await saveLocationModel(locationId, customerId, model)
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
