import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { sendPushToEmployee } from '@/lib/push'
import {
  raumZugriff, darfVerwalten, darfSchreibenAn, eigeneKennung, systemHinweis,
  MAX_ZEICHEN, ROLLEN_TEXT,
} from '@/lib/chat'
import {
  OKUN_ART, ASSISTENT_ART, weiterleitenAnOkun, assistentAntwortet,
} from '@/lib/okun-kanal'

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

  // §146 Die NEUESTEN 500, nicht die ältesten.
  //
  // Vorher stand hier `orderBy: asc` mit `take: 500` — das liefert die ersten
  // fünfhundert Nachrichten eines Raums. Ab der fünfhunderteinsten sah man die
  // neuen nie wieder: Der Verlauf blieb in der Vergangenheit stehen, und jede
  // Antwort verschwand, ohne dass jemand es gemerkt hätte. Aufgefallen im
  // eigenen Prüflauf, als ein Kanal über die Grenze gewachsen war.
  //
  // Geholt wird absteigend und danach gedreht, damit die Anzeige wie gewohnt
  // von alt nach neu läuft.
  /*
   * §221 Was ICH weggeräumt habe, sehe ich nicht mehr.
   *
   * Zwei Schnitte: `ausgeblendetAb` ist der Zeitpunkt, an dem ich das ganze
   * Gespräch bei mir gelöscht habe — alles davor ist für mich weg. Dazu die
   * einzelnen Nachrichten, die ich für mich weggeräumt habe.
   *
   * Beides gilt nur für mich. Die andere Person hat ihren Verlauf
   * unverändert: Ein Gespräch zu zweit gehört zwei Menschen, und wer bei sich
   * aufräumt, räumt nicht bei anderen auf.
   */
  const meinSchnitt = zugriff.mitglied!.ausgeblendetAb

  const [neueste, mitglieder, verborgen] = await Promise.all([
    prisma.chatNachricht.findMany({
      where: {
        raumId: raum.id,
        ...(meinSchnitt ? { createdAt: { gt: meinSchnitt } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.chatMitglied.findMany({ where: { raumId: raum.id } }),
    prisma.chatVerborgen.findMany({
      where: { userId: ich }, select: { nachrichtId: true },
    }),
  ])
  const weggeraeumt = new Set(verborgen.map(v => v.nachrichtId))
  const nachrichten = neueste.reverse().filter(n => !weggeraeumt.has(n.id))

  const namen = new Map(
    (await prisma.user.findMany({
      where: { id: { in: mitglieder.map(m => m.userId) } },
      select: { id: true, name: true, role: true },
    })).map(u => [u.id, u]),
  )

  const dateiIds = nachrichten.map(n => n.dateiId).filter(Boolean) as string[]
  const anhaenge = new Map(
    (dateiIds.length === 0 ? [] : await prisma.storedFile.findMany({
      where: { id: { in: dateiIds }, deletedAt: null },
      select: { id: true, dateiname: true, mimeType: true, groesse: true },
    })).map(d => [d.id, d]),
  )

  const gegenueber = raum.art === 'direkt'
    ? mitglieder.find(m => m.userId !== ich)?.userId
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
      userId: m.userId,
      name: namen.get(m.userId)?.name ?? 'Ehemalige Kollegin',
      position: ROLLEN_TEXT[namen.get(m.userId)?.role ?? ''] ?? null,
      rolle: m.rolle,
      ichSelbst: m.userId === ich,
    })),
    nachrichten: nachrichten.map(n => ({
      id: n.id, text: n.text, art: n.art,
      absenderName: n.absenderName,
      vonMir: n.userId === ich,
      dateiId: n.dateiId,
      dateiTyp: n.dateiId ? anhaenge.get(n.dateiId)?.mimeType ?? null : null,
      dateiName: n.dateiId ? anhaenge.get(n.dateiId)?.dateiname ?? null : null,
      dateiGroesse: n.dateiId ? anhaenge.get(n.dateiId)?.groesse ?? null : null,
      /*
       * §221 Zurückziehen geht nur, solange niemand sonst gelesen hat.
       * Die Auskunft kommt vom Server: Der Browser kennt den Lesestand der
       * anderen nicht — und soll ihn auch nicht erraten müssen.
       */
      zurueckziehbar: n.userId === ich && n.art !== 'system'
        && mitglieder.every(m => m.userId === ich
          || !m.gelesenBis || m.gelesenBis < n.createdAt),
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

  const mich = await prisma.user.findUnique({
    where: { id: ich }, select: { name: true, employeeId: true, email: true },
  })

  const nachricht = await prisma.chatNachricht.create({
    data: {
      raumId: raum.id, userId: ich, employeeId: mich?.employeeId ?? null,
      absenderName: mich?.name ?? 'Unbekannt', text: inhalt,
    },
  })
  await prisma.chatRaum.update({
    where: { id: raum.id }, data: { letzteAktivitaet: nachricht.createdAt },
  })

  // Push, aber keine E-Mail und kein Eintrag ins Postfach: bei einem Gespräch
  // mit dreißig Nachrichten am Tag wären beides dreißig Störungen, und das
  // Postfach fasst ohnehin nur die letzten dreißig Meldungen.
  //
  // Push hängt am Mitarbeiterdatensatz — wer keinen hat (Leitung, Unternehmen),
  // sieht die Nachricht beim nächsten Öffnen. Das ist kein Verlust: diese
  // Rollen arbeiten am Rechner, nicht am Diensthandy.
  const andere = await prisma.chatMitglied.findMany({
    where: { raumId: raum.id, userId: { not: ich }, employeeId: { not: null } },
    select: { employeeId: true },
  })
  // §145 Im Assistenten-Gespräch antwortet ein Programm. Bewusst ohne await:
  // Die eigene Nachricht steht sofort im Verlauf, die Antwort kommt Sekunden
  // später über dieselbe regelmäßige Abfrage wie die einer Kollegin. Ein
  // Absenden-Knopf, der acht Sekunden dreht, sieht aus wie ein hängendes
  // Programm.
  if (raum.art === ASSISTENT_ART) {
    assistentAntwortet(raum.id).catch(() => undefined)
    return NextResponse.json({ nachricht })
  }

  // §143 Der OKUN-Kanal hat kein zweites Mitglied — was hier steht, geht als
  // E-Mail bei OKUN ein. Ein Kanal, in den hineingeschrieben wird, ohne dass es
  // ankommt, wäre schlimmer als gar keiner.
  if (raum.art === OKUN_ART) {
    const kunde = await prisma.customer.findUnique({
      where: { id: raum.customerId }, select: { name: true },
    }).catch(() => null)
    await weiterleitenAnOkun(
      {
        name: mich?.name ?? 'Unbekannt',
        email: mich?.email,
        rolle: ROLLEN_TEXT[session.role] ?? session.role,
      },
      kunde?.name ?? null,
      inhalt,
    )
    return NextResponse.json({ nachricht })
  }

  const titel = raum.art === 'gruppe' ? `${raum.name}: ${mich?.name}` : (mich?.name ?? 'Nachricht')
  await Promise.all(andere.map(m => sendPushToEmployee(m.employeeId!, {
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

    const mich = await prisma.user.findUnique({
      where: { id: ich }, select: { name: true, employeeId: true },
    })
    await prisma.chatMitglied.create({
      data: {
        raumId: zugriff.raum.id, userId: ich,
        employeeId: mich?.employeeId ?? null, rolle: 'leitung',
      },
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
      where: { raumId_userId: { raumId: raum.id, userId: ich } },
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
    const mich = await prisma.user.findUnique({ where: { id: ich }, select: { name: true } })
    await prisma.chatMitglied.delete({
      where: { raumId_userId: { raumId: raum.id, userId: ich } },
    })
    await systemHinweis(raum.id, `${mich?.name ?? 'Jemand'} hat die Gruppe verlassen.`)
    return NextResponse.json({ ok: true })
  }

  // ── Ab hier: Verwaltung ──────────────────────────────────────────────────
  if (!await darfVerwalten(session, raum)) {
    return NextResponse.json(
      { error: 'Gruppen verwalten die Standortleitung und das Unternehmen.' }, { status: 403 },
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
    const konten = await prisma.user.findMany({
      where: { id: { in: body.hinzufuegen } },
      select: { id: true, name: true, employeeId: true },
    })
    for (const k of konten) {
      const schon = await prisma.chatMitglied.findUnique({
        where: { raumId_userId: { raumId: raum.id, userId: k.id } },
      })
      if (schon) continue
      await prisma.chatMitglied.create({
        data: { raumId: raum.id, userId: k.id, employeeId: k.employeeId },
      })
      await systemHinweis(raum.id, `${k.name} wurde hinzugefügt.`)
    }
    return NextResponse.json({ ok: true })
  }

  if (body.entfernen) {
    const konto = await prisma.user.findUnique({
      where: { id: body.entfernen }, select: { name: true },
    })
    await prisma.chatMitglied.deleteMany({
      where: { raumId: raum.id, userId: body.entfernen },
    })
    await systemHinweis(raum.id, `${konto?.name ?? 'Jemand'} wurde entfernt.`)
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

/**
 * §221 Löschen — und zwar drei verschiedene Dinge, die oft verwechselt werden.
 *
 *   DELETE /api/chat/<raum>                          das Gespräch bei MIR
 *   DELETE /api/chat/<raum>?nachricht=<id>           eine Nachricht bei MIR
 *   DELETE /api/chat/<raum>?nachricht=<id>&fuerAlle=1  zurückziehen
 *
 * WARUM NICHT EINFACH „LÖSCHEN"
 * Weil ein Gespräch zwei Menschen gehört. Es für beide zu entfernen, weil
 * einer aufräumt, wäre ein Eingriff in fremde Unterlagen: Der andere verlöre
 * seinen Verlauf, ohne gefragt worden zu sein. Deshalb räumt der Normalfall
 * nur bei mir auf.
 *
 * ZURÜCKZIEHEN GEHT NUR VOR DEM LESEN
 * Eine Nachricht, die niemand gesehen hat, spurlos zurückzunehmen ist
 * ehrlich — sie hat nie gewirkt. Eine gelesene Nachricht zurückzunehmen wäre
 * das Gegenteil: Der andere hat sie, und das Programm täte so, als hätte es
 * sie nie gegeben. Wer sich vertan hat, schreibt eine zweite Nachricht.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const zugriff = await raumZugriff(session, params.id)
  if (zugriff.grund !== 'ok') return NICHT_DA
  const raum = zugriff.raum!
  const ich = eigeneKennung(session)!

  const nachrichtId = req.nextUrl.searchParams.get('nachricht')
  const fuerAlle = req.nextUrl.searchParams.get('fuerAlle') === '1'

  // ── Das ganze Gespräch bei mir ──────────────────────────────────────────
  if (!nachrichtId) {
    await prisma.chatMitglied.update({
      where: { raumId_userId: { raumId: raum.id, userId: ich } },
      data: { ausgeblendetAb: new Date(), gelesenBis: new Date() },
    })
    return NextResponse.json({
      ok: true,
      hinweis: 'Das Gespräch ist bei dir weg. Schreibt die andere Person '
        + 'wieder, taucht es mit der neuen Nachricht erneut auf.',
    })
  }

  const nachricht = await prisma.chatNachricht.findFirst({
    where: { id: nachrichtId, raumId: raum.id },
    select: { id: true, userId: true, art: true, createdAt: true, dateiId: true },
  })
  if (!nachricht) return NICHT_DA

  // ── Eine Nachricht bei mir ──────────────────────────────────────────────
  if (!fuerAlle) {
    await prisma.chatVerborgen.upsert({
      where: { nachrichtId_userId: { nachrichtId: nachricht.id, userId: ich } },
      create: { nachrichtId: nachricht.id, userId: ich },
      update: {},
    })
    return NextResponse.json({ ok: true, umfang: 'nurIch' })
  }

  // ── Zurückziehen: nur die eigene, und nur vor dem Lesen ─────────────────
  if (nachricht.userId !== ich) {
    return NextResponse.json(
      { error: 'Zurückziehen kann man nur, was man selbst geschrieben hat.' },
      { status: 403 },
    )
  }
  if (nachricht.art === 'system') {
    return NextResponse.json(
      { error: 'Hinweise des Programms lassen sich nicht zurückziehen.' },
      { status: 400 },
    )
  }

  const andere = await prisma.chatMitglied.findMany({
    where: { raumId: raum.id, userId: { not: ich } },
    select: { gelesenBis: true },
  })
  const schonGelesen = andere.some(
    m => m.gelesenBis && m.gelesenBis >= nachricht.createdAt,
  )
  if (schonGelesen) {
    return NextResponse.json({
      error: 'Diese Nachricht ist schon gelesen worden — zurückziehen geht '
        + 'jetzt nicht mehr. Du kannst sie bei dir wegräumen oder etwas '
        + 'Klarstellendes schreiben.',
      code: 'SCHON_GELESEN',
    }, { status: 409 })
  }

  /*
   * Spurlos, mit allem, was daran hängt: die Markierungen „bei mir
   * weggeräumt" (über die Datenbank) und ein etwaiger Anhang. Eine Datei
   * liegen zu lassen, deren Nachricht es nicht mehr gibt, wäre Datenhaltung
   * ohne Zweck — und beim nächsten Export stünde sie wieder da.
   */
  if (nachricht.dateiId) {
    await prisma.storedFile.deleteMany({ where: { id: nachricht.dateiId } })
  }
  await prisma.chatNachricht.delete({ where: { id: nachricht.id } })

  return NextResponse.json({ ok: true, umfang: 'alle' })
}
