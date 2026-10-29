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
export function r2Eingerichtet(): boolean {
  return Boolean(zugang())
}

export function zugang(): R2Zugang | null {
  const kontoId = process.env.R2_KONTO_ID
  const bucket = process.env.R2_BUCKET
  const schluessel = process.env.R2_SCHLUESSEL
  const geheimnis = process.env.R2_GEHEIMNIS
  if (!kontoId || !bucket || !schluessel || !geheimnis) return null
  // §256 Leer lassen heißt „ohne Festlegung"; `eu` bindet an die EU.
  const bereich = (process.env.R2_BEREICH || '').trim().toLowerCase() || null
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
): string | null {
  const z = zugang()
  if (!z) return null

  const { lang, tag } = zeitstempel(jetzt)
  const bereich = `${tag}/${REGION}/${DIENST}/aws4_request`
  const pfad = `/${pfadKodieren(z.bucket)}/${pfadKodieren(schluesselPfad)}`

  // Die Reihenfolge der Parameter ist Teil der Signatur — alphabetisch.
  const parameter: Array<[string, string]> = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${z.schluessel}/${bereich}`],
    ['X-Amz-Date', lang],
    ['X-Amz-Expires', String(gueltigSekunden)],
    ['X-Amz-SignedHeaders', 'host'],
  ]
  const abfrage = parameter
    .map(([k, v]) => `${kodieren(k)}=${kodieren(v)}`)
    .sort()
    .join('&')

  const anfrage = [
    'GET',
    pfad,
    abfrage,
    `host:${wirt(z)}`,
    '',
    'host',
    // Bei einer ausgestellten Adresse wird der Inhalt nicht mitsigniert —
    // es gibt ja keinen.
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
