import { describe, it, expect } from 'vitest'
import {
  differenzBilden, ausgleichsMonat, korrekturText, werteAusErgebnis,
  type AbrechnungsWerte,
} from '../aufrollung'
import { calculatePayroll, type PayrollInput } from '../payroll-engine'

/**
 * §119 Eine falsch gebildete Korrektur zahlt entweder zu viel aus oder fordert
 * zu Unrecht Geld zurück. Beides fällt beim Mitarbeiter auf, nicht bei uns.
 */

const werte = (ueberschreiben: Partial<AbrechnungsWerte> = {}): AbrechnungsWerte => ({
  brutto: 3400, steuerBrutto: 3400, svBrutto: 3400,
  steuerfreieZuschlaege: 0, surchargesTotal: 0,
  regularHours: 160, overtimeHours: 0,
  lohnsteuer: 388.33, kirchensteuer: 0, soli: 0,
  rvAN: 316.2, kvAN: 277.1, pvAN: 81.6, avAN: 44.2,
  rvAG: 316.2, kvAG: 277.1, pvAG: 61.2, avAG: 44.2,
  totalDeductions: 1107.43, netto: 2292.57,
  ...ueberschreiben,
})

describe('Differenz zwischen zwei Ständen', () => {
  it('meldet keine Korrektur, wenn sich nichts geändert hat', () => {
    expect(differenzBilden(werte(), werte())).toBeNull()
  })

  it('ignoriert Rundungsrauschen unterhalb eines Cents', () => {
    expect(differenzBilden(werte(), werte({ netto: 2292.5701 }))).toBeNull()
  })

  it('erkennt eine Nachzahlung und benennt die Posten', () => {
    const d = differenzBilden(
      werte(),
      werte({ brutto: 3600, netto: 2420, lohnsteuer: 430 }),
    )!
    expect(d).not.toBeNull()
    expect(d.brutto).toBeCloseTo(200, 2)
    expect(d.netto).toBeCloseTo(127.43, 2)
    expect(d.lohnsteuer).toBeCloseTo(41.67, 2)
    const felder = d.posten.map(p => p.feld)
    expect(felder).toContain('brutto')
    expect(felder).toContain('netto')
    expect(felder).toContain('lohnsteuer')
  })

  it('erkennt eine Rückforderung als negative Differenz', () => {
    const d = differenzBilden(werte(), werte({ brutto: 3000, netto: 2050 }))!
    expect(d.brutto).toBeLessThan(0)
    expect(d.netto).toBeLessThan(0)
  })

  it('fasst die Sozialabgaben je Seite zusammen', () => {
    const d = differenzBilden(
      werte(),
      werte({ rvAN: 330, kvAN: 290, netto: 2265.87, rvAG: 330 }),
    )!
    expect(d.svAN).toBeCloseTo((330 - 316.2) + (290 - 277.1), 2)
    expect(d.svAG).toBeCloseTo(330 - 316.2, 2)
  })

  it('legt keine Korrektur an, wenn sich nur Stunden ohne Geldwirkung ändern', () => {
    // Ein Monatsgehalt bleibt gleich, auch wenn die Stundenzahl anders erfasst wird
    const d = differenzBilden(werte(), werte({ regularHours: 155 }))
    expect(d).toBeNull()
  })

  it('nennt alt und neu je Posten, nicht nur die Differenz', () => {
    const d = differenzBilden(werte(), werte({ netto: 2400 }))!
    const netto = d.posten.find(p => p.feld === 'netto')!
    expect(netto.alt).toBeCloseTo(2292.57, 2)
    expect(netto.neu).toBeCloseTo(2400, 2)
    expect(netto.differenz).toBeCloseTo(107.43, 2)
    expect(netto.bezeichnung).toBe('Netto')
  })
})

