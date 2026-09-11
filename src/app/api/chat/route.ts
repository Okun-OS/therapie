import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import {
  raeumeFuer, eigeneKennung, darfSchreibenAn, direktSchluessel,
} from '@/lib/chat'

export const dynamic = 'force-dynamic'

/**
 * §129 GET  /api/chat    Meine Gespräche
 *      POST /api/chat    Ein Gespräch beginnen
 *                        { art: 'direkt', employeeId }
 *                        { art: 'gruppe', name, mitglieder[] }   nur Leitung
 *
 * Eine Sitzung ohne eigene Mitarbeiterkennung kann den Chat nicht benutzen —
 * das trifft OKUN, und das ist so gewollt: Plattformzugänge gehören in keinen
 * Kundenchat.
 */
export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session
  if (!eigeneKennung(session)) {
    return NextResponse.json({ raeume: [], ungelesen: 0, chatMoeglich: false })
  }

  const raeume = await raeumeFuer(session)
  return NextResponse.json({
    raeume,
    ungelesen: raeume.reduce((s, r) => s + r.ungelesen, 0),
    chatMoeglich: true,
  })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const ich = eigeneKennung(session)
  if (!ich) {
    return NextResponse.json(
      { error: 'Dieser Zugang gehört zu keinem Mitarbeiter und kann den Chat nicht nutzen.' },
      { status: 403 },
    )
  }

  const body = await req.json().catch(() => ({})) as {
    art?: string; employeeId?: string; name?: string
    beschreibung?: string; mitglieder?: string[]
  }

  const mich = await prisma.employee.findUnique({
    where: { id: ich },
    select: { id: true, name: true, locationId: true, customerId: true },
  })
  if (!mich?.locationId || !mich.customerId) {
    return NextResponse.json(
      { error: 'Ohne Standort ist kein Chat möglich.' }, { status: 400 },
    )
  }

  // ── Direktchat ───────────────────────────────────────────────────────────
  if (body.art === 'direkt') {
    if (!body.employeeId) {
      return NextResponse.json({ error: 'Keine Person angegeben' }, { status: 400 })
    }
    if (!await darfSchreibenAn(session, body.employeeId)) {
      return NextResponse.json(
        { error: 'Dieser Person können Sie nicht schreiben.' }, { status: 403 },
      )
    }

    const schluessel = direktSchluessel(ich, body.employeeId)
    const vorhanden = await prisma.chatRaum.findUnique({ where: { schluessel } })
    if (vorhanden) return NextResponse.json({ raum: { id: vorhanden.id }, neu: false })

    // Beide schreiben gleichzeitig „Hallo": ohne den eindeutigen Schlüssel
    // gäbe es dann zwei Räume und jeder sähe nur seine Hälfte des Gesprächs.
    try {
      const raum = await prisma.chatRaum.create({
        data: {
          customerId: mich.customerId, locationId: mich.locationId,
          art: 'direkt', schluessel, erstelltVon: ich,
        },
      })
      await prisma.chatMitglied.createMany({
        data: [
          { raumId: raum.id, employeeId: ich },
          { raumId: raum.id, employeeId: body.employeeId },
        ],
      })
      return NextResponse.json({ raum: { id: raum.id }, neu: true })
    } catch {
      const jetztDoch = await prisma.chatRaum.findUnique({ where: { schluessel } })
      if (jetztDoch) return NextResponse.json({ raum: { id: jetztDoch.id }, neu: false })
      return NextResponse.json({ error: 'Gespräch konnte nicht angelegt werden' }, { status: 500 })
    }
  }

  // ── Gruppe ───────────────────────────────────────────────────────────────
  if (body.art === 'gruppe') {
    if (!['admin', 'company'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Gruppen eröffnet die Standortleitung.' }, { status: 403 },
      )
    }
    const name = (body.name ?? '').trim()
    if (name.length < 2) {
      return NextResponse.json({ error: 'Die Gruppe braucht einen Namen.' }, { status: 400 })
    }

    // Jedes Mitglied wird einzeln geprüft — eine Gruppe darf kein Weg sein,
    // jemanden aus einem fremden Standort hereinzuholen.
    const gewuenscht = Array.from(new Set(body.mitglieder ?? [])).filter(id => id !== ich)
    for (const id of gewuenscht) {
      if (!await darfSchreibenAn(session, id)) {
        return NextResponse.json(
          { error: 'Mindestens eine Person gehört nicht zu Ihrem Bereich.' }, { status: 403 },
        )
      }
    }

    const raum = await prisma.chatRaum.create({
      data: {
        customerId: mich.customerId, locationId: mich.locationId,
        art: 'gruppe', name, beschreibung: (body.beschreibung ?? '').trim() || null,
        erstelltVon: ich,
      },
    })
    await prisma.chatMitglied.createMany({
      data: [
        { raumId: raum.id, employeeId: ich, rolle: 'leitung' },
        ...gewuenscht.map(id => ({ raumId: raum.id, employeeId: id })),
      ],
    })
    await prisma.chatNachricht.create({
      data: {
        raumId: raum.id, employeeId: 'system', absenderName: 'System', art: 'system',
        text: `${mich.name} hat die Gruppe „${name}" eröffnet.`,
      },
    })
    return NextResponse.json({ raum: { id: raum.id }, neu: true })
  }

  return NextResponse.json({ error: 'Unbekannte Art' }, { status: 400 })
}
