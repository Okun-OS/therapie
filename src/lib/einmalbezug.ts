/**
 * §120 Einmalzahlungen in der Sozialversicherung.
 *
 * Weihnachtsgeld, Urlaubsgeld und Prämien werden anders verbeitragt als
 * laufender Lohn. Der Unterschied ist keine Feinheit, sondern der Kern:
 *
 *   Beim laufenden Lohn gilt die MONATLICHE Beitragsbemessungsgrenze. Wer über
 *   ihr liegt, zahlt nur bis zu ihr — jeden Monat neu.
 *
 *   Bei einer Einmalzahlung gilt die ANTEILIGE JAHRESGRENZE: die monatliche
 *   Grenze mal der Zahl der SV-Tage des Jahres bis einschließlich des
 *   Auszahlungsmonats, abzüglich des schon verbeitragten Entgelts. Wer im Jahr
 *   noch Luft unter der Jahresgrenze hat, zahlt auf die Einmalzahlung Beiträge,
 *   auch wenn er im Auszahlungsmonat längst über der Monatsgrenze liegt.
 *
 * Wer das mit der Monatsgrenze rechnet, verbeitragt bei Gutverdienern deutlich
 * zu wenig — und das fällt erst bei der Betriebsprüfung auf, Jahre später.
 *
 * Was hier bewusst NICHT gerechnet wird, sondern gemeldet: die Märzklausel
 * (§23a Abs.4 SGB IV). Sie ordnet eine Einmalzahlung aus Januar bis März dem
 * Vorjahr zu, wenn die Jahresgrenze des Vorjahres noch nicht ausgeschöpft war.
 * Das braucht die vollständigen Vorjahresdaten; solange die nicht sicher
 * vorliegen, wird gewarnt statt geraten.
 */

import { lohnjahrOderFehler } from './lohnjahre'
import { istSachsen, pflegeMerkmale } from './lohnsteuer-pap'

export interface EinmalbezugEingabe {
  jahr: number
  /** Auszahlungsmonat, 1–12 */
  monat: number
  /** Summe der Einmalzahlungen dieses Monats, die beitragspflichtig sind */
  betrag: number
  /**
   * Bereits beitragspflichtiges Entgelt dieses Jahres bis einschließlich des
   * Vormonats — laufender Lohn und frühere Einmalzahlungen zusammen.
   */
  bisherBeitragspflichtig: number
  /** Beitragspflichtiges Entgelt des laufenden Monats (ohne die Einmalzahlung) */
  laufendesEntgelt: number
  /** Erster Monat der Beschäftigung im Jahr, 1–12 — für die anteilige Grenze */
  eintrittsMonat?: number
  versicherung: 'GKV' | 'PKV'
  zusatzbeitragProzent?: number
  bundesland?: string
  hatKinder?: boolean
  kinderUnter25?: number
  rvExempt?: boolean
}

export interface EinmalbezugErgebnis {
  /** Der Teil der Einmalzahlung, auf den Beiträge erhoben werden */
  beitragspflichtig: number
  rvAN: number; kvAN: number; pvAN: number; avAN: number
  rvAG: number; kvAG: number; pvAG: number; avAG: number
  svAN: number
  svAG: number
  warnungen: string[]
}

/**
 * Die anteilige Jahres-Beitragsbemessungsgrenze.
 *
 * Gerechnet in vollen Monaten ab Beschäftigungsbeginn bis einschließlich des
 * Auszahlungsmonats. Die Vorschrift rechnet in SV-Tagen zu 30 je Monat — bei
 * vollen Monaten ist das dasselbe Ergebnis und deutlich verständlicher.
 */
export function anteiligeJahresgrenze(
  monatsgrenze: number,
  auszahlungsMonat: number,
  eintrittsMonat = 1,
): number {
  const monate = Math.max(0, auszahlungsMonat - Math.max(1, eintrittsMonat) + 1)
  return Math.round(monatsgrenze * monate * 100) / 100
}

const rund = (n: number) => Math.round(n * 100) / 100

