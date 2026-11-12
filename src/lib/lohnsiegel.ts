import { createHmac, timingSafeEqual } from 'crypto'

/**
 * §201 Die zweite Tür vor der Lohnabrechnung.
 *
 * WARUM ES SIE GIBT
 * Eine Sitzung hält dreißig Tage. Das ist für den Alltag richtig — niemand
 * will sich dreimal am Tag neu anmelden, um eine Schicht zu tauschen. Für die
 * Lohnabrechnung ist es falsch: In einer Wohngruppe steht ein Tablet im
 * Dienstzimmer, und wer es in die Hand nimmt, ist angemeldet als der, der es
 * zuletzt benutzt hat. Zwischen „Dienstplan ansehen" und „sehen, was die
 * Kollegin verdient" lag bisher ein Fingertipp.
 *
 * Das Gehalt ist die Angabe, die Mitarbeiter am wenigsten voneinander wissen
 * wollen. Sie verdient einen eigenen Schritt.
 *
 * WARUM KEIN ZWEITES PASSWORT
 * Der Eigentümer hatte „wie ein extra Passwort" vorgeschlagen. Ein zweites
 * Passwort wäre hier die schlechtere Lösung: Es wird einmal vergeben, selten
 * gebraucht, prompt vergessen — und dann braucht es einen Weg, es
 * zurückzusetzen, und dieser Weg ist am Ende die eigentliche Tür. Man baut
 * also eine zweite Sperre und gleich daneben die Umgehung dafür.
 *
 * Abgefragt wird deshalb das EIGENE Anmeldepasswort. Es ist dasselbe
 * Geheimnis, aber eine andere Aussage: nicht „dieses Gerät gehört jemandem,
 * der sich einmal angemeldet hat", sondern „die Person, die hier GERADE steht,
 * kennt das Passwort". Genau das ist die Frage, die am Tablet im Dienstzimmer
 * offen ist.
 *
 * WARUM NUR FÜR MITARBEITER
 * Für die Leitung wäre dieselbe Sperre Schaufenster-Sicherheit: Sie hat die
 * Lohnliste aller Beschäftigten ohnehin offen auf dem Bildschirm. Ein PDF zu
 * verriegeln, während die Tabelle mit denselben Zahlen daneben steht, schützt
 * nichts und kostet jeden Abrechnungslauf Zeit. Wer das ändern will, ändert
 * `siegelNoetig` — an einer Stelle.
 */

/** Name des Kekses. Getrennt vom Sitzungskeks, damit „abmelden" und
 *  „wieder sperren" zwei verschiedene Dinge bleiben können. */
export const SIEGEL_KEKS = 'okun_lohnsiegel'

/**
 * Wie lange die Freigabe hält.
 *
 * Fünfzehn Minuten: lang genug, um mehrere Monate hintereinander
 * herunterzuladen oder eine Abrechnung für die Bank zu suchen; kurz genug,
 * dass ein liegengelassenes Tablet nach der Übergabe nicht mehr offen ist.
 */
export const GUELTIG_MINUTEN = 15

/** Kategorien der Personalakte, die hinter der zweiten Tür liegen.
 *  Die Jahresübersicht wird unter derselben Kategorie abgelegt wie die
 *  Monatsabrechnung — beide tragen Jahresbrutto und -netto, beide gehören
 *  hierher. */
export const VERTRAULICHE_KATEGORIEN = ['lohnabrechnung']

/** Wer muss sich bestätigen, und wofür? */
export function siegelNoetig(rolle: string, kategorie?: string | null): boolean {
  if (rolle !== 'employee') return false
  if (kategorie === undefined) return true // Frage nach der Rolle allein
  return VERTRAULICHE_KATEGORIEN.includes(String(kategorie))
}

/**
 * Das Geheimnis zum Unterschreiben.
 *
 * Bewusst dasselbe wie für die Sitzungen — wie schon beim Anmeldeschutz
 * (§152): Wer es hat, hat ohnehin alles, und ein zweites Geheimnis ist vor
 * allem eine zweite Sache, die beim Einrichten vergessen wird.
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
 * Unterschrift über den Inhalt — mit vorangestelltem Zweck.
 *
 * Das `lohnsiegel:` davor ist kein Schmuck: Ohne es wären Sitzungsmarke und
 * Siegel über demselben Geheimnis und demselben Verfahren unterschrieben, und
 * dann ließe sich die eine an der Stelle der anderen vorzeigen. Getrennte
 * Zwecke brauchen getrennte Unterschriften, auch wenn der Schlüssel derselbe
 * ist.
 */
function unterschrift(inhalt: string): string {
  return createHmac('sha256', geheimnis()).update(`lohnsiegel:${inhalt}`).digest('base64url')
}

interface Siegelinhalt {
  /** Für wen das Siegel gilt. */
  u: string
  /** Wann es ausgestellt wurde. */
  iat: number
}

