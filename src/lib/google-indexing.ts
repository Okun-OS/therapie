import { createSign } from 'crypto'

/**
 * §216 Google sagen, dass sich eine Stellenanzeige geändert hat.
 *
 * WOFÜR
 * Jede Anzeige trägt seit §148 ein `JobPosting` im Quelltext — das ist die
 * Eintrittskarte zu Google for Jobs, und für einen kleinen Träger der
 * wirksamste Kanal überhaupt, weil er nichts kostet. Bisher musste Google von
 * selbst vorbeikommen; bei einer Seite ohne Verlinkung dauert das Tage. Diese
 * Datei sagt Google Bescheid.
 *
 * WAS DAS NICHT IST
 * **Keine Zusage auf Aufnahme.** Die Schnittstelle meldet eine Änderung an;
 * ob Google die Seite aufnimmt, bleibt Googles Entscheidung. Wer etwas
 * anderes verspricht, verspricht etwas, das er nicht halten kann. Sie ist
 * ausdrücklich nur für Seiten mit `JobPosting` oder `BroadcastEvent`
 * vorgesehen — unser Fall ist der erste; für alles andere wäre die Benutzung
 * ein Verstoß gegen Googles Bedingungen.
 *
 * WARUM SELBST GESCHRIEBEN UND NICHT `googleapis`
 * Dasselbe Argument wie bei §210 (R2): Das Paket zieht Dutzende weitere nach,
 * gebraucht werden genau zwei Dinge — ein signiertes Token holen und eine
 * Adresse melden. Beides steht unten in achtzig Zeilen, und der Weg über
 * JWT-Bearer ist von Google festgelegt und ändert sich nicht.
 *
 * WAS HIER BEWUSST FEHLT
 * Kein Lesen, kein `getMetadata`, kein Abruf fremder Adressen. Gemeldet wird
 * ausschließlich eine Adresse unserer eigenen Domain, und auch die nur, wenn
 * sie öffentlich ist oder gerade aufgehört hat, es zu sein.
 */

const SCOPE = 'https://www.googleapis.com/auth/indexing'
const TOKEN_ADRESSE = 'https://oauth2.googleapis.com/token'
const MELDE_ADRESSE = 'https://indexing.googleapis.com/v3/urlNotifications:publish'

/**
 * Das Tageskontingent, das Google je Projekt vorsieht: 200 Meldungen,
 * zurückgesetzt um Mitternacht pazifischer Zeit.
 *
 * Es gilt für das ganze Projekt und damit für ALLE Mandanten zusammen. Das
 * ist der Grund, warum hier überhaupt gezählt wird: Ein Betrieb, der seine
 * Karriereseite mit achtzig Anzeigen abschaltet, würde sonst das Kontingent
 * aller anderen für diesen Tag aufbrauchen.
 */
export const TAGESGRENZE = 200

/** Ein Stapel aus einer einzelnen Handlung. Deckel gegen genau diesen Fall. */
export const STAPELGRENZE = 50

export type Meldeart = 'URL_UPDATED' | 'URL_DELETED'

export interface Zugang {
  email: string
  schluessel: string
}

/**
 * Die Zugangsdaten des Dienstkontos.
 *
 * Zwei Variablen und nicht die ganze JSON-Datei: Der private Schlüssel ist
 * mehrzeilig, und eine JSON-Datei mit Zeilenumbrüchen in eine Umgebungsvariable
 * zu pressen ist der häufigste Weg, sich hier eine Stunde zu verlieren. Die
 * Umbrüche dürfen deshalb als `\n` geschrieben sein.
 */
export function zugang(): Zugang | null {
  const email = process.env.GOOGLE_INDEXING_EMAIL
  const roh = process.env.GOOGLE_INDEXING_SCHLUESSEL
  if (!email || !roh) return null
  const schluessel = roh.replace(/\\n/g, '\n')
  if (!schluessel.includes('BEGIN') || !schluessel.includes('PRIVATE KEY')) return null
  return { email, schluessel }
}

export function indexierungEingerichtet(): boolean {
  return Boolean(zugang())
}

// ── Die Adresse, um die es geht ────────────────────────────────────────────

/**
 * Die öffentliche Adresse einer Anzeige.
 *
 * Sie muss **genau** die sein, unter der die Seite erreichbar ist — Google
 * prüft die Inhaberschaft gegen die Search Console, und eine Adresse mit
 * abweichendem Schrägstrich oder fehlendem `https` wird abgelehnt.
 */
export function stellenAdresse(
  kundeSlug: string, stellenSlug: string, basis = process.env.APP_URL,
): string | null {
  const wurzel = String(basis ?? '').trim().replace(/\/+$/, '')
  if (!wurzel || !kundeSlug || !stellenSlug) return null
  return `${wurzel}/karriere/${encodeURIComponent(kundeSlug)}`
    + `/${encodeURIComponent(stellenSlug)}`
}

/**
 * Ist diese Anzeige für einen Fremden sichtbar?
 *
 * Dieselbe Regel wie in `karriere.ts` und bewusst noch einmal als eigene,
 * prüfbare Funktion: Seite eingeschaltet UND Anzeige veröffentlicht. Wer hier
 * großzügiger wäre als dort, meldete Google Adressen, die 404 liefern — und
 * das ist genau der Fehler, der eine Domain bei Google in Verruf bringt.
 */
