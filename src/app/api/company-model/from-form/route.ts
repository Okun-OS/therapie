import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { saveCompanyModel } from '@/lib/company-model-service'
import { prisma } from '@/lib/prisma'
import type {
  CompanyModel,
  HarteRegel,
  WeicheRegel,
  SchichtDefinition,
  WochentagKuerzel,
} from '@/lib/company-model-types'

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

interface FormSchicht {
  name: string
  von: string
  bis: string
  minBesetzung: number
}

interface FormBody {
  organisationName: string
  branche: string
  betriebsTyp: 'mon_fri' | 'mon_sat' | '7_tage' | '24_7' | 'schichtbetrieb' | 'bedarfsgesteuert' | 'bereitschaft'
  bundesland?: string
  schichten: FormSchicht[]
  regeln: Array<{ text: string }>
  arbeitstage: WochentagKuerzel[]
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kein Mandant' }, { status: 403 })

  const body: FormBody = await req.json()

  const location = await prisma.location.findFirst({ where: { customerId } })
  const locationId = location?.id ?? 'default'
  const locationName = location?.name ?? body.organisationName

  const schichten: SchichtDefinition[] = body.schichten.map((s, i) => ({
    id: `s-${i}`,
    name: s.name,
    typ: toSchichtTyp(s.name),
    von: s.von,
    bis: s.bis,
    uebernacht: s.bis < s.von,
    minBesetzungGesamt: s.minBesetzung,
    aufgaben: [],
  }))

  const harteRegeln: HarteRegel[] = [
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

  const weicheRegeln: WeicheRegel[] = body.regeln
    .filter(r => r.text?.trim())
    .map((r, i) => ({
      id: `wr-form-${i}`,
      kategorie: 'praeferenz' as const,
      beschreibung: r.text.trim(),
      gewicht: 0.7,
    }))

  const model: CompanyModel = {
    schemaVersion: '1.0',
    customerId,
    organisation: {
      name: body.organisationName,
      branche: body.branche,
      betriebsTyp: body.betriebsTyp,
      beschreibung: '',
      bundesland: body.bundesland,
      gesetzlicherRahmen: ['ArbZG'],
    },
    standortModelle: [
      {
        locationId,
        locationName,
        planungsEinheiten: [],
        schichtmodell: {
          arbeitstage: body.arbeitstage,
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
          wochenendArbeit: body.arbeitstage.includes('Sa') || body.arbeitstage.includes('So'),
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
  return NextResponse.json({ model })
}
