/**
 * §181 Das Tagesmuster — wie sich die Wochenstunden auf die Tage verteilen.
 *
 * WAS DAS IST
 * „Fünfmal acht Stunden." „Dreimal acht und einmal sechs." Also nicht nur WIE
 * VIEL jemand in der Woche arbeitet, sondern in welchen Portionen. Ohne das
 * verteilt der Rechendienst die Wochenstunden beliebig: zehn Stunden am
 * Montag, sechs am Dienstag, neun am Mittwoch. Rechnerisch stimmt die Woche,
 * im Betrieb ist der Plan unbrauchbar.
 *
 * WARUM DAS HIERHER GEHÖRT UND NICHT INS REGELPAKET
 * Bis zum 02.10.2026 stand das Muster als Tabelle mit sechzehn Vornamen im
 * Regelpaket der Kita. Das war falsch einsortiert, und zwar aus zwei Gründen.
 *
 *   Erstens ist es keine Regel. „Stephanie arbeitet fünfmal sieben Stunden"
 *   sagt nichts über den Betrieb aus — es ist eine Angabe über einen
 *   Arbeitsvertrag, genau wie die Wochenstundenzahl daneben. Eine Regel ist
 *   „auf jeder Etage öffnet genau eine Kraft": die gilt weiter, wenn die
 *   halbe Belegschaft wechselt.
 *
 *   Zweitens, und das ist der Grund, warum es nicht beim Aufräumen blieb:
 *   Stand das Muster im Paket und die Stundenzahl in den Stammdaten, konnten
 *   beide einander widersprechen. Und das Ergebnis war nicht ein schlechterer
 *   Plan, sondern GAR KEINER. Nachgemessen am 02.10.2026 im Demo-Betrieb:
 *
 *       35 Std. in der Maske (= 5 × 7, wie im Paket)  → Plan steht
 *       28 Std. in der Maske                          → CP-SAT INFEASIBLE
 *       40 Std. in der Maske                          → CP-SAT INFEASIBLE
 *       35 Std. wieder                                → Plan steht
 *
 *   Die Fehlermeldung nannte dabei Urlaube, Ruhezeiten und das Stundenlimit —
 *   also drei Ursachen, von denen keine zutraf. Eine Leitung, die die Stunden
 *   einer Kollegin ändert, hätte danach einen Betrieb ohne Dienstplan und
 *   keine Ahnung, warum.
 *
 * DIE EINE ZUSAGE, DIE DIESE DATEI GIBT
 * Muster und Stundenzahl können nicht mehr auseinanderlaufen, weil sie
 * zusammen geprüft werden, bevor etwas gespeichert wird. Ein Muster, dessen
 * Summe nicht zur Planstundenzahl passt, wird abgelehnt — in der Maske, mit
 * einem Satz, der die Zahlen nennt. Nicht später im Rechendienst.
 */

/** Ein Teil des Musters: so viele Tage zu je so vielen Arbeitsstunden. */
export interface Musterteil {
  /** NETTO-Arbeitsstunden, also ohne Pause. Ein Achtstundendienst dauert 8:30 im Haus. */
  stunden: number
  /** Wie viele Tage der Woche mit dieser Länge. */
  tage: number
}

export type Tagesmuster = Musterteil[]

/** Mehr als das ist kein Tagesmuster mehr, sondern ein Dienstplan. */
const HOECHSTENS_TEILE = 4
/** Unter- und Obergrenze einer Dienstlänge in Netto-Arbeitsstunden. */
const KUERZESTER_DIENST = 1
const LAENGSTER_DIENST = 12
/** Viertelstunden. Ein Dienst über 7,37 Stunden ist ein Tippfehler. */
const SCHRITT = 0.25
/** Rundungsreserve beim Vergleich zweier Stundensummen. */
const UNSCHAERFE = 0.001

export interface MusterPruefung {
  /** Das gelesene Muster — nur gesetzt, wenn es gültig ist. */
  muster: Tagesmuster | null
  /** Was dagegen spricht, in einem Satz für die Maske. Leer heißt: in Ordnung. */
  fehler: string | null
  /** Die Summe der Arbeitsstunden über die Woche. */
  wochenstunden: number
  /** Die Summe der Arbeitstage. */
  arbeitstage: number
}

function zahl(wert: unknown): number | null {
  const n = typeof wert === 'number' ? wert : Number(wert)
  return Number.isFinite(n) ? n : null
}

/**
 * Ein Tagesmuster lesen und gegen die Stammdaten prüfen.
 *
 * `sollStunden` ist die Zahl, auf die sich das Muster summieren MUSS — die
 * Planstunden, wenn es sie gibt, sonst die Vertragsstunden. Wird sie nicht
 * übergeben, wird nur die Form geprüft; das ist der Fall beim Einlesen
 * bestehender Daten, wo die Stundenzahl erst daneben steht.
 *
 * `moeglicheArbeitstage` ist die Zahl der Tage, auf die sich das Muster
 * überhaupt verteilen kann — fünf bei einer Woche von Montag bis Freitag,
 * abzüglich fester freier Tage.
 */
