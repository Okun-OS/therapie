/**
 * §169 /api/planning/massnahmen — Maßnahmen genehmigen, ablehnen, kommentieren.
 *
 * WAS EINE MASSNAHME IST
 * Wenn der Rechendienst eine Gruppe nicht besetzen kann, erfindet er nichts,
 * sondern schlägt vor: „Gruppe 7 am Donnerstag aufteilen." Der Vorschlag steht
 * im Ergebnis des Laufs. Entschieden wird er hier — von einem Menschen, mit
 * einem Satz dazu, warum.
 *
 * WARUM DIE ENTSCHEIDUNG AM TAG HÄNGT UND NICHT AM LAUF
 * Nach jeder Krankmeldung wird neu gerechnet. Hinge die Entscheidung am
 * Rechenlauf, müsste die Leitung sie jedes Mal neu treffen. Sie hängt deshalb
 * an (Standort, Typ, Ziel, Tag) — an der Tatsache, nicht am Rechenweg.
 *
 * GET  ?locationId=&von=&bis=  → alle gespeicherten Entscheidungen im Zeitraum
 * PATCH { locationId, typ, ziel, zielName?, tag, text, status, kommentar? }
 *      → legt die Entscheidung an oder ändert sie
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { locationFilter } from '@/lib/scope'
import { prisma } from '@/lib/prisma'

/** Was das System vorschlagen darf. Alles andere ist ein Tippfehler. */
const TYPEN = ['aufteilen', 'frueh_entfaellt', 'spaet_entfaellt'] as const
const STATUS = ['offen', 'genehmigt', 'abgelehnt'] as const

const TAG_FORM = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kein Mandant' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const locationId = searchParams.get('locationId')
  if (!locationId) {
    return NextResponse.json({ error: 'locationId ist erforderlich' }, { status: 400 })
  }

  // §112 Ohne diese Prüfung könnte eine fremde Leitung lesen, welche Gruppen
  // beim Wettbewerber aufgeteilt werden mussten.
  const erlaubt = await locationFilter(session, locationId)
  if (erlaubt instanceof NextResponse) return erlaubt

  const von = searchParams.get('von')
  const bis = searchParams.get('bis')

  const massnahmen = await prisma.planungsMassnahme.findMany({
    where: {
      customerId,
      locationId,
      ...(von && bis ? { tag: { gte: von, lte: bis } } : {}),
    },
    orderBy: [{ tag: 'asc' }, { zielName: 'asc' }],
  })

  return NextResponse.json({ massnahmen })
}

export async function PATCH(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kein Mandant' }, { status: 403 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const locationId = typeof body.locationId === 'string' ? body.locationId : ''
  if (!locationId) {
    return NextResponse.json({ error: 'locationId ist erforderlich' }, { status: 400 })
  }
  const erlaubt = await locationFilter(session, locationId)
  if (erlaubt instanceof NextResponse) return erlaubt

  // §164 Der rohe Wert wird zuerst gelesen und dann geprüft. Wer erst
  // `String(body.typ ?? 'x')` bildet und danach vergleicht, speichert bei
  // fehlendem Feld die Zeichenkette "undefined" — das stand schon zweimal in
  // der Oberfläche.
  const typ = typeof body.typ === 'string' ? body.typ : ''
  if (!(TYPEN as readonly string[]).includes(typ)) {
    return NextResponse.json({ error: `Unbekannte Maßnahme: ${typ || '(fehlt)'}` }, { status: 400 })
  }
  const status = typeof body.status === 'string' ? body.status : ''
  if (!(STATUS as readonly string[]).includes(status)) {
    return NextResponse.json({ error: `Unbekannter Status: ${status || '(fehlt)'}` }, { status: 400 })
  }
  const ziel = typeof body.ziel === 'string' ? body.ziel.trim() : ''
  if (!ziel) return NextResponse.json({ error: 'ziel ist erforderlich' }, { status: 400 })

  const tag = typeof body.tag === 'string' ? body.tag.trim() : ''
  if (!TAG_FORM.test(tag)) {
    return NextResponse.json({ error: 'tag muss JJJJ-MM-TT sein' }, { status: 400 })
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const zielName = typeof body.zielName === 'string' && body.zielName.trim()
    ? body.zielName.trim()
    : null
  // §169 Ein leerer Kommentar ist kein Kommentar. Wer das Feld leert, löscht
  // ihn — sonst bliebe ein Satz stehen, den niemand mehr meint.
  const kommentar = typeof body.kommentar === 'string' && body.kommentar.trim()
    ? body.kommentar.trim()
    : null

  const wer = session.name || session.email
  // §169 Der Name für die Anzeige, die Kennung fürs Löschkonzept.
  const werId = session.userId

  const gespeichert = await prisma.planungsMassnahme.upsert({
    where: { locationId_typ_ziel_tag: { locationId, typ, ziel, tag } },
    create: {
      customerId,
      locationId,
      typ,
      ziel,
      zielName,
      tag,
      text,
      status,
      kommentar,
      // §169 „offen" ist keine Entscheidung. Wer nur einen Kommentar
      // hinterlässt, steht nicht als Entscheider im Protokoll.
      entschiedenVon: status === 'offen' ? null : wer,
      entschiedenVonId: status === 'offen' ? null : werId,
      entschiedenAm: status === 'offen' ? null : new Date(),
    },
    update: {
      // Der Vorschlagstext kann sich nach einem neuen Lauf ändern; der
      // Name der Gruppe auch. Beides wird nachgezogen, die Entscheidung nicht.
      ...(text ? { text } : {}),
      ...(zielName ? { zielName } : {}),
      status,
      kommentar,
      entschiedenVon: status === 'offen' ? null : wer,
      entschiedenVonId: status === 'offen' ? null : werId,
      entschiedenAm: status === 'offen' ? null : new Date(),
    },
  })

  return NextResponse.json({ massnahme: gespeichert })
}
