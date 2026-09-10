import { describe, it, expect } from 'vitest'
import { calculatePayroll, type PayrollInput } from '../payroll-engine'

/**
 * §115 Diese Zahlen landen auf einer Lohnabrechnung, in der Buchhaltung des
 * Steuerberaters und als Überweisung auf einem Konto. Deshalb wird hier gegen
 * die Vorgaben des Gesetzes gerechnet und nicht gegen das, was das Programm
 * gerade ausgibt.
 *
 * Nachgerechnet nach §32a EStG 2025 (Grundfreibetrag 12.096 €),
 * §39b Abs.2 EStG (Vorsorgepauschale) und §51a EStG (Kinderfreibetrag nur für
 * Soli und Kirchensteuer).
 */

const basis: PayrollInput = {
  monthlyWage: 3400,
  regularHours: 151.67, overtimeHours: 0,
  nightHours: 0, sundayHours: 0, holidayHours: 0, saturdayHours: 0,
  vacationDays: 0, sickDays: 0,
  taxClass: 1, childCount: 0,
  insuranceType: 'GKV', churchTax: false,
  bundesland: 'Nordrhein-Westfalen',
}

describe('Sozialversicherung', () => {
  const r = calculatePayroll({ ...basis, zusatzbeitragPercent: 1.7 })

  it('teilt Renten- und Arbeitslosenversicherung hälftig', () => {
    expect(r.rvAN).toBeCloseTo(3400 * 0.093, 2)   // 316,20
    expect(r.rvAG).toBeCloseTo(r.rvAN, 2)
    expect(r.avAN).toBeCloseTo(3400 * 0.013, 2)   // 44,20
  })

  it('rechnet die Krankenversicherung mit dem Zusatzbeitrag der Kasse', () => {
    // (14,6 % + 1,7 %) / 2 = 8,15 %
    expect(r.kvAN).toBeCloseTo(3400 * 0.0815, 2)  // 277,10
  })

  it('belastet Kinderlose in der Pflegeversicherung zusätzlich', () => {
    const ohneKind = calculatePayroll({ ...basis, childCount: 0 })
    const mitKind = calculatePayroll({ ...basis, childCount: 1 })
    expect(ohneKind.pvAN).toBeCloseTo(3400 * (0.018 + 0.006), 2)  // 81,60
    expect(mitKind.pvAN).toBeCloseTo(3400 * 0.018, 2)             // 61,20
    // Der Zuschlag trägt allein der Arbeitnehmer
    expect(ohneKind.pvAG).toBeCloseTo(mitKind.pvAG, 2)
  })

  it('deckelt die Beiträge an den Beitragsbemessungsgrenzen', () => {
    const hoch = calculatePayroll({ ...basis, monthlyWage: 12000 })
    expect(hoch.rvAN).toBeCloseTo(8050 * 0.093, 2)
    expect(hoch.kvAN).toBeCloseTo(5512.5 * 0.0815, 1)
  })
})

