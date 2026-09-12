/**
 * §116 Lohnsteuer nach dem amtlichen Programmablaufplan des BMF.
 *
 * Vorher hat dieses Programm die Lohnsteuer selbst nachgebaut. Das ging schief:
 * der Grundfreibetrag wurde doppelt abgezogen, Steuerklasse III rechnete nicht
 * im Splittingverfahren, statt der Vorsorgepauschale wurden die vollen
 * Sozialabgaben abgesetzt. Alles Fehler, die eine Abrechnung falsch machen und
 * die man einer Zahl nicht ansieht.
 *
 * Deshalb rechnet die Steuer jetzt der Programmablaufplan, den das
 * Bundesfinanzministerium jedes Jahr veröffentlicht — dieselbe Vorschrift, die
 * jede Lohnsoftware in Deutschland umsetzt, in derselben Reihenfolge und mit
 * denselben Rundungsregeln.
 *
 * Wir liefern die Eingaben und übernehmen das Ergebnis. Der Ablaufplan rechnet:
 *   - die Lohnsteuer einschließlich Vorsorgepauschale und Steuerklassenlogik
 *   - den Solidaritätszuschlag mit Milderungszone
 *   - die Bemessungsgrundlage der Kirchensteuer nach §51a EStG, also mit
 *     Kinderfreibetrag, während die Lohnsteuer selbst ohne ihn gerechnet wird
 *
 * Er rechnet NICHT die Sozialversicherungsbeiträge selbst und nicht das Netto —
 * das bleibt in `payroll-engine.ts`, mit den Rechengrößen aus `lohnjahre.ts`,
 * die aus derselben Quelle stammen.
 *
 * Geldbeträge gehen in Cent hinein und kommen in Cent heraus; hier wird an der
 * Grenze umgerechnet, damit im übrigen Programm weiter mit Euro gerechnet wird.
 */

import { calculate } from 'lohnsteuerrechner'
import { lohnjahrOderFehler } from './lohnjahre'

export type Steuerklasse = 1 | 2 | 3 | 4 | 5 | 6

export interface LohnsteuerEingabe {
  jahr: number
  /** Steuerpflichtiger Arbeitslohn des Monats in Euro (ohne steuerfreie Zuschläge) */
  steuerBruttoMonat: number
  steuerklasse: Steuerklasse
  /** Zahl der Kinderfreibeträge laut ELStAM — wirkt nur auf Soli und Kirchensteuer */
  kinderfreibetraege: number
  /** Zusatzbeitrag der Krankenkasse in Prozentpunkten, voller Satz */
  zusatzbeitragProzent: number
  versicherung: 'GKV' | 'PKV'
  /** Monatsbeitrag zur privaten Basiskranken- und Pflegeversicherung, Euro */
  pkvBeitragMonat?: number
  /** Arbeitgeberzuschuss dazu, Euro im Monat */
  pkvZuschussMonat?: number
  /** Gehört der Arbeitnehmer einer Religionsgemeinschaft an, die Steuer erhebt? */
  kirchensteuer: boolean
  bundesland?: string
  /** Hat der Arbeitnehmer Kinder? Ohne Kinder fällt der Zuschlag zur Pflegeversicherung an. */
  hatKinder?: boolean
  /** Kinder unter 25 — ab dem zweiten mindert jedes den Pflegebeitrag */
  kinderUnter25?: number
  /** Pflichtversichert in der Rentenversicherung (Regelfall) */
  rentenversicherungspflichtig?: boolean
  /** Freibetrag bzw. Hinzurechnungsbetrag laut ELStAM, Euro im Monat */
  freibetragMonat?: number
  hinzurechnungMonat?: number
  /** Faktor laut ELStAM — nur Steuerklasse IV (Faktorverfahren, §39f EStG) */
  faktor?: number
  /**
   * §120 Einmalzahlungen dieses Monats in Euro (Weihnachtsgeld, Prämie …).
   * Sie werden nach §39b Abs.3 EStG besteuert: die Steuer ist der Unterschied
   * zwischen der Jahressteuer mit und ohne die Zahlung.
   */
  sonstigeBezuege?: number
  /**
   * Voraussichtlicher Jahresarbeitslohn OHNE die Einmalzahlung, in Euro,
   * zuzüglich bereits gezahlter Einmalzahlungen dieses Jahres.
   * Nur nötig, wenn `sonstigeBezuege` gesetzt ist.
   */
  jahresArbeitslohn?: number
}

