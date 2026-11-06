/**
 * §119 Rückwirkende Aufrollung.
 *
 * Der Fall, um den es geht: Eine Abrechnung ist freigegeben und ausgezahlt.
 * Danach ändert sich etwas an ihrer Grundlage — ein Krankenschein wird
 * nachgereicht, eine Zeitbuchung korrigiert, das Finanzamt meldet rückwirkend
 * eine andere Steuerklasse, eine Gehaltserhöhung gilt ab einem vergangenen
 * Datum.
 *
 * Bisher passierte dann nichts: ein freigegebener Monat wurde nicht mehr
 * angefasst, und die Abrechnung blieb dauerhaft falsch. Das ist kein
 * Randfall — es ist der Normalfall in jedem Betrieb.
 *
 * Zwei Prinzipien treffen aufeinander und werden hier getrennt behandelt:
 *
 *   Lohnsteuer folgt dem ZUFLUSSPRINZIP. Die Differenz wird in dem Monat
 *   versteuert, in dem sie ausgezahlt wird. §41c EStG erlaubt dem Arbeitgeber
 *   ausdrücklich, innerhalb des Jahres aufzurollen.
 *
 *   Sozialversicherung folgt beim laufenden Entgelt dem ENTSTEHUNGSPRINZIP.
 *   Die Beiträge gehören in den Monat, in dem der Anspruch entstanden ist —
 *   also in den korrigierten Monat, nicht in den Auszahlungsmonat. Deshalb
 *   hält jeder Korrekturdatensatz beide Monate fest.
 *
 * Was hier NICHT passiert: eine freigegebene Abrechnung wird niemals
 * überschrieben. Sie bleibt, wie sie unterschrieben wurde. Die Korrektur ist
 * ein eigener, nachvollziehbarer Datensatz daneben.
 */

import type { PayrollResult } from './payroll-engine'

/** Die Werte einer Abrechnung, wie sie für einen Vergleich gebraucht werden. */
export interface AbrechnungsWerte {
  brutto: number
  steuerBrutto: number
  svBrutto: number
  steuerfreieZuschlaege: number
  surchargesTotal: number
  regularHours: number
  overtimeHours: number
  lohnsteuer: number
  kirchensteuer: number
  soli: number
  rvAN: number; kvAN: number; pvAN: number; avAN: number
  rvAG: number; kvAG: number; pvAG: number; avAG: number
  totalDeductions: number
  netto: number
}

export interface Differenz {
  brutto: number
  netto: number
  lohnsteuer: number
  svAN: number
  svAG: number
  /** Welche Posten sich geändert haben — für die Anzeige und den Beleg */
  posten: { feld: string; bezeichnung: string; alt: number; neu: number; differenz: number }[]
}

const BEZEICHNUNG: Record<keyof AbrechnungsWerte, string> = {
  brutto: 'Gesamtbrutto',
  steuerBrutto: 'Steuerpflichtiges Brutto',
  svBrutto: 'Beitragspflichtiges Brutto',
  steuerfreieZuschlaege: 'Steuerfreie Zuschläge',
  surchargesTotal: 'Zuschläge',
  regularHours: 'Stunden',
  overtimeHours: 'Überstunden',
  lohnsteuer: 'Lohnsteuer',
  kirchensteuer: 'Kirchensteuer',
  soli: 'Solidaritätszuschlag',
  rvAN: 'Rentenversicherung AN',
  kvAN: 'Krankenversicherung AN',
  pvAN: 'Pflegeversicherung AN',
  avAN: 'Arbeitslosenversicherung AN',
  rvAG: 'Rentenversicherung AG',
  kvAG: 'Krankenversicherung AG',
  pvAG: 'Pflegeversicherung AG',
  avAG: 'Arbeitslosenversicherung AG',
  totalDeductions: 'Abzüge gesamt',
  netto: 'Netto',
}

/** Cent-genau vergleichen — Gleitkomma erzeugt sonst Geisterdifferenzen. */
const cent = (n: number) => Math.round(n * 100)
const rund = (n: number) => Math.round(n * 100) / 100