describe('Lohnsteuer', () => {
  it('zieht den Grundfreibetrag nicht doppelt ab', () => {
    // Vorsorgepauschale: RV 40.800 · 9,3 % = 3.794,40
    //   + KV 40.800 · (7 % + 0,85 %) = 3.202,80
    //   + PV 40.800 · 2,4 % (kinderlos) = 979,20   → zusammen 7.976,40
    // zvE = 40.800 − 1.230 − 36 − 7.976,40 = 31.557
    // §32a: y = (31.557 − 17.443)/10.000 = 1,4114
    //       (176,64 · 1,4114 + 2397) · 1,4114 + 1015,13 = 4.750
    const r = calculatePayroll({ ...basis, zusatzbeitragPercent: 1.7 })
    expect(r.lohnsteuerMonthly).toBeCloseTo(4750 / 12, 1)
  })

  it('rechnet Steuerklasse III nach dem Splittingverfahren', () => {
    // zvE 31.802 (höhere Mindestvorsorge-Grenze wirkt hier nicht)
    // 2 · §32a(15.901) = 2 · 667 = 1.334
    const r = calculatePayroll({
      ...basis, taxClass: 3, childCount: 1, zusatzbeitragPercent: 1.7,
    })
    expect(r.lohnsteuerMonthly).toBeCloseTo(1334 / 12, 1)
  })

  it('besteuert Klasse III milder als Klasse I bei gleichem Lohn', () => {
    const eins = calculatePayroll({ ...basis, taxClass: 1 })
    const drei = calculatePayroll({ ...basis, taxClass: 3 })
    expect(drei.lohnsteuerMonthly).toBeLessThan(eins.lohnsteuerMonthly)
  })

  it('entlastet Steuerklasse II um den Alleinerziehendenbetrag', () => {
    const eins = calculatePayroll({ ...basis, taxClass: 1, childCount: 1 })
    const zwei = calculatePayroll({ ...basis, taxClass: 2, childCount: 1 })
    expect(zwei.lohnsteuerMonthly).toBeLessThan(eins.lohnsteuerMonthly)
  })

  it('besteuert Klasse V und VI härter als Klasse I', () => {
    const eins = calculatePayroll({ ...basis, taxClass: 1 })
    const fuenf = calculatePayroll({ ...basis, taxClass: 5 })
    const sechs = calculatePayroll({ ...basis, taxClass: 6 })
    expect(fuenf.lohnsteuerMonthly).toBeGreaterThan(eins.lohnsteuerMonthly)
    expect(sechs.lohnsteuerMonthly).toBeGreaterThan(eins.lohnsteuerMonthly)
  })

  it('hält Klasse V bei mindestens 14 Prozent des zu versteuernden Betrags', () => {
    const r = calculatePayroll({ ...basis, monthlyWage: 1600, taxClass: 5 })
    expect(r.lohnsteuerMonthly).toBeGreaterThan(0)
  })

  it('lässt bei kleinem Einkommen keine Lohnsteuer entstehen', () => {
    const r = calculatePayroll({ ...basis, monthlyWage: 1100, taxClass: 1 })
    expect(r.lohnsteuerMonthly).toBe(0)
  })

  it('steigt mit dem Bruttolohn', () => {
    const werte = [2000, 3000, 4000, 6000, 10000].map(
      w => calculatePayroll({ ...basis, monthlyWage: w }).lohnsteuerMonthly,
    )
    for (let i = 1; i < werte.length; i++) expect(werte[i]).toBeGreaterThan(werte[i - 1])
  })
})

describe('Kinderfreibetrag, Soli und Kirchensteuer', () => {
  it('mindert die Lohnsteuer NICHT — dafür gibt es das Kindergeld (§51a EStG)', () => {
    // Ein Kind und zwei Kinder: der Pflegeversicherungssatz ist derselbe, also
    // bleibt auch die Vorsorgepauschale gleich. Bliebe ein Unterschied in der
    // Lohnsteuer, wäre der Kinderfreibetrag fälschlich dort verrechnet worden.
    const eins = calculatePayroll({ ...basis, taxClass: 4, childCount: 1 })
    const zwei = calculatePayroll({ ...basis, taxClass: 4, childCount: 2 })
    expect(zwei.lohnsteuerMonthly).toBe(eins.lohnsteuerMonthly)
  })

  it('mindert aber die Kirchensteuer', () => {
    const eins = calculatePayroll({ ...basis, taxClass: 4, childCount: 1, churchTax: true })
    const zwei = calculatePayroll({ ...basis, taxClass: 4, childCount: 2, churchTax: true })
    expect(zwei.kirchensteuerMonthly).toBeLessThan(eins.kirchensteuerMonthly)
  })

  it('nimmt 8 Prozent in Bayern und Baden-Württemberg, sonst 9', () => {
    const nrw = calculatePayroll({ ...basis, churchTax: true, bundesland: 'Nordrhein-Westfalen' })
    const bay = calculatePayroll({ ...basis, churchTax: true, bundesland: 'Bayern' })
    expect(nrw.kirchensteuerMonthly / bay.kirchensteuerMonthly).toBeCloseTo(9 / 8, 2)
  })

  it('erhebt ohne Konfession keine Kirchensteuer', () => {
    expect(calculatePayroll({ ...basis, churchTax: false }).kirchensteuerMonthly).toBe(0)
  })

  it('lässt den Soli unter der Freigrenze weg', () => {
    expect(calculatePayroll({ ...basis, monthlyWage: 3400 }).soliMonthly).toBe(0)
  })

  it('erhebt den Soli erst bei hohem Einkommen und höchstens 5,5 Prozent', () => {
    const r = calculatePayroll({ ...basis, monthlyWage: 12000 })
    expect(r.soliMonthly).toBeGreaterThan(0)
    expect(r.soliMonthly).toBeLessThanOrEqual(r.lohnsteuerMonthly * 0.055 + 0.01)
  })
})

