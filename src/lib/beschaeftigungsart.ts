/**
 * §121 Minijob, kurzfristige Beschäftigung und Übergangsbereich.
 *
 * In Kita und Reha sind geringfügig Beschäftigte der Normalfall, nicht die
 * Ausnahme. Bisher hat das Programm bei kleinen Beträgen nur gewarnt und
 * ansonsten wie bei einem regulären Arbeitsverhältnis gerechnet — also falsch,
 * und zwar in beide Richtungen: dem Minijobber wurden Beiträge abgezogen, die
 * er nicht schuldet, und der Arbeitgeber zahlte nicht die Pauschalen, die er
 * schuldet.
 *
 * Drei Arten, drei völlig verschiedene Rechnungen:
 *
 *   MINIJOB (§8 Abs.1 Nr.1 SGB IV) — bis zur Geringfügigkeitsgrenze.
 *   Der Arbeitgeber zahlt Pauschalen (15 % Rente, 13 % Kranken), der
 *   Arbeitnehmer nur seinen Rentenanteil von 3,6 % — und auch den nur, wenn er
 *   sich nicht davon befreien lässt. Keine Kranken-, Pflege- oder
 *   Arbeitslosenversicherung für ihn.
 *
 *   KURZFRISTIG (§8 Abs.1 Nr.2 SGB IV) — höchstens drei Monate oder 70
 *   Arbeitstage im Kalenderjahr. Völlig beitragsfrei, unabhängig vom Verdienst.
 *
 *   ÜBERGANGSBEREICH (§20 Abs.2a SGB IV) — von der Geringfügigkeitsgrenze bis
 *   2.000 €. Keine Wahl, sondern Gesetz: wer da hineinfällt, wird so gerechnet.
 *   Der Arbeitnehmeranteil steigt von null an der unteren Grenze langsam auf
 *   den vollen Satz an der oberen; die Differenz trägt der Arbeitgeber.
 *
 * Die Geringfügigkeitsgrenze steht bewusst nicht als Zahl im Code: sie folgt
 * seit 2022 dem Mindestlohn und wird in `lohnjahre.ts` aus ihm gerechnet.
 */

import {
  lohnjahrOderFehler, geringfuegigkeitsgrenze, uebergangsbereichFaktor,
  type Lohnjahr,
} from './lohnjahre'
import { istSachsen, pflegeMerkmale } from './lohnsteuer-pap'

export type Beschaeftigungsart = 'regulaer' | 'minijob' | 'kurzfristig' | 'uebergangsbereich'

export const BESCHAEFTIGUNGSARTEN: { wert: Beschaeftigungsart; label: string }[] = [
  { wert: 'regulaer', label: 'Reguläre Beschäftigung' },
  { wert: 'minijob', label: 'Minijob (geringfügig entlohnt)' },
  { wert: 'kurzfristig', label: 'Kurzfristige Beschäftigung' },
]

// §249b SGB V und §172 Abs.3 SGB VI — die Pauschalen des Arbeitgebers
const MINIJOB_PAUSCHAL_KV = 0.13
const MINIJOB_PAUSCHAL_RV = 0.15
/** §40a Abs.2 EStG — einheitliche Pauschsteuer inklusive Soli und Kirchensteuer */
const MINIJOB_PAUSCHSTEUER = 0.02

/**
 * Welche Art gilt tatsächlich?
 *
 * Vereinbart wird eine Art, aber das Gesetz entscheidet: wer als „regulär"
 * geführt wird und im Übergangsbereich verdient, wird nach dessen Regeln
 * gerechnet — das ist keine Wahl. Und wer als Minijobber geführt wird, aber
 * über der Grenze liegt, ist keiner mehr.
 */
