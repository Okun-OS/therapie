import { createHmac, timingSafeEqual } from 'crypto'

/**
 * §289 Die Bestätigung beim Öffnen der App — mit dem zweiten Faktor.
 *
 * GEWÜNSCHT: „Kannst du bitte einstellen, dass bei der 2FA auch beim
 * SMS-Code man einstellen kann, dass man bei jedem Öffnen der App neu mit
 * 2FA gefragt wird." Und dazu, auf Rückfrage: „bei 2fa mit sms, nicht bei
 * Fingerabdruck und so."
 *
 * WARUM DAS NICHT DIE GERÄTESPERRE VON §139 IST
 * Die hat in §288 jemanden ausgesperrt, und zwar nicht, weil der Sensor
 * schlecht war, sondern weil ihr Tor ein ANDERES war als das der Anmeldung:
 *
 *     Sperre fragt den Finger  →  Finger scheitert  →  bleibt zu
 *     „Abmelden"               →  Anmeldung mit Passwort  →  klappt
 *     Sperre fragt den Finger  →  scheitert wieder  →  bleibt zu  →  …
 *
 * Wer das eine Tor passieren konnte und das andere nicht, lief im Kreis.
 *
 * Hier ist das Tor DASSELBE wie beim Anmelden: derselbe SMS-Code, dieselbe
 * App, dieselbe E-Mail. Wer die Sperre nicht passieren kann, kann sich auch
 * nicht anmelden — die Sperre nimmt also niemandem etwas, das er sonst
 * hätte. Der Ausweg „stattdessen abmelden" führt zur Anmeldung, und die
 * verlangt genau dasselbe. Es gibt keinen Kreis mehr.
 *
 * ZWEI SCHRANKEN, DIE AUS §288 KOMMEN
 *   1. Einschalten geht nur mit eingerichtetem zweitem Faktor. Eine Tür ohne
 *      Schlüssel baut man nicht.
 *   2. Fällt der zweite Faktor später weg — Telefon verloren, SMS-2FA von
 *      der Verwaltung abgeschaltet —, gilt die Einstellung als AUS. Das ist
 *      bewusst ein Nachgeben: Eine Sperre, zu der es keinen Schlüssel mehr
 *      gibt, ist kein Schutz, sondern ein verschlossener Mensch.
 *
 * WIE „ÖFFNEN" ERKANNT WIRD
 * Das Siegel ist ein SITZUNGSKEKS — ohne Verfallsdatum im Keks selbst. Ein
 * solcher Keks lebt nur, solange das Fenster lebt: Wird die App wirklich
 * geschlossen (weggewischt, Prozess beendet), ist er weg, und beim nächsten
 * Start wird gefragt. Ein Neuladen innerhalb der laufenden App ist dagegen
 * kein Öffnen und fragt nicht — sonst stünde man nach jedem Antippen eines
 * Links wieder vor der Tür.
 *
 * Dass die App aus dem Hintergrund zurückkehrt, sieht nur das Gerät. Dafür
 * wirft die Oberfläche das Siegel selbst weg (`DELETE`), wenn sie länger als
 * eine Minute weg war. Eine Minute, weil genau dieser Weg gebraucht wird:
 * zur Kamera wechseln, den Krankenschein fotografieren, zurückkommen. Wer
 * dafür einen neuen SMS-Code bräuchte, schaltet die Sperre nach zwei Tagen
 * wieder ab.
 *
 * ZUSÄTZLICH EINE HARTE OBERGRENZE
 * Auch ein lebendes Fenster bekommt das Siegel nicht für immer: Nach zwölf
 * Stunden ist es ungültig. Ein Tablet im Dienstzimmer, das nie geschlossen
 * wird, stünde sonst dauerhaft offen — und das ist der Fall, für den die
 * ganze Einstellung da ist.
 */

/** Name des Kekses. Eigener Zweck, eigener Keks — wie beim Lohnsiegel. */
export const OEFFNUNG_KEKS = 'okun_oeffnung'

/** Harte Obergrenze, auch wenn das Fenster offen bleibt. */
export const HOECHSTENS_STUNDEN = 12

/**
 * Wie lange die App weg gewesen sein darf, ohne dass neu gefragt wird.
 *
 * Steht hier und nicht in der Oberfläche, damit Server und Gerät dieselbe
 * Zahl meinen, wenn später jemand darüber spricht.
 */
export const KARENZ_SEKUNDEN = 60

/**
 * Das Geheimnis zum Unterschreiben — dasselbe wie für Sitzung und
 * Lohnsiegel. Wer es hat, hat ohnehin alles; ein zweites Geheimnis ist vor
 * allem eine zweite Sache, die beim Einrichten vergessen wird (§201).
 */
function geheimnis(): string {
  const wert = process.env.SESSION_SECRET
  if (!wert) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET ist nicht gesetzt')
    }
    return 'dev-insecure-session-secret-do-not-use-in-production'
  }
  return wert
}

/**
 * Unterschrift mit vorangestelltem Zweck.
 *
 * Das `oeffnung:` davor ist kein Schmuck: Ohne es wären Sitzungsmarke,
 * Lohnsiegel und dieses Siegel über demselben Geheimnis und demselben
 * Verfahren unterschrieben — und dann ließe sich das eine an der Stelle des
 * anderen vorzeigen.
 */
