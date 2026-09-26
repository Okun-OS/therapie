import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { saveCompanyModel } from '@/lib/company-model-service'
import { prisma } from '@/lib/prisma'
import type {
  CompanyModel,
  HarteRegel,
  WeicheRegel,
  SchichtDefinition,
} from '@/lib/company-model-types'

const client = new Anthropic()

function toSchichtTyp(name: string): SchichtDefinition['typ'] {
  const n = name.toLowerCase()
  if (n.includes('früh') || n.includes('frueh') || n.includes('morgen')) return 'frueh'
  if (n.includes('spät') || n.includes('spaet') || n.includes('abend')) return 'spaet'
  if (n.includes('nacht')) return 'nacht'
  if (n.includes('bereitschaft') && n.includes('ruf')) return 'rufbereitschaft'
  if (n.includes('bereitschaft')) return 'bereitschaft'
  if (n.includes('sonder')) return 'sonderdienst'
  return 'mittel'
}

const SYSTEM = `Du analysierst einen oder mehrere Beispiel-Dienstpläne und extrahierst daraus ein strukturiertes Planungsmodell.

Antworte NUR mit einem JSON-Objekt. Kein Text außerhalb.

{
  "schichten": [
    { "name": "string", "von": "HH:MM", "bis": "HH:MM", "minBesetzung": 1, "uebernacht": false }
  ],
  "harteRegeln": [
    { "beschreibung": "string", "typ": "max_wochenstunden|min_ruhezeit|max_folgetage|min_besetzung|...", "wert": 40, "einheit": "stunden|tage|personen" }
  ],
  "weicheRegeln": [
    { "beschreibung": "string", "gewicht": 0.7 }
  ],
  "arbeitstage": ["Mo","Di","Mi","Do","Fr"],
  "erkanntesMuster": "Beschreibung des erkannten Planungsmusters"
}`

interface ExtractedSchicht {
  name: string
  von: string
  bis: string
  minBesetzung: number
  uebernacht?: boolean
}

interface ExtractedHarteRegel {
  beschreibung: string
  typ: string
  wert?: number
  einheit?: string
}

interface ExtractedWeicheRegel {
  beschreibung: string
  gewicht: number
}

interface ExtractedData {
  schichten: ExtractedSchicht[]
  harteRegeln: ExtractedHarteRegel[]
  weicheRegeln: ExtractedWeicheRegel[]
  arbeitstage: string[]
  erkanntesMuster?: string
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kein Mandant' }, { status: 403 })

  const body = await req.json() as { planText?: string }
  const planText = body.planText?.trim()
  if (!planText) return NextResponse.json({ error: 'planText fehlt' }, { status: 400 })

  const location = await prisma.location.findFirst({ where: { customerId } })
  const locationId = location?.id ?? 'default'
  const locationName = location?.name ?? 'Standort'

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    system: SYSTEM,
    messages: [{ role: 'user', content: `Analysiere diesen Dienstplan:\n\n${planText}` }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) {
    return NextResponse.json({ error: 'KI konnte keinen Plan extrahieren' }, { status: 422 })
  }

  const extracted: ExtractedData = JSON.parse(match[0])

  const schichten: SchichtDefinition[] = (extracted.schichten ?? []).map((s, i) => ({
    id: `s-upload-${i}`,
    name: s.name,
    typ: toSchichtTyp(s.name),
    von: s.von,
    bis: s.bis,
    uebernacht: s.uebernacht ?? s.bis < s.von,
    minBesetzungGesamt: s.minBesetzung ?? 1,
    aufgaben: [],
  }))

  // Always include mandatory legal hard rules, then add extracted ones
  const baseHarteRegeln: HarteRegel[] = [
    {
      id: 'hr-maxwochenstunden',
      kategorie: 'arbeitszeit',
      beschreibung: 'Maximal 40 Stunden pro Woche',
      typ: 'max_wochenstunden',
      wert: 40,
      einheit: 'stunden',
      quelle: 'gesetz',
    },
    {
      id: 'hr-ruhezeit',
      kategorie: 'ruhezeit',
      beschreibung: 'Mindestens 11 Stunden Ruhezeit zwischen Diensten',
      typ: 'min_ruhezeit',
      wert: 11,
      einheit: 'stunden',
      quelle: 'gesetz',
    },
    {
      id: 'hr-maxfolgetage',
      kategorie: 'folgetag',
      beschreibung: 'Maximal 5 aufeinanderfolgende Arbeitstage',
      typ: 'max_folgetage',
      wert: 5,
      einheit: 'tage',
      quelle: 'gesetz',
    },
  ]

  const extractedHarteRegeln: HarteRegel[] = (extracted.harteRegeln ?? []).map((r, i) => ({
    id: `hr-upload-${i}`,
    kategorie: 'gesetz' as const,
    beschreibung: r.beschreibung,
    typ: r.typ,
    wert: r.wert,
    einheit: r.einheit,
    quelle: 'unternehmen' as const,
  }))

  const harteRegeln = [...baseHarteRegeln, ...extractedHarteRegeln]

  const weicheRegeln: WeicheRegel[] = (extracted.weicheRegeln ?? []).map((r, i) => ({
    id: `wr-upload-${i}`,
    kategorie: 'praeferenz' as const,
    beschreibung: r.beschreibung,
    gewicht: r.gewicht ?? 0.7,
  }))

  const validWochentage = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
  const arbeitstage = (extracted.arbeitstage ?? ['Mo', 'Di', 'Mi', 'Do', 'Fr']).filter(d =>
    validWochentage.includes(d),
  ) as CompanyModel['standortModelle'][0]['schichtmodell']['arbeitstage']

  const model: CompanyModel = {
    schemaVersion: '1.0',
    customerId,
    organisation: {
      name: locationName,
      branche: 'Unbekannt',
      betriebsTyp: arbeitstage.includes('Sa') || arbeitstage.includes('So') ? '7_tage' : 'mon_fri',
      beschreibung: extracted.erkanntesMuster ?? '',
      gesetzlicherRahmen: ['ArbZG'],
    },
    standortModelle: [
      {
        locationId,
        locationName,
        planungsEinheiten: [],
        schichtmodell: {
          arbeitstage,
          schichten,
          pausenRegelung: {
            automatisch: true,
            nachMinuten: 360,
            dauertMinuten: 30,
          },
        },
        planungsRegeln: {
          hart: harteRegeln,
          weich: weicheRegeln,
        },
        fairnessKonfig: {
          wochenendArbeit: arbeitstage.includes('Sa') || arbeitstage.includes('So'),
          wochenendLimitProMonat: 2,
          nachtdienstFair: true,
          schichttypFairness: true,
          belastungsgleichverteilung: true,
        },
        vertretungsKonfig: {
          eskalationsReihenfolge: ['gruppe', 'standort', 'organisation'],
          qualifikationsPflicht: false,
          maxWartezeitMinuten: 120,
        },
      },
    ],
    aktivierteModule: ['dienstplanung'],
    erkannteModule: ['dienstplanung', 'zeiterfassung', 'urlaubsplanung'],
  }

  await saveCompanyModel(customerId, model)
  return NextResponse.json({ model, erkanntesMuster: extracted.erkanntesMuster })
}
