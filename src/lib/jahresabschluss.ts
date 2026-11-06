/**
 * §125 Jahresabschluss: die Werte, aus denen die Lohnsteuerbescheinigung wird.
 *
 * Eine bewusste Grenze, die hier gezogen wird:
 *
 * Rechtlich zählt die ELEKTRONISCHE Lohnsteuerbescheinigung. Der Arbeitgeber
 * übermittelt sie an die Finanzverwaltung und händigt dem Arbeitnehmer einen
 * AUSDRUCK davon aus (§41b EStG). Der Ausdruck trägt die Kennung der
 * Übermittlung — ohne sie ist er kein Ausdruck, sondern ein Zettel.
 *
 * Solange wir nicht selbst übermitteln (dafür braucht es ERiC, Fahrplan Teil 4),
 * können wir keinen gültigen Ausdruck erzeugen. Wer es trotzdem täte, gäbe dem
 * Kunden ein Papier in die Hand, das amtlich aussieht und keines ist.
 *
 * Deshalb entstehen hier zwei Dinge:
 *
 *   1. Die vollständigen Jahreswerte für den Steuerberater — er übermittelt
 *      und erzeugt daraus die Bescheinigung.
 *   2. Eine Jahresübersicht für den Mitarbeiter, die genau so heißt und nicht
 *      vorgibt, etwas anderes zu sein.
 *
 * Kommt die Übermittlung dazu, wird aus denselben Werten der echte Ausdruck.
 */

/** Ein Abrechnungsmonat, wie er für den Jahresabschluss gebraucht wird. */
export interface MonatsWerte {
  month: number
  brutto: number
  steuerBrutto: number
  svBrutto: number
  steuerfreieZuschlaege: number
  sonstigeBezuege: number
  lohnsteuer: number
  kirchensteuer: number
  soli: number
  rvAN: number; kvAN: number; pvAN: number; avAN: number
  rvAG: number; kvAG: number; pvAG: number; avAG: number
  pauschsteuerAG: number
  beschaeftigungsart: string
  svTage: number
  insuranceType: string
}

export interface JahresWerte {
  jahr: number
  /** Erster und letzter abgerechnete Monat */
  vonMonat: number
  bisMonat: number
  /** Monate innerhalb des Zeitraums ohne Abrechnung — Hinweis auf Unterbrechungen */
  monateOhneAbrechnung: number[]
  svTageGesamt: number

  /**
   * Bruttoarbeitslohn für die Bescheinigung (Zeile 3 des amtlichen Musters).
   * Steuerfreie Zuschläge nach §3b gehören NICHT hinein — sie sind steuerfrei
   * und werden nicht bescheinigt.
   */
  bruttoarbeitslohn: number
  /** Nachrichtlich: was tatsächlich ausgezahlt wurde, inklusive steuerfreier Teile */
  gesamtbrutto: number
  steuerfreieZuschlaege: number
  sonstigeBezuege: number

  lohnsteuer: number
  kirchensteuer: number
  soli: number

  rvAN: number; rvAG: number
  kvAN: number; kvAG: number
  pvAN: number; pvAG: number
  avAN: number; avAG: number

  /** Pauschal versteuerter Arbeitslohn — wird NICHT bescheinigt */
  pauschalVersteuert: number
  pauschsteuerAG: number

  /** Warum etwas nicht oder nur teilweise bescheinigt wird */
  hinweise: string[]
  /** Gibt es überhaupt etwas zu bescheinigen? */
  bescheinigungspflichtig: boolean
}

const rund = (n: number) => Math.round(n * 100) / 100

/**
 * Die Jahreswerte eines Mitarbeiters aus seinen Monatsabrechnungen.
 *
 * Der wichtigste Sonderfall: **pauschal versteuerter Arbeitslohn wird nicht
 * bescheinigt.** Wer als Minijobber mit der 2-Prozent-Pauschale abgerechnet
 * wird, bekommt keine Lohnsteuerbescheinigung — der Verdienst taucht in seiner
 * Steuererklärung gar nicht auf. Wer das übersieht, bescheinigt Beträge, die
 * das Finanzamt dann ein zweites Mal besteuert.
 */
