import { createHash, createHmac } from 'crypto'

/**
 * §210 Der Speicher für die Programmdateien — ohne fremdes Paket.
 *
 * WOFÜR
 * Das Windows-Programm aktualisiert sich selbst. Dafür müssen `latest.yml`
 * und die `.exe` unter einer festen Adresse liegen, die in jedem
 * ausgelieferten Programm eingebacken ist. Die Adresse soll `okun-workforce.com`
 * sein und bleiben — der Speicher dahinter austauschbar.
 *
 * WARUM SELBST GESCHRIEBEN UND NICHT `@aws-sdk/client-s3`
 * Das Paket zieht rund vierzig weitere nach und wiegt einige Megabyte. Hier
 * gebraucht werden genau zwei Dinge: eine kleine Datei lesen und eine
 * zeitlich begrenzte Download-Adresse ausstellen. Beides ist in AWS'
 * Signaturverfahren Version 4 sauber festgelegt und steht unten in sechzig
 * Zeilen. Dasselbe Verfahren spricht auch Hetzner, Backblaze und jeder
 * andere S3-kompatible Speicher — der Anbieter bleibt damit austauschbar,
 * und genau das ist der Sinn dieses Weges.
 *
 * WAS HIER NICHT STEHT
 * Kein Hochladen, kein Löschen, kein Auflisten. Was das Programm ausliefert,
 * lädt ein Mensch bewusst hoch. Eine Anlage, die ihren eigenen Ausgabekanal
 * beschreiben kann, ist ein Weg, über den sich eine übernommene Anlage selbst
 * verteilt.
 */

export interface R2Zugang {
  kontoId: string
  bucket: string
  schluessel: string
  geheimnis: string
  /**
   * §256 Der Rechtsraum des Eimers — leer oder `eu`.
   *
   * Cloudflare bietet an, einen Eimer auf einen Rechtsraum festzulegen. Für
   * Personaldaten ist das keine Kür: In diesem Programm liegen
   * Arbeitsunfähigkeitsbescheinigungen, und das sind Gesundheitsdaten nach
   * Art. 9 DSGVO. Ein Eimer mit `eu` speichert und verarbeitet sie nur in der
   * Europäischen Union.
   *
   * Solche Eimer sind NUR über eine andere Adresse erreichbar:
   *
   *     ohne Festlegung   <konto>.r2.cloudflarestorage.com
   *     mit `eu`          <konto>.eu.r2.cloudflarestorage.com
   *
   * Hier stand die erste Form fest eingetragen. Wer einen EU-Eimer anlegt und
   * die Zugangsdaten einträgt, hätte „SignatureDoesNotMatch" bekommen — eine
   * Meldung, die mit der Ursache nichts zu tun hat und einen Nachmittag
   * kostet.
   */
  bereich: string | null
}

/** Ist der Speicher überhaupt eingerichtet? */
export function r2Eingerichtet(zweck: Speicherzweck = 'programm'): boolean {
  return Boolean(zugang(zweck))
}

/**
 * §259 Wofür der Speicher gebraucht wird — es sind zwei verschiedene Dinge.
 *
 * DER FEHLER, DER FAST PASSIERT WÄRE
 * Beim Einrichten des Dateispeichers wäre `R2_BUCKET` überschrieben worden.
 * Diese Variable zeigt aber auf `okun-programm`, und von dort holt sich das
 * Windows-Programm seine Aktualisierungen (§210). Die Selbstaktualisierung
 * wäre still kaputtgegangen — still, weil sie niemand täglich benutzt und
 * ein Fehler dort erst auffällt, wenn jemand eine neue Fassung braucht.
 *
 * Gefunden hat das der Eigentümer, nicht ich.
 *
 * WARUM ZWEI GETRENNTE ZUGÄNGE UND NICHT EIN EIMER FÜR BEIDES
 * Weil die beiden nichts miteinander zu tun haben. Im einen liegen
 * Programmdateien, die jeder herunterladen darf; im anderen Krankenscheine.
 * Der Schlüssel für den einen soll den anderen nicht öffnen können — und der
 * Dateieimer liegt im EU-Rechtsraum, der Programmeimer nicht.
 */
export type Speicherzweck = 'programm' | 'dateien'

