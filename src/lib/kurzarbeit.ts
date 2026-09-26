import { lohnsteuerBerechnen, type Steuerklasse } from './lohnsteuer-pap'
import type { Lohnjahr } from './lohnjahre'

/**
 * §157 Kurzarbeitergeld (§§95 ff. SGB III).
 *
 * WAS HIER ANDERS IST ALS IM REST DER ABRECHNUNG
 * Kurzarbeitergeld ist kein Lohn. Der Betrieb zahlt es aus, aber er schuldet
 * es nicht — er verauslagt eine Leistung der Agentur für Arbeit und bekommt
 * sie erstattet. Daraus folgt alles Weitere:
 *
 *   Es ist STEUERFREI (§3 Nr. 2a EStG), unterliegt aber dem
 *   Progressionsvorbehalt (§32b Abs. 1 Nr. 1 lit. a EStG): Es erhöht den
 *   Steuersatz auf das übrige Einkommen. Wer das nicht bescheinigt, sorgt für
 *   eine Nachzahlung, mit der niemand gerechnet hat.
 *
 *   Es ist BEITRAGSFREI. Beiträge fallen stattdessen auf ein fiktives Entgelt
 *   an — und die trägt der Arbeitgeber ALLEIN.
 *
 * DIE DREI ZAHLEN, DIE MAN NICHT VERWECHSELN DARF
 *   Sollentgelt — was ohne den Arbeitsausfall verdient worden wäre, OHNE
 *     Entgelt für Mehrarbeit (§106 Abs. 1 Satz 2 SGB III).
 *   Istentgelt  — was tatsächlich verdient wurde, MIT Mehrarbeit.
 *   Beide gedeckelt auf die Beitragsbemessungsgrenze der Rentenversicherung.
 *
 * Das Kurzarbeitergeld ist nicht etwa 60 % der Differenz der BRUTTObeträge,
 * sondern 60 % (mit Kind 67 %) der Differenz der pauschalierten NETTObeträge.
 * Das ist ein anderer Betrag, und zwar ein deutlich kleinerer.
 *
 * WAS DIESES MODUL NICHT KANN
 * Die Agentur rechnet nach ihrer eigenen „Tabelle zur Berechnung des
 * Kurzarbeitergeldes". Diese Tabelle entsteht aus demselben Programmablaufplan,
 * den wir verwenden, aber mit einer eingeschränkten Vorsorgepauschale
 * (§153 Abs. 1 Satz 2 Nr. 2 SGB III verweist nur auf §39b Abs. 2 Satz 5 Nr. 3
 * Buchstabe a und b EStG, nicht auf Buchstabe c). Bei üblichen Entgelten
 * stimmt das Ergebnis überein; bei niedrigen kann es um einige Euro abweichen,
 * weil dort die Mindestvorsorgepauschale greift.
 *
 * Deshalb ist jeder Betrag überschreibbar: Wer den Wert aus der amtlichen
 * Tabelle abliest, trägt ihn ein, und gerechnet wird mit seinem. Das Programm
 * sagt dann, wie weit es selbst daneben lag — damit eine systematische
 * Abweichung auffällt, statt sich zwölf Monate lang zu wiederholen.
 */

/** §105 Nr. 1 SGB III: mit mindestens einem Kind im Sinne des §32 EStG. */
export const LEISTUNGSSATZ_MIT_KIND = 0.67
/** §105 Nr. 2 SGB III: alle übrigen. */
export const LEISTUNGSSATZ_OHNE_KIND = 0.60

/** §153 Abs. 1 Satz 2 Nr. 1 SGB III: pauschalierte Sozialversicherung. */
export const SV_PAUSCHALE = 0.20

/**
 * Das fiktive Entgelt: 80 % des Unterschieds zwischen Soll und Ist
 * (§232a Abs. 2 SGB V, §163 Abs. 6 SGB VI, §57 Abs. 1 SGB XI).
 */
export const FIKTIV_ANTEIL = 0.80

export interface KugPerson {
  /** Was ohne den Arbeitsausfall verdient worden wäre, ohne Mehrarbeit */
  sollEntgelt: number
  /** Was tatsächlich verdient wurde, mit Mehrarbeit */
  istEntgelt: number
  /** §105 SGB III: mindestens ein Kind — dann 67 % statt 60 % */
  mitKind: boolean
  steuerklasse: Steuerklasse
  /** Nur für den Solidaritätszuschlag von Belang */
  kinderfreibetraege?: number
  versicherung: 'GKV' | 'PKV'
  zusatzbeitragProzent?: number
  bundesland?: string
  hatKinder?: boolean
  kinderUnter25?: number
  /** Nicht rentenversicherungspflichtig (Versorgungswerk) */
  rvExempt?: boolean
  /**
   * Der Betrag aus der amtlichen Tabelle, falls abgelesen. Ist er gesetzt,
   * gilt er — gerechnet wird trotzdem, um die Abweichung zu zeigen.
   */
  kugAusTabelle?: number | null
}

