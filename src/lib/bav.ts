import type { Lohnjahr } from './lohnjahre'

/**
 * §156 Betriebliche Altersvorsorge — Entgeltumwandlung nach §1a BetrAVG.
 *
 * DER FEHLER, DEN FAST JEDE SELBSTGEBAUTE ABRECHNUNG MACHT
 * Man merkt sich „acht Prozent sind frei" und rechnet damit. Das ist zur
 * Hälfte richtig und deshalb besonders gefährlich:
 *
 *   STEUERFREI sind Beiträge bis 8 % der Beitragsbemessungsgrenze der
 *   Rentenversicherung (§3 Nr. 63 EStG).
 *
 *   BEITRAGSFREI in der Sozialversicherung sind sie nur bis 4 %
 *   (§1 Abs. 1 Satz 1 Nr. 9 SvEV).
 *
 * Dazwischen liegt ein Bereich, in dem der Beitrag steuerfrei ist und trotzdem
 * verbeitragt wird. Wer mit einer Grenze rechnet, zieht in diesem Bereich zu
 * wenig Sozialversicherung ab — und das fällt erst bei der Betriebsprüfung
 * auf, dann für vier Jahre rückwirkend und mit Säumniszuschlägen.
 *
 * UND DIE ZWEITE HÄLFTE DESSELBEN FEHLERS: DER ZEITRAUM
 * Die beiden Grenzen gelten nicht nur in verschiedener Höhe, sondern auch für
 * verschiedene Zeiträume.
 *
 *   STEUERLICH ist der Höchstbetrag ein JAHRESbetrag. Er darf jederzeit im
 *   Jahr ausgeschöpft werden, auch auf einen Schlag im Dezember, und auch
 *   dann, wenn das Beschäftigungsverhältnis nicht das ganze Jahr bestand
 *   (R 3.63 LStR). Was in früheren Monaten nicht gebraucht wurde, bleibt
 *   nutzbar.
 *
 *   BEITRAGSRECHTLICH wird bei laufendem Arbeitsentgelt MONATLICH gerechnet:
 *   ein Zwölftel der 4 % je Monat. Was ein Monat nicht ausschöpft, ist
 *   verfallen — eine Nachholung gibt es nicht.
 *
 * Wer beide Grenzen als Jahresbetrag führt, lässt im Januar einen Beitrag in
 * Höhe des ganzen Jahresrahmens beitragsfrei durchlaufen. Das ist derselbe
 * Fehler wie oben, nur in der anderen Achse, und es ist der Grund, warum diese
 * Datei zwei getrennte Zähler führt: `steuerfreiBisherImJahr` für die Steuer,
 * `svfreiBisherImMonat` für die Beiträge.
 *
 * DER ZUSCHUSS IST NICHT EINFACH 15 %
 * §1a Abs. 1a BetrAVG verpflichtet den Arbeitgeber, 15 % des umgewandelten
 * Betrags weiterzugeben — aber nur, „soweit er durch die Entgeltumwandlung
 * Sozialversicherungsbeiträge einspart". Oberhalb der 4-%-Grenze spart er
 * nichts, also schuldet er dort auch nichts. Pauschal 15 % auf alles zu zahlen
 * ist erlaubt und großzügig; es als Pflicht darzustellen wäre falsch.
 *
 * WAS HIER NICHT STEHT
 * Die Pauschalversteuerung alter Direktversicherungen nach §40b EStG in der
 * Fassung bis 2004. Sie betrifft nur Verträge, die vor 2005 geschlossen
 * wurden, und läuft nach eigenen Regeln. Wer so einen Vertrag hat, braucht
 * eine eigene Behandlung — das Programm erkennt ihn und sagt es, statt ihn
 * still falsch zu rechnen.
 */

export type Durchfuehrungsweg =
  | 'direktversicherung'
  | 'pensionskasse'
  | 'pensionsfonds'
  /** §40b EStG alte Fassung — eigene Regeln, wird nicht gerechnet */
  | 'altvertrag_40b'