export function zugang(zweck: Speicherzweck = 'programm'): R2Zugang | null {
  /*
   * Die Kontonummer ist bei beiden dieselbe — es ist ein Cloudflare-Konto.
   * Sie lässt sich trotzdem eigens setzen, falls der Dateispeicher einmal
   * woanders liegen soll.
   */
  const kontoId = zweck === 'dateien'
    ? (process.env.R2_DATEIEN_KONTO_ID || process.env.R2_KONTO_ID)
    : process.env.R2_KONTO_ID

  const bucket = zweck === 'dateien' ? process.env.R2_DATEIEN_BUCKET : process.env.R2_BUCKET
  const schluessel = zweck === 'dateien'
    ? process.env.R2_DATEIEN_SCHLUESSEL : process.env.R2_SCHLUESSEL
  const geheimnis = zweck === 'dateien'
    ? process.env.R2_DATEIEN_GEHEIMNIS : process.env.R2_GEHEIMNIS
  const bereichRoh = zweck === 'dateien' ? process.env.R2_DATEIEN_BEREICH : process.env.R2_BEREICH

  if (!kontoId || !bucket || !schluessel || !geheimnis) return null
  // §256 Leer lassen heißt „ohne Festlegung"; `eu` bindet an die EU.
  const bereich = (bereichRoh || '').trim().toLowerCase() || null
  return { kontoId, bucket, schluessel, geheimnis, bereich }
}

const REGION = 'auto'
const DIENST = 's3'

const sha256 = (w: string | Buffer) => createHash('sha256').update(w).digest('hex')
const hmac = (k: Buffer | string, w: string) => createHmac('sha256', k).update(w).digest()

/**
 * Prozentkodierung nach AWS' Regeln.
 *
 * `encodeURIComponent` lässt `!`, `'`, `(`, `)` und `*` stehen — AWS nicht.
 * Ein Dateiname mit Klammer ergäbe sonst eine Signatur, die nicht passt, und
 * der Fehler wäre „SignatureDoesNotMatch" ohne jeden Hinweis worauf.
 */