describe('Steuerfreie Zuschläge (§3b EStG)', () => {
  // Stundenlöhner: 20 €/h, 24 Stunden, davon 8 h Nacht und 8 h Sonntag
  const stundenlohn: PayrollInput = {
    ...basis, monthlyWage: undefined, hourlyWage: 20,
    regularHours: 24, overtimeHours: 0,
    nightHours: 8, nightSurcharge: 8 * 20 * 0.25,      // 40,00 — genau der Höchstsatz
    sundayHours: 8, sundaySurcharge: 8 * 20 * 0.5,     // 80,00 — genau der Höchstsatz
  }

  it('stellt Nacht- und Sonntagszuschlag bis zum Höchstsatz frei', () => {
    const r = calculatePayroll(stundenlohn)
    expect(r.steuerfreieZuschlaege).toBeCloseTo(120, 2)
    expect(r.steuerBrutto).toBeCloseTo(480, 2)   // 24 h · 20 € — die Zuschläge bleiben draußen
    expect(r.brutto).toBeCloseTo(600, 2)         // ausgezahlt wird trotzdem alles
  })

  it('versteuert den Teil über dem Höchstsatz', () => {
    // 50 % Nachtzuschlag statt 25 % — die Hälfte davon ist steuerpflichtig
    const r = calculatePayroll({ ...stundenlohn, nightSurcharge: 8 * 20 * 0.5 })
    expect(r.steuerfreieZuschlaege).toBeCloseTo(40 + 80, 2)
    expect(r.steuerBrutto).toBeCloseTo(480 + 40, 2)
  })

  it('stellt Samstagszuschläge NICHT frei — dafür gibt es keine Vorschrift', () => {
    const r = calculatePayroll({
      ...stundenlohn, nightSurcharge: 0, nightHours: 0, sundaySurcharge: 0, sundayHours: 0,
      saturdayHours: 8, saturdaySurcharge: 8 * 20 * 0.2,
    })
    expect(r.steuerfreieZuschlaege).toBe(0)
    expect(r.steuerBrutto).toBeCloseTo(r.brutto, 2)
  })

  it('lässt Feiertagszuschläge bis 125 Prozent frei', () => {
    const r = calculatePayroll({
      ...stundenlohn, nightSurcharge: 0, nightHours: 0, sundaySurcharge: 0, sundayHours: 0,
      holidayHours: 8, holidaySurcharge: 8 * 20 * 1.25,
    })
    expect(r.steuerfreieZuschlaege).toBeCloseTo(200, 2)
  })

  it('zieht bei hohem Grundlohn die Beitragsfreiheit früher als die Steuerfreiheit ab', () => {
    // Grundlohn 40 €/h: steuerfrei bis 40 €, beitragsfrei nur bis 25 €
    const r = calculatePayroll({
      ...stundenlohn, hourlyWage: 40,
      nightSurcharge: 8 * 40 * 0.25, sundaySurcharge: 8 * 40 * 0.5,
    })
    expect(r.steuerfreieZuschlaege).toBeCloseTo(8 * 40 * 0.75, 2)  // 240
    expect(r.svfreieZuschlaege).toBeCloseTo(8 * 25 * 0.75, 2)      // 150
    expect(r.svBrutto).toBeGreaterThan(r.steuerBrutto)
  })

  it('senkt die Lohnsteuer gegenüber voll versteuerten Zuschlägen', () => {
    const mitFreistellung = calculatePayroll(stundenlohn)
    const ohneAngabe = calculatePayroll({ ...stundenlohn, nightHours: 0, sundayHours: 0 })
    expect(mitFreistellung.lohnsteuerMonthly).toBeLessThanOrEqual(ohneAngabe.lohnsteuerMonthly)
    expect(mitFreistellung.netto).toBeGreaterThanOrEqual(ohneAngabe.netto)
  })

  it('versteuert vorsichtshalber alles, wenn der Grundlohn unbekannt ist', () => {
    const r = calculatePayroll({
      ...basis, monthlyWage: undefined, hourlyWage: undefined,
      regularHours: 0, nightHours: 8, nightSurcharge: 40,
    })
    expect(r.steuerfreieZuschlaege).toBe(0)
    expect(r.warnings.join(' ')).toMatch(/§3b/)
  })

  it('leitet den Grundlohn beim Monatsgehalt aus den Stunden ab', () => {
    const r = calculatePayroll({
      ...basis, monthlyWage: 3400, regularHours: 170, overtimeHours: 0,
      nightHours: 10, nightSurcharge: 50,
    })
    // 3400 / 170 = 20 €/h → steuerfrei bis 10 · 20 · 25 % = 50 €
    expect(r.steuerfreieZuschlaege).toBeCloseTo(50, 2)
  })
})