export function einmalbezugBeitraege(e: EinmalbezugEingabe): EinmalbezugErgebnis {
  const jahr = lohnjahrOderFehler(e.jahr)
  const warnungen: string[] = []

  if (e.betrag <= 0) {
    return {
      beitragspflichtig: 0,
      rvAN: 0, kvAN: 0, pvAN: 0, avAN: 0,
      rvAG: 0, kvAG: 0, pvAG: 0, avAG: 0,
      svAN: 0, svAG: 0, warnungen,
    }
  }

  // §23a Abs.4 SGB IV — die Märzklausel wird nicht geraten, sondern gemeldet.
  if (e.monat <= 3) {
    warnungen.push(
      'Einmalzahlung im ersten Quartal: Die Märzklausel (§23a Abs.4 SGB IV) kann '
      + 'sie dem Vorjahr zuordnen, wenn dessen Beitragsbemessungsgrenze noch nicht '
      + 'ausgeschöpft war. Das wird hier NICHT geprüft — bitte mit dem '
      + 'Steuerberater klären.',
    )
  }

  const schonVerbeitragt = Math.max(0, e.bisherBeitragspflichtig) + Math.max(0, e.laufendesEntgelt)

  // Renten- und Arbeitslosenversicherung teilen sich eine Grenze,
  // Kranken- und Pflegeversicherung eine andere. Beide werden getrennt gerechnet.
  const grenzeRv = anteiligeJahresgrenze(jahr.bbgRvAvMonat, e.monat, e.eintrittsMonat)
  const grenzeKv = anteiligeJahresgrenze(jahr.bbgKvPvMonat, e.monat, e.eintrittsMonat)

  const raumRv = Math.max(0, grenzeRv - schonVerbeitragt)
  const raumKv = Math.max(0, grenzeKv - schonVerbeitragt)

  const pflichtigRv = Math.min(e.betrag, raumRv)
  const pflichtigKv = Math.min(e.betrag, raumKv)

  if (pflichtigRv < e.betrag || pflichtigKv < e.betrag) {
    warnungen.push(
      'Die Einmalzahlung liegt teilweise über der anteiligen Jahres-'
      + 'Beitragsbemessungsgrenze und ist insoweit beitragsfrei.',
    )
  }

  const rvAN = e.rvExempt ? 0 : rund(pflichtigRv * (jahr.rvSatz / 2))
  const rvAG = e.rvExempt ? 0 : rund(pflichtigRv * (jahr.rvSatz / 2))
  const avAN = rund(pflichtigRv * (jahr.avSatz / 2))
  const avAG = rund(pflichtigRv * (jahr.avSatz / 2))

  let kvAN = 0, kvAG = 0, pvAN = 0, pvAG = 0
  if (e.versicherung === 'GKV') {
    const kvSatz = jahr.kvBasisSatz
      + (e.zusatzbeitragProzent ?? jahr.kvZusatzSatzDurchschnitt * 100) / 100
    kvAN = rund(pflichtigKv * (kvSatz / 2))
    kvAG = rund(pflichtigKv * (kvSatz / 2))

    const { pvz, pva } = pflegeMerkmale({
      hatKinder: e.hatKinder, kinderUnter25: e.kinderUnter25,
    })
    const sachsen = istSachsen(e.bundesland)
    let pvAnSatz = sachsen ? jahr.pvSachsenAn : jahr.pvSatz / 2
    const pvAgSatz = sachsen ? jahr.pvSachsenAg : jahr.pvSatz / 2
    if (pvz === 1) pvAnSatz += jahr.pvZuschlagKinderlos
    else pvAnSatz -= pva * jahr.pvAbschlagJeKind
    pvAN = rund(pflichtigKv * Math.max(0, pvAnSatz))
    pvAG = rund(pflichtigKv * pvAgSatz)
  } else {
    // Privat Versicherte zahlen ihren Beitrag unabhängig vom Entgelt — eine
    // Einmalzahlung erhöht ihn nicht.
    warnungen.push(
      'Privat versichert: Die Einmalzahlung erhöht den Kranken- und '
      + 'Pflegeversicherungsbeitrag nicht.',
    )
  }

  return {
    beitragspflichtig: rund(Math.max(pflichtigRv, pflichtigKv)),
    rvAN, kvAN, pvAN, avAN,
    rvAG, kvAG, pvAG, avAG,
    svAN: rund(rvAN + kvAN + pvAN + avAN),
    svAG: rund(rvAG + kvAG + pvAG + avAG),
    warnungen,
  }
}

/**
 * Der voraussichtliche Jahresarbeitslohn für die Steuerberechnung.
 *
 * Der Ablaufplan braucht ihn, weil die Steuer auf eine Einmalzahlung der
 * Unterschied zwischen der Jahressteuer mit und ohne sie ist. Gerechnet wird:
 * das bereits abgerechnete Steuerbrutto des Jahres, plus der laufende Monat
 * hochgerechnet auf die verbleibenden Monate, plus bereits gezahlte
 * Einmalzahlungen — so schreibt es §39b Abs.3 EStG vor.
 */
export function voraussichtlicherJahreslohn(opts: {
  bisherSteuerBrutto: number
  laufendesSteuerBrutto: number
  monat: number
  bisherigeEinmalzahlungen: number
}): number {
  const verbleibendeMonate = Math.max(0, 12 - opts.monat + 1)
  return rund(
    opts.bisherSteuerBrutto
    + opts.laufendesSteuerBrutto * verbleibendeMonate
    + opts.bisherigeEinmalzahlungen,
  )
}
