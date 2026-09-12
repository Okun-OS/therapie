import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireRole, resolveLocationId, resolveCustomerId } from '@/lib/session'
import { saveLocationModel } from '@/lib/company-model-service'
import { prisma } from '@/lib/prisma'
import type {
  LocationModel,
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

const SYSTEM = `Du analysierst einen Dienstplan und extrahierst daraus ein strukturiertes Planungsmodell.

Antworte NUR mit einem JSON-Objekt. Kein Text außerhalb.

{
  "schichten": [
    { "name": "string", "von": "HH:MM", "bis": "HH:MM", "minBesetzung": 1, "uebernacht": false }
  ],
  "harteRegeln": [
    { "beschreibung": "string", "typ": "max_wochenstunden|min_ruhezeit|max_folgetage|min_besetzung", "wert": 40, "einheit": "stunden|tage|personen" }
  ],
  "weicheRegeln": [
    { "beschreibung": "string", "gewicht": 0.7 }
  ],
  "arbeitstage": ["Mo","Di","Mi","Do","Fr"],
  "betriebsTyp": "mon_fri|mon_sat|7_tage|24_7|schichtbetrieb|bedarfsgesteuert|bereitschaft",
  "erkanntesMuster": "Kurze Beschreibung des Planungsmusters"
}`

interface ExtractedData {
  schichten: Array<{ name: string; von: string; bis: string; minBesetzung: number; uebernacht?: boolean }>
  harteRegeln: Array<{ beschreibung: string; typ: string; wert?: number; einheit?: string }>
  weicheRegeln: Array<{ beschreibung: string; gewicht: number }>
  arbeitstage: string[]
  betriebsTyp?: string
  erkanntesMuster?: string
}

const VALID_WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const VALID_BETRIEBSTYPEN = ['mon_fri', 'mon_sat', '7_tage', '24_7', 'schichtbetrieb', 'bedarfsgesteuert', 'bereitschaft']

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin'])
  if (session instanceof NextResponse) return session

  const locationId = await resolveLocationId(session)
  if (!locationId) return NextResponse.json({ error: 'Kein Standort zugeordnet' }, { status: 403 })

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kein Mandant' }, { status: 403 })

  const body = await req.json() as { planText?: string }
  const planText = body.planText?.trim()
  if (!planText) return NextResponse.json({ error: 'planText fehlt' }, { status: 400 })

  const location = await prisma.location.findUnique({ where: { id: locationId } })

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    system: SYSTEM,
    messages: [{ role: 'user', content: `Analysiere diesen Dienstplan:\n\n${planText}` }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return NextResponse.json({ error: 'KI konnte keinen Plan extrahieren' }, { status: 422 })

  const extracted: ExtractedData = JSON.parse(match[0])

  // Upsert DB shifts from extracted data
  const existingShifts = await prisma.shift.findMany({ where: { locationId } })
  for (const s of extracted.schichten ?? []) {
    const name = s.name?.trim()
    if (!name) continue
    const existing = existingShifts.find(e => e.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      await prisma.shift.update({
        where: { id: existing.id },
        data: { startTime: s.von, endTime: s.bis, minStaff: s.minBesetzung ?? 1 },
      })
    } else {
      await prisma.shift.create({
        data: {
          locationId,
          name,
          startTime: s.von,
          endTime: s.bis,
          minStaff: s.minBesetzung ?? 1,
          type: toSchichtTyp(name),
          color: '#26C6C6',
          bgColor: '#E0F7F7',
        },
      })
    }
  }

  const dbShifts = await prisma.shift.findMany({ where: { locationId } })
  const schichten: SchichtDefinition[] = dbShifts.map(s => ({
    id: s.id,
    name: s.name,
    typ: toSchichtTyp(s.name),
    von: s.startTime,
    bis: s.endTime,
    uebernacht: s.endTime < s.startTime,
    minBesetzungGesamt: s.minStaff,
    aufgaben: [],
  }))

  const arbeitstage = (extracted.arbeitstage ?? ['Mo', 'Di', 'Mi', 'Do', 'Fr']).filter(d =>
    VALID_WOCHENTAGE.includes(d),
  ) as LocationModel['schichtmodell']['arbeitstage']

  const detectedBetriebsTyp = VALID_BETRIEBSTYPEN.includes(extracted.betriebsTyp ?? '')
    ? (extracted.betriebsTyp as LocationModel['betriebsTyp'])
    : (arbeitstage.includes('Sa') || arbeitstage.includes('So') ? '7_tage' : 'mon_fri')

  const baseHarteRegeln: HarteRegel[] = [
    { id: 'hr-maxwochenstunden', kategorie: 'arbeitszeit', beschreibung: 'Maximal 40 Stunden pro Woche', typ: 'max_wochenstunden', wert: 40, einheit: 'stunden', quelle: 'gesetz' },
    { id: 'hr-ruhezeit', kategorie: 'ruhezeit', beschreibung: 'Mindestens 11 Stunden Ruhezeit zwischen Diensten', typ: 'min_ruhezeit', wert: 11, einheit: 'stunden', quelle: 'gesetz' },
    { id: 'hr-maxfolgetage', kategorie: 'folgetag', beschreibung: 'Maximal 5 aufeinanderfolgende Arbeitstage', typ: 'max_folgetage', wert: 5, einheit: 'tage', quelle: 'gesetz' },
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

  const weicheRegeln: WeicheRegel[] = (extracted.weicheRegeln ?? []).map((r, i) => ({
    id: `wr-upload-${i}`,
    kategorie: 'praeferenz' as const,
    beschreibung: r.beschreibung,
    gewicht: r.gewicht ?? 0.7,
  }))

  const model: LocationModel = {
    locationId,
    locationName: location?.name ?? 'Standort',
    customerId,
    betriebsTyp: detectedBetriebsTyp,
    planungsEinheiten: [],
    schichtmodell: {
      arbeitstage,
      schichten,
      pausenRegelung: { automatisch: true, nachMinuten: 360, dauertMinuten: 30 },
    },
    planungsRegeln: {
      hart: [...baseHarteRegeln, ...extractedHarteRegeln],
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
  }

  await saveLocationModel(locationId, customerId, model)
  return NextResponse.json({ model, erkanntesMuster: extracted.erkanntesMuster })
}
