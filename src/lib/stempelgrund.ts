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

/**
 * §219 Wie weit der Beginn vom Plan abweichen darf, bevor gefragt wird.
 *
 * Fünf Minuten, und das ist bewusst viel strenger als die Viertelstunde für
 * die Dauer. Der Grund ist ein anderer: Bei der Dauer geht es darum, ob die
 * Stunden zusammenkommen — bei der Uhrzeit darum, ob überhaupt der geplante
 * Dienst gearbeitet wurde. Wer um 23 Uhr einstempelt, während für ihn
 * 07:15 eingeplant ist, arbeitet nicht seinen Dienst, sondern einen anderen.
 * Das gehört im selben Moment gesagt und nicht am Monatsende gerätselt.
 *
 * Diese eine Zahl ist die Stellschraube: Wird die Rückfrage im Alltag als
 * lästig empfunden, gehört sie hier höher gesetzt — und nirgendwo sonst.
 */
export const TOLERANZ_KOMMEN_MINUTEN = 5

export type Abweichungsart =
  /** Für diesen Tag war gar kein Dienst geplant. */
  | 'ohne-dienst'
  /** §219 Deutlich früher angefangen als geplant. */
  | 'kommen-frueh'
  /** §219 Deutlich später angefangen als geplant. */
  | 'kommen-spaet'
  /** Die gearbeitete Zeit bleibt deutlich hinter dem Plan zurück. */
  | 'frueher'
  /** Deutlich länger gearbeitet als geplant. */
  | 'laenger'

/**
 * §219 Der Text, den die Standortleitung in der Liste liest.
 *
 * Bei `frueher` stand hier „früher gegangen als geplant". Das war falsch und
 * verwirrend: Verglichen wird die DAUER. Wer um 14:00 anfängt und um 22:30
 * geht, ist nicht „früher gegangen" — ihm fehlen Stunden. Genau so stand es
 * dann auf dem Bildschirm, und niemand konnte es sich erklären.
 *
 * Die Kennung `frueher` bleibt, damit vorhandene Einträge weiter lesbar sind;
 * geändert hat sich, was dort steht.
 */
export const ABWEICHUNG_TEXT: Record<Abweichungsart, string> = {
  'ohne-dienst': 'ohne geplanten Dienst gearbeitet',
  'kommen-frueh': 'früher angefangen als geplant',
  'kommen-spaet': 'später angefangen als geplant',
  frueher: 'weniger Stunden als geplant',
  laenger: 'mehr Stunden als geplant',
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
 * §219 Muss schon beim EINSTEMPELN nach einem Grund gefragt werden?
 *
 * WARUM DAS GEFEHLT HAT
 * Bis hierher wurde beim Kommen nur eine einzige Frage gestellt: ob für den
 * Tag überhaupt ein Dienst geplant ist. War einer geplant, ließ sich zu jeder
 * beliebigen Uhrzeit einstempeln — um 23 Uhr genauso wie um 07:15. Die
 * Abweichung fiel dann erst beim Gehen auf, und zwar als Dauer. Wer um 23 Uhr
 * anfängt und acht Stunden bleibt, hat eine tadellose Dauer und trotzdem
 * nicht den Dienst gearbeitet, der im Plan stand.
 *
 * WARUM NICHT GESPERRT, SONDERN GEFRAGT
 * Dieselbe Begründung wie bei `ohne-dienst`: Es gibt den Einspringer, den
 * Tausch, den Notfall. Wer dann nicht stempeln kann, arbeitet unbezahlt. Was
 * fehlt, ist nicht die Erlaubnis, sondern die Erklärung.
 */
export function abweichungBeimKommen(
  plan: Dienstzeit | null | undefined,
  istVon: string,
  toleranz: number = TOLERANZ_KOMMEN_MINUTEN,
): Abweichung | null {
  if (!plan) return { art: 'ohne-dienst', minuten: 0 }

  const soll = minuten(plan.von)
  const ist = minuten(istVon)
  if (soll === null || ist === null) return null

  /*
   * Über Mitternacht hinweg — aber nur, wenn es wirklich Mitternacht ist.
   *
   * Ein Dienst um 00:15, gestempelt um 23:50, ist 25 Minuten zu früh und
   * nicht 23 Stunden und 35 Minuten zu spät. Deshalb wird gefaltet.
   *
   * Gefaltet wird aber NUR, wenn dabei eine kleine Zahl herauskommt. Sonst
   * würde aus „geplant 07:15, gestempelt um 23 Uhr" plötzlich „8 Stunden zu
   * früh" — gemeint ist der Dienst von heute Morgen, und dafür ist 23 Uhr
   * spät und nicht früh. Genau dieser Fall kam aus dem Betrieb.
   */
  const NACHTFENSTER = 2 * 60
  let unterschied = ist - soll
  if (unterschied > 12 * 60 && Math.abs(unterschied - 24 * 60) <= NACHTFENSTER) {
    unterschied -= 24 * 60
  } else if (unterschied < -12 * 60 && Math.abs(unterschied + 24 * 60) <= NACHTFENSTER) {
    unterschied += 24 * 60
  }

  if (Math.abs(unterschied) <= toleranz) return null

  return {
    art: unterschied > 0 ? 'kommen-spaet' : 'kommen-frueh',
    minuten: Math.abs(unterschied),
    plan,
  }
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