export function artBestimmen(
  vereinbart: string | null | undefined,
  monatsEntgelt: number,
  jahr: Lohnjahr,
): { art: Beschaeftigungsart; hinweis?: string } {
  const grenze = geringfuegigkeitsgrenze(jahr)

  if (vereinbart === 'kurzfristig') return { art: 'kurzfristig' }

  if (vereinbart === 'minijob') {
    if (monatsEntgelt > grenze) {
      // Ein gelegentliches Überschreiten ist erlaubt (bis zu zwei Monate im
      // Jahr), ein dauerhaftes nicht. Das kann nur ein Mensch entscheiden.
      return {
        art: monatsEntgelt > jahr.uebergangsbereichObergrenze ? 'regulaer' : 'uebergangsbereich',
        hinweis: `Das Entgelt liegt mit ${monatsEntgelt.toFixed(2)} € über der `
          + `Geringfügigkeitsgrenze von ${grenze} €. Gerechnet wurde daher nicht als `
          + `Minijob. Ein gelegentliches Überschreiten ist zulässig (§8 Abs.1b SGB IV) — `
          + `bei dauerhaftem Überschreiten endet der Minijob und muss umgemeldet werden.`,
      }
    }
    return { art: 'minijob' }
  }

  // Regulär vereinbart: der Übergangsbereich greift von selbst
  if (monatsEntgelt > grenze && monatsEntgelt <= jahr.uebergangsbereichObergrenze) {
    return {
      art: 'uebergangsbereich',
      hinweis: `Das Entgelt liegt im Übergangsbereich (${grenze} € bis `
        + `${jahr.uebergangsbereichObergrenze} €). Der Arbeitnehmeranteil ist deshalb `
        + `vermindert (§20 Abs.2a SGB IV).`,
    }
  }
  if (monatsEntgelt > 0 && monatsEntgelt <= grenze) {
    return {
      art: 'regulaer',
      hinweis: `Das Entgelt liegt mit ${monatsEntgelt.toFixed(2)} € unter der `
        + `Geringfügigkeitsgrenze von ${grenze} €, ist aber als reguläre `
        + `Beschäftigung geführt. Bitte prüfen, ob ein Minijob vorliegt.`,
    }
  }
  return { art: 'regulaer' }
}

export interface BeitragsEingabe {
  jahr: number
  /** Beitragspflichtiges Monatsentgelt */
  entgelt: number
  art: Beschaeftigungsart
  versicherung: 'GKV' | 'PKV'
  zusatzbeitragProzent?: number
  bundesland?: string
  hatKinder?: boolean
  kinderUnter25?: number
  rvExempt?: boolean
  /** Minijob: Befreiung von der Rentenversicherungspflicht auf Antrag */
  rvBefreiung?: boolean
}

export interface BeitragsErgebnis {
  rvAN: number; kvAN: number; pvAN: number; avAN: number
  rvAG: number; kvAG: number; pvAG: number; avAG: number
  svAN: number
  svAG: number
  /** §40a EStG — die Pauschsteuer trägt der Arbeitgeber, nicht der Arbeitnehmer */
  pauschsteuerAG: number
  /** Die Bemessungsgrundlage, auf der gerechnet wurde — für den Nachweis */
  bemessung: number
  hinweise: string[]
}

const rund = (n: number) => Math.round(n * 100) / 100

/**
 * Die beitragspflichtige Einnahme im Übergangsbereich (§20 Abs.2a SGB IV).
 *
 * Sie ist nicht das Entgelt, sondern ein kleinerer, gestaffelter Betrag: an der
 * unteren Grenze rund zwei Drittel, an der oberen das volle Entgelt. Auf ihr
 * wird der GESAMTbeitrag gebildet.
 */
export function uebergangsbereichBemessung(entgelt: number, jahr: Lohnjahr): number {
  const G = geringfuegigkeitsgrenze(jahr)
  const OG = jahr.uebergangsbereichObergrenze
  const F = uebergangsbereichFaktor(jahr)
  if (entgelt <= G) return entgelt
  if (entgelt > OG) return entgelt
  const faktorOben = OG / (OG - G)
  return rund(F * G + (faktorOben - (G / (OG - G)) * F) * (entgelt - G))
}