export function jahresWerte(jahr: number, monate: MonatsWerte[]): JahresWerte {
  const hinweise: string[] = []
  const sortiert = [...monate].sort((a, b) => a.month - b.month)

  if (sortiert.length === 0) {
    return {
      jahr, vonMonat: 0, bisMonat: 0, monateOhneAbrechnung: [], svTageGesamt: 0,
      bruttoarbeitslohn: 0, gesamtbrutto: 0, steuerfreieZuschlaege: 0, sonstigeBezuege: 0,
      lohnsteuer: 0, kirchensteuer: 0, soli: 0,
      rvAN: 0, rvAG: 0, kvAN: 0, kvAG: 0, pvAN: 0, pvAG: 0, avAN: 0, avAG: 0,
      pauschalVersteuert: 0, pauschsteuerAG: 0,
      hinweise: ['Für dieses Jahr gibt es keine Abrechnung.'],
      bescheinigungspflichtig: false,
    }
  }

  const vonMonat = sortiert[0].month
  const bisMonat = sortiert[sortiert.length - 1].month

  // Lücken im Beschäftigungszeitraum deuten auf Unterbrechungen ohne Anspruch
  // auf Arbeitslohn — die gehören als Großbuchstabe U auf die Bescheinigung.
  const vorhanden = new Set(sortiert.map(m => m.month))
  const monateOhneAbrechnung: number[] = []
  for (let m = vonMonat; m <= bisMonat; m++) if (!vorhanden.has(m)) monateOhneAbrechnung.push(m)
  if (monateOhneAbrechnung.length > 0) {
    hinweise.push(
      `Im Beschäftigungszeitraum fehlen Abrechnungen für ${monateOhneAbrechnung.length} Monate. `
      + 'Unterbrechungen ohne Anspruch auf Arbeitslohn sind auf der Bescheinigung als '
      + 'Großbuchstabe U anzugeben — bitte mit dem Steuerberater klären.',
    )
  }

  // Pauschal versteuerte Monate gehören nicht in die Bescheinigung
  const pauschal = sortiert.filter(m => m.beschaeftigungsart === 'minijob' && m.pauschsteuerAG > 0)
  const zuBescheinigen = sortiert.filter(m => !pauschal.includes(m))

  if (pauschal.length > 0) {
    hinweise.push(
      `${pauschal.length} Monate wurden pauschal versteuert (§40a EStG). Dieser Arbeitslohn `
      + 'wird NICHT bescheinigt und gehört nicht in die Steuererklärung des Arbeitnehmers.',
    )
  }

  const summe = (feld: keyof MonatsWerte, liste = zuBescheinigen) =>
    rund(liste.reduce((s, m) => s + (Number(m[feld]) || 0), 0))

  const bruttoarbeitslohn = rund(
    zuBescheinigen.reduce((s, m) => s + m.steuerBrutto + m.sonstigeBezuege, 0))

  const steuerfrei = summe('steuerfreieZuschlaege')
  if (steuerfrei > 0) {
    hinweise.push(
      `${steuerfrei.toFixed(2)} € steuerfreie Zuschläge (§3b EStG) sind im `
      + 'Bruttoarbeitslohn NICHT enthalten — sie werden nicht bescheinigt.',
    )
  }

  const privat = zuBescheinigen.some(m => m.insuranceType === 'PKV')
  if (privat) {
    hinweise.push(
      'Privat versichert: Der steuerfreie Arbeitgeberzuschuss zur Kranken- und '
      + 'Pflegeversicherung ist gesondert zu bescheinigen.',
    )
  }

  return {
    jahr, vonMonat, bisMonat, monateOhneAbrechnung,
    svTageGesamt: sortiert.reduce((s, m) => s + (m.svTage || 0), 0),

    bruttoarbeitslohn,
    gesamtbrutto: summe('brutto', sortiert),
    steuerfreieZuschlaege: steuerfrei,
    sonstigeBezuege: summe('sonstigeBezuege'),

    lohnsteuer: summe('lohnsteuer'),
    kirchensteuer: summe('kirchensteuer'),
    soli: summe('soli'),

    rvAN: summe('rvAN'), rvAG: summe('rvAG'),
    kvAN: summe('kvAN'), kvAG: summe('kvAG'),
    pvAN: summe('pvAN'), pvAG: summe('pvAG'),
    avAN: summe('avAN'), avAG: summe('avAG'),

    pauschalVersteuert: rund(pauschal.reduce((s, m) => s + m.brutto, 0)),
    pauschsteuerAG: summe('pauschsteuerAG', sortiert),

    hinweise,
    bescheinigungspflichtig: zuBescheinigen.length > 0 && bruttoarbeitslohn > 0,
  }
}

/**
 * Die Werte in der Reihenfolge, in der sie auf der Bescheinigung stehen.
 *
 * Die Zeilennummern des amtlichen Musters sind hier bewusst NICHT angegeben.
 * Sie ändern sich zwischen den Jahren, und eine falsche Nummer wäre schlimmer
 * als keine — der Steuerberater ordnet die benannten Werte zu.
 */
export function bescheinigungsZeilen(w: JahresWerte): { bezeichnung: string; betrag: number }[] {
  const zeilen: { bezeichnung: string; betrag: number }[] = [
    { bezeichnung: 'Bruttoarbeitslohn einschließlich Sachbezüge', betrag: w.bruttoarbeitslohn },
    { bezeichnung: 'Einbehaltene Lohnsteuer', betrag: w.lohnsteuer },
    { bezeichnung: 'Einbehaltener Solidaritätszuschlag', betrag: w.soli },
    { bezeichnung: 'Einbehaltene Kirchensteuer des Arbeitnehmers', betrag: w.kirchensteuer },
    { bezeichnung: 'Arbeitgeberanteil zur gesetzlichen Rentenversicherung', betrag: w.rvAG },
    { bezeichnung: 'Arbeitnehmeranteil zur gesetzlichen Rentenversicherung', betrag: w.rvAN },
    { bezeichnung: 'Arbeitnehmerbeiträge zur gesetzlichen Krankenversicherung', betrag: w.kvAN },
    { bezeichnung: 'Arbeitnehmerbeiträge zur sozialen Pflegeversicherung', betrag: w.pvAN },
    { bezeichnung: 'Arbeitnehmerbeiträge zur Arbeitslosenversicherung', betrag: w.avAN },
  ]
  return zeilen.filter(z => z.betrag > 0)
}

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

/** Der Bescheinigungszeitraum als Text. */
export function zeitraumText(w: JahresWerte): string {
  if (w.vonMonat === 0) return '—'
  if (w.vonMonat === w.bisMonat) return `${MONATE[w.vonMonat - 1]} ${w.jahr}`
  return `${MONATE[w.vonMonat - 1]} bis ${MONATE[w.bisMonat - 1]} ${w.jahr}`
}