export function istOeffentlich(stellenStatus: string, seiteAktiv: boolean): boolean {
  return seiteAktiv && stellenStatus === 'veroeffentlicht'
}

/**
 * Was ist zu melden, wenn sich etwas geändert hat?
 *
 * Die ganze Entscheidung an einer Stelle, ohne Netz und ohne Datenbank —
 * damit sie sich einzeln prüfen lässt. Die vier Fälle:
 *
 *   war versteckt → ist öffentlich   `URL_UPDATED`  (neu oder wieder da)
 *   war öffentlich → ist versteckt   `URL_DELETED`  (geschlossen, Seite aus)
 *   war öffentlich → bleibt öffentlich, Inhalt geändert   `URL_UPDATED`
 *   war versteckt → bleibt versteckt  nichts
 *
 * Der letzte Fall ist der wichtigste: Ein Entwurf, an dem jemand zehnmal
 * herumschreibt, geht Google nichts an — und verbraucht sonst das
 * Tageskontingent aller Mandanten.
 */
export function meldungFuer(
  vorherOeffentlich: boolean,
  nachherOeffentlich: boolean,
  inhaltGeaendert = false,
): Meldeart | null {
  if (nachherOeffentlich) {
    if (!vorherOeffentlich || inhaltGeaendert) return 'URL_UPDATED'
    return null
  }
  return vorherOeffentlich ? 'URL_DELETED' : null
}

// ── Das Token ──────────────────────────────────────────────────────────────

const b64url = (w: Buffer | string) =>
  Buffer.from(w).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/**
 * Ein signiertes JWT nach Googles Vorgabe für Dienstkonten.
 *
 * Eine Stunde Laufzeit ist das Höchstmaß, das Google annimmt. `iat` in der
 * Zukunft — etwa durch eine falsch gehende Uhr — führt zu einer Ablehnung
 * ohne brauchbare Begründung; deshalb wird hier auf volle Sekunden gerundet
 * und nicht aufgerundet.
 */
export function jwtBauen(z: Zugang, jetzt: Date = new Date()): string {
  const sek = Math.floor(jetzt.getTime() / 1000)
  const kopf = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const inhalt = b64url(JSON.stringify({
    iss: z.email,
    scope: SCOPE,
    aud: TOKEN_ADRESSE,
    iat: sek,
    exp: sek + 3600,
  }))
  const signatur = createSign('RSA-SHA256')
    .update(`${kopf}.${inhalt}`)
    .sign(z.schluessel)
  return `${kopf}.${inhalt}.${b64url(signatur)}`
}

/**
 * Das Zugriffstoken, im Arbeitsspeicher gehalten.
 *
 * Ohne diesen Zwischenspeicher holte jede gemeldete Adresse ein neues Token —
 * zwei Anfragen statt einer, und eine davon mit einer RSA-Signatur. Eine
 * Minute Sicherheitsabstand, damit ein Token nicht unterwegs abläuft.
 */
let gehalten: { token: string; bis: number } | null = null

export function tokenVergessen(): void {
  gehalten = null
}

async function zugriffsToken(z: Zugang): Promise<string | null> {
  if (gehalten && gehalten.bis > Date.now()) return gehalten.token

  const antwort = await fetch(TOKEN_ADRESSE, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwtBauen(z),
    }),
  }).catch(() => null)
  if (!antwort || !antwort.ok) return null

  const daten = await antwort.json().catch(() => null) as
    { access_token?: string; expires_in?: number } | null
  if (!daten?.access_token) return null

  gehalten = {
    token: daten.access_token,
    bis: Date.now() + Math.max(0, (daten.expires_in ?? 3600) - 60) * 1000,
  }
  return gehalten.token
}

// ── Das Tageskontingent ────────────────────────────────────────────────────

let verbraucht = { tag: '', anzahl: 0 }

/** Der Kalendertag in pazifischer Zeit — danach setzt Google zurück. */
export function kontingentTag(jetzt: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(jetzt)
}

export function kontingentStand(jetzt: Date = new Date()): number {
  return verbraucht.tag === kontingentTag(jetzt) ? verbraucht.anzahl : 0
}

export function kontingentZuruecksetzen(): void {
  verbraucht = { tag: '', anzahl: 0 }
}

/**
 * Gezählt wird der Versuch, nicht der Erfolg.
 *
 * Das ist bewusst die vorsichtige Seite: Scheitert eine Meldung, weil Google
 * nicht erreichbar ist, haben wir eine Einheit verbraucht, die dort niemand
 * gezählt hat. Andersherum — erst bei Erfolg zählen — liefe eine Anlage, die
 * in einen Fehler läuft, beliebig oft gegen dieselbe Tür. Von beiden Fehlern
 * ist dieser der harmlosere: Er kostet uns einen Tag Verzögerung, nicht
 * Googles Vertrauen in die Domain.
 */