export const WEGE: Record<Durchfuehrungsweg, string> = {
  direktversicherung: 'Direktversicherung',
  pensionskasse: 'Pensionskasse',
  pensionsfonds: 'Pensionsfonds',
  altvertrag_40b: 'Altvertrag mit Pauschalversteuerung (§40b EStG a.F.)',
}

/** Die drei Wege, die §3 Nr. 63 EStG erfasst. */
export const NACH_3_NR_63: Durchfuehrungsweg[] = [
  'direktversicherung', 'pensionskasse', 'pensionsfonds',
]

/** §3 Nr. 63 EStG: steuerfrei bis 8 % der Beitragsbemessungsgrenze RV. */
export const STEUERFREI_ANTEIL = 0.08

/** §1 Abs. 1 Satz 1 Nr. 9 SvEV: beitragsfrei nur bis 4 %. */
export const SVFREI_ANTEIL = 0.04

/** §1a Abs. 1a BetrAVG: der Pflichtzuschuss des Arbeitgebers. */
export const PFLICHTZUSCHUSS = 0.15

export interface Grenzen {
  /** Bemessungsgrundlage: die Beitragsbemessungsgrenze RV im Jahr */
  bbgJahr: number
  steuerfreiJahr: number
  steuerfreiMonat: number
  svfreiJahr: number
  svfreiMonat: number
}

/**
 * Die Grenzen eines Jahres.
 *
 * Gerechnet aus der Beitragsbemessungsgrenze und nicht als feste Zahl
 * hinterlegt: Die BBG ändert sich jedes Jahr, die Prozentsätze nicht. Eine
 * hinterlegte Zahl wäre im Januar falsch, ohne dass es auffiele.
 */
export function grenzen(jahr: Lohnjahr): Grenzen {
  const bbgJahr = jahr.bbgRvAvMonat * 12
  return {
    bbgJahr,
    steuerfreiJahr: runde(bbgJahr * STEUERFREI_ANTEIL),
    steuerfreiMonat: runde(bbgJahr * STEUERFREI_ANTEIL / 12),
    svfreiJahr: runde(bbgJahr * SVFREI_ANTEIL),
    svfreiMonat: runde(bbgJahr * SVFREI_ANTEIL / 12),
  }
}

export interface Umwandlung {
  /** Was in diesem Monat umgewandelt wird */
  monatsbetrag: number
  weg: Durchfuehrungsweg
  /**
   * Wie viel vom JAHRESrahmen der Steuerfreiheit schon verbraucht ist.
   *
   * Gezählt wird, was tatsächlich steuerfrei gestellt wurde — nicht, was
   * umgewandelt wurde. Ein Betrag oberhalb der Grenze war nie frei und darf
   * den Rahmen deshalb auch nicht mindern.
   */
  steuerfreiBisherImJahr?: number
  /**
   * Wie viel vom MONATSrahmen der Beitragsfreiheit schon verbraucht ist — aus
   * einem anderen Vertrag derselben Person in demselben Monat.
   *
   * Die Beitragsfreiheit nach der SvEV wird bei laufendem Entgelt monatlich
   * bemessen. Zwei Verträge teilen sich einen Monatsrahmen; wer jedem seinen
   * eigenen gäbe, verdoppelte ihn.
   */
  svfreiBisherImMonat?: number
}

export interface Aufteilung {
  /** Der umgewandelte Betrag insgesamt */
  umgewandelt: number
  /** Davon steuerfrei UND beitragsfrei */
  freiBeides: number
  /** Davon steuerfrei, aber beitragspflichtig — der Bereich zwischen 4 % und 8 % */
  nurSteuerfrei: number
  /** Davon weder steuer- noch beitragsfrei */
  pflichtig: number
  /** Um wie viel das Steuerbrutto sinkt */
  minderungSteuer: number
  /** Um wie viel das Beitragsbrutto sinkt */
  minderungSv: number
  grenzen: Grenzen
  hinweise: string[]
}

