import { NextRequest, NextResponse } from 'next/server'
import { getVacationRules, setVacationRules } from '@/lib/vacation-entities'
import { requireRole } from '@/lib/session'
import { locationFilter } from '@/lib/scope'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const locationId = req.nextUrl.searchParams.get('locationId')
  if (!locationId) {
    return NextResponse.json({ error: 'locationId ist erforderlich' }, { status: 400 })
  }

  const erlaubtGet = await locationFilter(session, locationId)
  if (erlaubtGet instanceof NextResponse) return erlaubtGet

  const rules = await getVacationRules(locationId)
  return NextResponse.json({ rules })
}

export async function PUT(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const { locationId, rules } = await req.json()
  if (!locationId || !rules) {
    return NextResponse.json({ error: 'locationId und rules sind erforderlich' }, { status: 400 })
  }

  // §110 Ohne diese Prüfung konnte eine fremde Leitung die Urlaubsregeln
  // dieses Standorts überschreiben.
  const erlaubt = await locationFilter(session, locationId)
  if (erlaubt instanceof NextResponse) return erlaubt

  // §110 Unbekannte oder fehlende Felder liessen die Route mit HTTP 500 und
  // LEEREM Antworttext abstuerzen — der Nutzer sah gar nichts. Jetzt wird
  // benannt, was fehlt.
  const pflicht: Record<string, string> = {
    facilityDescription: 'Beschreibung der Einrichtung',
    maxConcurrent: 'Höchstzahl gleichzeitig Abwesender',
  }
  const fehlend = Object.keys(pflicht).filter(k => rules[k] === undefined || rules[k] === null)
  if (fehlend.length > 0) {
    return NextResponse.json(
      { error: `Es fehlt: ${fehlend.map(k => pflicht[k]).join(', ')}.` },
      { status: 400 },
    )
  }

  try {
    const updated = await setVacationRules(locationId, rules)
    return NextResponse.json({ rules: updated })
  } catch (err) {
    console.error('[vacation-rules] Speichern fehlgeschlagen', err)
    return NextResponse.json(
      { error: 'Die Urlaubsregeln konnten nicht gespeichert werden. Bitte die Angaben prüfen.' },
      { status: 400 },
    )
  }
}