function kodieren(wert: string): string {
  return encodeURIComponent(wert)
    .replace(/[!'()*]/g, z => `%${z.charCodeAt(0).toString(16).toUpperCase()}`)
}

/** Der Pfad im Speicher, jedes Segment einzeln kodiert — `/` bleibt stehen. */
function pfadKodieren(pfad: string): string {
  return pfad.split('/').map(kodieren).join('/')
}

/** Der Signierschlüssel — vier verkettete HMACs, so steht es in der Vorschrift. */
function signierschluessel(geheimnis: string, tag: string): Buffer {
  return hmac(hmac(hmac(hmac(`AWS4${geheimnis}`, tag), REGION), DIENST), 'aws4_request')
}

/** `20260121T143000Z` und `20260121`. */
function zeitstempel(jetzt: Date): { lang: string; tag: string } {
  const lang = jetzt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  return { lang, tag: lang.slice(0, 8) }
}

function wirt(z: R2Zugang): string {
  // §256 Ein auf einen Rechtsraum festgelegter Eimer hat eine eigene Adresse
  // und ist über die allgemeine NICHT erreichbar. Siehe `R2Zugang.bereich`.
  return z.bereich
    ? `${z.kontoId}.${z.bereich}.r2.cloudflarestorage.com`
    : `${z.kontoId}.r2.cloudflarestorage.com`
}

/**
 * Eine zeitlich begrenzte Download-Adresse ausstellen.
 *
 * WARUM NICHT DURCHREICHEN
 * Die `.exe` wiegt rund neunzig Megabyte. Liefe sie durch die Anlage, zahlte
 * Railway jeden Download als ausgehenden Verkehr — bei einer Datei, die
 * ohnehin anderswo liegt. Mit dieser Adresse lädt der Rechner des Kunden
 * direkt beim Speicher, und die Anlage sagt ihm nur, wo.
 *
 * Die Adresse verfällt. Sie steht in keinem Lesezeichen und in keiner
 * Suchmaschine; wer sie weitergibt, gibt etwas weiter, das morgen nicht mehr
 * geht.
 */
export function downloadAdresse(
  schluesselPfad: string,
  gueltigSekunden = 900,
  jetzt: Date = new Date(),
  zweck: Speicherzweck = 'programm',
  /**
   * §260 Der Name, unter dem die Datei beim Herunterladen erscheinen soll.
   *
   * Im Speicher heißt sie `chat/<raum>/2026-10-29/9f3c…b1.jpg` — ein
   * zufälliger Schlüssel, damit zwei Fotos namens `IMG_0427.jpg` sich nicht
   * überschreiben und der Name nicht in der Adresse steht. Genau deshalb muss
   * der richtige Name hier wieder dazu: Sonst landet im Ordner „Downloads"
   * eine Datei mit einem Namen aus 32 Hexzeichen.
   *
   * `response-content-disposition` wird mitsigniert; der Speicher setzt den
   * Kopf dann so, wie der alte Weg ihn gesetzt hat.
   */
  anzeigeName?: string,
): string | null {
  return ausgestellteAdresse({
    methode: 'GET', schluesselPfad, gueltigSekunden, jetzt, zweck, anzeigeName,
  })
}

/**
 * §257 Eine zeitlich begrenzte Adresse zum HOCHLADEN.
 *
 * WARUM DAS DIE GANZE SACHE ÄNDERT
 * Heute geht jede Datei durch die Anwendung: Das Telefon lädt zum Server, der
 * Server liest sie vollständig in den Arbeitsspeicher und schreibt sie in die
 * Datenbank. Jede dieser drei Stationen ist eine Stelle, an der etwas
 * schiefgehen kann — und drei Runden Fehlersuche haben genau das gezeigt.
 *
 * Mit dieser Adresse lädt das Telefon DIREKT zum Speicher. Die Anwendung sagt
 * nur, wohin. Sie sieht die Datei nie, hält keinen Arbeitsspeicher dafür vor
 * und belegt keine Datenbankverbindung.
 *
 * WARUM DER TYP MITSIGNIERT WIRD
 * Ohne ihn könnte jemand mit einer Adresse für ein Bild eine ausführbare
 * Datei ablegen. Der Typ steht in der Signatur; wer beim Hochladen einen
 * anderen angibt, bekommt von Cloudflare eine Absage — nicht von uns, und
 * damit auch dann, wenn unsere Prüfung einmal danebenliegt.
 *
 * WARUM DIE ADRESSE KURZ GILT
 * Sie ist ein Schreibrecht auf einen Platz im Speicher. Fünf Minuten reichen
 * für jeden Upload; eine Adresse, die in einem Protokoll landet, ist danach
 * wertlos.
 */
export function uploadAdresse(
  schluesselPfad: string,
  mimeType: string,
  gueltigSekunden = 300,
  jetzt: Date = new Date(),
  zweck: Speicherzweck = 'dateien',
): string | null {
  return ausgestellteAdresse({
    methode: 'PUT', schluesselPfad, gueltigSekunden, jetzt, mimeType, zweck,
  })
}

/**
 * §257 Eine zeitlich begrenzte Adresse zum LÖSCHEN.
 *
 * Gebraucht für den Fall, der sonst eine Leiche hinterlässt: Das Telefon hat
 * hochgeladen, aber der Eintrag in der Datenbank scheitert. Dann liegt eine
 * Datei im Speicher, von der niemand mehr weiß. Diese Adresse räumt sie weg.
 */
export function loeschAdresse(
  schluesselPfad: string,
  gueltigSekunden = 300,
  jetzt: Date = new Date(),
  zweck: Speicherzweck = 'dateien',
): string | null {
  return ausgestellteAdresse({
    methode: 'DELETE', schluesselPfad, gueltigSekunden, jetzt, zweck,
  })
}

/**
 * Die gemeinsame Rechenvorschrift für alle ausgestellten Adressen.
 *
 * §257 Vorher stand sie einmal für `GET` da. Sie ein zweites Mal für `PUT`
 * hinzuschreiben wäre die Art Dublette, die in §229, §232 und §235 dreimal
 * als Fehler aufgefallen ist: Zwei Abschriften derselben Vorschrift laufen
 * auseinander, und der Unterschied meldet sich als „SignatureDoesNotMatch",
 * ohne Hinweis worauf.
 */
function ausgestellteAdresse(auftrag: {
  methode: 'GET' | 'PUT' | 'DELETE'
  schluesselPfad: string
  gueltigSekunden: number
  jetzt: Date
  mimeType?: string
  zweck?: Speicherzweck
  anzeigeName?: string
}): string | null {
  /*
   * §260 Benannte Angaben statt einer Reihe von Stellen.
   *
   * Vorher standen hier sechs Parameter hintereinander, davon zwei optionale
   * mitten drin. Der Aufruf `(…, undefined, 'dateien')` sagt niemandem mehr,
   * was gemeint ist, und ein Vertauschen fällt nicht auf: Die Folge wäre
   * „SignatureDoesNotMatch", und diese Meldung nennt den Grund nicht.
   */
  const {
    methode, schluesselPfad, gueltigSekunden, jetzt, mimeType, anzeigeName,
  } = auftrag
  const z = zugang(auftrag.zweck ?? 'programm')
  if (!z) return null

  const { lang, tag } = zeitstempel(jetzt)
  const bereich = `${tag}/${REGION}/${DIENST}/aws4_request`
  const pfad = `/${pfadKodieren(z.bucket)}/${pfadKodieren(schluesselPfad)}`

  // Die Reihenfolge der Parameter ist Teil der Signatur — alphabetisch.
  /*
   * §257 Beim Hochladen wird der Typ mitsigniert. Die Köpfe müssen
   * alphabetisch stehen — `content-type` vor `host` —, sonst stimmt die
   * Signatur nicht, und die Meldung dazu nennt den Grund nicht.
   */
  const koepfe: Array<[string, string]> = mimeType
    ? [['content-type', mimeType], ['host', wirt(z)]]
    : [['host', wirt(z)]]
  const signierteKoepfe = koepfe.map(([k]) => k).join(';')

  const parameter: Array<[string, string]> = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${z.schluessel}/${bereich}`],
    ['X-Amz-Date', lang],
    ['X-Amz-Expires', String(gueltigSekunden)],
    ['X-Amz-SignedHeaders', signierteKoepfe],
  ]
  /*
   * §260 Der Anzeigename. `inline` und nicht `attachment`, genau wie beim
   * alten Weg: Ein Bild soll man sehen und eine Sprachnachricht hören können,
   * ohne sie vorher herunterzuladen.
   *
   * Anführungszeichen im Namen würden den Kopf aufbrechen; `sichererDateiname`
   * entfernt sie bereits, hier steht es noch einmal, weil diese Stelle sich
   * nicht darauf verlassen können soll.
   */
  if (anzeigeName) {
    parameter.push([
      'response-content-disposition',
      `inline; filename="${anzeigeName.replace(/[\r\n"]/g, '')}"`,
    ])
  }
  const abfrage = parameter
    .map(([k, v]) => `${kodieren(k)}=${kodieren(v)}`)
    .sort()
    .join('&')

  const anfrage = [
    methode,
    pfad,
    abfrage,
    ...koepfe.map(([k, v]) => `${k}:${v}`),
    '',
    signierteKoepfe,
    // Bei einer ausgestellten Adresse wird der Inhalt nicht mitsigniert —
    // beim Ausstellen gibt es ihn noch gar nicht.
    'UNSIGNED-PAYLOAD',
  ].join('\n')

  const zuSignieren = [
    'AWS4-HMAC-SHA256', lang, bereich, sha256(anfrage),
  ].join('\n')

  const signatur = createHmac('sha256', signierschluessel(z.geheimnis, tag))
    .update(zuSignieren).digest('hex')

  return `https://${wirt(z)}${pfad}?${abfrage}&X-Amz-Signature=${signatur}`
}

