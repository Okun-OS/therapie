import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveLocationId, resolveCustomerId } from '@/lib/session'
import { saveLocationModel } from '@/lib/company-model-service'
import { prisma } from '@/lib/prisma'
import type {
  LocationModel,
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
  betriebsTyp: 'mon_fri' | 'mon_sat' | '7_tage' | '24_7' | 'schichtbetrieb' | 'bedarfsgesteuert' | 'bereitschaft'
  bundesland?: string
  arbeitstage: WochentagKuerzel[]
  schichten: FormSchicht[]
  regeln: string[]
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin'])
  if (session instanceof NextResponse) return session

  const locationId = await resolveLocationId(session)
  if (!locationId) return NextResponse.json({ error: 'Kein Standort zugeordnet' }, { status: 403 })

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kein Mandant' }, { status: 403 })

  const body: FormBody = await req.json()

  if (!body.schichten || body.schichten.length === 0) {
    return NextResponse.json({ error: 'Mindestens eine Schicht erforderlich' }, { status: 400 })
  }

  const location = await prisma.location.findUnique({ where: { id: locationId } })

  // Upsert DB shifts (match by name within location)
  const existingShifts = await prisma.shift.findMany({ where: { locationId } })
  for (const s of body.schichten) {
    const name = s.name.trim()
    if (!name) continue
    const existing = existingShifts.find(e => e.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      await prisma.shift.update({
        where: { id: existing.id },
        data: { startTime: s.von, endTime: s.bis, minStaff: s.minBesetzung },
      })
    } else {
      await prisma.shift.create({
        data: {
          locationId,
          name,
          startTime: s.von,
          endTime: s.bis,
          minStaff: s.minBesetzung,
          type: toSchichtTyp(name),
          color: '#26C6C6',
          bgColor: '#E0F7F7',
        },
      })
    }
  }

  // Rebuild schichten list from DB (so IDs are real UUIDs)
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

  const weicheRegeln: WeicheRegel[] = (body.regeln ?? [])
    .map(r => r.trim())
    .filter(Boolean)
    .map((text, i) => ({
      id: `wr-form-${i}`,
      kategorie: 'praeferenz' as const,
      beschreibung: text,
      gewicht: 0.7,
    }))

  const model: LocationModel = {
    locationId,
    locationName: location?.name ?? 'Standort',
    customerId,
    betriebsTyp: body.betriebsTyp,
    bundesland: body.bundesland,
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
  }

  await saveLocationModel(locationId, customerId, model)
  return NextResponse.json({ model })
}
