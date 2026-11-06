/**
 * §122 Teilmonate: wer mitten im Monat kommt oder geht.
 *
 * Hat jeder Kunde, und bisher stimmte davon nichts. Wer am 15. anfängt, bekam
 * das volle Monatsgehalt, und die Beitragsbemessungsgrenzen galten für den
 * ganzen Monat, obwohl er nur zur Hälfte beschäftigt war.
 *
 * Die Sozialversicherung rechnet nicht in Kalendertagen, sondern in SV-TAGEN.
 * Das ist eine eigene Zählweise mit zwei Eigenheiten, die man kennen muss:
 *
 *   Jeder volle Monat hat 30 SV-Tage — auch der Februar, auch der Januar.
 *   Der 31. eines Monats zählt nicht mit.
 *   Ein Teilmonat, der am Monatsende ausläuft, wird im Februar auf 30
 *   aufgefüllt.
 *
 * Warum das wichtig ist: nur so ergeben zwei Teilmonate zusammen wieder genau
 * 30. Der 1.–14. Februar sind 14 SV-Tage, der 15.–28. sind 16 — zusammen 30.
 * Wer stattdessen Kalendertage zählt, kommt auf 28 und verbeitragt zu wenig.
 */

/** Letzter Kalendertag eines Monats. */
export function letzterTag(jahr: number, monat: number): number {
  return new Date(Date.UTC(jahr, monat, 0)).getUTCDate()
}

/** Der Tag im Monat, falls das Datum in diesen Monat fällt — sonst null. */
function tagImMonat(datum: string | null | undefined, jahr: number, monat: number): number | null {
  if (!datum || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) return null
  const [j, m, t] = datum.split('-').map(Number)
  return j === jahr && m === monat ? t : null
}

/** Liegt das Datum vor dem Monat? */
function vorDemMonat(datum: string | null | undefined, jahr: number, monat: number): boolean {
  if (!datum || !/^\d{4}-\d{2}/.test(datum)) return false
  const [j, m] = datum.split('-').map(Number)
  return j < jahr || (j === jahr && m < monat)
}

/** Liegt das Datum nach dem Monat? */
function nachDemMonat(datum: string | null | undefined, jahr: number, monat: number): boolean {
  if (!datum || !/^\d{4}-\d{2}/.test(datum)) return false
  const [j, m] = datum.split('-').map(Number)
  return j > jahr || (j === jahr && m > monat)
}

export interface TeilmonatErgebnis {
  /** SV-Tage des Monats, 0 bis 30 */
  svTage: number
  /** Anteil am vollen Monat, 0 bis 1 */
  anteil: number
  /** Ist der Monat voll beschäftigt? */
  vollerMonat: boolean
  /** Beschäftigt der Mitarbeiter in diesem Monat überhaupt? */
  beschaeftigt: boolean
  erster?: number
  letzter?: number
}

/**
 * SV-Tage eines Mitarbeiters in einem Monat.
 *
 * `eintritt` und `austritt` sind Datumsangaben (YYYY-MM-DD) oder leer. Der
 * Austrittstag zählt mit — das Arbeitsverhältnis endet mit Ablauf des Tages.
 */
export function svTageImMonat(
  jahr: number,
  monat: number,
  eintritt?: string | null,
  austritt?: string | null,
): TeilmonatErgebnis {
  const letzterKalendertag = letzterTag(jahr, monat)

  // Gar nicht beschäftigt in diesem Monat
  if (nachDemMonat(eintritt, jahr, monat) || vorDemMonat(austritt, jahr, monat)) {
    return { svTage: 0, anteil: 0, vollerMonat: false, beschaeftigt: false }
  }

  const eintrittTag = tagImMonat(eintritt, jahr, monat)
  const austrittTag = tagImMonat(austritt, jahr, monat)

  const erster = eintrittTag ?? 1
  const letzter = austrittTag ?? letzterKalendertag

  if (letzter < erster) {
    return { svTage: 0, anteil: 0, vollerMonat: false, beschaeftigt: false }
  }

  // Der volle Monat sind immer 30 SV-Tage — unabhängig davon, wie viele
  // Kalendertage er wirklich hat.
  if (erster === 1 && letzter === letzterKalendertag) {
    return { svTage: 30, anteil: 1, vollerMonat: true, beschaeftigt: true, erster, letzter }
  }

  let tage = letzter - erster + 1
  // Der 31. zählt nicht mit
  if (letzter === 31) tage -= 1
  // Ein Teilmonat, der am Monatsende ausläuft, wird auf 30 aufgefüllt —
  // sonst ergäben zwei Teilmonate im Februar zusammen nur 28.
  if (letzter === letzterKalendertag && letzterKalendertag < 30) {
    tage += 30 - letzterKalendertag
  }
  tage = Math.max(0, Math.min(30, tage))

  return {
    svTage: tage,
    anteil: Math.round(tage / 30 * 10000) / 10000,
    vollerMonat: false,
    beschaeftigt: tage > 0,
    erster, letzter,
  }
}