/**
 * Die Bemessung für den Arbeitnehmeranteil im Übergangsbereich.
 *
 * Eine zweite, andere Größe: an der unteren Grenze null, an der oberen das
 * volle Entgelt. Daraus folgt, dass der Arbeitnehmer an der Untergrenze gar
 * nichts zahlt — der Arbeitgeber trägt dort den ganzen Beitrag.
 */
export function uebergangsbereichBemessungAN(entgelt: number, jahr: Lohnjahr): number {
  const G = geringfuegigkeitsgrenze(jahr)
  const OG = jahr.uebergangsbereichObergrenze
  if (entgelt <= G) return 0
  if (entgelt > OG) return entgelt
  return rund((OG / (OG - G)) * (entgelt - G))
}

/**
 * Beiträge nach Beschäftigungsart.
 *
 * Für `regulaer` liefert diese Funktion bewusst nichts — der Regelfall bleibt
 * im Rechenkern, wo auch die Beitragsbemessungsgrenzen greifen. Hier stehen nur
 * die Sonderformen.
 */
export function beitraegeNachArt(e: BeitragsEingabe): BeitragsErgebnis | null {
  const jahr = lohnjahrOderFehler(e.jahr)
  const hinweise: string[] = []
  const leer = {
    rvAN: 0, kvAN: 0, pvAN: 0, avAN: 0,
    rvAG: 0, kvAG: 0, pvAG: 0, avAG: 0,
    svAN: 0, svAG: 0, pauschsteuerAG: 0,
  }

  if (e.art === 'regulaer') return null

  // ── Kurzfristige Beschäftigung ───────────────────────────────────────────
  if (e.art === 'kurzfristig') {
    hinweise.push(
      'Kurzfristige Beschäftigung: beitragsfrei in allen Zweigen. Die Zeitgrenze '
      + '(drei Monate oder 70 Arbeitstage im Kalenderjahr) muss überwacht werden — '
      + 'bei Überschreiten wird die Beschäftigung rückwirkend beitragspflichtig.',
    )
    return { ...leer, bemessung: 0, hinweise }
  }

  // ── Minijob ──────────────────────────────────────────────────────────────
  if (e.art === 'minijob') {
    // Der Arbeitgeber zahlt Pauschalen, der Arbeitnehmer nur seinen Rentenanteil.
    const rvAG = rund(e.entgelt * MINIJOB_PAUSCHAL_RV)
    // Die Krankenversicherungspauschale fällt nur an, wenn der Minijobber
    // gesetzlich versichert ist — privat Versicherte lösen sie nicht aus.
    const kvAG = e.versicherung === 'GKV' ? rund(e.entgelt * MINIJOB_PAUSCHAL_KV) : 0
    if (e.versicherung !== 'GKV') {
      hinweise.push(
        'Privat versicherter Minijobber: Die Krankenversicherungspauschale von 13 % '
        + 'fällt nicht an.',
      )
    }

    // §172 Abs.3 SGB VI: der Arbeitnehmer stockt auf den vollen Rentenbeitrag auf
    const eigenanteilSatz = Math.max(0, jahr.rvSatz - MINIJOB_PAUSCHAL_RV)
    const rvAN = (e.rvBefreiung || e.rvExempt) ? 0 : rund(e.entgelt * eigenanteilSatz)
    if (e.rvBefreiung) {
      hinweise.push(
        'Von der Rentenversicherungspflicht befreit — der Arbeitnehmer erwirbt '
        + 'dadurch keine vollen Rentenanwartschaften.',
      )
    }

    return {
      ...leer,
      rvAN, rvAG, kvAG,
      svAN: rvAN,
      svAG: rund(rvAG + kvAG),
      // §40a Abs.2 EStG — trägt der Arbeitgeber zusätzlich
      pauschsteuerAG: rund(e.entgelt * MINIJOB_PAUSCHSTEUER),
      bemessung: e.entgelt,
      hinweise,
    }
  }

  // ── Übergangsbereich ─────────────────────────────────────────────────────
  const gesamtBemessung = uebergangsbereichBemessung(e.entgelt, jahr)
  const anBemessung = uebergangsbereichBemessungAN(e.entgelt, jahr)

  const kvSatz = jahr.kvBasisSatz
    + (e.zusatzbeitragProzent ?? jahr.kvZusatzSatzDurchschnitt * 100) / 100
  const { pvz, pva } = pflegeMerkmale({
    hatKinder: e.hatKinder, kinderUnter25: e.kinderUnter25,
  })
  const sachsen = istSachsen(e.bundesland)
  let pvAnSatz = sachsen ? jahr.pvSachsenAn : jahr.pvSatz / 2
  if (pvz === 1) pvAnSatz += jahr.pvZuschlagKinderlos
  else pvAnSatz -= pva * jahr.pvAbschlagJeKind
  pvAnSatz = Math.max(0, pvAnSatz)

  // Arbeitnehmer: halber Satz auf seine eigene, kleinere Bemessung
  const rvAN = e.rvExempt ? 0 : rund(anBemessung * (jahr.rvSatz / 2))
  const avAN = rund(anBemessung * (jahr.avSatz / 2))
  const kvAN = e.versicherung === 'GKV' ? rund(anBemessung * (kvSatz / 2)) : 0
  const pvAN = e.versicherung === 'GKV' ? rund(anBemessung * pvAnSatz) : 0

  // Arbeitgeber: der Gesamtbeitrag auf die größere Bemessung, minus dem
  // Arbeitnehmeranteil. So trägt er an der Untergrenze alles allein.
  const rvGesamt = e.rvExempt ? 0 : rund(gesamtBemessung * jahr.rvSatz)
  const avGesamt = rund(gesamtBemessung * jahr.avSatz)
  const kvGesamt = e.versicherung === 'GKV' ? rund(gesamtBemessung * kvSatz) : 0
  const pvGesamtSatz = sachsen ? jahr.pvSachsenAn + jahr.pvSachsenAg : jahr.pvSatz
  const pvGesamt = e.versicherung === 'GKV' ? rund(gesamtBemessung * pvGesamtSatz) : 0

  const rvAG = rund(Math.max(0, rvGesamt - rvAN))
  const avAG = rund(Math.max(0, avGesamt - avAN))
  const kvAG = rund(Math.max(0, kvGesamt - kvAN))
  const pvAG = rund(Math.max(0, pvGesamt - pvAN))

  hinweise.push(
    `Übergangsbereich: Beiträge auf ${gesamtBemessung.toFixed(2)} € statt auf `
    + `${e.entgelt.toFixed(2)} €; der Arbeitnehmeranteil bemisst sich nach `
    + `${anBemessung.toFixed(2)} €.`,
  )

  return {
    rvAN, kvAN, pvAN, avAN,
    rvAG, kvAG, pvAG, avAG,
    svAN: rund(rvAN + kvAN + pvAN + avAN),
    svAG: rund(rvAG + kvAG + pvAG + avAG),
    pauschsteuerAG: 0,
    bemessung: gesamtBemessung,
    hinweise,
  }
}

/**
 * Wird für diese Beschäftigungsart Lohnsteuer nach ELStAM erhoben?
 *
 * Beim Minijob mit Pauschsteuer nicht: die 2 % des Arbeitgebers gelten alles ab,
 * einschließlich Soli und Kirchensteuer. Der Verdienst taucht dann in der
 * Steuererklärung des Arbeitnehmers gar nicht auf.
 */
export function individuellBesteuert(
  art: Beschaeftigungsart,
  pauschalsteuer: boolean | null | undefined,
): boolean {
  if (art === 'minijob' && pauschalsteuer) return false
  return true
}
