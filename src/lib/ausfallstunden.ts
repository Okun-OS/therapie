import { pruefeTagesmuster, moeglicheArbeitstage } from './tagesmuster'

/**
 * §227 Was ein Ausfalltag gutschreibt.
 *
 * DIE MELDUNG
 * „Dann habe ich mal Juliane krank gemeldet. Da steht auch nicht krank, und
 * dadurch hat sie halt nur 16 von 35 Stunden. Bei ihr steht dann drin frei und
 * nicht krank. Wenn jemand krank ist, muss er halt die Stunden bekommen, die er
 * sonst auch bekommen hätte — bei einer 40-Stunden-Kraft für jeden kranken Tag
 * trotzdem acht Stunden."
 *
 * WAS VORHER PASSIERTE
 * Eine Krankmeldung nahm der Person ihre Dienste weg und schrieb nichts
 * zurück. Im Plan stand eine leere Zelle, in der Stundenspalte eine Zahl, die
 * nach Minderleistung aussah. Beides ist falsch: Entgeltfortzahlung heißt, dass
 * die Stunden bezahlt werden, die ohne die Krankheit angefallen wären
 * (§3 EntgFG, Lohnausfallprinzip). Nicht null.
 *
 * WARUM DER DURCHSCHNITT ÜBER DIE EIGENEN TAGE UND NICHT „DER TAG, DER WAR"
 * Ein Muster aus dreimal acht und einmal sechs sagt nicht, WELCHER Wochentag
 * der sechsstündige ist. Das hat niemand aufgeschrieben, und es zu raten heißt,
 * mal acht gutzuschreiben, wo sechs zustanden. Der Durchschnitt über die
 * eigenen Arbeitstage ist die einzige Zahl, die für die Woche als Ganzes
 * stimmt — und im häufigen Fall gleich langer Tage IST er die Tageslänge.
 *
 * WO ES BESSER GEHT, GEHT ES BESSER
 * Stand für den Tag schon ein Dienst im Plan, gewinnt dessen Länge. Dann ist
 * der Ausfall genau bekannt und muss nicht geschätzt werden — das ist der
 * Normalfall bei einer Krankmeldung, die nach dem Plan kommt.
 *
 * WARUM EIN TAG OHNE DIENSTPFLICHT NICHTS GUTSCHREIBT
 * Wer dienstags immer frei hat, verliert an einem kranken Dienstag nichts. Eine
 * Krankmeldung von Montag bis Sonntag umfasst sieben Kalendertage und höchstens
 * fünf Arbeitstage. Würde jeder Kalendertag zählen, bekäme eine Woche Krankheit
 * mehr Stunden gutgeschrieben als eine Woche Arbeit.
 */

const WOCHENTAG_ZU_NUMMER: Record<string, number> = {
  Mo: 1, Di: 2, Mi: 3, Do: 4, Fr: 5, Sa: 6, So: 0,
}

/** Die Angaben über eine Person, die für die Rechnung gebraucht werden. */
export interface AusfallPerson {
  /** Vertragsstunden pro Woche. */
  weeklyHours: number
  /** §171 Planstunden, falls sie von den Vertragsstunden abweichen. */
  planungsStundenSoll?: number | null
  /** §181 Das Tagesmuster, ungeprüft wie es aus der Datenbank kommt. */
  tagesmuster?: unknown
  workDaysPerWeek?: number | null
  fixedOffDays?: string[] | null
}

/** Welche Arten von Fehlzeit überhaupt Stunden gutschreiben. */
export const BEZAHLTE_AUSFALLARTEN = [
  'krankheit', 'krank', 'sick', 'urlaub', 'fortbildung', 'entschuldigt',
]

/**
 * Wie viele Stunden ein einzelner Ausfalltag dieser Person gutschreibt.
 *
 * Das Tagesmuster schlägt die Stundenzahl: Wer eines hinterlegt hat, hat darin
 * seine Arbeitstage selbst benannt, und die können von `workDaysPerWeek`
 * abweichen. Ohne Muster bleibt die Teilung aus Stunden und Tagen — dieselbe
 * Rechnung, mit der auch der Rechendienst gleich lange Tage baut (§226).
 */
export function stundenProAusfalltag(
  person: AusfallPerson,
  /** Zahl der Wochentage, an denen der Betrieb geöffnet ist. Fünf, wo nichts gesagt wird. */
  wocheTage?: number | null,
): number {
  const muster = pruefeTagesmuster(person.tagesmuster).muster
  if (muster && muster.length > 0) {
    const tage = muster.reduce((s, t) => s + t.tage, 0)
    const stunden = muster.reduce((s, t) => s + t.stunden * t.tage, 0)
    if (tage > 0) return runde(stunden / tage)
  }

  const soll = person.planungsStundenSoll ?? person.weeklyHours
  const tage = moeglicheArbeitstage(
    person.workDaysPerWeek, person.fixedOffDays, wocheTage && wocheTage > 0 ? wocheTage : 5,
  )
  if (!soll || soll <= 0 || tage <= 0) return 0
  return runde(soll / tage)
}