/**
 * §260 Nachsehen, was wirklich im Speicher liegt.
 *
 * DAS PROBLEM, DAS DAMIT GELÖST WIRD
 * Beim direkten Weg lädt das Telefon zum Speicher, und erst danach meldet es
 * der Anwendung: „liegt da, heißt so, ist so groß." Diese Meldung ist eine
 * BEHAUPTUNG. Ihr zu glauben hieße, drei Prüfungen aufzugeben, die der alte
 * Weg hatte:
 *
 *   — ob überhaupt etwas angekommen ist (sonst steht im Verlauf eine
 *     Nachricht mit einem Anhang, den niemand öffnen kann),
 *   — wie groß es wirklich ist (die Grenze von 25 MB wäre sonst eine Bitte),
 *   — was tatsächlich drinsteht (§241: eine `.exe` mit dem Namen `foto.jpg`
 *     und dem gemeldeten Typ `image/jpeg` kommt sonst durch).
 *
 * WARUM EIN TEILSTÜCK UND KEIN `HEAD`
 * Ein `HEAD` bräuchte eine eigene Unterschrift — die Methode steht in der
 * Signatur. Ein `GET` mit Bereichsangabe kommt mit der vorhandenen
 * Download-Adresse aus und bringt beides in einer Anfrage: Im Kopf
 * `content-range` steht die wahre Gesamtgröße, im Rumpf die ersten Bytes für
 * die Typerkennung. Geholt werden 64 Bytes, nicht die Datei.
 */
