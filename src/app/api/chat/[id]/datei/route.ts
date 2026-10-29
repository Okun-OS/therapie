import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'
import { raumZugriff, eigeneKennung } from '@/lib/chat'
import { sendPushToEmployee } from '@/lib/push'
import {
  dateiSpeichern, objektSpeichern, objektSchonVermerkt, istSchonVermerkt, pruefeChatDatei,
  sichererDateiname, CHAT_TYPEN,
} from '@/lib/file-storage'
import { dateityp } from '@/lib/dateityp'
import { vorfall, vorfallMelden } from '@/lib/fehlerkennung'
import { downloadAdresse, objektKopf, objektWegraeumen } from '@/lib/r2'
import { nachweisGueltig } from '@/lib/objekt-nachweis'

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

async function postImpl(req: NextRequest, { params }: { params: { id: string } }) {
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

  /*
   * §260 Ab hier führen zwei Wege weiter.
   *
   * JSON  — die Datei liegt schon im Objektspeicher, es wird nur vermerkt,
   *         wo. Das ist der neue, direkte Weg.
   * Rest  — die Datei kommt als `multipart/form-data` durch die Anwendung.
   *         Der alte Weg, und zugleich der Rückfall, wenn kein Objektspeicher
   *         eingerichtet ist.
   *
   * Beide bleiben, und das ist Absicht: Eine Umstellung, die bei fehlender
   * Einrichtung das Senden von Dateien anhält, wäre schlimmer als der Zustand
   * vorher.
   */
  if ((req.headers.get('content-type') ?? '').includes('application/json')) {
    return vermerken(
      req,
      { id: raum.id, customerId: raum.customerId, locationId: raum.locationId ?? null },
      ich,
      session.role,
    )
  }

  const form = await req.formData().catch(() => null)
  const datei = form?.get('datei')
  if (!form || !(datei instanceof File)) {
    return NextResponse.json({ error: 'Es war keine Datei dabei.' }, { status: 400 })
  }

  /*
   * §255 Die Übertragung kann mitten im Lesen abbrechen.
   *
   * `arrayBuffer()` liest den Rumpf der Anfrage fertig ein. Bricht die
   * Verbindung dabei ab — ein Funkloch, ein Wechsel von WLAN auf Mobilfunk,
   * ein gesperrter Bildschirm —, wirft dieser Aufruf. Bis hierher war er
   * NICHT abgefangen: Daraus wurde eine 500, und in der Oberfläche stand
   * „Die Datei ließ sich nicht senden" ohne Grund.
   *
   * Gemeldet wurde genau das, mit Kennung 88e511 und ohne Zusatz — also kein
   * Datenbankfehler. Ein abgebrochener Rumpf passt zum Bild: Es geschieht am
   * Telefon, nicht am Schreibtisch, und nicht jedes Mal.
   *
   * Das ist keine Störung der Anlage, sondern eine der Leitung. Entsprechend
   * lautet die Antwort: noch einmal versuchen, nicht „melde einen Fehler".
   */
  let daten: Buffer
  try {
    daten = Buffer.from(await datei.arrayBuffer())
  } catch {
    return NextResponse.json({
      error: 'Die Übertragung wurde unterbrochen. Bitte noch einmal versuchen '
        + '— am besten mit WLAN oder vollem Empfang.',
    }, { status: 400 })
  }
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

  /*
   * §252 Ab hier wird geschrieben — und ab hier kann etwas schiefgehen, das
   * nichts mit der Datei zu tun hat.
   *
   * Gemeldet wurde „Fehler 500, 204 kB". 500 heißt: Die Anwendung ist über
   * etwas gestolpert, und der Browser bekam keine Auskunft, sondern eine
   * leere Seite. Örtlich ließ sich das nicht nachstellen — dieselbe Datei
   * geht durch jedes Gespräch mit HTTP 200.
   *
   * Ohne diesen Mantel ist ein solcher Fall unsichtbar: Der Mensch sieht
   * „500", ich sehe nichts. Jetzt steht in der Meldung eine Kennung, und
   * dieselbe Kennung steht im Protokoll neben dem vollen Fehler.
   */
  let abgelegt: { id: string }
  try {
    abgelegt = await dateiSpeichern({
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
  } catch (fehler) {
    const v = vorfall('chat/datei/ablegen', fehler,
      'Die Datei ließ sich nicht speichern.')
    await vorfallMelden('chat/datei/ablegen', fehler, v.kennung, {
      userId: ich, name: mich?.name ?? undefined, role: session.role,
      customerId: raum.customerId,
    })
    return NextResponse.json({ error: v.text }, { status: 500 })
  }

  return nachrichtAnlegen({
    raumId: raum.id,
    ich,
    employeeId: mich?.employeeId ?? null,
    absenderName: mich?.name ?? null,
    /*
     * Der Begleittext ist freiwillig. Steht keiner da, nimmt die Nachricht den
     * Dateinamen — eine Nachricht ganz ohne Text wäre in jeder Liste, jeder
     * Vorschau und jeder Push-Meldung eine leere Zeile.
     */
    text: String(form.get('text') ?? '').trim().slice(0, 2000) || name,
    datei: {
      id: abgelegt.id, dateiname: name, mimeType: typ, groesse: daten.length,
    },
  })
}

/**
 * §260 Der zweite Weg: Die Datei liegt schon im Speicher.
 *
 * WIE ES DAZU KOMMT
 * Die Oberfläche hat sich bei `…/datei/adresse` einen Platz geben lassen, das
 * Telefon hat die Datei direkt dorthin geladen, und jetzt soll sie im Verlauf
 * erscheinen. Die Anwendung hat die Datei dabei nie gesehen.
 *
 * WARUM TROTZDEM GEPRÜFT WIRD — UND ZWAR AM SPEICHER, NICHT AN DER MELDUNG
 * Was hier hereinkommt, ist eine Behauptung des Browsers. Ihr zu glauben
 * hieße, drei Prüfungen aufzugeben, die der alte Weg hatte: ob überhaupt
 * etwas angekommen ist, wie groß es wirklich ist und was tatsächlich
 * drinsteht. `objektKopf` holt deshalb die ersten 64 Bytes samt wahrer Größe
 * aus dem Speicher — eine Anfrage, und danach gelten dieselben Regeln wie
 * vorher.
 *
 * WARUM DER SCHLÜSSEL AUF DIESEN RAUM FESTGENAGELT IST
 * Das ist die wichtigste Zeile hier. Ohne sie könnte ein Mitglied eines
 * beliebigen Gesprächs den Schlüssel einer FREMDEN Datei eintragen — etwa den
 * eines Krankenscheins aus einer Personalakte — und sie anschließend über
 * sein eigenes Gespräch herunterladen. Der Schlüssel muss mit
 * `chat/<diesem Raum>/` beginnen; alles darunter darf dieses Mitglied ohnehin
 * sehen.
 */
async function vermerken(
  req: NextRequest,
  raum: { id: string; customerId: string; locationId: string | null },
  ich: string,
  rolle: string,
) {
  const eingang = await req.json().catch(() => ({})) as {
    objektSchluessel?: string; dateiname?: string; mimeType?: string
    nachweis?: string; text?: string
  }
  const schluessel = String(eingang.objektSchluessel ?? '')
  if (!schluessel || !eingang.dateiname) {
    return NextResponse.json({ error: 'Es fehlen Angaben zur Datei.' }, { status: 400 })
  }

  /*
   * Zwei Riegel, und beide sind nötig.
   *
   * Der Ordner hält fremde Gespräche und fremde Akten draußen. Die
   * Unterschrift (§261) hält darüber hinaus alles draußen, was wir nicht
   * selbst ausgegeben haben — auch einen Schlüssel aus DIESEM Ordner, den
   * jemand anders eingetragen hätte.
   */
  if (!schluessel.startsWith(`chat/${raum.id}/`) || schluessel.includes('..')) {
    return NextResponse.json({ error: 'Dieser Platz gehört nicht zu diesem Gespräch.' },
      { status: 403 })
  }
  if (!nachweisGueltig(schluessel, `chat:${raum.id}`, eingang.nachweis)) {
    return NextResponse.json({
      error: 'Der Platz für die Datei ist nicht mehr gültig. Bitte noch einmal senden.',
    }, { status: 403 })
  }

  // §261 Ein Platz wird einmal ausgegeben und einmal eingelöst.
  if (await objektSchonVermerkt(schluessel)) {
    return NextResponse.json(
      { error: 'Diese Datei ist bereits gesendet.' }, { status: 409 },
    )
  }

  const kopf = await objektKopf(schluessel)
  if (!kopf) {
    return NextResponse.json({
      error: 'Die Datei ist im Speicher nicht angekommen. Bitte noch einmal '
        + 'versuchen — am besten mit WLAN oder vollem Empfang.',
    }, { status: 409 })
  }

  const name = sichererDateiname(eingang.dateiname)
  // §241/§246 Dieselbe Erkennung wie beim alten Weg, jetzt mit den Bytes aus
  // dem Speicher: Endung, gemeldeter Typ UND Inhalt.
  const erkannt = dateityp(name, eingang.mimeType, kopf.anfang, Object.keys(CHAT_TYPEN))
  const typ = erkannt.typ
  const geprueft = erkannt.widerspruch
    ? { ok: false, fehler: erkannt.widerspruch }
    : pruefeChatDatei(name, typ, kopf.groesse)

  if (!geprueft.ok) {
    // Abgewiesen heißt: Das Objekt darf nicht liegen bleiben. Sonst hätten wir
    // eine Datei im Speicher, von der kein Eintrag mehr weiß.
    await objektWegraeumen(schluessel)
    return NextResponse.json({ error: geprueft.fehler }, { status: 400 })
  }

  const mich = await prisma.user.findUnique({
    where: { id: ich }, select: { name: true, employeeId: true },
  })

  let abgelegt: { id: string }
  try {
    abgelegt = await objektSpeichern({
      customerId: raum.customerId,
      locationId: raum.locationId,
      ownerType: 'chat' as never,
      ownerId: raum.id,
      kategorie: 'sonstiges',
      dateiname: name,
      mimeType: typ,
      objektSchluessel: schluessel,
      groesse: kopf.groesse,
      hochgeladenVon: ich,
      hochgeladenVonName: mich?.name ?? null,
      sichtbarFuerMitarbeiter: false,
      pruefen: pruefeChatDatei,
    })
  } catch (fehler) {
    /*
     * §261 Der Wettlauf: Zwei Anfragen haben dieselbe Unterschrift im selben
     * Augenblick eingelöst. Das Objekt bleibt liegen — die andere Anfrage
     * braucht es — und der Mensch bekommt die Antwort von oben, keine 500.
     */
    if (istSchonVermerkt(fehler)) {
      return NextResponse.json(
        { error: 'Diese Datei ist bereits gesendet.' }, { status: 409 },
      )
    }
    await objektWegraeumen(schluessel)
    const v = vorfall('chat/datei/vermerken', fehler,
      'Die Datei ließ sich nicht speichern.')
    await vorfallMelden('chat/datei/vermerken', fehler, v.kennung, {
      userId: ich, name: mich?.name ?? undefined, role: rolle,
      customerId: raum.customerId,
    })
    return NextResponse.json({ error: v.text }, { status: 500 })
  }

  return nachrichtAnlegen({
    raumId: raum.id,
    ich,
    employeeId: mich?.employeeId ?? null,
    absenderName: mich?.name ?? null,
    text: String(eingang.text ?? '').trim().slice(0, 2000) || name,
    datei: {
      id: abgelegt.id, dateiname: name, mimeType: typ, groesse: kopf.groesse,
    },
  })
}

/**
 * §260 Was nach dem Ablegen für beide Wege gleich ist.
 *
 * Vorher stand das nur einmal da — am Ende des einen Weges. Mit dem zweiten
 * Weg wäre es eine Abschrift geworden, und Abschriften laufen auseinander:
 * §229, §232 und §235 sind genau daran gescheitert. Hier wäre es der
 * Zeitstempel der letzten Aktivität oder die Push-Meldung, die beim direkten
 * Weg still ausfällt.
 */
async function nachrichtAnlegen(opts: {
  raumId: string
  ich: string
  employeeId: string | null
  /** Der Name des Absenders, soweit bekannt. */
  absenderName: string | null
  text: string
  datei: { id: string; dateiname: string; mimeType: string; groesse: number }
}) {
  const nachricht = await prisma.chatNachricht.create({
    data: {
      raumId: opts.raumId, userId: opts.ich, employeeId: opts.employeeId,
      absenderName: opts.absenderName ?? 'Unbekannt',
      text: opts.text, art: 'datei', dateiId: opts.datei.id,
    },
  })
  await prisma.chatRaum.update({
    where: { id: opts.raumId }, data: { letzteAktivitaet: nachricht.createdAt },
  })

  // Dieselbe Benachrichtigung wie bei einer Textnachricht — wer ein Bild
  // bekommt, soll es genauso mitbekommen.
  const andere = await prisma.chatMitglied.findMany({
    where: { raumId: opts.raumId, userId: { not: opts.ich }, employeeId: { not: null } },
    select: { employeeId: true },
  })
  await Promise.all(andere.map(m => sendPushToEmployee(m.employeeId!, {
    // Ohne Namen lieber „Neue Nachricht" als „Unbekannt" auf dem Sperrbildschirm.
    title: opts.absenderName ?? 'Neue Nachricht',
    body: `${CHAT_TYPEN[opts.datei.mimeType] ?? 'Datei'}: ${opts.text}`,
    url: `/nachrichten?raum=${opts.raumId}`,
  }).catch(() => undefined)))

  return NextResponse.json({ nachricht: { ...nachricht, datei: opts.datei } })
}

/**
 * §252 Der äußere Mantel.
 *
 * Alles, was unterwegs unerwartet scheitert, wird hier zu einer Antwort mit
 * Kennung statt zu einer leeren 500. Ohne ihn sieht ein Mensch „Fehler 500"
 * und ich sehe gar nichts — genau die Lage, in der wir dreimal gelandet sind.
 */
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    return await postImpl(req, ctx)
  } catch (fehler) {
    const v = vorfall('chat/datei', fehler, 'Die Datei ließ sich nicht senden.')
    await vorfallMelden('chat/datei', fehler, v.kennung)
    return NextResponse.json({ error: v.text }, { status: 500 })
  }
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
    select: {
      dateiname: true, mimeType: true, inhalt: true,
      treiber: true, objektSchluessel: true,
    },
  })
  if (!datei) {
    return NextResponse.json({ error: 'Datei nicht gefunden' }, { status: 404 })
  }

  /*
   * §260 Liegt die Datei im Objektspeicher, wird nur der Weg dorthin gewiesen.
   *
   * Die Zugriffsprüfung ist zu diesem Zeitpunkt schon gelaufen — wer hier
   * ankommt, ist Mitglied dieses Gesprächs und die Datei gehört dazu. Die
   * ausgestellte Adresse gilt fünf Minuten und nur für diese eine Datei.
   *
   * WARUM UMLEITEN UND NICHT DURCHREICHEN
   * Weil ein Durchreichen genau das wieder einführen würde, was wir loswerden
   * wollten: Die ganze Datei läge im Arbeitsspeicher des Servers, und Railway
   * zählte jeden Abruf als ausgehenden Verkehr. Bei R2 ist der Verkehr frei —
   * aber nur, wenn er dort stattfindet.
   */
  if (datei.treiber === 'r2' && datei.objektSchluessel) {
    const adresse = downloadAdresse(
      datei.objektSchluessel, 300, new Date(), 'dateien', datei.dateiname,
    )
    if (!adresse) {
      return NextResponse.json(
        { error: 'Der Dateispeicher ist gerade nicht erreichbar.' }, { status: 503 },
      )
    }
    return NextResponse.redirect(adresse, 302)
  }

  if (!datei.inhalt) {
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

