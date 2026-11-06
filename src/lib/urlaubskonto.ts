/**
 * §235 Der Resturlaub — eine Rechnung für alle Masken.
 *
 * DIE MELDUNG
 * „Bei Bild 1 und 2 stimmen die Urlaubstage nicht überein. Bei dem einen steht
 * die eine Zahl, bei dem anderen die andere. Das ist sehr schlecht."
 *
 * Nachgemessen bei Juliane Saul am 24.10.2026:
 *
 *     Urlaubsseite  „Resturlaub 2026: 12 von 30 Tagen"
 *     Profilseite   „16 Resturlaub"
 *
 * Beide stimmten für sich. Die Urlaubsseite rechnete
 * `gesamt − genommen − beantragt` (30 − 14 − 4 = 12), das Profil
 * `gesamt − genommen` (30 − 14 = 16). Dieselbe Überschrift, zwei Zahlen, vier
 * Tage Unterschied — und das sind genau die vier Tage, über die noch niemand
 * entschieden hat.
 *
 * WELCHE ZAHL DIE RICHTIGE IST — BEIDE, ABER SIE HEISSEN NICHT GLEICH
 * „Wie viel kann ich noch beantragen" ist 12: Die vier beantragten Tage sind
 * vergeben, solange niemand sie ablehnt. „Wie viel steht mir dieses Jahr noch
 * zu" ist 16. Der Fehler war nicht die Rechnung, sondern dass beide Zahlen
 * „Resturlaub" hießen.
 *
 * Diese Datei rechnet beides aus und benennt es. Welche Zahl eine Maske zeigt,
 * entscheidet sie — aber sie muss dazuschreiben, welche es ist.
 *
 * WARUM DAS NICHT „EINFACH EINE ZAHL" WIRD
 * Weil die Maske zum Beantragen die eine braucht (sonst beantragt jemand Tage,
 * die schon weg sind) und der Jahresüberblick die andere (sonst sieht ein
 * abgelehnter Antrag aus wie verbrauchter Urlaub). Eine Zahl für beides wäre
 * an einer der beiden Stellen falsch — und zwar still.
 */

/** Ein Antrag, so viel wie diese Rechnung davon braucht. */
export interface Urlaubsantrag {
  status: string
  days: number
}

export interface Urlaubskonto {
  /** Der Jahresanspruch. */
  gesamt: number
  /** Tage, die bereits genommen und abgerechnet sind. */
  genommen: number
  /** Tage in Anträgen, über die noch niemand entschieden hat. */
  beantragt: number
  /** Tage in genehmigten Anträgen dieses Jahres. */
  genehmigt: number
  /**
   * Was noch BEANTRAGT werden kann: Anspruch minus genommen minus beantragt.
   *
   * Das ist die Zahl, nach der jemand handelt — und deshalb die, die in der
   * großen Kachel auf der Urlaubsseite steht.
   */
  verfuegbar: number
  /**
   * Was dieses Jahr noch ZUSTEHT: Anspruch minus genommen.
   *
   * Die rechtliche Zahl. Sie ist größer, solange Anträge offen sind, und wird
   * erst beim Genehmigen zu `verfuegbar`.
   */
  offen: number
}

/**
 * Das Urlaubskonto einer Person.
 *
 * `antraege` sind ihre Anträge — gefiltert wird hier, damit keine Maske das
 * vergisst. Abgelehnte zählen nicht: Über sie ist entschieden, und zwar gegen
 * sie.
 */
export function urlaubskonto(
  person: { vacationDaysTotal?: number | null; vacationDaysUsed?: number | null },
  antraege: Urlaubsantrag[],
): Urlaubskonto {
  const gesamt = zahl(person.vacationDaysTotal, 30)
  const genommen = zahl(person.vacationDaysUsed, 0)

  const beantragt = antraege
    .filter(a => a.status === 'pending')
    .reduce((s, a) => s + zahl(a.days, 0), 0)
  const genehmigt = antraege
    .filter(a => a.status === 'approved')
    .reduce((s, a) => s + zahl(a.days, 0), 0)

  return {
    gesamt,
    genommen,
    beantragt,
    genehmigt,
    // Nie unter null: Wer mehr beantragt hat, als ihm zusteht, hat 0 übrig und
    // keine negative Zahl in der Kachel.
    verfuegbar: Math.max(0, gesamt - genommen - beantragt),
    offen: Math.max(0, gesamt - genommen),
  }
}

function zahl(wert: unknown, ersatz: number): number {
  // §235 `null` und `undefined` ausdrücklich zuerst: `Number(null)` ist 0 und
  // nicht NaN. Ohne diese Zeile bekäme ein Mensch ohne gesetzten Anspruch
  // „0 von 0 Tagen" angezeigt statt der 30, die ihm zustehen — und würde
  // glauben, er habe seinen Urlaub verbraucht.
  if (wert === null || wert === undefined || wert === '') return ersatz
  const n = typeof wert === 'number' ? wert : Number(wert)
  return Number.isFinite(n) ? n : ersatz
}

/**
 * §238 Was eine Maske anzeigt, ohne selbst zu rechnen.
 *
 * `/api/employees` liefert das Konto mit (§238). Diese beiden Helfer sind der
 * Grund, warum eine Maske es nicht mehr herleiten muss — und `null` statt
 * einer Null ist dabei die ganze Pointe: Fehlt das Konto, steht ein Strich.
 * Eine 0 sähe aus wie „kein Urlaub mehr übrig" und wäre die eine Antwort, die
 * niemand nachprüft.
 */
export function restUrlaub(person: { urlaub?: Urlaubskonto }): number | null {
  return person.urlaub ? person.urlaub.verfuegbar : null
}

/**
 * Die Summe über mehrere Menschen — oder `null`, wenn bei einem das Konto
 * fehlt.
 *
 * Teilsummen sind hier gefährlicher als gar keine Zahl: „Resturlaub gesamt"
 * über eine Belegschaft, bei der drei Leute fehlen, ist keine Schätzung,
 * sondern eine falsche Zahl mit richtigem Etikett.
 */
export function restUrlaubSumme(liste: { urlaub?: Urlaubskonto }[]): number | null {
  if (liste.length === 0) return 0
  if (!liste.every(p => p.urlaub)) return null
  return liste.reduce((s, p) => s + (p.urlaub as Urlaubskonto).verfuegbar, 0)
}

/**
 * §238 Was dieses Jahr noch ZUSTEHT — die rechtliche Zahl.
 *
 * Für die beiden Stellen, an denen ein Sprachmodell über Anträge urteilt.
 * Dort wäre `verfuegbar` falsch: Der Antrag, um den es gerade geht, ist selbst
 * ein offener und darin schon abgezogen. Das Modell bekäme weniger Tage zu
 * sehen, als die Person hat, und zwar genau um den Antrag, den es beurteilen
 * soll.
 *
 * Rechnerisch ist das `gesamt − genommen`, also das, was dort vorher von Hand
 * stand. Der Unterschied liegt in den Rändern, die `urlaubskonto` mitbringt:
 * ein fehlender Anspruch wird zu 30 statt zu 0, und negativ wird es nie.
 */
export function offenerUrlaub(person: { urlaub?: Urlaubskonto }): number | null {
  return person.urlaub ? person.urlaub.offen : null
}