export async function objektKopf(
  schluesselPfad: string,
  zweck: Speicherzweck = 'dateien',
): Promise<{ groesse: number; anfang: Buffer } | null> {
  const adresse = downloadAdresse(schluesselPfad, 60, new Date(), zweck)
  if (!adresse) return null

  const antwort = await fetch(adresse, { headers: { range: 'bytes=0-63' } }).catch(() => null)
  if (!antwort) return null
  /*
   * 416 heißt „der angeforderte Bereich liegt außerhalb" — bei einem Objekt
   * ohne Inhalt. Das Objekt gibt es also, es ist nur leer; die Prüfung weiter
   * oben weist eine leere Datei ohnehin ab.
   */
  if (antwort.status === 416) {
    await antwort.body?.cancel().catch(() => undefined)
    return { groesse: 0, anfang: Buffer.alloc(0) }
  }
  if (!antwort.ok) {
    await antwort.body?.cancel().catch(() => undefined)
    return null
  }

  const anfang = Buffer.from(await antwort.arrayBuffer())
  /*
   * `bytes 0-63/421337` — hinter dem Schrägstrich die Gesamtgröße. Fehlt der
   * Kopf, hat der Speicher die ganze Datei geschickt, und dann ist deren
   * Länge die Gesamtgröße.
   */
  const gesamt = antwort.headers.get('content-range')?.match(/\/(\d+)\s*$/)?.[1]
  return { groesse: gesamt ? Number(gesamt) : anfang.length, anfang }
}

/**
 * §260 Ein Objekt wegräumen, von dem kein Eintrag mehr weiß.
 *
 * Gebraucht für den Fall, in dem das Telefon hochgeladen hat, die Prüfung
 * danach aber fehlschlägt. Ohne das bliebe eine Datei im Speicher liegen, die
 * in keiner Akte und keinem Verlauf auftaucht — und die deshalb auch keine
 * Löschfrist je erreicht.
 *
 * Scheitert das Wegräumen, passiert nichts weiter: Der Mensch soll deswegen
 * keine zweite Fehlermeldung sehen.
 */
export async function objektWegraeumen(
  schluesselPfad: string,
  zweck: Speicherzweck = 'dateien',
): Promise<void> {
  const adresse = loeschAdresse(schluesselPfad, 120, new Date(), zweck)
  if (!adresse) return
  const antwort = await fetch(adresse, { method: 'DELETE' }).catch(() => null)
  await antwort?.body?.cancel().catch(() => undefined)
}

/**
 * Eine kleine Datei direkt holen.
 *
 * Nur für `latest.yml` gedacht — vier Zeilen Text, die bei jedem Programm
 * alle paar Stunden abgefragt werden. Dafür lohnt kein Umweg über eine
 * ausgestellte Adresse: Das wären zwei Anfragen statt einer, und die Datei
 * ist kleiner als der Umleitungskopf.
 */
export async function kleineDateiHolen(
  schluesselPfad: string,
): Promise<{ ok: true; inhalt: string } | { ok: false; status: number }> {
  const z = zugang()
  if (!z) return { ok: false, status: 503 }

  const jetzt = new Date()
  const { lang, tag } = zeitstempel(jetzt)
  const bereich = `${tag}/${REGION}/${DIENST}/aws4_request`
  const pfad = `/${pfadKodieren(z.bucket)}/${pfadKodieren(schluesselPfad)}`
  const leer = sha256('')

  const anfrage = [
    'GET', pfad, '',
    `host:${wirt(z)}`,
    `x-amz-content-sha256:${leer}`,
    `x-amz-date:${lang}`,
    '',
    'host;x-amz-content-sha256;x-amz-date',
    leer,
  ].join('\n')

  const zuSignieren = ['AWS4-HMAC-SHA256', lang, bereich, sha256(anfrage)].join('\n')
  const signatur = createHmac('sha256', signierschluessel(z.geheimnis, tag))
    .update(zuSignieren).digest('hex')

  const antwort = await fetch(`https://${wirt(z)}${pfad}`, {
    headers: {
      host: wirt(z),
      'x-amz-content-sha256': leer,
      'x-amz-date': lang,
      authorization: `AWS4-HMAC-SHA256 Credential=${z.schluessel}/${bereich}, `
        + `SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${signatur}`,
    },
  }).catch(() => null)

  if (!antwort) return { ok: false, status: 502 }
  if (!antwort.ok) return { ok: false, status: antwort.status }
  return { ok: true, inhalt: await antwort.text() }
}