export interface LohnsteuerErgebnis {
  lohnsteuer: number
  soli: number
  /** Bemessungsgrundlage der Kirchensteuer (§51a EStG) — mit Kinderfreibetrag */
  kirchensteuerBasis: number
  /** §120 Steuer auf die Einmalzahlungen, getrennt vom laufenden Lohn */
  lohnsteuerSonstige: number
  soliSonstige: number
  kirchensteuerBasisSonstige: number
}

/** Sachsen teilt die Pflegeversicherung anders auf als der Rest der Republik. */
export function istSachsen(bundesland?: string | null): boolean {
  return ['SN', 'Sachsen'].includes(bundesland ?? '')
}

/**
 * Zuschlag und Abschläge in der Pflegeversicherung.
 *
 * Zwei verschiedene Dinge, die gern verwechselt werden: der Zuschlag entfällt
 * dauerhaft, sobald jemand ein Kind hat — auch wenn es längst erwachsen ist.
 * Die Abschläge gibt es nur für Kinder unter 25 und erst ab dem zweiten.
 */
export function pflegeMerkmale(e: {
  hatKinder?: boolean
  kinderUnter25?: number
  kinderfreibetraege?: number
}): { pvz: 0 | 1; pva: number } {
  const kinderUnter25 = Math.max(0, Math.floor(e.kinderUnter25 ?? 0))
  const hatKinder = e.hatKinder ?? (kinderUnter25 > 0 || (e.kinderfreibetraege ?? 0) > 0)
  return {
    pvz: hatKinder ? 0 : 1,
    pva: Math.min(4, Math.max(0, kinderUnter25 - 1)),
  }
}

const cent = (euro: number) => Math.round(euro * 100)
const euro = (cent: number) => Math.round(cent) / 100

/**
 * Ein Monat Lohnsteuer.
 *
 * Wirft für ein Jahr, das weder in `lohnjahre.ts` noch im Ablaufplan hinterlegt
 * ist. Das ist Absicht: eine geschätzte Lohnsteuer ist schlimmer als gar keine.
 */
export function lohnsteuerBerechnen(e: LohnsteuerEingabe): LohnsteuerErgebnis {
  lohnjahrOderFehler(e.jahr)

  const { pvz, pva } = pflegeMerkmale(e)
  const privat = e.versicherung === 'PKV'

  let ergebnis
  try {
    ergebnis = calculate(e.jahr, {
      LZZ: 2,                                   // Lohnzahlungszeitraum: Monat
      RE4: cent(Math.max(0, e.steuerBruttoMonat)),
      STKL: e.steuerklasse,
      ZKF: Math.max(0, e.kinderfreibetraege),
      R: e.kirchensteuer ? 1 : 0,
      KVZ: privat ? 0 : Math.max(0, e.zusatzbeitragProzent),
      PKV: privat ? 1 : 0,
      PKPV: privat ? cent(e.pkvBeitragMonat ?? 0) : 0,
      PKPVAGZ: privat ? cent(e.pkvZuschussMonat ?? 0) : 0,
      PVS: istSachsen(e.bundesland) ? 1 : 0,
      PVZ: pvz,
      PVA: pva,
      KRV: e.rentenversicherungspflichtig === false ? 1 : 0,
      LZZFREIB: cent(e.freibetragMonat ?? 0),
      LZZHINZU: cent(e.hinzurechnungMonat ?? 0),
      // §120 Ohne den voraussichtlichen Jahresarbeitslohn kann der Ablaufplan
      // die Steuer auf eine Einmalzahlung nicht bilden — sie ist ja gerade der
      // Unterschied zwischen der Jahressteuer mit und ohne sie.
      SONSTB: cent(Math.max(0, e.sonstigeBezuege ?? 0)),
      JRE4: cent(Math.max(0, e.jahresArbeitslohn ?? 0)),
      // Das Faktorverfahren gibt es nur in Steuerklasse IV. Ein Faktor an einer
      // anderen Klasse waere ein Datenfehler und wird deshalb nicht angewandt.
      ...(e.steuerklasse === 4 && e.faktor && e.faktor > 0
        ? { af: 1, f: e.faktor }
        : {}),
    })
  } catch (fehler) {
    throw new Error(
      `Für ${e.jahr} liegt kein amtlicher Programmablaufplan vor. `
      + `Ohne ihn wird die Lohnsteuer nicht berechnet. `
      + `(${fehler instanceof Error ? fehler.message : String(fehler)})`,
    )
  }

  return {
    lohnsteuer: euro(ergebnis.LSTLZZ),
    soli: euro(ergebnis.SOLZLZZ),
    kirchensteuerBasis: euro(ergebnis.BK),
    lohnsteuerSonstige: euro(ergebnis.STS),
    soliSonstige: euro(ergebnis.SOLZS),
    kirchensteuerBasisSonstige: euro(ergebnis.BKS),
  }
}