export interface KugErgebnis {
  /** Sollentgelt nach der Deckelung auf die Beitragsbemessungsgrenze */
  sollGedeckelt: number
  istGedeckelt: number
  /** Pauschaliertes Nettoentgelt aus dem Sollentgelt */
  nettoSoll: number
  nettoIst: number
  nettoDifferenz: number
  leistungssatz: number
  /** Das rechnerische Kurzarbeitergeld */
  kugGerechnet: number
  /** Der Betrag, der ausgezahlt wird — aus der Tabelle, sonst der gerechnete */
  kug: number
  /** Woher der ausgezahlte Betrag stammt */
  quelle: 'gerechnet' | 'tabelle'
  /** Entgeltausfall in Prozent des Sollentgelts — §96 SGB III */
  ausfallProzent: number
  /** Das fiktive Entgelt, auf das Beiträge anfallen */
  fiktivEntgelt: number
  /** Die Beiträge darauf — vom Arbeitgeber allein zu tragen */
  beitraege: KugBeitraege
  hinweise: string[]
}

export interface KugBeitraege {
  rv: number
  kv: number
  pv: number
  /** Arbeitslosenversicherung: auf Kurzarbeitergeld fallen keine Beiträge an */
  av: 0
  gesamt: number
}

/**
 * Das pauschalierte Nettoentgelt (§153 SGB III).
 *
 * Nicht das echte Netto: Es wird mit einer Sozialversicherungspauschale von
 * 20 % gerechnet, unabhängig davon, was tatsächlich abgeführt wird, und OHNE
 * Kirchensteuer. Das Gesetz will eine einfache, für alle gleiche Größe — kein
 * Abbild der einzelnen Abrechnung.
 */
export function pauschaliertesNetto(
  brutto: number,
  p: Pick<KugPerson,
    'steuerklasse' | 'kinderfreibetraege' | 'versicherung'
    | 'zusatzbeitragProzent' | 'bundesland' | 'hatKinder' | 'kinderUnter25'
    | 'rvExempt'>,
  jahr: Lohnjahr,
): number {
  const b = Math.max(0, brutto)
  if (b === 0) return 0

  const steuer = lohnsteuerBerechnen({
    jahr: jahr.jahr,
    steuerBruttoMonat: b,
    steuerklasse: p.steuerklasse,
    kinderfreibetraege: Math.max(0, p.kinderfreibetraege ?? 0),
    zusatzbeitragProzent:
      p.zusatzbeitragProzent ?? jahr.kvZusatzSatzDurchschnitt * 100,
    versicherung: p.versicherung,
    // Die Kirchensteuer bleibt außen vor: §153 Abs. 1 Satz 2 SGB III nennt
    // nur Lohnsteuer und Solidaritätszuschlag.
    kirchensteuer: false,
    bundesland: p.bundesland,
    hatKinder: p.hatKinder,
    kinderUnter25: p.kinderUnter25,
    rentenversicherungspflichtig: !p.rvExempt,
  })

  return runde(b - b * SV_PAUSCHALE - steuer.lohnsteuer - steuer.soli)
}

/**
 * Die Beiträge auf das fiktive Entgelt.
 *
 * Der Arbeitgeber trägt sie ALLEIN (§249 Abs. 2 SGB V, §168 Abs. 1 Nr. 1a
 * SGB VI, §58 Abs. 1 SGB XI). Die Erstattung durch die Agentur, die es in der
 * Pandemie gab, ist ausgelaufen — es ist echter Aufwand des Betriebs, und
 * genau deshalb steht er hier und nicht im Kleingedruckten.
 *
 * Zur Arbeitslosenversicherung: Auf Kurzarbeitergeld fallen keine Beiträge an.
 * Der Beschäftigte bleibt versichert, weil das Beschäftigungsverhältnis
 * fortbesteht, nicht wegen eines Beitrags.
 */
