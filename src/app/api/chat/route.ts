import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import {
  raeumeFuer, eigeneKennung, darfSchreibenAn, direktSchluessel,
} from '@/lib/chat'

export const dynamic = 'force-dynamic'

/**
 * §129/§131 GET  /api/chat    Meine Gespräche
 *           POST /api/chat    Ein Gespräch beginnen
 *                             { art: 'direkt', userId }
 *                             { art: 'gruppe', name, mitglieder[] }  Leitung/Unternehmen
 *
 * Teilnehmer sind Benutzerkonten. Nur OKUN bleibt draußen: Plattformzugänge
 * gehören zu keinem Kunden und haben in keinem Kundengespräch etwas zu suchen.
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
      { error: 'Plattformzugänge nehmen an Kundengesprächen nicht teil.' },
      { status: 403 },
    )
  }

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json(
      { error: 'Dieser Zugang gehört zu keinem Unternehmen.' }, { status: 400 },
    )
  }

  const body = await req.json().catch(() => ({})) as {
    art?: string; userId?: string; name?: string
    beschreibung?: string; mitglieder?: string[]
  }

  const konto = await prisma.user.findUnique({
    where: { id: ich },
    select: { id: true, name: true, locationId: true, employeeId: true },
  })
  if (!konto) return NextResponse.json({ error: 'Zugang nicht gefunden' }, { status: 404 })

  // ── Direktchat ───────────────────────────────────────────────────────────
  if (body.art === 'direkt') {
    if (!body.userId) {
      return NextResponse.json({ error: 'Keine Person angegeben' }, { status: 400 })
    }
    if (!await darfSchreibenAn(session, body.userId)) {
      return NextResponse.json(
        { error: 'Dieser Person können Sie nicht schreiben.' }, { status: 403 },
      )
    }

    const schluessel = direktSchluessel(ich, body.userId)
    const vorhanden = await prisma.chatRaum.findUnique({ where: { schluessel } })
    if (vorhanden) return NextResponse.json({ raum: { id: vorhanden.id }, neu: false })

    const gegenueber = await prisma.user.findUnique({
      where: { id: body.userId }, select: { employeeId: true, locationId: true },
    })

    // Beide schreiben gleichzeitig „Hallo": ohne den eindeutigen Schlüssel
    // gäbe es dann zwei Räume und jeder sähe nur seine Hälfte des Gesprächs.
    try {
      const raum = await prisma.chatRaum.create({
        data: {
          customerId,
          locationId: konto.locationId ?? gegenueber?.locationId ?? null,
          art: 'direkt', schluessel, erstelltVon: ich,
        },
      })
      await prisma.chatMitglied.createMany({
        data: [
          { raumId: raum.id, userId: ich, employeeId: konto.employeeId },
          { raumId: raum.id, userId: body.userId, employeeId: gegenueber?.employeeId ?? null },
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
        { error: 'Gruppen eröffnen die Standortleitung und das Unternehmen.' },
        { status: 403 },
      )
    }
    const name = (body.name ?? '').trim()
    if (name.length < 2) {
      return NextResponse.json({ error: 'Die Gruppe braucht einen Namen.' }, { status: 400 })
    }

    // Jedes Mitglied wird einzeln geprüft — eine Gruppe darf kein Weg sein,
    // jemanden aus einem fremden Bereich hereinzuholen.
    const gewuenscht = Array.from(new Set(body.mitglieder ?? [])).filter(id => id !== ich)
    for (const id of gewuenscht) {
      if (!await darfSchreibenAn(session, id)) {
        return NextResponse.json(
          { error: 'Mindestens eine Person gehört nicht zu Ihrem Bereich.' }, { status: 403 },
        )
      }
    }

    const konten = await prisma.user.findMany({
      where: { id: { in: gewuenscht } },
      select: { id: true, employeeId: true },
    })

    const raum = await prisma.chatRaum.create({
      data: {
        customerId,
        // Eine Geschäftsführung sitzt an keinem Standort — dann ist die Gruppe
        // eine des Unternehmens und nicht die eines Hauses.
        locationId: konto.locationId ?? null,
        art: 'gruppe', name, beschreibung: (body.beschreibung ?? '').trim() || null,
        erstelltVon: ich,
      },
    })
    await prisma.chatMitglied.createMany({
      data: [
        { raumId: raum.id, userId: ich, employeeId: konto.employeeId, rolle: 'leitung' },
        ...konten.map(k => ({ raumId: raum.id, userId: k.id, employeeId: k.employeeId })),
      ],
    })
    await prisma.chatNachricht.create({
      data: {
        raumId: raum.id, userId: 'system', absenderName: 'System', art: 'system',
        text: `${konto.name} hat die Gruppe „${name}" eröffnet.`,
      },
    })
    return NextResponse.json({ raum: { id: raum.id }, neu: true })
  }

  return NextResponse.json({ error: 'Unbekannte Art' }, { status: 400 })
}