export function werteAusErgebnis(r: PayrollResult, stunden: {
  regularHours: number; overtimeHours: number
}): AbrechnungsWerte {
  return {
    brutto: r.brutto,
    steuerBrutto: r.steuerBrutto,
    svBrutto: r.svBrutto,
    steuerfreieZuschlaege: r.steuerfreieZuschlaege,
    surchargesTotal: r.surchargesTotal,
    regularHours: stunden.regularHours,
    overtimeHours: stunden.overtimeHours,
    lohnsteuer: r.lohnsteuerMonthly,
    kirchensteuer: r.kirchensteuerMonthly,
    soli: r.soliMonthly,
    rvAN: r.rvAN, kvAN: r.kvAN, pvAN: r.pvAN, avAN: r.avAN,
    rvAG: r.rvAG, kvAG: r.kvAG, pvAG: r.pvAG, avAG: r.avAG,
    totalDeductions: r.totalDeductions,
    netto: r.netto,
  }
}

/**
 * Zwei Stände vergleichen.
 *
 * Liefert `null`, wenn sich nichts geändert hat — eine Korrektur über null Euro
 * wäre nur Rauschen in der Akte.
 */
export function differenzBilden(
  alt: AbrechnungsWerte,
  neu: AbrechnungsWerte,
): Differenz | null {
  const posten: Differenz['posten'] = []
  for (const feld of Object.keys(BEZEICHNUNG) as (keyof AbrechnungsWerte)[]) {
    const a = alt[feld] ?? 0
    const n = neu[feld] ?? 0
    // Stunden auf zwei Nachkommastellen, Geld auf den Cent
    if (Math.abs(n - a) < 0.005) continue
    posten.push({
      feld, bezeichnung: BEZEICHNUNG[feld],
      alt: rund(a), neu: rund(n), differenz: rund(n - a),
    })
  }

  const svAN = (neu.rvAN + neu.kvAN + neu.pvAN + neu.avAN)
    - (alt.rvAN + alt.kvAN + alt.pvAN + alt.avAN)
  const svAG = (neu.rvAG + neu.kvAG + neu.pvAG + neu.avAG)
    - (alt.rvAG + alt.kvAG + alt.pvAG + alt.avAG)

  const differenz: Differenz = {
    brutto: rund(neu.brutto - alt.brutto),
    netto: rund(neu.netto - alt.netto),
    lohnsteuer: rund(neu.lohnsteuer - alt.lohnsteuer),
    svAN: rund(svAN),
    svAG: rund(svAG),
    posten,
  }

  // Nur wenn wirklich Geld anders ist, entsteht eine Korrektur. Eine reine
  // Stundenverschiebung ohne Geldwirkung braucht keine.
  const relevant = cent(differenz.brutto) !== 0
    || cent(differenz.netto) !== 0
    || cent(differenz.lohnsteuer) !== 0
    || cent(differenz.svAN) !== 0
    || cent(differenz.svAG) !== 0
  return relevant ? differenz : null
}

/**
 * Der Monat, in dem eine Korrektur ausgeglichen wird.
 *
 * Grundsatz: der nächste Monat nach dem korrigierten. Liegt der in der
 * Vergangenheit und ist selbst schon abgeschlossen, wandert der Ausgleich in
 * den laufenden Monat — Geld, das niemand mehr auszahlen kann, hilft keinem.
 */
export function ausgleichsMonat(
  korrigiertJahr: number,
  korrigiertMonat: number,
  heute = new Date(),
): { jahr: number; monat: number } {
  const naechsterMonat = korrigiertMonat === 12 ? 1 : korrigiertMonat + 1
  const naechstesJahr = korrigiertMonat === 12 ? korrigiertJahr + 1 : korrigiertJahr

  const laufendJahr = heute.getFullYear()
  const laufendMonat = heute.getMonth() + 1

  const naechsterIstVorbei =
    naechstesJahr < laufendJahr
    || (naechstesJahr === laufendJahr && naechsterMonat < laufendMonat)

  return naechsterIstVorbei
    ? { jahr: laufendJahr, monat: laufendMonat }
    : { jahr: naechstesJahr, monat: naechsterMonat }
}

/** Kurzfassung einer Korrektur für Anzeige und Beleg. */
export function korrekturText(
  jahr: number, monat: number, differenzNetto: number,
): string {
  const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
  const richtung = differenzNetto >= 0 ? 'Nachzahlung' : 'Rückforderung'
  return `${richtung} aus ${MONATE[monat - 1]} ${jahr}`
}
