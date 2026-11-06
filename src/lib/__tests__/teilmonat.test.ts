import { describe, it, expect } from 'vitest'
import {
  svTageImMonat, anteiligesEntgelt, anteiligeBbg, anteiligerUrlaub,
  volleMonateImJahr, urlaubsabgeltung, letzterTag,
} from '../teilmonat'
import { calculatePayroll, type PayrollInput } from '../payroll-engine'
import { lohnjahr } from '../lohnjahre'

/**
 * §122 Die Probe für jede Teilmonatsrechnung: zwei Teilmonate desselben Monats
 * müssen zusammen genau 30 SV-Tage ergeben. Wo das nicht aufgeht, wird zu viel
 * oder zu wenig verbeitragt — und niemandem fällt es auf.
 */

describe('SV-Tage', () => {
  it('gibt jedem vollen Monat 30 Tage — auch dem Februar', () => {
    expect(svTageImMonat(2026, 1).svTage).toBe(30)   // 31 Kalendertage
    expect(svTageImMonat(2026, 2).svTage).toBe(30)   // 28 Kalendertage
    expect(svTageImMonat(2026, 4).svTage).toBe(30)   // 30 Kalendertage
  })

  it('zählt ab dem Eintrittstag', () => {
    // Januar, Eintritt am 15.: 15.–31., der 31. zählt nicht → 16
    expect(svTageImMonat(2026, 1, '2026-01-15').svTage).toBe(16)
  })

  it('zählt bis zum Austrittstag einschließlich', () => {
    expect(svTageImMonat(2026, 1, null, '2026-01-14').svTage).toBe(14)
  })

  it('ergibt für zwei Teile eines Monats zusammen genau 30 — die eigentliche Probe', () => {
    for (const [monat, trenntag] of [[1, 14], [2, 14], [4, 20], [12, 5]] as const) {
      const teil1 = svTageImMonat(2026, monat, null, `2026-${String(monat).padStart(2, '0')}-${String(trenntag).padStart(2, '0')}`)
      const teil2 = svTageImMonat(2026, monat, `2026-${String(monat).padStart(2, '0')}-${String(trenntag + 1).padStart(2, '0')}`)
      expect(teil1.svTage + teil2.svTage).toBe(30)
    }
  })

  it('füllt einen Februar-Teilmonat auf, der am Monatsende ausläuft', () => {
    // 15.–28. Februar sind 14 Kalendertage, aber 16 SV-Tage
    expect(svTageImMonat(2026, 2, '2026-02-15').svTage).toBe(16)
  })

  it('lässt den 31. eines Monats nicht mitzählen', () => {
    // Der 31. Januar allein ist kein SV-Tag
    expect(svTageImMonat(2026, 1, '2026-01-31').svTage).toBe(0)
  })

  it('erkennt einen Monat vor dem Eintritt', () => {
    const r = svTageImMonat(2026, 3, '2026-06-01')
    expect(r.beschaeftigt).toBe(false)
    expect(r.svTage).toBe(0)
  })

  it('erkennt einen Monat nach dem Austritt', () => {
    const r = svTageImMonat(2026, 9, null, '2026-06-30')
    expect(r.beschaeftigt).toBe(false)
  })

  it('rechnet Ein- und Austritt im selben Monat', () => {
    // 10.–20. April: elf Tage
    expect(svTageImMonat(2026, 4, '2026-04-10', '2026-04-20').svTage).toBe(11)
  })

  it('kennt die Länge jedes Monats', () => {
    expect(letzterTag(2026, 2)).toBe(28)
    expect(letzterTag(2024, 2)).toBe(29)   // Schaltjahr
    expect(letzterTag(2026, 4)).toBe(30)
    expect(letzterTag(2026, 12)).toBe(31)
  })
})

describe('Anteilige Beträge', () => {
  it('kürzt das Monatsgehalt im Teilmonat', () => {
    const halb = svTageImMonat(2026, 1, '2026-01-16')   // 15 SV-Tage
    expect(halb.svTage).toBe(15)
    expect(anteiligesEntgelt(3000, halb)).toBeCloseTo(1500, 2)
  })

  it('lässt ein volles Monatsgehalt unangetastet', () => {
    expect(anteiligesEntgelt(3000, svTageImMonat(2026, 2))).toBe(3000)
  })

  it('kürzt die Beitragsbemessungsgrenze mit', () => {
    const J = lohnjahr(2026)!
    const halb = svTageImMonat(2026, 1, '2026-01-16')
    expect(anteiligeBbg(J.bbgRvAvMonat, halb)).toBeCloseTo(J.bbgRvAvMonat / 2, 1)
  })
})

