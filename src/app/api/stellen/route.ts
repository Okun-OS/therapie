import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { allowedLocationScope } from '@/lib/scope'
import { logAudit } from '@/lib/audit'
import {
  freierSlug, fehltZumVeroeffentlichen, UMFAENGE, STELLEN_STAENDE,
} from '@/lib/recruiting'

export const dynamic = 'force-dynamic'

/**
 * §148 Stellenanzeigen.
 *
 * WER HIER SCHREIBEN DARF
 * Die Standortleitung für ihren Standort, die Unternehmensebene für alles.
 * Eine Stelle auszuschreiben ist die Sache derer, die sie besetzen muss —
 * sie über die Zentrale laufen zu lassen, wäre der sicherste Weg, dass die
 * Anzeige drei Wochen zu spät online geht.
 *
 * WAS DIE LEITUNG NICHT DARF
 * Unternehmensweit ausschreiben (`locationId` leer). Eine Anzeige ohne
 * Standort steht für den ganzen Träger — das entscheidet der Träger.
 *
 * WARUM VERÖFFENTLICHEN EIN EIGENER SCHRITT IST
 * Weil zwischen „angelegt" und „im Internet" ein Unterschied liegt, den man
 * nicht versehentlich überschreiten können soll. Beim Wechsel auf
 * `veroeffentlicht` prüft das System, ob die Anzeige überhaupt vollständig
 * ist, und sagt sonst, was fehlt.
 */

const FELDER = {
  id: true, customerId: true, locationId: true, titel: true, ort: true,
  plz: true, umfang: true, stundenProWoche: true, befristung: true,
  befristetBis: true, beginn: true, beschreibung: true, aufgaben: true,
  profil: true, wirBieten: true, verguetungVon: true, verguetungBis: true,
  verguetungZeit: true, status: true, slug: true, veroeffentlichtAm: true,
  geschlossenAm: true, kontaktName: true, kontaktEmail: true,
  erstelltVon: true, createdAt: true, updatedAt: true,
} as const

/** Darf diese Sitzung an einer Anzeige für diesen Standort arbeiten? */
async function standortErlaubt(
  session: { role: string }, locationId: string | null,
): Promise<NextResponse | null> {
  if (session.role === 'company' || session.role === 'okun') return null
  if (!locationId) {
    return NextResponse.json(
      {
        error: 'Eine Anzeige ohne Standort gilt für das ganze Unternehmen — '
          + 'das schreibt die Unternehmensebene aus.',
      },
      { status: 403 },
    )
  }
  const scope = await allowedLocationScope(session as never)
  if (scope.kind !== 'all' && !scope.ids.includes(locationId)) {
    return NextResponse.json(
      { error: 'Kein Zugriff auf diesen Standort' }, { status: 403 },
    )
  }
  return null
}

function zahl(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : null
}