/**
 * Hätte diese Person an diesem Tag überhaupt Dienst gehabt?
 *
 * `betriebsTage` sind die Wochentage, an denen der Standort geöffnet ist
 * (`['Mo','Di',…]`). Ohne Angabe wird Montag bis Freitag angenommen — die
 * Rechnung darf nicht daran scheitern, dass der Aufrufer den Betriebstyp nicht
 * zur Hand hat, und für den überwiegenden Teil der Betriebe stimmt es.
 */
export function hatDienstpflicht(
  person: AusfallPerson,
  datum: string,
  betriebsTage?: string[] | null,
): boolean {
  const nummer = wochentagNummer(datum)
  if (nummer === null) return false

  const offen = (betriebsTage?.length ? betriebsTage : ['Mo', 'Di', 'Mi', 'Do', 'Fr'])
    .map(t => WOCHENTAG_ZU_NUMMER[t])
    .filter((n): n is number => n !== undefined)
  if (!offen.includes(nummer)) return false

  const frei = (person.fixedOffDays ?? [])
    .map(t => WOCHENTAG_ZU_NUMMER[t] ?? (Number.isFinite(Number(t)) ? Number(t) : undefined))
    .filter((n): n is number => n !== undefined)
  return !frei.includes(nummer)
}

/**
 * Die Stunden, die ein bestimmter Ausfalltag gutschreibt — oder 0.
 *
 * `geplanteStunden` ist die Länge des Dienstes, der für diesen Tag im Plan
 * stand, falls es einen gab. Sie gewinnt, weil sie der tatsächliche Ausfall
 * ist und keine Schätzung.
 */
export function ausfallStundenAmTag(
  person: AusfallPerson,
  datum: string,
  opt?: {
    geplanteStunden?: number | null
    betriebsTage?: string[] | null
    /** Feiertag: bezahlt, aber nicht als Krankheitsstunde — sonst doppelt. */
    feiertag?: boolean
  },
): number {
  if (opt?.feiertag) return 0
  if (!hatDienstpflicht(person, datum, opt?.betriebsTage)) return 0
  if (opt?.geplanteStunden && opt.geplanteStunden > 0) return runde(opt.geplanteStunden)
  return stundenProAusfalltag(person, opt?.betriebsTage?.length)
}

/**
 * Die Arbeitstage einer Fehlzeit — nicht ihre Kalendertage.
 *
 * Gezählt wird gegen die Arbeitstage DIESER Person. Die Oberfläche fragt beim
 * Krankmelden „seit wann, voraussichtlich bis wann" und schickt die
 * Kalendertage mit; wer von Montag bis Sonntag krank ist, meldet sieben. Wird
 * damit das Monatssoll gekürzt, verliert eine Woche Krankheit zwei Arbeitstage,
 * die es nie gab.
 *
 * Gezählt wird Tag für Tag — Betriebstage minus feste freie Tage. Wo jemand
 * weniger Arbeitstage im Vertrag hat als danach übrig bleiben (drei Tage die
 * Woche, ohne dass jemand aufgeschrieben hat welche), zählt diese Rechnung zu
 * viel. Dagegen hilft nur, die freien Tage zu benennen; ein Deckel auf die
 * Vertragstage wäre für jede Fehlzeit über mehr als eine Woche falsch, weil
 * sich Kalenderwochen und Zeiträume nicht deckungsgleich teilen.
 */
export function arbeitstageDerFehlzeit(
  person: AusfallPerson,
  von: string,
  bis: string,
  betriebsTage?: string[] | null,
): number {
  let tage = 0
  for (const tag of tageVonBis(von, bis)) {
    if (hatDienstpflicht(person, tag, betriebsTage)) tage++
  }
  return tage
}

/** Die Stunden einer ganzen Fehlzeit — Arbeitstage × Tagesstunden. */
export function ausfallStundenDerFehlzeit(
  person: AusfallPerson,
  von: string,
  bis: string,
  betriebsTage?: string[] | null,
): number {
  return runde(
    arbeitstageDerFehlzeit(person, von, bis, betriebsTage)
    * stundenProAusfalltag(person, betriebsTage?.length),
  )
}

/** Alle Kalendertage von … bis einschließlich, als `YYYY-MM-DD`. */
export function tageVonBis(von: string, bis: string): string[] {
  const a = Date.parse(`${von}T00:00:00Z`)
  const b = Date.parse(`${bis}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return []
  // Eine Fehlzeit über ein Jahr ist ein Tippfehler, keine Fehlzeit. Ohne diese
  // Grenze dreht ein vertipptes Jahr („2206") die Schleife Zehntausende Male.
  if (b - a > 370 * 86400000) return []
  const tage: string[] = []
  for (let t = a; t <= b; t += 86400000) {
    tage.push(new Date(t).toISOString().slice(0, 10))
  }
  return tage
}

function wochentagNummer(datum: string): number | null {
  const t = Date.parse(`${datum}T00:00:00Z`)
  if (Number.isNaN(t)) return null
  return new Date(t).getUTCDay()
}

/** Auf zwei Stellen — 35/3 soll nicht als 11,666666666666666 in der Spalte stehen. */
function runde(n: number): number {
  return Math.round(n * 100) / 100
}