export function pruefeTagesmuster(
  roh: unknown,
  sollStunden?: number | null,
  moeglicheArbeitstage?: number | null,
): MusterPruefung {
  const leer: MusterPruefung = { muster: null, fehler: null, wochenstunden: 0, arbeitstage: 0 }

  // Kein Muster ist ein gültiger Zustand: Dann verteilt der Rechendienst die
  // Stunden wie bisher. Nur ein KAPUTTES Muster ist ein Fehler.
  if (roh === null || roh === undefined || (Array.isArray(roh) && roh.length === 0)) {
    return leer
  }
  if (!Array.isArray(roh)) {
    return { ...leer, fehler: 'Das Tagesmuster muss eine Liste von Einträgen sein.' }
  }
  if (roh.length > HOECHSTENS_TEILE) {
    return {
      ...leer,
      fehler: `Ein Tagesmuster hat höchstens ${HOECHSTENS_TEILE} verschiedene `
        + `Dienstlängen — hier sind es ${roh.length}.`,
    }
  }

  const muster: Tagesmuster = []
  const gesehen = new Set<number>()
  for (const teil of roh) {
    if (!teil || typeof teil !== 'object') {
      return { ...leer, fehler: 'Jeder Eintrag braucht „stunden" und „tage".' }
    }
    const stunden = zahl((teil as Record<string, unknown>).stunden)
    const tage = zahl((teil as Record<string, unknown>).tage)
    if (stunden === null || tage === null) {
      return { ...leer, fehler: 'Jeder Eintrag braucht „stunden" und „tage" als Zahl.' }
    }
    if (stunden < KUERZESTER_DIENST || stunden > LAENGSTER_DIENST) {
      return {
        ...leer,
        fehler: `${stunden} Arbeitsstunden an einem Tag sind außerhalb des `
          + `Erlaubten (${KUERZESTER_DIENST} bis ${LAENGSTER_DIENST}).`,
      }
    }
    if (Math.abs(stunden / SCHRITT - Math.round(stunden / SCHRITT)) > UNSCHAERFE) {
      return { ...leer, fehler: `${stunden} Stunden geht nicht — bitte in Viertelstunden.` }
    }
    if (!Number.isInteger(tage) || tage < 1 || tage > 7) {
      return { ...leer, fehler: `${tage} Tage geht nicht — es müssen 1 bis 7 ganze Tage sein.` }
    }
    // Zwei Einträge mit derselben Dienstlänge sind kein Fehler des Nutzers,
    // sondern einer der Maske — zusammengefasst wäre es dasselbe. Trotzdem
    // abgelehnt, weil sonst zwei Zeilen dasselbe meinen und niemand weiß,
    // welche gilt.
    if (gesehen.has(stunden)) {
      return { ...leer, fehler: `${stunden} Stunden stehen zweimal — bitte zu einer Zeile zusammenfassen.` }
    }
    gesehen.add(stunden)
    muster.push({ stunden, tage })
  }

  const arbeitstage = muster.reduce((s, t) => s + t.tage, 0)
  const wochenstunden = muster.reduce((s, t) => s + t.stunden * t.tage, 0)

  if (moeglicheArbeitstage !== undefined && moeglicheArbeitstage !== null
      && arbeitstage > moeglicheArbeitstage) {
    return {
      ...leer,
      wochenstunden,
      arbeitstage,
      fehler: `Das Muster belegt ${arbeitstage} Arbeitstage, zur Verfügung stehen `
        + `${moeglicheArbeitstage}.`,
    }
  }

  if (sollStunden !== undefined && sollStunden !== null
      && Math.abs(wochenstunden - sollStunden) > UNSCHAERFE) {
    return {
      ...leer,
      wochenstunden,
      arbeitstage,
      fehler: `Das Muster ergibt ${runde(wochenstunden)} Wochenstunden, geplant werden `
        + `${runde(sollStunden)}. Beides muss übereinstimmen — sonst kann für diesen `
        + 'Betrieb kein Dienstplan gerechnet werden.',
    }
  }

  return { muster, fehler: null, wochenstunden, arbeitstage }
}

/** „35" statt „35.00", „7,5" statt „7.5" — für einen Satz in der Maske. */
function runde(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

/**
 * Das Muster so aufschreiben, wie ein Mensch es sagt.
 *
 *     [{stunden: 8, tage: 3}, {stunden: 6, tage: 1}] → „3 × 8 Std., 1 × 6 Std."
 */
export function musterText(muster: Tagesmuster | null): string {
  if (!muster || muster.length === 0) return 'kein festes Muster'
  return [...muster]
    .sort((a, b) => b.stunden - a.stunden)
    .map(t => `${t.tage} × ${runde(t.stunden)} Std.`)
    .join(', ')
}

/**
 * Wie viele Tage der Woche für Dienste übrig bleiben.
 *
 * Feste freie Wochentage zählen nicht mit: Wer dienstags immer frei hat, kann
 * sein Muster nur auf die übrigen Tage verteilen. Ohne diese Rechnung ließe
 * sich ein Muster speichern, das rechnerisch aufgeht und trotzdem nie
 * planbar ist.
 */
export function moeglicheArbeitstage(
  arbeitstageProWoche: number | null | undefined,
  festeFreieTage: string[] | null | undefined,
): number {
  const basis = arbeitstageProWoche && arbeitstageProWoche > 0 ? arbeitstageProWoche : 5
  const frei = (festeFreieTage ?? []).length
  return Math.max(0, basis - frei)
}
