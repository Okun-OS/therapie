import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireRole, resolveLocationId, resolveCustomerId } from '@/lib/session'
import { getLocationModel, saveLocationModel } from '@/lib/company-model-service'
import type { HarteRegel, WeicheRegel } from '@/lib/company-model-types'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin'])
  if (session instanceof NextResponse) return session

  const locationId = await resolveLocationId(session)
  if (!locationId) return NextResponse.json({ error: 'Kein Standort zugeordnet' }, { status: 403 })

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kein Mandant' }, { status: 403 })

  const { text } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: 'text fehlt' }, { status: 400 })

  const model = await getLocationModel(locationId)
  if (!model) return NextResponse.json({ error: 'Kein LocationModel gefunden. Bitte zuerst Onboarding abschließen.' }, { status: 404 })

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 512,
    system: `Du konvertierst eine Planungsregel in JSON.
Antworte NUR mit einem JSON-Objekt. Kein Text außerhalb.

Harte Regel (Gesetz, Pflicht, feste Grenze):
{
  "art": "hart",
  "regel": {
    "id": "hr-<kurzname>",
    "kategorie": "arbeitszeit|ruhezeit|qualifikation|besetzung|folgetag|gesetz",
    "beschreibung": "<Regeltext>",
    "typ": "<maschinenlesbar z.B. max_wochenstunden|min_ruhezeit|max_folgetage|min_besetzung>",
    "wert": <Zahl falls vorhanden, sonst weglassen>,
    "einheit": "<stunden|tage|personen|... falls vorhanden, sonst weglassen>",
    "quelle": "gesetz|tarifvertrag|betriebsvereinbarung|unternehmen"
  }
}

Weiche Regel (Wunsch, Fairness, Präferenz):
{
  "art": "weich",
  "regel": {
    "id": "wr-<kurzname>",
    "kategorie": "fairness|wunsch|praeferenz|belastung|kontinuitaet",
    "beschreibung": "<Regeltext>",
    "gewicht": <0.1 bis 1.0>
  }
}`,
    messages: [{ role: 'user', content: `Konvertiere diese Regel: "${text.trim()}"` }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return NextResponse.json({ error: 'KI konnte Regel nicht konvertieren' }, { status: 422 })

  const parsed = JSON.parse(match[0]) as { art: 'hart' | 'weich'; regel: HarteRegel | WeicheRegel }

  const updatedModel = { ...model }
  if (parsed.art === 'hart') {
    updatedModel.planungsRegeln = {
      ...model.planungsRegeln,
      hart: [...model.planungsRegeln.hart, parsed.regel as HarteRegel],
    }
  } else {
    updatedModel.planungsRegeln = {
      ...model.planungsRegeln,
      weich: [...model.planungsRegeln.weich, parsed.regel as WeicheRegel],
    }
  }

  await saveLocationModel(locationId, customerId, updatedModel)
  return NextResponse.json({ model: updatedModel, addedRule: parsed })
}