/** Ein frisches Siegel ausstellen. */
export function siegelErzeugen(userId: string, jetzt: number = Date.now()): string {
  const inhalt: Siegelinhalt = { u: userId, iat: jetzt }
  const daten = Buffer.from(JSON.stringify(inhalt)).toString('base64url')
  return `${daten}.${unterschrift(daten)}`
}

export interface Siegelstand {
  gueltig: boolean
  /** Verbleibende Zeit in Millisekunden; 0, wenn ungültig. */
  restMs: number
}

const UNGUELTIG: Siegelstand = { gueltig: false, restMs: 0 }

/**
 * Ein vorgezeigtes Siegel prüfen.
 *
 * Drei Bedingungen, und alle drei zählen:
 *   1. Die Unterschrift stimmt — sonst hat es jemand selbst geschrieben.
 *   2. Es ist noch keine 15 Minuten alt.
 *   3. Es gehört DIESEM Benutzer.
 *
 * Punkt 3 ist der eigentliche Grund für den Aufwand. Ohne ihn bliebe das
 * Siegel im Browser liegen, wenn sich am selben Tablet die nächste Person
 * anmeldet — und die käme dann ohne Passwort an ihre Abrechnung. Das ist
 * genau der Fall, gegen den die ganze Sperre gebaut ist, also wäre sie ohne
 * Punkt 3 wertlos.
 */
export function siegelPruefen(
  marke: string | undefined | null,
  userId: string,
  jetzt: number = Date.now(),
): Siegelstand {
  if (!marke) return UNGUELTIG

  const teile = marke.split('.')
  if (teile.length !== 2) return UNGUELTIG
  const [daten, gezeigt] = teile

  const erwartet = unterschrift(daten)
  const a = Buffer.from(gezeigt)
  const b = Buffer.from(erwartet)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return UNGUELTIG

  let inhalt: Siegelinhalt
  try {
    inhalt = JSON.parse(Buffer.from(daten, 'base64url').toString('utf8')) as Siegelinhalt
  } catch {
    return UNGUELTIG
  }

  if (!inhalt?.u || inhalt.u !== userId) return UNGUELTIG
  if (typeof inhalt.iat !== 'number') return UNGUELTIG

  const restMs = inhalt.iat + GUELTIG_MINUTEN * 60 * 1000 - jetzt
  // Ein Siegel aus der Zukunft ist entweder eine verstellte Uhr oder ein
  // Bastelversuch. Beides hat hier nichts verloren.
  if (restMs <= 0 || inhalt.iat > jetzt + 60 * 1000) return UNGUELTIG

  return { gueltig: true, restMs }
}

export interface Siegelsperre {
  status: number
  error: string
  code: 'SIEGEL_NOETIG'
}

/**
 * Die eine Stelle, an der entschieden wird, ob jemand erst bestätigen muss.
 *
 * WARUM SIE MEHR ALS DIE PDF SCHÜTZT
 * Beim Prüfen der Sperre an der Lohnabrechnung fiel auf, dass dieselben Zahlen
 * noch auf drei anderen Wegen herauskommen, die jedem Angemeldeten offenstehen:
 *
 *   /api/dsgvo/auskunft        alle Abrechnungszeilen auf einmal, als JSON
 *   /api/payroll/bescheinigung Personalnummer, SV-Nummer, Krankenkasse, Monate
 *   /api/payroll/bav           die Entgeltumwandlung mit Monatsbetrag
 *
 * Die Auskunft ist dabei die schlimmere Tür als die Abrechnung: Sie gibt nicht
 * einen Monat heraus, sondern alles. Eine Sperre nur am PDF hätte wie Schutz
 * ausgesehen und keiner gewesen — der Nachbar am selben Tablet hätte einfach
 * die andere Adresse genommen.
 *
 * DASS DAS BEI DER AUSKUNFT ERLAUBT IST
 * Art. 15 DSGVO ist ein Recht der Person, und es darf nicht erschwert werden.
 * Eine Identitätsprüfung ist aber ausdrücklich vorgesehen (Art. 12 Abs. 6):
 * Bei begründeten Zweifeln, WER da fragt, dürfen zusätzliche Informationen
 * verlangt werden. Genau das ist hier der Zweifel — und verlangt wird nichts
 * Neues, sondern das Passwort, das die Person ohnehin hat.
 */
export function siegelSperre(opts: {
  rolle: string
  marke?: string | null
  userId: string
  /** Nur bei Dateien: Was für eine Unterlage ist es? */
  kategorie?: string | null
  /** Für die Meldung: „…, um <was>." */
  was: string
  jetzt?: number
}): Siegelsperre | null {
  if (!siegelNoetig(opts.rolle, opts.kategorie)) return null
  if (siegelPruefen(opts.marke, opts.userId, opts.jetzt).gueltig) return null
  return {
    status: 403,
    error: `Bitte bestätige zuerst dein Passwort, um ${opts.was}.`,
    code: 'SIEGEL_NOETIG',
  }
}

/** Keks-Einstellungen — gleich streng wie beim Sitzungskeks. */
export const KEKS_OPTIONEN = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
}