/**
 * Den Monatsbeitrag auf die drei Bereiche aufteilen.
 *
 * Zwei Grenzen, zwei Zeiträume:
 *
 *   Die STEUERfreiheit wird gegen den Jahresrahmen gerechnet, abzüglich
 *   dessen, was im Jahr schon umgewandelt wurde. Nur so stimmt es auch bei
 *   schwankenden Beträgen und bei einer Einmalzahlung im Dezember.
 *
 *   Die BEITRAGSfreiheit wird gegen den Monatsrahmen gerechnet. Ein Monat
 *   erbt nichts vom vorigen.
 *
 * Beitragsfrei kann außerdem nur sein, was steuerfrei ist: Die SvEV nimmt
 * „Beiträge nach §3 Nr. 63 EStG" aus. Ist der Jahresrahmen der Steuer
 * erschöpft, ist auch der Monatsrahmen der Beiträge gegenstandslos.
 */
export function teileAuf(u: Umwandlung, jahr: Lohnjahr): Aufteilung {
  const g = grenzen(jahr)
  const bisher = Math.max(0, u.steuerfreiBisherImJahr ?? 0)
  const bisherMonat = Math.max(0, u.svfreiBisherImMonat ?? 0)
  const betrag = Math.max(0, u.monatsbetrag)
  const hinweise: string[] = []

  // §40b-Altverträge laufen nach eigenen Regeln — hier wird nichts geraten.
  if (u.weg === 'altvertrag_40b') {
    hinweise.push(
      'Dieser Vertrag wird nach §40b EStG in der Fassung bis 2004 pauschal '
      + 'versteuert. Das Programm rechnet ihn NICHT — die Beiträge und die '
      + 'Pauschsteuer gehören von Hand erfasst, damit nichts still falsch '
      + 'gerechnet wird.',
    )
    return {
      umgewandelt: betrag,
      freiBeides: 0, nurSteuerfrei: 0, pflichtig: betrag,
      minderungSteuer: 0, minderungSv: 0,
      grenzen: g, hinweise,
    }
  }

  // Steuer: was vom Jahresrahmen noch offen ist.
  const restSteuerfrei = Math.max(0, g.steuerfreiJahr - bisher)
  const steuerfrei = runde(Math.min(betrag, restSteuerfrei))

  // Beiträge: was vom Monatsrahmen noch offen ist — und nur, soweit der
  // Betrag überhaupt steuerfrei bleibt.
  const restSvfrei = Math.max(0, g.svfreiMonat - bisherMonat)
  const freiBeides = runde(Math.min(steuerfrei, restSvfrei))
  const nurSteuerfrei = runde(steuerfrei - freiBeides)
  const pflichtig = runde(betrag - steuerfrei)

  if (nurSteuerfrei > 0) {
    hinweise.push(
      `${euro(nurSteuerfrei)} liegen über der Beitragsgrenze (4 % = `
      + `${euro(g.svfreiMonat)} im Monat) und unter der Steuergrenze (8 % = `
      + `${euro(g.steuerfreiJahr)} im Jahr). Dieser Teil ist steuerfrei, aber `
      + 'beitragspflichtig (§1 Abs. 1 Satz 1 Nr. 9 SvEV).',
    )
  }
  if (pflichtig > 0) {
    hinweise.push(
      `${euro(pflichtig)} übersteigen die Steuergrenze von 8 % der `
      + 'Beitragsbemessungsgrenze (§3 Nr. 63 EStG) und sind voll steuer- und '
      + 'beitragspflichtig.',
    )
  }

  return {
    umgewandelt: runde(betrag),
    freiBeides,
    nurSteuerfrei,
    pflichtig,
    minderungSteuer: runde(freiBeides + nurSteuerfrei),
    minderungSv: freiBeides,
    grenzen: g,
    hinweise,
  }
}

export interface Zuschuss {
  /** Was der Arbeitgeber schuldet */
  pflicht: number
  /** Was er tatsächlich zahlt — kann freiwillig höher sein */
  gezahlt: number
  /** Der Teil, auf den überhaupt eine Pflicht besteht */
  bemessung: number
  hinweise: string[]
}

