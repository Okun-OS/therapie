import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'
import { raumZugriff, eigeneKennung } from '@/lib/chat'
import { sendPushToEmployee } from '@/lib/push'
import {
  dateiSpeichern, pruefeChatDatei, sichererDateiname, CHAT_TYPEN,
} from '@/lib/file-storage'
import { dateityp } from '@/lib/dateityp'

export const dynamic = 'force-dynamic'

/**
 * §221 Dateien im Chat: Bild, Tonaufnahme, Schriftstück.
 *
 *   POST /api/chat/<raum>/datei        eine Datei schicken (multipart)
 *   GET  /api/chat/<raum>/datei?id=…   eine Datei herunterladen
 *
 * WAS VORHER FEHLTE
 * Alles. Eine Nachricht konnte Text sein und sonst nichts. Wer ein Foto vom
 * Dienstplan an der Wand schicken wollte, eine Sprachnachricht mit vollen
 * Händen oder die PDF vom Träger, musste auf WhatsApp ausweichen — und genau
 * dort liegen Personaldaten dann wirklich falsch.
 *
 * WARUM DER RAUM DER BESITZER IST UND NICHT DIE PERSON
 * Die Datei liegt als `StoredFile` mit `ownerType = "chat"` und dem Raum als
 * Besitzer. Wer eine Gruppe verlässt, nimmt das Bild nicht mit, das er dort
 * geteilt hat — sonst stünde bei den anderen eine Lücke im Verlauf.
 *
 * WARUM DER ZUGRIFF HIER ENTSCHIEDEN WIRD UND NICHT IN /api/files
 * Weil die Regel eine andere ist: Dort gilt „die Akte gehört dieser Person",
 * hier gilt „wer im Raum ist, sieht den Verlauf". Zwei Regeln an einer Tür
 * sind eine Tür zu viel.
 */

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const zugriff = await raumZugriff(session, params.id)
  if (zugriff.grund !== 'ok') {
    return NextResponse.json({ error: 'Gespräch nicht gefunden' }, { status: 404 })
  }
  const raum = zugriff.raum!
  const ich = eigeneKennung(session)!

  if (raum.archiviertAm) {
    return NextResponse.json(
      { error: 'Diese Gruppe ist geschlossen. Der Verlauf bleibt lesbar.' }, { status: 409 },
    )
  }

  const form = await req.formData().catch(() => null)
  const datei = form?.get('datei')
  if (!form || !(datei instanceof File)) {
    return NextResponse.json({ error: 'Es war keine Datei dabei.' }, { status: 400 })
  }

  const daten = Buffer.from(await datei.arrayBuffer())
  const name = sichererDateiname(datei.name || 'Anhang')
  /*
   * §241 Hier stand `datei.type || 'application/octet-stream'`.
   *
   * Auf dem Telefon meldet der Browser für Dateien aus „Dateien" und iCloud
   * häufig gar keinen Typ. Daraus wurde `application/octet-stream`, und das
   * steht in keiner Liste erlaubter Arten — eine ganz normale PDF fiel durch,
   * und in der Oberfläche sah es aus, als passiere beim Senden nichts.
   * Nachgemessen und als genau dieser Fall bestätigt.
   *
   * `dateityp` bestimmt die Art aus Endung UND den ersten Bytes. Das ist
   * strenger als vorher: Dem gemeldeten Typ wurde bis hierher blind geglaubt.
   */
  // §246 Mit der Liste: Ein gemeldeter Typ, den der Chat nicht annimmt
  // (`image/heif` vom iPhone), tritt gegen die Endung zurück.
  const erkannt = dateityp(name, datei.type, daten, Object.keys(CHAT_TYPEN))
  if (erkannt.widerspruch) {
    return NextResponse.json({ error: erkannt.widerspruch }, { status: 400 })
  }
  const typ = erkannt.typ
  const geprueft = pruefeChatDatei(name, typ, daten.length)
  if (!geprueft.ok) {
    return NextResponse.json({ error: geprueft.fehler }, { status: 400 })
  }

  const mich = await prisma.user.findUnique({
    where: { id: ich }, select: { name: true, employeeId: true },
  })

  const abgelegt = await dateiSpeichern({
    customerId: raum.customerId,
    locationId: raum.locationId ?? null,
    ownerType: 'chat' as never,
    ownerId: raum.id,
    kategorie: 'sonstiges',
    dateiname: name,
    mimeType: typ,
    daten,
    hochgeladenVon: ich,
    hochgeladenVonName: mich?.name ?? null,
    sichtbarFuerMitarbeiter: false,
    pruefen: pruefeChatDatei,
  })

  /*
   * Der Begleittext ist freiwillig. Steht keiner da, nimmt die Nachricht den
   * Dateinamen — eine Nachricht ganz ohne Text wäre in jeder Liste, jeder
   * Vorschau und jeder Push-Meldung eine leere Zeile.
   */
  const text = String(form.get('text') ?? '').trim().slice(0, 2000) || name

  const nachricht = await prisma.chatNachricht.create({
    data: {
      raumId: raum.id, userId: ich, employeeId: mich?.employeeId ?? null,
      absenderName: mich?.name ?? 'Unbekannt',
      text, art: 'datei', dateiId: abgelegt.id,
    },
  })
  await prisma.chatRaum.update({
    where: { id: raum.id }, data: { letzteAktivitaet: nachricht.createdAt },
  })

  // Dieselbe Benachrichtigung wie bei einer Textnachricht — wer ein Bild
  // bekommt, soll es genauso mitbekommen.
  const andere = await prisma.chatMitglied.findMany({
    where: { raumId: raum.id, userId: { not: ich }, employeeId: { not: null } },
    select: { employeeId: true },
  })
  await Promise.all(andere.map(m => sendPushToEmployee(m.employeeId!, {
    title: mich?.name ?? 'Neue Nachricht',
    body: `${CHAT_TYPEN[typ] ?? 'Datei'}: ${text}`,
    url: `/nachrichten?raum=${raum.id}`,
  }).catch(() => undefined)))

  return NextResponse.json({
    nachricht: {
      ...nachricht,
      datei: {
        id: abgelegt.id, dateiname: name, mimeType: typ, groesse: daten.length,
      },
    },
  })
}

/**
 * Eine Datei aus diesem Gespräch holen.
 *
 * Geprüft wird die Mitgliedschaft im Raum — und zusätzlich, dass die Datei
 * wirklich zu DIESEM Raum gehört. Ohne das zweite ließe sich mit einer
 * fremden Dateikennung über den eigenen Raum alles holen, was irgendwo
 * gespeichert ist.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const zugriff = await raumZugriff(session, params.id)
  if (zugriff.grund !== 'ok') {
    return NextResponse.json({ error: 'Gespräch nicht gefunden' }, { status: 404 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Welche Datei?' }, { status: 400 })

  const datei = await prisma.storedFile.findFirst({
    where: { id, ownerType: 'chat', ownerId: params.id, deletedAt: null },
    select: { dateiname: true, mimeType: true, inhalt: true },
  })
  if (!datei?.inhalt) {
    return NextResponse.json({ error: 'Datei nicht gefunden' }, { status: 404 })
  }

  return new NextResponse(Buffer.from(datei.inhalt), {
    headers: {
      'Content-Type': datei.mimeType,
      // `inline`, nicht `attachment`: Ein Bild soll man sehen und eine
      // Sprachnachricht hören können, ohne sie vorher herunterzuladen.
      'Content-Disposition': `inline; filename="${encodeURIComponent(datei.dateiname)}"`,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'",
    },
  })
}