function liste(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map(x => String(x).trim()).filter(Boolean).slice(0, 30)
}

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ stellen: [] })

  const scope = await allowedLocationScope(session)
  const stellen = await prisma.stelle.findMany({
    where: {
      customerId,
      // Die Leitung sieht die Anzeigen ihres Standorts und die
      // unternehmensweiten — die betreffen sie ja auch.
      ...(scope.kind === 'all' ? {} : {
        OR: [{ locationId: { in: scope.ids } }, { locationId: null }],
      }),
    },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    select: FELDER,
  })

  // Wie viele Bewerbungen je Anzeige offen sind — die Zahl, nach der in der
  // Liste zuerst geschaut wird.
  const zaehlung = await prisma.bewerbung.groupBy({
    by: ['stelleId'],
    where: {
      customerId, stelleId: { in: stellen.map(s => s.id) },
      status: { notIn: ['absage', 'eingestellt'] },
    },
    _count: { _all: true },
  })
  const offen = new Map(zaehlung.map(z => [z.stelleId, z._count._all]))

  return NextResponse.json({
    stellen: stellen.map(s => ({ ...s, offeneBewerbungen: offen.get(s.id) ?? 0 })),
    umfaenge: UMFAENGE,
  })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const titel = String(body.titel ?? '').trim()
  if (!titel) return NextResponse.json({ error: 'Ein Titel fehlt.' }, { status: 400 })

  const locationId = body.locationId ? String(body.locationId) : null
  const verweigert = await standortErlaubt(session, locationId)
  if (verweigert) return verweigert

  // Fehlt der Ort, wird er vom Standort übernommen — das ist in neun von zehn
  // Fällen richtig und spart eine Eingabe.
  let ort = String(body.ort ?? '').trim() || null
  let plz = String(body.plz ?? '').trim() || null
  if (locationId && (!ort || !plz)) {
    const standort = await prisma.location.findUnique({
      where: { id: locationId }, select: { city: true, zip: true },
    })
    ort = ort ?? standort?.city ?? null
    plz = plz ?? standort?.zip ?? null
  }

  const vergeben = await prisma.stelle.findMany({
    where: { customerId }, select: { slug: true },
  })
  const slug = freierSlug(titel, vergeben.map(v => v.slug))

  const stelle = await prisma.stelle.create({
    data: {
      customerId, locationId, titel, ort, plz, slug,
      umfang: String(body.umfang ?? 'vollzeit') in UMFAENGE
        ? String(body.umfang ?? 'vollzeit') : 'vollzeit',
      stundenProWoche: zahl(body.stundenProWoche),
      befristung: body.befristung === 'befristet' ? 'befristet' : 'unbefristet',
      befristetBis: String(body.befristetBis ?? '').trim() || null,
      beginn: String(body.beginn ?? '').trim() || null,
      beschreibung: String(body.beschreibung ?? '').slice(0, 20_000),
      aufgaben: liste(body.aufgaben),
      profil: liste(body.profil),
      wirBieten: liste(body.wirBieten),
      verguetungVon: zahl(body.verguetungVon),
      verguetungBis: zahl(body.verguetungBis),
      verguetungZeit: ['stunde', 'monat', 'jahr'].includes(String(body.verguetungZeit))
        ? String(body.verguetungZeit) : 'monat',
      kontaktName: String(body.kontaktName ?? '').trim() || null,
      kontaktEmail: String(body.kontaktEmail ?? '').trim() || null,
      erstelltVon: session.name ?? session.email,
    },
    select: FELDER,
  })

  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'create', entityType: 'Stelle', entityId: stelle.id,
    customerId, details: { titel },
  })

  return NextResponse.json({ stelle })
}

