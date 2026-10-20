/**
 * §203 Wann beim Stempeln nach einem Grund gefragt wird.
 *
 * WARUM ES DAS BRAUCHT
 * Bisher ließ sich einstempeln, ohne dass für den Tag ein Dienst geplant war,
 * und ausstempeln, ohne dass irgendjemand merkte, dass zwei Stunden mehr oder
 * weniger zusammengekommen sind. Beides ist am Monatsende ein Rätsel: Die
 * Standortleitung sieht eine Zahl, die nicht zum Plan passt, und muss
 * nachfragen — bei jemandem, der sich an den Tag nicht mehr erinnert.
 *
 * Ein Grund, der im Moment des Stempelns geschrieben wird, kostet zwanzig
 * Sekunden. Derselbe Grund drei Wochen später zu rekonstruieren kostet zwei
 * Telefonate und ist trotzdem geraten.
 *
 * Das ist keine Kontrolle, sondern das Gegenteil: Ohne Begründung wird aus
 * Mehrarbeit keine bezahlte Überstunde, sondern eine Unstimmigkeit.
 *
 * WARUM EINE REINE FUNKTION
 * Diese Entscheidung bestimmt, wann jemand ein Eingabefeld vorgesetzt
 * bekommt, und sie entscheidet mit darüber, wie Mehrarbeit später verbucht
 * wird. So etwas muss einzeln nachrechenbar sein, ohne Datenbank und ohne
 * Browser.
 */

/**
 * Ab wann eine Abweichung eine ist.
 *
 * Fünfzehn Minuten: Wer drei Minuten früher geht, soll nicht tippen müssen —
 * eine Rückfrage, die ständig ohne Anlass kommt, wird weggeklickt, und dann
 * ist sie auch in den Fällen wertlos, auf die es ankommt. Eine Viertelstunde
 * ist auch die Schwelle, ab der die meisten Dienstvereinbarungen von
 * Mehrarbeit sprechen.
 */
export const TOLERANZ_MINUTEN = 15

export type Abweichungsart =
  /** Für diesen Tag war gar kein Dienst geplant. */
  | 'ohne-dienst'
  /** Deutlich früher gegangen als geplant. */
  | 'frueher'
  /** Deutlich länger geblieben als geplant. */
  | 'laenger'

export const ABWEICHUNG_TEXT: Record<Abweichungsart, string> = {
  'ohne-dienst': 'ohne geplanten Dienst gearbeitet',
  frueher: 'früher gegangen als geplant',
  laenger: 'länger geblieben als geplant',
}

export interface Dienstzeit {
  /** „HH:MM" */
  von: string
  /** „HH:MM" */
  bis: string
}

export interface Abweichung {
  art: Abweichungsart
  /** Wie viele Minuten — bei `ohne-dienst` die gesamte gearbeitete Zeit. */
  minuten: number
  plan?: Dienstzeit
}

/** „HH:MM" → Minuten seit Mitternacht. `null`, wenn unlesbar. */
export function minuten(uhrzeit: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(uhrzeit ?? '').trim())
  if (!m) return null
  const std = Number(m[1])
  const min = Number(m[2])
  if (std > 23 || min > 59) return null
  return std * 60 + min
}

/**
 * Dauer zwischen zwei Uhrzeiten, über Mitternacht hinweg.
 *
 * Ein Nachtdienst von 22:00 bis 06:00 ist acht Stunden, nicht minus sechzehn.
 */
export function dauer(von: string, bis: string): number | null {
  const a = minuten(von)
  const b = minuten(bis)
  if (a === null || b === null) return null
  return b >= a ? b - a : b + 24 * 60 - a
}

/**
 * Muss nach dem Ausstempeln nach einem Grund gefragt werden?
 *
 * `null` heißt: alles wie geplant, keine Rückfrage.
 *
 * Verglichen wird die DAUER, nicht die Uhrzeit des Gehens. Wer eine halbe
 * Stunde später kommt und eine halbe Stunde später geht, hat seinen Dienst
 * voll gearbeitet — ihn dafür um eine Begründung zu bitten, wäre Schikane.
 * Was zählt, ist, ob am Ende die Stunden zusammenkommen.
 */
export function abweichungBeimGehen(
  plan: Dienstzeit | null | undefined,
  ist: Dienstzeit,
  toleranz: number = TOLERANZ_MINUTEN,
): Abweichung | null {
  const gearbeitet = dauer(ist.von, ist.bis)
  if (gearbeitet === null) return null

  if (!plan) {
    return { art: 'ohne-dienst', minuten: gearbeitet }
  }

  const geplant = dauer(plan.von, plan.bis)
  if (geplant === null) return { art: 'ohne-dienst', minuten: gearbeitet }

  const unterschied = gearbeitet - geplant
  if (Math.abs(unterschied) < toleranz) return null

  return {
    art: unterschied > 0 ? 'laenger' : 'frueher',
    minuten: Math.abs(unterschied),
    plan,
  }
}

/** Minuten als „2 h 15 min" — für die Rückfrage an den Menschen. */
export function alsDauer(min: number): string {
  const std = Math.floor(min / 60)
  const rest = min % 60
  if (std === 0) return `${rest} min`
  if (rest === 0) return `${std} h`
  return `${std} h ${rest} min`
}

/** Ein Grund, der nur aus Leerzeichen besteht, ist keiner. */
export function grundTaugt(grund: string | null | undefined): boolean {
  return String(grund ?? '').trim().length >= 3
}