export function beitraegeAufFiktivEntgelt(
  fiktivEntgelt: number,
  p: Pick<KugPerson, 'versicherung' | 'zusatzbeitragProzent' | 'rvExempt'>,
  jahr: Lohnjahr,
): KugBeitraege {
  const e = Math.max(0, fiktivEntgelt)
  const rv = p.rvExempt ? 0 : runde(Math.min(e, jahr.bbgRvAvMonat) * jahr.rvSatz)

  // Privat Versicherte: Der Betrieb zahlt keinen Beitrag an eine gesetzliche
  // Kasse. Er schuldet dem Beschäftigten weiterhin seinen Zuschuss zur
  // privaten Versicherung, und der hängt nicht am fiktiven Entgelt.
  const kvBasis = Math.min(e, jahr.bbgKvPvMonat)
  const zusatz =
    (p.zusatzbeitragProzent ?? jahr.kvZusatzSatzDurchschnitt * 100) / 100
  const kv = p.versicherung === 'GKV'
    ? runde(kvBasis * (jahr.kvBasisSatz + zusatz))
    : 0
  const pv = p.versicherung === 'GKV' ? runde(kvBasis * jahr.pvSatz) : 0

  return { rv, kv, pv, av: 0, gesamt: runde(rv + kv + pv) }
}

/**
 * Ein Monat Kurzarbeit für eine Person.
 */
export function rechne(p: KugPerson, jahr: Lohnjahr): KugErgebnis {
  const hinweise: string[] = []

  // §106 Abs. 1 SGB III: Beide Größen sind auf die Beitragsbemessungsgrenze
  // der Rentenversicherung gedeckelt. Wer das vergisst, zahlt bei
  // Gutverdienern zu viel aus und bekommt es nicht erstattet.
  const soll = Math.max(0, p.sollEntgelt)
  const ist = Math.max(0, p.istEntgelt)
  const sollGedeckelt = runde(Math.min(soll, jahr.bbgRvAvMonat))
  const istGedeckelt = runde(Math.min(ist, jahr.bbgRvAvMonat))
  if (soll > jahr.bbgRvAvMonat) {
    hinweise.push(
      `Das Sollentgelt liegt über der Beitragsbemessungsgrenze `
      + `(${euro(jahr.bbgRvAvMonat)}) und wird darauf begrenzt `
      + '(§106 Abs. 1 SGB III).',
    )
  }

  const leistungssatz = p.mitKind
    ? LEISTUNGSSATZ_MIT_KIND : LEISTUNGSSATZ_OHNE_KIND

  if (istGedeckelt >= sollGedeckelt) {
    // Kein Ausfall heißt kein Kurzarbeitergeld. Das ist kein Fehler, sondern
    // der Normalfall in jedem Monat ohne Arbeitsausfall.
    return {
      sollGedeckelt, istGedeckelt,
      nettoSoll: 0, nettoIst: 0, nettoDifferenz: 0,
      leistungssatz,
      kugGerechnet: 0, kug: 0, quelle: 'gerechnet',
      ausfallProzent: 0,
      fiktivEntgelt: 0,
      beitraege: { rv: 0, kv: 0, pv: 0, av: 0, gesamt: 0 },
      hinweise: istGedeckelt > sollGedeckelt
        ? [...hinweise,
          'Das Istentgelt liegt über dem Sollentgelt. Es wird kein '
          + 'Kurzarbeitergeld gezahlt. Sollte im Monat Mehrarbeit angefallen '
          + 'sein: Sie gehört ins Istentgelt, nicht ins Sollentgelt.']
        : hinweise,
    }
  }

  const nettoSoll = pauschaliertesNetto(sollGedeckelt, p, jahr)
  const nettoIst = pauschaliertesNetto(istGedeckelt, p, jahr)
  const nettoDifferenz = runde(Math.max(0, nettoSoll - nettoIst))
  const kugGerechnet = runde(nettoDifferenz * leistungssatz)

  const ausTabelle = p.kugAusTabelle != null && p.kugAusTabelle >= 0
    ? runde(p.kugAusTabelle) : null
  const kug = ausTabelle ?? kugGerechnet
  const abweichung = ausTabelle != null ? runde(ausTabelle - kugGerechnet) : 0
  if (ausTabelle != null && Math.abs(abweichung) >= 0.01) {
    hinweise.push(
      `Ausgezahlt wird der eingetragene Betrag aus der amtlichen Tabelle `
      + `(${euro(ausTabelle)}). Gerechnet hätte das Programm `
      + `${euro(kugGerechnet)} — ${abweichung > 0 ? '+' : ''}`
      + `${euro(abweichung)} Unterschied. Wiederholt sich das in jedem Monat, `
      + 'stimmt eine der Eingaben nicht.',
    )
  }

  const ausfallProzent = sollGedeckelt > 0
    ? runde((sollGedeckelt - istGedeckelt) / sollGedeckelt * 100) : 0
  // §96 Abs. 1 Nr. 4 SGB III: Ein Entgeltausfall von 10 % oder weniger zählt
  // für die Betriebsschwelle nicht mit. Kurzarbeitergeld bekommt die Person
  // trotzdem — die Schwelle betrifft den Betrieb, nicht den Einzelnen.
  if (ausfallProzent <= 10) {
    hinweise.push(
      `Der Entgeltausfall beträgt ${ausfallProzent.toLocaleString('de-DE', {
        maximumFractionDigits: 1,
      })} %. Für die Betriebsschwelle des §96 Abs. 1 Nr. 4 SGB III zählen nur `
      + 'Beschäftigte mit mehr als 10 % Ausfall mit.',
    )
  }

  const fiktivEntgelt = runde((sollGedeckelt - istGedeckelt) * FIKTIV_ANTEIL)
  const beitraege = beitraegeAufFiktivEntgelt(fiktivEntgelt, p, jahr)

  hinweise.push(
    'Kurzarbeitergeld ist steuerfrei (§3 Nr. 2a EStG), unterliegt aber dem '
    + 'Progressionsvorbehalt (§32b EStG): Es gehört in die '
    + 'Lohnsteuerbescheinigung und erhöht den Steuersatz auf das übrige '
    + 'Einkommen.',
  )
  if (beitraege.gesamt > 0) {
    hinweise.push(
      `Auf das fiktive Entgelt von ${euro(fiktivEntgelt)} fallen `
      + `${euro(beitraege.gesamt)} Sozialversicherung an. Diese Beiträge trägt `
      + 'der Arbeitgeber allein (§249 Abs. 2 SGB V, §168 Abs. 1 Nr. 1a SGB VI) '
      + 'und bekommt sie nicht erstattet — die Erstattung aus der Pandemie ist '
      + 'ausgelaufen.',
    )
  }

  return {
    sollGedeckelt, istGedeckelt,
    nettoSoll, nettoIst, nettoDifferenz,
    leistungssatz,
    kugGerechnet, kug, quelle: ausTabelle != null ? 'tabelle' : 'gerechnet',
    ausfallProzent,
    fiktivEntgelt,
    beitraege,
    hinweise,
  }
}