describe('Urlaub', () => {
  it('gibt für jeden vollen Monat ein Zwölftel', () => {
    expect(anteiligerUrlaub(24, 6)).toBe(12)
    expect(anteiligerUrlaub(30, 12)).toBe(30)
    expect(anteiligerUrlaub(30, 0)).toBe(0)
  })

  it('rundet ab einem halben Tag auf (§5 Abs.2 BUrlG)', () => {
    // 30 Tage × 5/12 = 12,5 → 13
    expect(anteiligerUrlaub(30, 5)).toBe(13)
    // 30 Tage × 7/12 = 17,5 → 18
    expect(anteiligerUrlaub(30, 7)).toBe(18)
    // 24 Tage × 5/12 = 10,0 → 10
    expect(anteiligerUrlaub(24, 5)).toBe(10)
  })

  it('zählt volle Monate im Jahr', () => {
    expect(volleMonateImJahr(2026, '2026-01-01')).toBe(12)
    expect(volleMonateImJahr(2026, '2026-07-01')).toBe(6)
    // Eintritt am 15. Juli: Juli ist kein voller Monat, August bis Dezember schon
    expect(volleMonateImJahr(2026, '2026-07-15')).toBe(5)
    expect(volleMonateImJahr(2026, null, '2026-06-30')).toBe(6)
  })

  it('gilt kein Urlaub für ein Jahr ohne Beschäftigung', () => {
    expect(volleMonateImJahr(2026, '2027-01-01')).toBe(0)
  })
})

describe('Urlaubsabgeltung', () => {
  it('rechnet offene Tage in Geld um', () => {
    // 3.000 € / (5 × 13/3 = 21,67 Arbeitstage) = 138,46 € je Tag
    expect(urlaubsabgeltung(10, 3000)).toBeCloseTo(1384.62, 1)
  })

  it('berücksichtigt eine Teilzeitwoche', () => {
    const voll = urlaubsabgeltung(10, 3000, 5)
    const teilzeit = urlaubsabgeltung(10, 3000, 3)
    expect(teilzeit).toBeGreaterThan(voll)   // weniger Arbeitstage, höherer Tageswert
  })

  it('liefert nichts ohne offene Tage', () => {
    expect(urlaubsabgeltung(0, 3000)).toBe(0)
    expect(urlaubsabgeltung(10, 0)).toBe(0)
  })
})

describe('In der ganzen Abrechnung', () => {
  const basis: PayrollInput = {
    jahr: 2026, monat: 1, monthlyWage: 3400,
    regularHours: 160, overtimeHours: 0,
    nightHours: 0, sundayHours: 0, holidayHours: 0, saturdayHours: 0,
    vacationDays: 0, sickDays: 0,
    taxClass: 1, childCount: 0,
    insuranceType: 'GKV', churchTax: false, zusatzbeitragPercent: 1.7,
    bundesland: 'Nordrhein-Westfalen',
  }

  it('zahlt im halben Monat das halbe Gehalt', () => {
    const r = calculatePayroll({ ...basis, svTage: 15 })
    expect(r.brutto).toBeCloseTo(1700, 2)
    expect(r.warnings.join(' ')).toMatch(/Teilmonat/)
  })

  it('bleibt bei 30 SV-Tagen unverändert zum vollen Monat', () => {
    const voll = calculatePayroll(basis)
    const dreissig = calculatePayroll({ ...basis, svTage: 30 })
    expect(dreissig.brutto).toBe(voll.brutto)
    expect(dreissig.netto).toBe(voll.netto)
  })

  it('kürzt die Beitragsbemessungsgrenze im Teilmonat', () => {
    const J = lohnjahr(2026)!
    // Gutverdiener im halben Monat: die Grenze ist ebenfalls halbiert
    const r = calculatePayroll({ ...basis, monthlyWage: 30000, svTage: 15 })
    expect(r.rvAN).toBeCloseTo((J.bbgRvAvMonat / 2) * 0.093, 1)
  })

  it('macht aus einem Teilmonat KEINEN Minijob', () => {
    // Der klassische Fehler: 3.400 € Gehalt, Eintritt am 25. → 566 € im Monat.
    // Klassifiziert wird nach dem regelmäßigen Entgelt, nicht nach dem Teilbetrag.
    const r = calculatePayroll({ ...basis, svTage: 5 })
    expect(r.beschaeftigungsart).toBe('regulaer')
    expect(r.brutto).toBeCloseTo(3400 * 5 / 30, 2)
  })

  it('lässt einen echten Minijob auch im Teilmonat Minijob sein', () => {
    const r = calculatePayroll({
      ...basis, monthlyWage: 500, beschaeftigungsart: 'minijob',
      pauschalsteuer: true, svTage: 15,
    })
    expect(r.beschaeftigungsart).toBe('minijob')
    expect(r.brutto).toBeCloseTo(250, 2)
  })

  it('lässt Stundenlöhner unberührt — sie werden ohnehin nach Stunden bezahlt', () => {
    const r = calculatePayroll({
      ...basis, monthlyWage: undefined, hourlyWage: 20,
      regularHours: 80, svTage: 15,
    })
    expect(r.brutto).toBeCloseTo(1600, 2)   // 80 Std. × 20 €, nicht halbiert
  })

  it('hält die SV-Tage im Ergebnis fest', () => {
    expect(calculatePayroll({ ...basis, svTage: 16 }).svTage).toBe(16)
    expect(calculatePayroll(basis).svTage).toBe(30)
  })
})