export async function PATCH(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const vorhanden = await prisma.stelle.findFirst({ where: { id, customerId } })
  if (!vorhanden) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const verweigert = await standortErlaubt(session, vorhanden.locationId)
  if (verweigert) return verweigert

  const daten: Record<string, unknown> = {}
  const setzeText = (feld: string, max = 500) => {
    if (body[feld] !== undefined) {
      daten[feld] = String(body[feld] ?? '').slice(0, max).trim() || null
    }
  }
  if (body.titel !== undefined) {
    const t = String(body.titel).trim()
    if (!t) return NextResponse.json({ error: 'Ein Titel fehlt.' }, { status: 400 })
    daten.titel = t
  }
  setzeText('ort'); setzeText('plz'); setzeText('beginn'); setzeText('befristetBis')
  setzeText('kontaktName'); setzeText('kontaktEmail')
  if (body.beschreibung !== undefined) {
    daten.beschreibung = String(body.beschreibung ?? '').slice(0, 20_000)
  }
  for (const feld of ['aufgaben', 'profil', 'wirBieten']) {
    if (body[feld] !== undefined) daten[feld] = liste(body[feld])
  }
  for (const feld of ['stundenProWoche', 'verguetungVon', 'verguetungBis']) {
    if (body[feld] !== undefined) daten[feld] = zahl(body[feld])
  }
  if (body.umfang !== undefined && String(body.umfang) in UMFAENGE) {
    daten.umfang = String(body.umfang)
  }
  if (body.befristung !== undefined) {
    daten.befristung = body.befristung === 'befristet' ? 'befristet' : 'unbefristet'
  }
  if (body.verguetungZeit !== undefined
      && ['stunde', 'monat', 'jahr'].includes(String(body.verguetungZeit))) {
    daten.verguetungZeit = String(body.verguetungZeit)
  }
  // Der Standort darf wechseln — aber nur in einen, den man auch sehen darf.
  if (body.locationId !== undefined) {
    const neu = body.locationId ? String(body.locationId) : null
    const abgelehnt = await standortErlaubt(session, neu)
    if (abgelehnt) return abgelehnt
    daten.locationId = neu
  }

  if (body.status !== undefined) {
    const status = String(body.status)
    if (!STELLEN_STAENDE.includes(status as never)) {
      return NextResponse.json({ error: 'Unbekannter Stand' }, { status: 400 })
    }
    if (status === 'veroeffentlicht') {
      // Gegen den Stand nach der Änderung prüfen, nicht gegen den davor —
      // sonst scheitert das Veröffentlichen genau in dem Zug, in dem der
      // fehlende Text nachgereicht wird.
      const kuenftig = { ...vorhanden, ...daten } as Record<string, unknown>
      const fehlt = fehltZumVeroeffentlichen({
        titel: kuenftig.titel as string,
        ort: kuenftig.ort as string,
        umfang: kuenftig.umfang as string,
        beschreibung: kuenftig.beschreibung as string,
        aufgaben: kuenftig.aufgaben as string[],
        profil: kuenftig.profil as string[],
      })
      if (fehlt.length > 0) {
        return NextResponse.json(
          { error: 'Die Anzeige ist noch nicht vollständig.', fehlt }, { status: 400 },
        )
      }
      daten.veroeffentlichtAm = vorhanden.veroeffentlichtAm ?? new Date()
      daten.geschlossenAm = null
    }
    if (status === 'geschlossen') daten.geschlossenAm = new Date()
    if (status === 'entwurf') daten.geschlossenAm = null
    daten.status = status
  }

  const stelle = await prisma.stelle.update({
    where: { id }, data: daten, select: FELDER,
  })

  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'update', entityType: 'Stelle', entityId: id,
    customerId, details: { status: daten.status ?? vorhanden.status },
  })

  return NextResponse.json({ stelle })
}

/**
 * Eine Anzeige löschen.
 *
 * Nur ein Entwurf, an dem keine Bewerbung hängt. Alles andere wird
 * geschlossen, nicht gelöscht: An einer veröffentlichten Anzeige hängen
 * Bewerbungen, und eine Bewerbung ohne die Stelle, auf die sie sich bezog,
 * ist im Streitfall wertlos.
 */
export async function DELETE(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const vorhanden = await prisma.stelle.findFirst({ where: { id, customerId } })
  if (!vorhanden) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const verweigert = await standortErlaubt(session, vorhanden.locationId)
  if (verweigert) return verweigert

  const bewerbungen = await prisma.bewerbung.count({ where: { stelleId: id } })
  if (bewerbungen > 0 || vorhanden.veroeffentlichtAm) {
    return NextResponse.json(
      {
        error: bewerbungen > 0
          ? `An dieser Anzeige hängen ${bewerbungen} Bewerbungen. Sie wird `
            + 'geschlossen, nicht gelöscht — sonst fehlt später der Bezug.'
          : 'Diese Anzeige war schon online. Sie wird geschlossen, nicht gelöscht.',
      },
      { status: 409 },
    )
  }

  await prisma.stelle.delete({ where: { id } })
  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'delete', entityType: 'Stelle', entityId: id,
    customerId, details: { titel: vorhanden.titel },
  })
  return NextResponse.json({ ok: true })
}