/**
 * Die Frist, die am häufigsten verpasst wird.
 *
 * §109 Abs. 1 SGB III: Der Leistungsantrag muss innerhalb von drei Monaten
 * nach Ablauf des Kalendermonats gestellt sein, für den er gilt. Die Frist ist
 * eine AUSSCHLUSSfrist — danach ist das Geld weg, ohne Nachsicht und ohne
 * Wiedereinsetzung im Regelfall.
 */
export function antragsfrist(jahr: number, monat: number): string {
  // Ablauf des Kalendermonats plus drei Monate. Der 30./31. wird vom
  // Datumsobjekt selbst auf den letzten Tag des Zielmonats geführt.
  const ende = new Date(Date.UTC(jahr, monat + 3, 0))
  return ende.toISOString().slice(0, 10)
}

/** Ist die Ausschlussfrist für diesen Abrechnungsmonat schon abgelaufen? */
export function fristAbgelaufen(
  jahr: number, monat: number, heute = new Date(),
): boolean {
  return heute.toISOString().slice(0, 10) > antragsfrist(jahr, monat)
}

/** Wie viele Tage bleiben noch — negativ, wenn sie vorbei sind. */
export function tageBisFrist(
  jahr: number, monat: number, heute = new Date(),
): number {
  const frist = new Date(`${antragsfrist(jahr, monat)}T00:00:00Z`).getTime()
  const jetzt = new Date(heute.toISOString().slice(0, 10) + 'T00:00:00Z').getTime()
  return Math.round((frist - jetzt) / 86400000)
}

/**
 * Die Betriebsschwelle (§96 Abs. 1 Nr. 4 SGB III).
 *
 * Erheblich ist der Arbeitsausfall nur, wenn mindestens ein Drittel der
 * Beschäftigten von mehr als 10 % Entgeltausfall betroffen ist. In den
 * Krisenjahren war die Schwelle auf 10 % der Beschäftigten abgesenkt; diese
 * Sonderregelung ist ausgelaufen. Das Programm rechnet nach dem Dauerrecht und
 * sagt dazu, was es gerechnet hat.
 */
export const SCHWELLE_ANTEIL = 1 / 3

export function schwelleErreicht(
  ausfaelleProzent: number[],
): { betroffen: number; gesamt: number; anteil: number; erreicht: boolean } {
  const gesamt = ausfaelleProzent.length
  const betroffen = ausfaelleProzent.filter(a => a > 10).length
  const anteil = gesamt > 0 ? betroffen / gesamt : 0
  return {
    betroffen, gesamt, anteil,
    erreicht: gesamt > 0 && anteil >= SCHWELLE_ANTEIL - 1e-9,
  }
}

export function runde(betrag: number): number {
  return Math.round((betrag + Number.EPSILON) * 100) / 100
}

function euro(betrag: number): string {
  return `${betrag.toLocaleString('de-DE', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })} €`
}