describe('Ausgleichsmonat', () => {
  it('nimmt den Folgemonat, wenn der noch offen ist', () => {
    const heute = new Date('2026-09-15T00:00:00Z')
    expect(ausgleichsMonat(2026, 8, heute)).toEqual({ jahr: 2026, monat: 9 })
  })

  it('rechnet über den Jahreswechsel', () => {
    const heute = new Date('2027-01-10T00:00:00Z')
    expect(ausgleichsMonat(2026, 12, heute)).toEqual({ jahr: 2027, monat: 1 })
  })

  it('wandert in den laufenden Monat, wenn der Folgemonat längst vorbei ist', () => {
    // März wird im September aufgerollt — April ist längst abgerechnet
    const heute = new Date('2026-09-15T00:00:00Z')
    expect(ausgleichsMonat(2026, 3, heute)).toEqual({ jahr: 2026, monat: 9 })
  })

  it('legt eine Korrektur nicht in die Vergangenheit', () => {
    const heute = new Date('2026-09-15T00:00:00Z')
    const a = ausgleichsMonat(2025, 11, heute)
    expect(a.jahr * 12 + a.monat).toBeGreaterThanOrEqual(2026 * 12 + 9)
  })
})

describe('Text der Korrektur', () => {
  it('unterscheidet Nachzahlung und Rückforderung', () => {
    expect(korrekturText(2026, 3, 120)).toBe('Nachzahlung aus März 2026')
    expect(korrekturText(2026, 3, -120)).toBe('Rückforderung aus März 2026')
  })
})

describe('Aus einer echten Neuberechnung', () => {
  const basis: PayrollInput = {
    jahr: 2026, monthlyWage: 3400,
    regularHours: 160, overtimeHours: 0,
    nightHours: 0, sundayHours: 0, holidayHours: 0, saturdayHours: 0,
    vacationDays: 0, sickDays: 0,
    taxClass: 1, childCount: 0,
    insuranceType: 'GKV', churchTax: false, zusatzbeitragPercent: 1.7,
    bundesland: 'Nordrhein-Westfalen',
  }

  it('bildet aus einer rückwirkenden Steuerklassenänderung eine Nachzahlung', () => {
    // Der Klassiker: geheiratet im März, gemeldet im Mai.
    const alt = werteAusErgebnis(calculatePayroll(basis), { regularHours: 160, overtimeHours: 0 })
    const neu = werteAusErgebnis(
      calculatePayroll({ ...basis, taxClass: 3, childCount: 1 }),
      { regularHours: 160, overtimeHours: 0 },
    )
    const d = differenzBilden(alt, neu)!
    expect(d).not.toBeNull()
    // Klasse III zieht weniger Steuer ab — der Mitarbeiter bekommt Geld zurück
    expect(d.lohnsteuer).toBeLessThan(0)
    expect(d.netto).toBeGreaterThan(0)
    // Das Brutto ändert sich dabei nicht
    expect(d.brutto).toBe(0)
  })

  it('bildet aus einem nachgereichten Nachtdienst eine Nachzahlung mit steuerfreiem Anteil', () => {
    const stundenlohn: PayrollInput = {
      ...basis, monthlyWage: undefined, hourlyWage: 20, regularHours: 160,
    }
    const alt = werteAusErgebnis(calculatePayroll(stundenlohn), { regularHours: 160, overtimeHours: 0 })
    const neu = werteAusErgebnis(
      calculatePayroll({
        ...stundenlohn, regularHours: 168,
        nightHours: 8, nightSurcharge: 8 * 20 * 0.25,
      }),
      { regularHours: 168, overtimeHours: 0 },
    )
    const d = differenzBilden(alt, neu)!
    expect(d.brutto).toBeCloseTo(8 * 20 + 40, 2)   // 8 Stunden Lohn plus Zuschlag
    expect(d.netto).toBeGreaterThan(0)
    // Der Zuschlag ist steuerfrei, das Steuerbrutto steigt nur um den Grundlohn
    const steuerBrutto = d.posten.find(p => p.feld === 'steuerBrutto')!
    expect(steuerBrutto.differenz).toBeCloseTo(160, 2)
  })

  it('bildet aus einer Rückforderung ein negatives Netto', () => {
    // Zu viel gezahlt: Krankheit war unbezahlt, wurde aber voll abgerechnet
    const alt = werteAusErgebnis(calculatePayroll(basis), { regularHours: 160, overtimeHours: 0 })
    const neu = werteAusErgebnis(
      calculatePayroll({ ...basis, monthlyWage: 2800 }),
      { regularHours: 130, overtimeHours: 0 },
    )
    const d = differenzBilden(alt, neu)!
    expect(d.brutto).toBeCloseTo(-600, 2)
    expect(d.netto).toBeLessThan(0)
    expect(korrekturText(2026, 5, d.netto)).toMatch(/Rückforderung/)
  })
})