function kontingentNehmen(jetzt: Date): boolean {
  const heute = kontingentTag(jetzt)
  if (verbraucht.tag !== heute) verbraucht = { tag: heute, anzahl: 0 }
  if (verbraucht.anzahl >= TAGESGRENZE) return false
  verbraucht.anzahl++
  return true
}

/**
 * Dasselbe zweimal hintereinander zu melden, bringt nichts.
 *
 * Zwei Klicks auf „Veröffentlichen" sind keine zwei Änderungen. Zehn Minuten
 * Gedächtnis reichen, um das abzufangen, ohne eine echte Korrektur zu
 * verschlucken.
 */
const GEDAECHTNIS_MS = 10 * 60 * 1000
const zuletzt = new Map<string, number>()

export function gedaechtnisLeeren(): void {
  zuletzt.clear()
}

function schonGemeldet(url: string, art: Meldeart, jetzt: number): boolean {
  const schluessel = `${art} ${url}`
  const vorher = zuletzt.get(schluessel)
  if (vorher && jetzt - vorher < GEDAECHTNIS_MS) return true
  zuletzt.set(schluessel, jetzt)
  if (zuletzt.size > 2000) {
    for (const [k, t] of Array.from(zuletzt.entries())) {
      if (jetzt - t > GEDAECHTNIS_MS) zuletzt.delete(k)
    }
  }
  return false
}

// ── Melden ─────────────────────────────────────────────────────────────────

export type Ergebnis =
  | { ok: true }
  | { ok: false; grund: 'nicht eingerichtet' | 'doppelt' | 'kontingent' | 'abgelehnt'
      status?: number }

/**
 * Eine Adresse melden.
 *
 * Gibt niemals einen Fehler weiter nach oben. Diese Meldung ist eine
 * Nebensache: Dass ein Träger seine Anzeige veröffentlichen kann, darf nicht
 * davon abhängen, ob Google gerade erreichbar ist.
 */
export async function melden(
  url: string, art: Meldeart, jetzt: Date = new Date(),
): Promise<Ergebnis> {
  const z = zugang()
  if (!z) return { ok: false, grund: 'nicht eingerichtet' }
  if (schonGemeldet(url, art, jetzt.getTime())) return { ok: false, grund: 'doppelt' }
  if (!kontingentNehmen(jetzt)) return { ok: false, grund: 'kontingent' }

  const token = await zugriffsToken(z)
  if (!token) return { ok: false, grund: 'abgelehnt' }

  const antwort = await fetch(MELDE_ADRESSE, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ url, type: art }),
  }).catch(() => null)

  if (!antwort) return { ok: false, grund: 'abgelehnt' }
  if (!antwort.ok) {
    // 401 heißt fast immer: Das Dienstkonto ist in der Search Console nicht
    // als Inhaber eingetragen. Das Token zu vergessen kostet nichts und
    // behebt den anderen Fall — ein Token, das früher ablief als gedacht.
    if (antwort.status === 401) tokenVergessen()
    return { ok: false, grund: 'abgelehnt', status: antwort.status }
  }
  return { ok: true }
}

/**
 * Mehrere Adressen melden — eine nach der anderen.
 *
 * Google erlaubt bis zu hundert Aufrufe in einer gebündelten Anfrage. Hier
 * wird trotzdem einzeln gemeldet, und zwar aus einem Grund: Ein Stapel wäre
 * eine zweite Art, Anfragen zu bauen (`multipart/mixed` von Hand), mit einer
 * eigenen Fehlerbehandlung je Teilantwort — für eine Handvoll Anzeigen je
 * Betrieb. Die Grenze, die hier wirklich zählt, ist das Tageskontingent, und
 * das zählt Aufrufe, nicht Anfragen.
 */
export async function meldenViele(
  adressen: { url: string; art: Meldeart }[], jetzt: Date = new Date(),
): Promise<{ gemeldet: number; uebersprungen: number }> {
  let gemeldet = 0
  let uebersprungen = 0
  for (const a of adressen.slice(0, STAPELGRENZE)) {
    const e = await melden(a.url, a.art, jetzt)
    if (e.ok) gemeldet++
    else uebersprungen++
  }
  uebersprungen += Math.max(0, adressen.length - STAPELGRENZE)
  return { gemeldet, uebersprungen }
}

/**
 * Melden, ohne auf das Ergebnis zu warten.
 *
 * Der Weg, auf dem diese Datei aus einer Schnittstelle heraus benutzt wird:
 * Die Antwort an den Anwender geht sofort raus, die Meldung an Google läuft
 * daneben. Fehler landen im Protokoll und nirgendwo sonst.
 */
export function nebenbeiMelden(adressen: { url: string; art: Meldeart }[]): void {
  if (adressen.length === 0 || !indexierungEingerichtet()) return
  void meldenViele(adressen).then(({ gemeldet, uebersprungen }) => {
    if (uebersprungen > 0) {
      console.warn(
        `§216 Google-Indexierung: ${gemeldet} gemeldet, ${uebersprungen} nicht `
        + `(Kontingent heute: ${kontingentStand()}/${TAGESGRENZE})`,
      )
    }
  }).catch(() => undefined)
}