/**
 * Anteiliges Monatsgehalt bei einem Teilmonat.
 *
 * Gerechnet nach der Dreißigstel-Methode, also mit denselben SV-Tagen wie die
 * Beiträge. Das ist die verbreitete Rechenweise und hält Entgelt und Beitrag
 * beieinander.
 *
 * Ein Arbeitsvertrag kann stattdessen die kalendertägliche Methode vorsehen
 * (Gehalt × tatsächliche Kalendertage ÷ Kalendertage des Monats). Wenn ein
 * Kunde das so vereinbart hat, gehört es hierher — bis dahin gilt die eine,
 * dokumentierte Regel statt zwei stillen.
 */
export function anteiligesEntgelt(monatsgehalt: number, teil: TeilmonatErgebnis): number {
  if (teil.vollerMonat) return monatsgehalt
  return Math.round(monatsgehalt * teil.anteil * 100) / 100
}

/** Anteilige Beitragsbemessungsgrenze — sie gilt nur für die Tage der Beschäftigung. */
export function anteiligeBbg(monatsgrenze: number, teil: TeilmonatErgebnis): number {
  if (teil.vollerMonat) return monatsgrenze
  return Math.round(monatsgrenze * teil.anteil * 100) / 100
}

/**
 * Anteiliger Urlaubsanspruch (§5 BUrlG).
 *
 * Für jeden vollen Monat der Beschäftigung ein Zwölftel des Jahresanspruchs.
 * Bruchteile von mindestens einem halben Tag werden aufgerundet — das schreibt
 * §5 Abs.2 BUrlG so vor, und es ist ein Vorteil des Arbeitnehmers.
 */
export function anteiligerUrlaub(jahresanspruch: number, volleMonate: number): number {
  const monate = Math.max(0, Math.min(12, volleMonate))
  const anspruch = jahresanspruch * monate / 12
  const ganze = Math.floor(anspruch)
  const rest = anspruch - ganze
  return rest >= 0.5 ? ganze + 1 : ganze
}

/**
 * Volle Beschäftigungsmonate im Kalenderjahr.
 *
 * Ein Monat zählt, wenn das Arbeitsverhältnis den ganzen Monat bestand. Für
 * den Urlaubsanspruch zählt §5 BUrlG volle Monate, nicht angebrochene.
 */
export function volleMonateImJahr(
  jahr: number,
  eintritt?: string | null,
  austritt?: string | null,
): number {
  let anzahl = 0
  for (let m = 1; m <= 12; m++) {
    if (svTageImMonat(jahr, m, eintritt, austritt).vollerMonat) anzahl++
  }
  return anzahl
}

/**
 * Urlaubsabgeltung bei Austritt (§7 Abs.4 BUrlG).
 *
 * Nicht genommener Urlaub wird ausgezahlt, wenn er wegen der Beendigung nicht
 * mehr genommen werden kann. Bemessung: das durchschnittliche Arbeitsentgelt
 * der letzten dreizehn Wochen (§11 BUrlG), heruntergerechnet auf den Tag.
 *
 * Die Abgeltung ist ein sonstiger Bezug — sie wird nach der
 * Jahreslohnsteuer-Methode besteuert und ist beitragspflichtig. Deshalb wird
 * hier nur der Betrag gebildet; erfasst wird er als Einmalzahlung.
 */
export function urlaubsabgeltung(
  offeneTage: number,
  durchschnittlichesMonatsentgelt: number,
  arbeitstageProWoche = 5,
): number {
  if (offeneTage <= 0 || durchschnittlichesMonatsentgelt <= 0) return 0
  // Arbeitstage je Monat: Wochenarbeitstage × 13 Wochen ÷ 3 Monate
  const arbeitstageProMonat = arbeitstageProWoche * (13 / 3)
  const tagesentgelt = durchschnittlichesMonatsentgelt / arbeitstageProMonat
  return Math.round(offeneTage * tagesentgelt * 100) / 100
}
