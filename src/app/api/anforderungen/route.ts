import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { allowedLocationScope, assertEmployeeAccess } from '@/lib/scope'
import { logAudit } from '@/lib/audit'
import { notifyEmployee } from '@/lib/notify'
import { getAppOrigin } from '@/lib/app-url'
import { lage, reihenfolge, OFFEN, STAENDE, darfErinnern } from '@/lib/anforderung'

export const dynamic = 'force-dynamic'

/**
 * §149 Nachweise anfordern.
 *
 * DREI SICHTEN AUF DIESELBEN DATEN
 *   Rolle employee     ausschließlich die eigenen
 *   Leitung            die Leute des eigenen Standorts
 *   Unternehmensebene  alle
 *
 * WAS EINE ANFORDERUNG VON EINER NACHRICHT UNTERSCHEIDET
 * Sie hat einen Zustand und sie geht nicht weg, bis jemand etwas tut. Eine
 * Bitte im Chat ist nach drei Tagen weggescrollt; hier steht sie, bis sie
 * abgenommen oder zurückgezogen wurde.
 *
 * WARUM DER MITARBEITER HIER SCHREIBEN DARF
 * Weil er einreicht. Alles Weitere — abnehmen, nachfragen, zurückziehen —
 * entscheidet der Betrieb. Durchgesetzt wird das in `src/lib/anforderung.ts`,
 * nicht in der Oberfläche.
 */

const FELDER = {
  id: true, customerId: true, employeeId: true, locationId: true,
  fristId: true, nachweisartId: true, titel: true, hinweis: true,
  fristBis: true, status: true, statusAm: true,
  angefordertVonName: true, eingereichtAm: true, erledigtAm: true,
  erledigtVon: true, erinnertAm: true, createdAt: true,
} as const

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ anforderungen: [] })

  const gefragt = req.nextUrl.searchParams.get('employeeId')
  const nurOffene = req.nextUrl.searchParams.get('offen') === '1'

  let wo: Record<string, unknown>
  if (session.role === 'employee') {
    if (!session.employeeId) return NextResponse.json({ anforderungen: [] })
    wo = { customerId, employeeId: session.employeeId }
  } else if (gefragt) {
    const verweigert = await assertEmployeeAccess(session, gefragt)
    if (verweigert) return verweigert
    wo = { customerId, employeeId: gefragt }
  } else {
    const scope = await allowedLocationScope(session)
    const leute = await prisma.employee.findMany({
      where: {
        customerId, active: true, datenGesperrtAm: null,
        ...(scope.kind === 'all' ? {} : { locationId: { in: scope.ids } }),
      },
      select: { id: true },
    })
    wo = { customerId, employeeId: { in: leute.map(l => l.id) } }
  }

  const roh = await prisma.anforderung.findMany({
    where: { ...wo, ...(nurOffene ? { status: { in: OFFEN } } : {}) },
    select: FELDER,
  })

  // Die Namen dazu, damit die Liste ohne zweite Abfrage lesbar ist.
  const namen = new Map<string, string>()
  if (session.role !== 'employee' && roh.length > 0) {
    const leute = await prisma.employee.findMany({
      where: { id: { in: Array.from(new Set(roh.map(a => a.employeeId))) } },
      select: { id: true, name: true },
    })
    for (const l of leute) namen.set(l.id, l.name)
  }

  const seite = session.role === 'employee' ? 'mitarbeiter' : 'betrieb'
  const anforderungen = roh
    .sort(reihenfolge)
    .map(a => {
      const l = lage(a, seite)
      return {
        ...a,
        personName: namen.get(a.employeeId) ?? null,
        stand: l.stand, standText: l.text, hinweis: l.hinweis,
        ueberfaellig: l.ueberfaellig, tageBis: l.tageBis,
      }
    })

  return NextResponse.json({
    anforderungen,
    staende: STAENDE,
    zusammenfassung: {
      offen: anforderungen.filter(a => a.stand === 'offen').length,
      eingereicht: anforderungen.filter(a => a.stand === 'eingereicht').length,
      rueckfrage: anforderungen.filter(a => a.stand === 'rueckfrage').length,
    },
  })
}

/**
 * Etwas anfordern.
 *
 * Für eine Person oder für viele auf einmal — der zweite Fall ist der
 * häufigere: Eine neue Vorschrift trifft selten nur einen.
 */