function unterschrift(inhalt: string): string {
  return createHmac('sha256', geheimnis()).update(`oeffnung:${inhalt}`).digest('base64url')
}

interface Siegelinhalt {
  u: string
  iat: number
}

export function siegelErzeugen(userId: string, jetzt: number = Date.now()): string {
  const daten = Buffer.from(JSON.stringify({ u: userId, iat: jetzt } satisfies Siegelinhalt))
    .toString('base64url')
  return `${daten}.${unterschrift(daten)}`
}

/**
 * Ein vorgezeigtes Siegel prüfen.
 *
 * Drei Bedingungen: richtige Unterschrift, nicht älter als die Obergrenze,
 * und es gehört DIESEM Benutzer. Die dritte ist der eigentliche Grund für
 * den Aufwand — sonst bliebe das Siegel liegen, wenn sich am selben Tablet
 * die nächste Person anmeldet, und die käme ohne Code hinein. Genau der
 * Fall, gegen den die Einstellung gebaut ist.
 */
export function siegelGueltig(
  marke: string | undefined | null,
  userId: string,
  jetzt: number = Date.now(),
): boolean {
  if (!marke) return false

  const teile = marke.split('.')
  if (teile.length !== 2) return false
  const [daten, gezeigt] = teile

  const erwartet = unterschrift(daten)
  const a = Buffer.from(gezeigt)
  const b = Buffer.from(erwartet)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false

  let inhalt: Siegelinhalt
  try {
    inhalt = JSON.parse(Buffer.from(daten, 'base64url').toString('utf8')) as Siegelinhalt
  } catch {
    return false
  }

  if (!inhalt?.u || inhalt.u !== userId) return false
  if (typeof inhalt.iat !== 'number') return false
  // Ein Siegel aus der Zukunft ist eine verstellte Uhr oder ein Bastelversuch.
  if (inhalt.iat > jetzt + 60_000) return false
  return inhalt.iat + HOECHSTENS_STUNDEN * 3600_000 > jetzt
}

/**
 * Keks-Einstellungen. KEIN `maxAge` — das macht ihn zum Sitzungskeks, und
 * genau darauf beruht „beim Öffnen der App". Siehe oben.
 */
export const KEKS_OPTIONEN = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
}

/**
 * Wege, die offen bleiben MÜSSEN, solange die Tür zu ist.
 *
 * Das ist die wichtigste Liste in dieser Datei, und sie ist aus §288
 * gelernt: Ohne den Ausweg ist eine Sperre eine Falle. Offen bleiben
 *
 *   – das Abmelden (der Ausweg),
 *   – die Auskunft, wer angemeldet ist (sonst weiß die Oberfläche nichts),
 *   – alles, was zum Passieren der Tür gebraucht wird,
 *   – das Lebenszeichen der Anlage.
 *
 * Verglichen wird mit `startsWith`, damit Unterpfade mitkommen.
 */
export const FREIE_PFADE = [
  '/api/auth/logout',
  '/api/auth/me',
  '/api/auth/oeffnung',
  '/api/health',
]

export function pfadIstFrei(pfad: string): boolean {
  return FREIE_PFADE.some(frei => pfad === frei || pfad.startsWith(`${frei}/`))
}

export interface Oeffnungssperre {
  status: number
  error: string
  code: 'OEFFNUNG_NOETIG'
}

/**
 * Die eine Stelle, an der entschieden wird, ob erst bestätigt werden muss.
 *
 * Aufgerufen wird sie in `requireRole` — also an jeder Schnittstelle, die
 * eine Anmeldung verlangt. Eine Sperre, die nur die Oberfläche verdeckt,
 * wäre Schaufensterschutz: Wer das Telefon in der Hand hat, hat auch den
 * Sitzungskeks, und damit stünden die Daten über jede Adresse offen.
 */
export function oeffnungSperre(opts: {
  /** Steht die Einstellung an? Kommt aus der Sitzungsmarke. */
  verlangt: boolean | undefined
  marke?: string | null
  userId: string
  pfad: string
  jetzt?: number
}): Oeffnungssperre | null {
  if (!opts.verlangt) return null
  if (pfadIstFrei(opts.pfad)) return null
  if (siegelGueltig(opts.marke, opts.userId, opts.jetzt)) return null
  return {
    status: 403,
    error: 'Bitte bestätige dich mit deinem zweiten Faktor, um weiterzumachen.',
    code: 'OEFFNUNG_NOETIG',
  }
}

/** Welche zweiten Faktoren ein Konto hat — und ob überhaupt einer da ist. */
export interface Faktorlage {
  sms: boolean
  email: boolean
  totp: boolean
}

export function hatZweitenFaktor(lage: Faktorlage): boolean {
  return lage.sms || lage.email || lage.totp
}

/**
 * Gilt die Einstellung wirklich?
 *
 * Nur mit einem zweiten Faktor. Das ist die Schranke aus §288: Ohne
 * Schlüssel keine Tür. Fällt der Faktor nachträglich weg, gibt diese
 * Funktion `false` — und die Oberfläche schaltet die Einstellung auch in der
 * Datenbank ab, damit der Zustand nicht still auseinanderläuft.
 */
export function oeffnungAktiv(gespeichert: boolean, lage: Faktorlage): boolean {
  return gespeichert && hatZweitenFaktor(lage)
}