/**
 * Der Zuschuss des Arbeitgebers (§1a Abs. 1a BetrAVG).
 *
 * WARUM NICHT EINFACH 15 % VOM GANZEN
 * Weil das Gesetz „soweit er Sozialversicherungsbeiträge einspart" sagt.
 * Gespart wird nur auf dem beitragsfreien Teil — oberhalb der 4-%-Grenze
 * zahlt der Arbeitgeber seinen Anteil ohnehin weiter und spart nichts. Ein
 * pauschaler Zuschuss auf den vollen Betrag ist zulässig und wird oft
 * vereinbart; er ist dann freiwillig, nicht geschuldet.
 *
 * Deshalb stehen hier beide Zahlen: die Pflicht und das, was vereinbart ist.
 * Wer weniger zahlt als die Pflicht, bekommt es gesagt.
 */
export function zuschuss(
  a: Aufteilung,
  vereinbarterSatz: number = PFLICHTZUSCHUSS,
  /** Manche Betriebe zahlen pauschal auf den ganzen Betrag */
  aufGesamtbetrag = false,
): Zuschuss {
  const bemessung = aufGesamtbetrag ? a.umgewandelt : a.freiBeides
  const pflicht = runde(a.freiBeides * PFLICHTZUSCHUSS)
  const gezahlt = runde(bemessung * Math.max(0, vereinbarterSatz))
  const hinweise: string[] = []

  if (gezahlt + 0.005 < pflicht) {
    hinweise.push(
      `Der Zuschuss liegt unter der Pflicht aus §1a Abs. 1a BetrAVG: `
      + `${euro(pflicht)} wären mindestens geschuldet, vereinbart sind `
      + `${euro(gezahlt)}. Die Pflicht gilt seit dem 1. Januar 2022 auch für `
      + 'Vereinbarungen, die vorher geschlossen wurden.',
    )
  }
  if (a.nurSteuerfrei > 0 && !aufGesamtbetrag) {
    hinweise.push(
      'Auf den Teil zwischen 4 % und 8 % besteht keine Zuschusspflicht — dort '
      + 'spart der Betrieb keine Beiträge. Ein Zuschuss darauf wäre '
      + 'freiwillig.',
    )
  }

  return { pflicht, gezahlt, bemessung, hinweise }
}

export interface Ergebnis {
  aufteilung: Aufteilung
  zuschuss: Zuschuss
  /**
   * Der Betrag, um den das Bruttoentgelt sinkt: die Umwandlung selbst. Der
   * Zuschuss des Arbeitgebers erhöht den Beitrag an die Versorgung, mindert
   * aber NICHT das Entgelt — er kommt obendrauf.
   */
  entgeltminderung: number
  /** Was insgesamt an die Versorgungseinrichtung geht */
  anDieVersorgung: number
  hinweise: string[]
}

export function rechne(
  u: Umwandlung,
  jahr: Lohnjahr,
  vereinbarterSatz: number = PFLICHTZUSCHUSS,
  aufGesamtbetrag = false,
): Ergebnis {
  const aufteilung = teileAuf(u, jahr)
  const z = zuschuss(aufteilung, vereinbarterSatz, aufGesamtbetrag)
  return {
    aufteilung,
    zuschuss: z,
    entgeltminderung: aufteilung.umgewandelt,
    anDieVersorgung: runde(aufteilung.umgewandelt + z.gezahlt),
    hinweise: [...aufteilung.hinweise, ...z.hinweise],
  }
}

/**
 * Der Anspruch aus §1a Abs. 1 BetrAVG.
 *
 * Jeder Beschäftigte kann verlangen, bis zu 4 % der Beitragsbemessungsgrenze
 * umzuwandeln. Das ist ein Anspruch, keine Gunst — der Betrieb kann ihn nicht
 * ablehnen, sondern nur den Durchführungsweg bestimmen.
 */
export function anspruchJahr(jahr: Lohnjahr): number {
  return runde(jahr.bbgRvAvMonat * 12 * SVFREI_ANTEIL)
}

export function runde(betrag: number): number {
  return Math.round((betrag + Number.EPSILON) * 100) / 100
}

function euro(betrag: number): string {
  return `${betrag.toLocaleString('de-DE', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })} €`
}