export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const titel = String(body.titel ?? '').trim()
  if (!titel) {
    return NextResponse.json(
      { error: 'Was soll eingereicht werden? Ohne Titel weiß das niemand.' },
      { status: 400 },
    )
  }

  const ids: string[] = Array.isArray(body.employeeIds)
    ? body.employeeIds.map(String)
    : body.employeeId ? [String(body.employeeId)] : []
  if (ids.length === 0) {
    return NextResponse.json({ error: 'Von wem?' }, { status: 400 })
  }

  // Jede Person einzeln prüfen. Eine Liste, bei der nur der erste Eintrag
  // geprüft wird, ist keine Prüfung.
  for (const id of ids) {
    const verweigert = await assertEmployeeAccess(session, id)
    if (verweigert) return verweigert
  }

  const fristBis = body.fristBis ? new Date(String(body.fristBis)) : null
  const hinweis = String(body.hinweis ?? '').slice(0, 5000).trim() || null
  const angelegt: { id: string; employeeId: string }[] = []

  for (const employeeId of ids) {
    // Für dieselbe Sache nicht zweimal anfordern — der Empfänger sähe zwei
    // gleich aussehende Aufgaben und wüsste nicht, welche gemeint ist.
    const schonOffen = await prisma.anforderung.findFirst({
      where: {
        employeeId, titel, status: { in: OFFEN },
        ...(body.fristId ? { fristId: String(body.fristId) } : {}),
      },
      select: { id: true },
    })
    if (schonOffen) continue

    const person = await prisma.employee.findUnique({
      where: { id: employeeId }, select: { locationId: true },
    })

    const a = await prisma.anforderung.create({
      data: {
        customerId, employeeId, locationId: person?.locationId ?? null,
        fristId: body.fristId ? String(body.fristId) : null,
        nachweisartId: body.nachweisartId ? String(body.nachweisartId) : null,
        titel, hinweis, fristBis,
        angefordertVon: session.userId,
        angefordertVonName: session.name ?? session.email,
        erinnertAm: new Date(),
      },
      select: { id: true, employeeId: true },
    })

    await prisma.anforderungBeitrag.create({
      data: {
        anforderungId: a.id, userId: session.userId, seite: 'betrieb',
        absenderName: session.name ?? session.email,
        text: hinweis
          ? `${titel} wird gebraucht.\n\n${hinweis}`
          : `${titel} wird gebraucht.`,
      },
    }).catch(() => undefined)

    await notifyEmployee(employeeId, {
      type: 'nachweis_angefordert',
      title: `Bitte einreichen: ${titel}`,
      body: [
        hinweis,
        fristBis ? `Bis ${fristBis.toLocaleDateString('de-DE')}.` : null,
        'Du kannst es direkt in der App hochladen.',
      ].filter(Boolean).join(' '),
      requestId: a.id,
      url: `${getAppOrigin(req)}/employee/nachweise`,
    }).catch(() => undefined)

    angelegt.push(a)
  }

  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'create', entityType: 'Anforderung', entityId: angelegt[0]?.id,
    customerId, details: { titel, personen: angelegt.length },
  })

  return NextResponse.json({
    angelegt: angelegt.length,
    uebersprungen: ids.length - angelegt.length,
    ids: angelegt.map(a => a.id),
  })
}

/**
 * Noch einmal erinnern.
 *
 * Bewusst von Hand und nicht als täglicher Automat: Wer eine Mahnung schickt,
 * soll sie wollen. Die Sperre von sieben Tagen verhindert, dass derselbe
 * Mensch dreimal am Tag angestupst wird, wenn zwei Leitungen dieselbe Liste
 * durchgehen.
 */
export async function PATCH(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  if (body.aktion !== 'erinnern') {
    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
  }

  const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String)
    : body.id ? [String(body.id)] : []
  if (ids.length === 0) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  let erinnert = 0
  let zuFrueh = 0
  for (const id of ids) {
    const a = await prisma.anforderung.findFirst({ where: { id, customerId } })
    if (!a) continue
    const verweigert = await assertEmployeeAccess(session, a.employeeId)
    if (verweigert) return verweigert
    if (!darfErinnern(a)) { zuFrueh++; continue }

    await notifyEmployee(a.employeeId, {
      type: 'nachweis_erinnerung',
      title: `Erinnerung: ${a.titel}`,
      body: a.fristBis
        ? `Bitte bis ${a.fristBis.toLocaleDateString('de-DE')} einreichen.`
        : 'Bitte noch einreichen.',
      requestId: a.id,
      url: `${getAppOrigin(req)}/employee/nachweise`,
    }).catch(() => undefined)

    await prisma.anforderung.update({
      where: { id }, data: { erinnertAm: new Date() },
    })
    erinnert++
  }

  return NextResponse.json({
    erinnert, zuFrueh,
    ...(zuFrueh > 0 && erinnert === 0
      ? {
        hinweis: 'Hier wurde vor Kurzem schon erinnert. Eine Mahnung alle '
          + 'paar Tage liest noch jemand — eine tägliche nicht mehr.',
      }
      : {}),
  })
}
