import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { sendPushToEmployee } from '@/lib/push'
import {
  raumZugriff, darfVerwalten, darfSchreibenAn, eigeneKennung, systemHinweis, MAX_ZEICHEN,
} from '@/lib/chat'

export const dynamic = 'force-dynamic'

/**
 * §129 Ein einzelnes Gespräch.
 *
 *   GET    Verlauf und Mitglieder
 *   POST   Nachricht schreiben
 *   PATCH  gelesen · Name/Beschreibung · Mitglieder · beitreten · verlassen · schließen
 *
 * „Gibt es nicht" und „du bist kein Mitglied" werden beide mit 404 beantwortet.
 * Sonst ließe sich durch Ausprobieren herausfinden, welche Gespräche existieren
 * — und schon die Existenz eines Gesprächs ist eine Information über Menschen.
 */

const NICHT_DA = NextResponse.json({ error: 'Gespräch nicht gefunden' }, { status: 404 })

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const zugriff = await raumZugriff(session, params.id)
  if (zugriff.grund !== 'ok') return NICHT_DA
  const raum = zugriff.raum!
  const ich = eigeneKennung(session)!

  const [nachrichten, mitglieder] = await Promise.all([
    prisma.chatNachricht.findMany({
      where: { raumId: raum.id },
      orderBy: { createdAt: 'asc' },
      take: 500,
    }),
    prisma.chatMitglied.findMany({ where: { raumId: raum.id } }),
  ])

  const namen = new Map(
    (await prisma.employee.findMany({
      where: { id: { in: mitglieder.map(m => m.employeeId) } },
      select: { id: true, name: true, position: true },
    })).map(e => [e.id, e]),
  )

  const gegenueber = raum.art === 'direkt'
    ? mitglieder.find(m => m.employeeId !== ich)?.employeeId
    : undefined

  return NextResponse.json({
    raum: {
      id: raum.id,
      art: raum.art,
      titel: raum.art === 'direkt'
        ? (gegenueber ? namen.get(gegenueber)?.name ?? 'Ehemalige Kollegin' : 'Gespräch')
        : raum.name,
      beschreibung: raum.beschreibung,
      archiviert: !!raum.archiviertAm,
      darfVerwalten: await darfVerwalten(session, raum),
      binLeitung: zugriff.mitglied!.rolle === 'leitung',
    },
    mitglieder: mitglieder.map(m => ({
      employeeId: m.employeeId,
      name: namen.get(m.employeeId)?.name ?? 'Ehemalige Kollegin',
      position: namen.get(m.employeeId)?.position ?? null,
      rolle: m.rolle,
      ichSelbst: m.employeeId === ich,
    })),
    nachrichten: nachrichten.map(n => ({
      id: n.id, text: n.text, art: n.art,
      absenderName: n.absenderName,
      vonMir: n.employeeId === ich,
      createdAt: n.createdAt.toISOString(),
    })),
  })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const zugriff = await raumZugriff(session, params.id)
  if (zugriff.grund !== 'ok') return NICHT_DA
  const raum = zugriff.raum!
  const ich = eigeneKennung(session)!

  if (raum.archiviertAm) {
    return NextResponse.json(
      { error: 'Diese Gruppe ist geschlossen. Der Verlauf bleibt lesbar.' }, { status: 409 },
    )
  }

  const { text } = await req.json().catch(() => ({})) as { text?: string }
  const inhalt = (text ?? '').trim()
  if (!inhalt) return NextResponse.json({ error: 'Die Nachricht ist leer.' }, { status: 400 })
  if (inhalt.length > MAX_ZEICHEN) {
    return NextResponse.json(
      { error: `Höchstens ${MAX_ZEICHEN} Zeichen.` }, { status: 400 },
    )
  }

  const mich = await prisma.employee.findUnique({
    where: { id: ich }, select: { name: true },
  })

  const nachricht = await prisma.chatNachricht.create({
    data: {
      raumId: raum.id, employeeId: ich,
      absenderName: mich?.name ?? 'Unbekannt', text: inhalt,
    },
  })
  await prisma.chatRaum.update({
    where: { id: raum.id }, data: { letzteAktivitaet: nachricht.createdAt },
  })

  // Push, aber keine E-Mail und kein Eintrag ins Postfach: bei einem Gespräch
  // mit dreißig Nachrichten am Tag wären beides dreißig Störungen, und das
  // Postfach fasst ohnehin nur die letzten dreißig Meldungen.
  const andere = await prisma.chatMitglied.findMany({
    where: { raumId: raum.id, employeeId: { not: ich } },
    select: { employeeId: true },
  })
  const titel = raum.art === 'gruppe' ? `${raum.name}: ${mich?.name}` : (mich?.name ?? 'Nachricht')
  await Promise.all(andere.map(m => sendPushToEmployee(m.employeeId, {
    title: titel,
    body: inhalt.length > 120 ? `${inhalt.slice(0, 117)}…` : inhalt,
    url: '/employee/nachrichten',
  }).catch(() => undefined)))

  return NextResponse.json({
    nachricht: {
      id: nachricht.id, text: nachricht.text, art: nachricht.art,
      absenderName: nachricht.absenderName, vonMir: true,
      createdAt: nachricht.createdAt.toISOString(),
    },
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const ich = eigeneKennung(session)
  if (!ich) return NICHT_DA

  const body = await req.json().catch(() => ({})) as {
    gelesen?: boolean
    name?: string; beschreibung?: string
    hinzufuegen?: string[]; entfernen?: string
    beitreten?: boolean; verlassen?: boolean; archivieren?: boolean
  }

  const zugriff = await raumZugriff(session, params.id)

  // ── Beitreten: der einzige Weg in einen Raum, in dem man nicht ist ───────
  //
  // Nur für Gruppen und nur für die Leitung des Standorts — und er hinterlässt
  // eine sichtbare Spur im Verlauf. Eine Vorgesetzte, die unbemerkt mitliest,
  // wäre keine Funktion, sondern ein Vertrauensbruch.
  if (body.beitreten) {
    if (zugriff.grund === 'ok') return NextResponse.json({ ok: true })
    if (!zugriff.raum) return NICHT_DA
    if (!await darfVerwalten(session, zugriff.raum)) return NICHT_DA

    const mich = await prisma.employee.findUnique({ where: { id: ich }, select: { name: true } })
    await prisma.chatMitglied.create({
      data: { raumId: zugriff.raum.id, employeeId: ich, rolle: 'leitung' },
    })
    await systemHinweis(zugriff.raum.id,
      `${mich?.name ?? 'Die Leitung'} ist der Gruppe beigetreten und liest ab jetzt mit.`)
    return NextResponse.json({ ok: true })
  }

  if (zugriff.grund !== 'ok') return NICHT_DA
  const raum = zugriff.raum!

  // ── Lesestand ────────────────────────────────────────────────────────────
  if (body.gelesen) {
    await prisma.chatMitglied.update({
      where: { raumId_employeeId: { raumId: raum.id, employeeId: ich } },
      data: { gelesenBis: new Date() },
    })
    return NextResponse.json({ ok: true })
  }

  // ── Verlassen ────────────────────────────────────────────────────────────
  if (body.verlassen) {
    if (raum.art !== 'gruppe') {
      return NextResponse.json(
        { error: 'Ein Gespräch zu zweit lässt sich nicht verlassen.' }, { status: 400 },
      )
    }
    const mich = await prisma.employee.findUnique({ where: { id: ich }, select: { name: true } })
    await prisma.chatMitglied.delete({
      where: { raumId_employeeId: { raumId: raum.id, employeeId: ich } },
    })
    await systemHinweis(raum.id, `${mich?.name ?? 'Jemand'} hat die Gruppe verlassen.`)
    return NextResponse.json({ ok: true })
  }

  // ── Ab hier: Verwaltung ──────────────────────────────────────────────────
  if (!await darfVerwalten(session, raum)) {
    return NextResponse.json(
      { error: 'Gruppen verwaltet die Standortleitung.' }, { status: 403 },
    )
  }

  if (typeof body.name === 'string' || typeof body.beschreibung === 'string') {
    const name = (body.name ?? raum.name ?? '').trim()
    if (name.length < 2) {
      return NextResponse.json({ error: 'Die Gruppe braucht einen Namen.' }, { status: 400 })
    }
    await prisma.chatRaum.update({
      where: { id: raum.id },
      data: {
        name,
        ...(typeof body.beschreibung === 'string'
          ? { beschreibung: body.beschreibung.trim() || null } : {}),
      },
    })
    return NextResponse.json({ ok: true })
  }

  if (body.hinzufuegen?.length) {
    for (const id of body.hinzufuegen) {
      if (!await darfSchreibenAn(session, id)) {
        return NextResponse.json(
          { error: 'Mindestens eine Person gehört nicht zu Ihrem Bereich.' }, { status: 403 },
        )
      }
    }
    const namen = new Map(
      (await prisma.employee.findMany({
        where: { id: { in: body.hinzufuegen } }, select: { id: true, name: true },
      })).map(e => [e.id, e.name]),
    )
    for (const id of body.hinzufuegen) {
      const schon = await prisma.chatMitglied.findUnique({
        where: { raumId_employeeId: { raumId: raum.id, employeeId: id } },
      })
      if (schon) continue
      await prisma.chatMitglied.create({ data: { raumId: raum.id, employeeId: id } })
      await systemHinweis(raum.id, `${namen.get(id) ?? 'Jemand'} wurde hinzugefügt.`)
    }
    return NextResponse.json({ ok: true })
  }

  if (body.entfernen) {
    const person = await prisma.employee.findUnique({
      where: { id: body.entfernen }, select: { name: true },
    })
    await prisma.chatMitglied.deleteMany({
      where: { raumId: raum.id, employeeId: body.entfernen },
    })
    await systemHinweis(raum.id, `${person?.name ?? 'Jemand'} wurde entfernt.`)
    return NextResponse.json({ ok: true })
  }

  if (typeof body.archivieren === 'boolean') {
    // Geschlossen heißt nicht gelöscht: der Verlauf bleibt für die Mitglieder
    // lesbar. Wer eine Absprache von vor einem Jahr sucht, findet sie wieder.
    await prisma.chatRaum.update({
      where: { id: raum.id },
      data: { archiviertAm: body.archivieren ? new Date() : null },
    })
    await systemHinweis(raum.id, body.archivieren
      ? 'Die Gruppe wurde geschlossen. Der Verlauf bleibt lesbar.'
      : 'Die Gruppe wurde wieder geöffnet.')
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Nichts zu ändern' }, { status: 400 })
}