describe('Brutto, Netto und Arbeitgeberkosten', () => {
  it('addiert Zuschläge zum Brutto', () => {
    const r = calculatePayroll({ ...basis, nightSurcharge: 120, sundaySurcharge: 80, otherSurcharge: 25 })
    expect(r.surchargesTotal).toBeCloseTo(225, 2)
    expect(r.brutto).toBeCloseTo(3625, 2)
  })

  it('rechnet Stundenlöhner nach geleisteten Stunden ab', () => {
    const r = calculatePayroll({
      ...basis, monthlyWage: undefined, hourlyWage: 18, regularHours: 150, overtimeHours: 10,
    })
    expect(r.brutto).toBeCloseTo(160 * 18, 2)
  })

  it('ergibt Netto = Brutto minus aller Abzüge', () => {
    const r = calculatePayroll({ ...basis, churchTax: true, zusatzbeitragPercent: 1.7 })
    const summe = r.rvAN + r.kvAN + r.pvAN + r.avAN
      + r.lohnsteuerMonthly + r.kirchensteuerMonthly + r.soliMonthly
    expect(r.totalDeductions).toBeCloseTo(summe, 2)
    expect(r.netto).toBeCloseTo(r.brutto - r.totalDeductions, 2)
  })

  it('lässt vom Brutto etwas übrig', () => {
    const r = calculatePayroll(basis)
    expect(r.netto).toBeGreaterThan(r.brutto * 0.5)
    expect(r.netto).toBeLessThan(r.brutto)
  })

  it('weist die Arbeitgeberkosten über dem Brutto aus', () => {
    const r = calculatePayroll({ ...basis, zusatzbeitragPercent: 1.7 })
    expect(r.totalAgCost).toBeCloseTo(r.brutto + r.rvAG + r.kvAG + r.pvAG + r.avAG, 2)
    expect(r.totalAgCost).toBeGreaterThan(r.brutto)
  })

  it('warnt beim Minijob statt still falsch zu rechnen', () => {
    const r = calculatePayroll({ ...basis, monthlyWage: 500 })
    expect(r.warnings.join(' ')).toMatch(/Minijob/)
  })

  it('warnt, wenn weder Stundenlohn noch Gehalt hinterlegt ist', () => {
    const r = calculatePayroll({ ...basis, monthlyWage: undefined, hourlyWage: undefined })
    expect(r.brutto).toBe(0)
    expect(r.warnings.length).toBeGreaterThan(0)
  })
})
