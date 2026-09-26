/**
 * §158 Abfindungen.
 *
 * DIE ÄNDERUNG, DIE VIELE PROGRAMME NOCH NICHT NACHVOLLZOGEN HABEN
 * Bis einschließlich 2024 durfte der Arbeitgeber die Fünftelregelung
 * (§34 Abs. 1 EStG) schon beim Lohnsteuerabzug anwenden. Das Wachstumschancen-
 * gesetz hat die dafür nötige Vorschrift (§39b Abs. 3 Satz 9 EStG) mit Wirkung
 * ab dem 1. Januar 2025 GESTRICHEN.
 *
 * Seitdem gilt: Der Arbeitgeber versteuert die Abfindung als sonstigen Bezug,
 * ganz normal und ohne Ermäßigung. Die Fünftelregelung gibt es weiterhin — aber
 * die Person holt sie sich über ihre Einkommensteuererklärung.
 *
 * Wer das nicht mitbekommen hat, behält zu wenig Lohnsteuer ein. Die fehlt
 * nicht dem Finanzamt, sondern der Person: Sie bekommt einen Bescheid mit einer
 * Nachzahlung, mit der niemand gerechnet hat. Deshalb steht der Hinweis auf der
 * Abrechnung — nicht als Fußnote, sondern neben dem Betrag.
 *
 * SOZIALVERSICHERUNG: GAR NICHTS
 * Eine echte Abfindung ist Entschädigung für den Verlust des Arbeitsplatzes,
 * kein Arbeitsentgelt (§14 SGB IV). Sie ist beitragsfrei — und zwar vollständig,
 * nicht nur oberhalb einer Grenze. Sie verbraucht deshalb auch nichts von der
 * anteiligen Jahres-Beitragsbemessungsgrenze, die für andere Einmalzahlungen
 * gilt.
 *
 * Das gilt nur für die ECHTE Abfindung. Wird stattdessen rückständiger Lohn,
 * nicht genommener Urlaub oder eine Karenzentschädigung ausgezahlt, ist das
 * Arbeitsentgelt und voll beitragspflichtig — egal, was in der Vereinbarung
 * darübersteht.
 */

/**
 * Darf der Arbeitgeber die Fünftelregelung beim Lohnsteuerabzug anwenden?
 *
 * Bis 2024 ja, ab 2025 nein (§39b Abs. 3 Satz 9 EStG, aufgehoben durch das
 * Wachstumschancengesetz).
 */
export function fuenftelregelungImAbzug(jahr: number): boolean {
  return jahr <= 2024
}

export interface Zusammenballung {
  /** Sind die Voraussetzungen des §34 EStG voraussichtlich erfüllt? */
  erfuellt: boolean
  /** Die entgangenen Einnahmen, mit denen verglichen wurde */
  entgangen: number
  begruendung: string
}

/**
 * Die Zusammenballung (§34 Abs. 1, Abs. 2 Nr. 2 EStG).
 *
 * Ermäßigt besteuert wird eine Entschädigung nur, wenn sie zusammengeballt in
 * einem Jahr zufließt — also mehr beträgt als das, was bis zum Jahresende ohne
 * die Beendigung noch verdient worden wäre. Sonst gibt es keinen
 * Progressionsnachteil, den die Fünftelregelung ausgleichen müsste.
 *
 * Das Programm ENTSCHEIDET das nicht. Es rechnet die Faustregel und sagt, wie
 * es dazu kommt — die Prüfung macht das Finanzamt, und Ausnahmen gibt es
 * (etwa, wenn das Jahreseinkommen insgesamt steigt).
 */
export function zusammenballung(
  abfindung: number,
  /** Monatliches Bruttoentgelt vor der Beendigung */
  monatsentgelt: number,
  /** Monat der Beendigung, 1–12 */
  austrittsMonat: number,
): Zusammenballung {
  const restmonate = Math.max(0, 12 - Math.max(1, Math.min(12, austrittsMonat)))
  const entgangen = runde(monatsentgelt * restmonate)
  const erfuellt = abfindung > entgangen

  return {
    erfuellt,
    entgangen,
    begruendung: erfuellt
      ? `Die Abfindung von ${euro(abfindung)} übersteigt die bis Jahresende `
        + `entgangenen Einnahmen von ${euro(entgangen)} `
        + `(${restmonate} Monate à ${euro(monatsentgelt)}). Die Zusammenballung `
        + 'nach §34 Abs. 1 EStG ist damit voraussichtlich gegeben.'
      : `Die Abfindung von ${euro(abfindung)} bleibt unter den bis Jahresende `
        + `entgangenen Einnahmen von ${euro(entgangen)} `
        + `(${restmonate} Monate à ${euro(monatsentgelt)}). Ohne Zusammenballung `
        + 'gibt es keine ermäßigte Besteuerung nach §34 EStG. Ob eine Ausnahme '
        + 'greift, entscheidet das Finanzamt.',
  }
}

/**
 * Was zu einer Abfindung auf die Abrechnung gehört.
 */
export function hinweise(
  jahr: number,
  betrag: number,
  beitragsfrei: boolean,
): string[] {
  const h: string[] = []

  if (fuenftelregelungImAbzug(jahr)) {
    h.push(
      'Die Fünftelregelung (§34 Abs. 1 EStG) wird für dieses Jahr noch im '
      + 'Lohnsteuerabzug angewandt (§39b Abs. 3 Satz 9 EStG in der bis 2024 '
      + 'geltenden Fassung).',
    )
  } else {
    h.push(
      `Die Abfindung von ${euro(betrag)} wird als sonstiger Bezug versteuert. `
      + 'Die Fünftelregelung wendet der Arbeitgeber seit 2025 NICHT mehr an — '
      + '§39b Abs. 3 Satz 9 EStG ist entfallen. Die Ermäßigung nach §34 EStG '
      + 'gibt es weiterhin: Sie ist in der Einkommensteuererklärung geltend zu '
      + 'machen. Bis dahin ist die einbehaltene Lohnsteuer bewusst höher.',
    )
  }

  if (beitragsfrei) {
    h.push(
      'Beitragsfrei in der Sozialversicherung: Eine echte Abfindung entschädigt '
      + 'den Verlust des Arbeitsplatzes und ist kein Arbeitsentgelt '
      + '(§14 SGB IV). Ausgezahlter Restlohn, nicht genommener Urlaub oder eine '
      + 'Karenzentschädigung wären dagegen voll beitragspflichtig — sie gehören '
      + 'dann nicht in diese Zeile.',
    )
  } else {
    h.push(
      'Diese Zahlung ist als beitragspflichtig gekennzeichnet. Eine echte '
      + 'Abfindung wäre beitragsfrei (§14 SGB IV) — falls es sich um '
      + 'ausgezahlten Restlohn oder Urlaubsabgeltung handelt, ist die '
      + 'Kennzeichnung richtig, sonst gehört sie geändert.',
    )
  }

  return h
}

function runde(betrag: number): number {
  return Math.round((betrag + Number.EPSILON) * 100) / 100
}

function euro(betrag: number): string {
  return `${betrag.toLocaleString('de-DE', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })} €`
}
