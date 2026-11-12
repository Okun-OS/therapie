import { NextRequest, NextResponse } from 'next/server'
import { requireRole, type SessionPayload } from '@/lib/session'
import { assertEmployeeAccess, allowedLocationScope } from '@/lib/scope'
import { prisma } from '@/lib/prisma'
import {
  ERLAUBTE_TYPEN, dateiSpeichern, objektSpeichern, objektSchonVermerkt, istSchonVermerkt,
  pruefeDatei, sichererDateiname,
  DATEI_FELDER, mitarbeiterDarfSehen, KATEGORIEN, MAX_DATEI_BYTES,
} from '@/lib/file-storage'
import { akteAuftrag, akteBereich, akteZweck, type AkteAuftrag } from '@/lib/akte-auftrag'
import { objektKopf, objektWegraeumen } from '@/lib/r2'
import { nachweisGueltig } from '@/lib/objekt-nachweis'
import { automatischZuordnen, verknuepfen } from '@/lib/krankmeldung'
import { dateityp } from '@/lib/dateityp'
import { vorfall, vorfallMelden } from '@/lib/fehlerkennung'

export const dynamic = 'force-dynamic'

// §100 GET /api/files?ownerType=employee&ownerId=…
// Liefert nur Kopfdaten, nie Inhalte. Der Mitarbeiter sieht ausschließlich das,
// was ihm gehört UND freigegeben ist (oder was er selbst eingereicht hat).
export async function GET(req: NextRequest) {
  const session = requireRole(req, ['employee', 'admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const ownerType = req.nextUrl.searchParams.get('ownerType') ?? 'employee'
  const ownerId = req.nextUrl.searchParams.get('ownerId')
  if (!ownerId) return NextResponse.json({ error: 'ownerId fehlt' }, { status: 400 })

  if (ownerType === 'employee') {
    const verweigert = await assertEmployeeAccess(session, ownerId)
    if (verweigert) return verweigert
  } else if (ownerType === 'location') {
    const scope = await allowedLocationScope(session)
    if (scope.kind !== 'all' && !scope.ids.includes(ownerId)) {
      return NextResponse.json({ error: 'Kein Zugriff auf diesen Standort' }, { status: 403 })
    }
  } else {
    return NextResponse.json({ error: 'Unbekannter ownerType' }, { status: 400 })
  }

  const alle = await prisma.storedFile.findMany({
    where: { ownerType, ownerId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { ...DATEI_FELDER, hochgeladenVon: true },
  })

  // Mitarbeiter bekommen eine gefilterte Sicht — auch auf die eigene Akte
  const dateien = session.role === 'employee'
    ? alle.filter(d => mitarbeiterDarfSehen(d, session.employeeId ?? '', session.userId))
    : alle

  return NextResponse.json({ dateien, kategorien: KATEGORIEN, maxBytes: MAX_DATEI_BYTES })
}

// §100 POST /api/files — Datei hochladen (multipart/form-data)
async function postImpl(req: NextRequest) {
  const session = requireRole(req, ['employee', 'admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  /*
   * §261 Zwei Wege, wie beim Chat-Anhang (§260).
   *
   * JSON  — die Datei liegt schon im Objektspeicher; es wird vermerkt, wo.
   * Rest  — die Datei kommt durch die Anwendung. Der alte Weg, und der
   *         Rückfall, wenn kein Objektspeicher eingerichtet ist.
   */
  if ((req.headers.get('content-type') ?? '').includes('application/json')) {
    return vermerken(req, session)
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Ungültiger Upload (multipart/form-data erwartet)' }, { status: 400 })
  }

  const datei = form.get('datei')
  if (!(datei instanceof File)) {
    return NextResponse.json({ error: 'Es wurde keine Datei mitgeschickt.' }, { status: 400 })
  }

  // §261 Wer darf was in welche Akte legen — steht an einer Stelle, weil es
  // für den direkten Weg ein zweites Mal gebraucht wird.
  const auftrag = await akteAuftrag(session, {
    ownerType: form.get('ownerType') as string | null,
    ownerId: form.get('ownerId') as string | null,
    kategorie: form.get('kategorie') as string | null,
  })
  if (auftrag instanceof NextResponse) return auftrag
  const { ownerType, ownerId, kategorie, locationId, customerId } = auftrag

  const groesse = datei.size
  // §255 Siehe `chat/[id]/datei`: Bricht die Verbindung beim Lesen des
  // Rumpfes ab, ist das keine Störung der Anlage, sondern der Leitung.
  let daten: Buffer
  try {
    daten = Buffer.from(await datei.arrayBuffer())
  } catch {
    return NextResponse.json({
      error: 'Die Übertragung wurde unterbrochen. Bitte noch einmal versuchen '
        + '— am besten mit WLAN oder vollem Empfang.',
    }, { status: 400 })
  }
  /*
   * §241 Dieselbe Ursache wie beim Chat-Anhang, dieselbe Meldung: „außerdem
   * konnte man da auch keine Bescheinigung hochladen, da hat der Upload nicht
   * funktioniert". Ohne gemeldeten Typ wurde daraus `application/octet-stream`
   * und fiel durch die Prüfung.
   *
   * Die Datei wird dafür schon hier gelesen und nicht erst weiter unten — die
   * ersten Bytes entscheiden mit.
   */
  // §246 Siehe Chat: dieselbe Regel, andere Liste — die Akte nimmt
  // weniger Arten an als ein Gespräch.
  const erkannt = dateityp(datei.name, datei.type, daten, Object.keys(ERLAUBTE_TYPEN))
  if (erkannt.widerspruch) {
    return NextResponse.json({ error: erkannt.widerspruch }, { status: 400 })
  }
  const mimeType = erkannt.typ
  const pruefung = pruefeDatei(datei.name, mimeType, groesse)
  if (!pruefung.ok) return NextResponse.json({ error: pruefung.fehler }, { status: 400 })

  const sichtbarRoh = form.get('sichtbarFuerMitarbeiter')
  const gespeichert = await dateiSpeichern({
    customerId,
    locationId,
    ownerType,
    ownerId,
    kategorie,
    dateiname: datei.name,
    mimeType,
    daten,
    hochgeladenVon: session.employeeId ?? session.userId,
    hochgeladenVonName: session.name ?? null,
    notiz: (form.get('notiz') as string) || null,
    gueltigVon: (form.get('gueltigVon') as string) || null,
    gueltigBis: (form.get('gueltigBis') as string) || null,
    // Was der Mitarbeiter selbst einreicht, sieht er auch weiterhin
    sichtbarFuerMitarbeiter: sichtbarRoh === null
      ? (session.role === 'employee' ? true : undefined)
      : sichtbarRoh === 'true',
  })

  return abschliessen(auftrag, gespeichert, (form.get('absenceId') as string) || null)
}

/**
 * §261 Was nach dem Ablegen für beide Wege gleich ist.
 *
 * Der Krankenschein muss zu seiner Fehlzeit finden — ganz gleich, ob die
 * Datei durch die Anwendung kam oder unmittelbar in den Objektspeicher. Zwei
 * Abschriften davon liefen auseinander, und auffallen würde das daran, dass
 * eine eingereichte Bescheinigung im Kalender als fehlend gilt.
 */
async function abschliessen(
  auftrag: AkteAuftrag,
  gespeichert: Awaited<ReturnType<typeof dateiSpeichern>>,
  absenceWunsch: string | null,
) {
  const { kategorie, ownerType, ownerId } = auftrag

  // §130 Ein Krankenschein gehört zu einer Fehlzeit.
  //
  // Bisher landete er als Datei in der Akte und die Fehlzeit stand im Kalender
  // — verbunden war nichts. Wer wissen wollte, ob für die Krankheit vom 2. bis
  // 6. März ein Nachweis vorliegt, musste zwei Listen von Hand vergleichen.
  //
  // Zugeordnet wird nur, wenn es eindeutig ist. Passen mehrere Fehlzeiten, wird
  // gefragt: eine falsch zugeordnete Bescheinigung ist schlimmer als eine nicht
  // zugeordnete, weil sie eine Lücke zudeckt, die dann niemand mehr sieht.
  let zuordnung: {
    zugeordnet: string | null
    vorschlaege: { id: string; startDate: string; endDate: string; type: string }[]
  } | undefined

  if (kategorie === 'krankenschein' && ownerType === 'employee') {
    const gewuenscht = absenceWunsch
    if (gewuenscht) {
      const passt = await prisma.absence.findFirst({
        where: { id: gewuenscht, employeeId: ownerId },
        select: { id: true },
      })
      if (!passt) {
        return NextResponse.json(
          { error: 'Diese Fehlzeit gehört nicht zu dieser Person.' }, { status: 400 },
        )
      }
      await verknuepfen(gespeichert.id, gewuenscht)
      zuordnung = { zugeordnet: gewuenscht, vorschlaege: [] }
    } else {
      zuordnung = await automatischZuordnen(
        gespeichert.id, ownerId,
        gespeichert.gueltigVon, gespeichert.gueltigBis,
      )
    }
  }

  return NextResponse.json(
    { datei: { ...gespeichert, absenceId: zuordnung?.zugeordnet ?? null }, zuordnung },
    { status: 201 },
  )
}

/**
 * §261 Der direkte Weg: Die Unterlage liegt schon im Objektspeicher.
 *
 * Es gelten dieselben beiden Riegel wie beim Chat (§260/§261):
 *
 *   — Der Ordner. Der Schlüssel muss zu DIESER Akte gehören. Ohne das ließe
 *     sich der Krankenschein einer fremden Person in die eigene Akte
 *     eintragen.
 *   — Die Unterschrift. Sie hält darüber hinaus alles draußen, was wir nicht
 *     selbst ausgegeben haben — auch einen Schlüssel aus DIESEM Ordner. Das
 *     ist hier der wichtigere der beiden: In der eigenen Akte liegen
 *     Unterlagen, die dem Mitarbeiter nicht freigegeben sind, und was man
 *     selbst eingereicht hat, darf man ansehen.
 *
 * Geprüft wird außerdem am Speicher und nicht an der Meldung: `objektKopf`
 * holt die ersten Bytes samt wahrer Größe, und danach gelten dieselben Regeln
 * wie beim alten Weg.
 */
async function vermerken(req: NextRequest, session: SessionPayload) {
  const eingang = await req.json().catch(() => ({})) as {
    objektSchluessel?: string; nachweis?: string
    dateiname?: string; mimeType?: string
    ownerType?: string; ownerId?: string; kategorie?: string
    notiz?: string; gueltigVon?: string; gueltigBis?: string
    sichtbarFuerMitarbeiter?: boolean; absenceId?: string
  }

  const auftrag = await akteAuftrag(session, eingang)
  if (auftrag instanceof NextResponse) return auftrag

  const schluessel = String(eingang.objektSchluessel ?? '')
  if (!schluessel || !eingang.dateiname) {
    return NextResponse.json({ error: 'Es fehlen Angaben zur Datei.' }, { status: 400 })
  }
  if (!schluessel.startsWith(`${akteBereich(auftrag)}/`) || schluessel.includes('..')) {
    return NextResponse.json(
      { error: 'Dieser Platz gehört nicht zu dieser Akte.' }, { status: 403 },
    )
  }
  if (!nachweisGueltig(schluessel, akteZweck(auftrag), eingang.nachweis)) {
    return NextResponse.json({
      error: 'Der Platz für die Datei ist nicht mehr gültig. Bitte noch einmal hochladen.',
    }, { status: 403 })
  }

  // §261 Ein Platz wird einmal ausgegeben und einmal eingelöst — sonst hingen
  // zwei Einträge an einer Datei, und der eine zeigte ins Leere, sobald
  // jemand den anderen löscht.
  if (await objektSchonVermerkt(schluessel)) {
    return NextResponse.json(
      { error: 'Diese Datei ist bereits eingereicht.' }, { status: 409 },
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
  const erkannt = dateityp(name, eingang.mimeType, kopf.anfang, Object.keys(ERLAUBTE_TYPEN))
  const pruefung = erkannt.widerspruch
    ? { ok: false, fehler: erkannt.widerspruch }
    : pruefeDatei(name, erkannt.typ, kopf.groesse)
  if (!pruefung.ok) {
    // Abgewiesen heißt: Das Objekt darf nicht liegen bleiben.
    await objektWegraeumen(schluessel)
    return NextResponse.json({ error: pruefung.fehler }, { status: 400 })
  }

  let gespeichert: Awaited<ReturnType<typeof objektSpeichern>>
  try {
    gespeichert = await objektSpeichern({
      customerId: auftrag.customerId,
      locationId: auftrag.locationId,
      ownerType: auftrag.ownerType,
      ownerId: auftrag.ownerId,
      kategorie: auftrag.kategorie,
      dateiname: name,
      mimeType: erkannt.typ,
      objektSchluessel: schluessel,
      groesse: kopf.groesse,
      hochgeladenVon: session.employeeId ?? session.userId,
      hochgeladenVonName: session.name ?? null,
      notiz: eingang.notiz || null,
      gueltigVon: eingang.gueltigVon || null,
      gueltigBis: eingang.gueltigBis || null,
      // Was der Mitarbeiter selbst einreicht, sieht er auch weiterhin
      sichtbarFuerMitarbeiter: eingang.sichtbarFuerMitarbeiter
        ?? (session.role === 'employee' ? true : undefined),
    })
  } catch (fehler) {
    /*
     * §261 Der Wettlauf: Zwei Anfragen haben dieselbe Unterschrift im selben
     * Augenblick eingelöst, und der eindeutige Index hat die zweite
     * abgelehnt. Das Objekt bleibt liegen — die andere Anfrage braucht es.
     */
    if (istSchonVermerkt(fehler)) {
      return NextResponse.json(
        { error: 'Diese Datei ist bereits eingereicht.' }, { status: 409 },
      )
    }
    await objektWegraeumen(schluessel)
    throw fehler
  }

  return abschliessen(auftrag, gespeichert, eingang.absenceId || null)
}

/**
 * §252 Der äußere Mantel — siehe `chat/[id]/datei/route.ts`.
 *
 * Gemeldet war die Bescheinigung in derselben Weise wie der Chat-Anhang:
 * „der Upload hat nicht funktioniert", ohne dass jemand hätte sagen können,
 * woran. Eine leere 500 ist keine Auskunft.
 */
export async function POST(req: NextRequest) {
  try {
    return await postImpl(req)
  } catch (fehler) {
    const v = vorfall('files', fehler, 'Die Datei ließ sich nicht speichern.')
    await vorfallMelden('files', fehler, v.kennung)
    return NextResponse.json({ error: v.text }, { status: 500 })
  }
}
