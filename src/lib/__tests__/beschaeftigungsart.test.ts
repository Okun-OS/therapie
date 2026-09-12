import { describe, it, expect } from 'vitest'
import {
  artBestimmen, beitraegeNachArt, individuellBesteuert,
  uebergangsbereichBemessung, uebergangsbereichBemessungAN,
} from '../beschaeftigungsart'
import { lohnjahr, geringfuegigkeitsgrenze, uebergangsbereichFaktor } from '../lohnjahre'
import { calculatePayroll, type PayrollInput } from '../payroll-engine'

/**
 * §121 Hier entscheiden Grenzfälle. Ein Euro über der Geringfügigkeitsgrenze
 * ist eine völlig andere Rechnung als ein Euro darunter — und beide müssen
 * stimmen, sonst zahlt entweder der Mitarbeiter oder der Arbeitgeber zu viel.
 */

const J = lohnjahr(2026)!
const G = geringfuegigkeitsgrenze(J)
const OG = J.uebergangsbereichObergrenze

describe('Geringfügigkeitsgrenze', () => {
  it('folgt dem Mindestlohn statt fest zu sein', () => {
    // §8 Abs.1a SGB IV: Mindestlohn × 130 ÷ 3, aufgerundet
    expect(geringfuegigkeitsgrenze(lohnjahr(2025)!)).toBe(556)
    expect(G).toBe(Math.ceil(J.mindestlohn * 130 / 3))
  })

  it('bestätigt sich an der bekannten Grenze von 2025', () => {
    // 12,82 € Mindestlohn ergeben genau die amtlichen 556 € — die Herleitung stimmt
    expect(geringfuegigkeitsgrenze(lohnjahr(2025)!)).toBe(556)
  })
})

describe('Welche Art gilt wirklich', () => {
  it('lässt einen Minijob unter der Grenze Minijob sein', () => {
    expect(artBestimmen('minijob', G - 1, J).art).toBe('minijob')
    expect(artBestimmen('minijob', G, J).art).toBe('minijob')
  })

  it('erkennt, wenn ein Minijob die Grenze überschreitet', () => {
    const r = artBestimmen('minijob', G + 1, J)
    expect(r.art).toBe('uebergangsbereich')
    expect(r.hinweis).toMatch(/über der Geringfügigkeitsgrenze/)
  })

  it('schiebt einen regulären Lohn im Übergangsbereich von selbst dorthin', () => {
    // Keine Wahl, sondern Gesetz
    const r = artBestimmen('regulaer', 1200, J)
    expect(r.art).toBe('uebergangsbereich')
    expect(r.hinweis).toMatch(/Übergangsbereich/)
  })

  it('lässt oberhalb der Obergrenze alles regulär', () => {
    expect(artBestimmen('regulaer', OG + 1, J).art).toBe('regulaer')
    expect(artBestimmen('regulaer', 3400, J).art).toBe('regulaer')
  })

  it('warnt, wenn ein regulärer Lohn unter der Geringfügigkeitsgrenze liegt', () => {
    const r = artBestimmen('regulaer', 400, J)
    expect(r.art).toBe('regulaer')
    expect(r.hinweis).toMatch(/Minijob/)
  })

  it('lässt eine kurzfristige Beschäftigung unabhängig vom Verdienst kurzfristig', () => {
    expect(artBestimmen('kurzfristig', 3000, J).art).toBe('kurzfristig')
  })
})

describe('Minijob', () => {
  const basis = {
    jahr: 2026, entgelt: 500, art: 'minijob' as const,
    versicherung: 'GKV' as const, zusatzbeitragProzent: 1.7,
    bundesland: 'Nordrhein-Westfalen', hatKinder: false,
  }

  it('lässt den Arbeitgeber die Pauschalen tragen', () => {
    const r = beitraegeNachArt(basis)!
    expect(r.rvAG).toBeCloseTo(500 * 0.15, 2)   // 75,00
    expect(r.kvAG).toBeCloseTo(500 * 0.13, 2)   // 65,00
  })

  it('zieht dem Arbeitnehmer nur seinen Rentenanteil ab', () => {
    const r = beitraegeNachArt(basis)!
    expect(r.rvAN).toBeCloseTo(500 * (0.186 - 0.15), 2)   // 18,00
    expect(r.kvAN).toBe(0)
    expect(r.pvAN).toBe(0)
    expect(r.avAN).toBe(0)
    expect(r.svAN).toBeCloseTo(18, 2)
  })

  it('zieht bei Befreiung gar nichts ab', () => {
    const r = beitraegeNachArt({ ...basis, rvBefreiung: true })!
    expect(r.rvAN).toBe(0)
    expect(r.svAN).toBe(0)
    expect(r.hinweise.join(' ')).toMatch(/befreit/)
  })

  it('rechnet die Pauschsteuer des Arbeitgebers', () => {
    expect(beitraegeNachArt(basis)!.pauschsteuerAG).toBeCloseTo(10, 2)  // 2 %
  })

  it('lässt die Krankenversicherungspauschale bei privat Versicherten weg', () => {
    const r = beitraegeNachArt({ ...basis, versicherung: 'PKV' })!
    expect(r.kvAG).toBe(0)
    expect(r.rvAG).toBeCloseTo(75, 2)
    expect(r.hinweise.join(' ')).toMatch(/Privat versichert/)
  })
})

describe('Kurzfristige Beschäftigung', () => {
  it('ist in allen Zweigen beitragsfrei', () => {
    const r = beitraegeNachArt({
      jahr: 2026, entgelt: 2500, art: 'kurzfristig',
      versicherung: 'GKV', hatKinder: false,
    })!
    expect(r.svAN).toBe(0)
    expect(r.svAG).toBe(0)
    expect(r.pauschsteuerAG).toBe(0)
  })

  it('erinnert an die Zeitgrenze', () => {
    const r = beitraegeNachArt({
      jahr: 2026, entgelt: 2500, art: 'kurzfristig', versicherung: 'GKV',
    })!
    expect(r.hinweise.join(' ')).toMatch(/70 Arbeitstage/)
  })
})

describe('Übergangsbereich — die Formel muss an beiden Enden aufgehen', () => {
  it('ergibt an der Untergrenze den Faktor mal die Grenze', () => {
    const F = uebergangsbereichFaktor(J)
    expect(uebergangsbereichBemessung(G, J)).toBeCloseTo(G, 2)
    expect(uebergangsbereichBemessung(G + 0.01, J)).toBeCloseTo(F * G, 1)
  })

  it('ergibt an der Obergrenze genau das Entgelt', () => {
    // Der Übergang muss stufenlos sein — sonst gäbe es einen Sprung, bei dem
    // ein Euro mehr Brutto weniger Netto bedeutet.
    expect(uebergangsbereichBemessung(OG, J)).toBeCloseTo(OG, 1)
    expect(uebergangsbereichBemessungAN(OG, J)).toBeCloseTo(OG, 1)
  })

  it('lässt den Arbeitnehmer an der Untergrenze nichts zahlen', () => {
    expect(uebergangsbereichBemessungAN(G, J)).toBe(0)
  })

  it('steigt durchgehend an', () => {
    let vorher = -1
    for (let e = G + 1; e <= OG; e += 100) {
      const b = uebergangsbereichBemessungAN(e, J)
      expect(b).toBeGreaterThan(vorher)
      vorher = b
    }
  })

  it('bemisst den Arbeitnehmeranteil niedriger als den Gesamtbeitrag', () => {
    for (const e of [700, 1000, 1500, 1900]) {
      expect(uebergangsbereichBemessungAN(e, J))
        .toBeLessThan(uebergangsbereichBemessung(e, J))
    }
  })
})

describe('Übergangsbereich — Beiträge', () => {
  const basis = {
    jahr: 2026, art: 'uebergangsbereich' as const,
    versicherung: 'GKV' as const, zusatzbeitragProzent: 1.7,
    bundesland: 'Nordrhein-Westfalen', hatKinder: true, kinderUnter25: 1,
  }

  it('lässt den Arbeitgeber an der Untergrenze alles allein tragen', () => {
    const r = beitraegeNachArt({ ...basis, entgelt: G + 0.01 })!
    expect(r.svAN).toBeCloseTo(0, 1)
    expect(r.svAG).toBeGreaterThan(0)
  })

  it('teilt an der Obergrenze wieder normal', () => {
    const r = beitraegeNachArt({ ...basis, entgelt: OG })!
    // Bei 2.000 € sind AN und AG praktisch gleich — der Übergang endet stufenlos
    expect(Math.abs(r.svAN - r.svAG)).toBeLessThan(15)
  })

  it('belastet den Arbeitnehmer weniger als eine reguläre Rechnung', () => {
    const uebergang = beitraegeNachArt({ ...basis, entgelt: 1200 })!
    // Regulär wären es rund 21 % vom Entgelt
    const regulaerAN = 1200 * (0.093 + 0.0815 + 0.018 + 0.013)
    expect(uebergang.svAN).toBeLessThan(regulaerAN)
  })

  it('erklärt, worauf gerechnet wurde', () => {
    const r = beitraegeNachArt({ ...basis, entgelt: 1200 })!
    expect(r.hinweise.join(' ')).toMatch(/Übergangsbereich: Beiträge auf/)
  })
})

describe('Besteuerung', () => {
  it('besteuert einen Minijob mit Pauschsteuer nicht individuell', () => {
    expect(individuellBesteuert('minijob', true)).toBe(false)
    expect(individuellBesteuert('minijob', false)).toBe(true)
  })

  it('besteuert alles andere individuell', () => {
    expect(individuellBesteuert('kurzfristig', true)).toBe(true)
    expect(individuellBesteuert('uebergangsbereich', true)).toBe(true)
    expect(individuellBesteuert('regulaer', true)).toBe(true)
  })
})

describe('In der ganzen Abrechnung', () => {
  const basis: PayrollInput = {
    jahr: 2026, monat: 9,
    regularHours: 40, overtimeHours: 0,
    nightHours: 0, sundayHours: 0, holidayHours: 0, saturdayHours: 0,
    vacationDays: 0, sickDays: 0,
    taxClass: 1, childCount: 0,
    insuranceType: 'GKV', churchTax: false, zusatzbeitragPercent: 1.7,
    bundesland: 'Nordrhein-Westfalen',
  }

  it('rechnet einen Minijob als Minijob', () => {
    const r = calculatePayroll({
      ...basis, monthlyWage: 500, beschaeftigungsart: 'minijob',
    })
    expect(r.beschaeftigungsart).toBe('minijob')
    expect(r.rvAN).toBeCloseTo(18, 2)
    expect(r.kvAN).toBe(0)
    expect(r.pauschsteuerAG).toBeCloseTo(10, 2)
  })

  it('behält beim Minijob mit Pauschsteuer keine Lohnsteuer ein', () => {
    const r = calculatePayroll({
      ...basis, monthlyWage: 500, beschaeftigungsart: 'minijob', pauschalsteuer: true,
    })
    expect(r.lohnsteuerMonthly).toBe(0)
    expect(r.soliMonthly).toBe(0)
    expect(r.warnings.join(' ')).toMatch(/Pauschsteuer/)
  })

  it('lässt einem Minijobber fast alles übrig', () => {
    const r = calculatePayroll({
      ...basis, monthlyWage: 500, beschaeftigungsart: 'minijob', pauschalsteuer: true,
    })
    expect(r.netto).toBeCloseTo(500 - 18, 2)
  })

  it('kostet den Arbeitgeber beim Minijob deutlich mehr als das Brutto', () => {
    const r = calculatePayroll({
      ...basis, monthlyWage: 500, beschaeftigungsart: 'minijob', pauschalsteuer: true,
    })
    // 500 + 75 Rente + 65 Kranken + 10 Pauschsteuer = 650
    expect(r.totalAgCost).toBeCloseTo(650, 2)
  })

  it('zahlt eine kurzfristige Beschäftigung ohne Beiträge aus', () => {
    const r = calculatePayroll({
      ...basis, monthlyWage: 2000, beschaeftigungsart: 'kurzfristig',
    })
    expect(r.beschaeftigungsart).toBe('kurzfristig')
    expect(r.rvAN + r.kvAN + r.pvAN + r.avAN).toBe(0)
    // Versteuert wird sie trotzdem
    expect(r.lohnsteuerMonthly).toBeGreaterThan(0)
  })

  it('erkennt den Übergangsbereich von selbst', () => {
    const r = calculatePayroll({ ...basis, monthlyWage: 1200 })
    expect(r.beschaeftigungsart).toBe('uebergangsbereich')
  })

  it('lässt im Übergangsbereich mehr netto als bei regulärer Rechnung', () => {
    const uebergang = calculatePayroll({ ...basis, monthlyWage: 1200 })
    // Zum Vergleich: dieselbe Person knapp über der Obergrenze, anteilig gerechnet
    const regulaerAnteil = calculatePayroll({ ...basis, monthlyWage: 2100 })
    const quoteUebergang = uebergang.netto / uebergang.brutto
    const quoteRegulaer = regulaerAnteil.netto / regulaerAnteil.brutto
    expect(quoteUebergang).toBeGreaterThan(quoteRegulaer)
  })

  it('macht aus einem regulären Gehalt keinen Sonderfall', () => {
    const r = calculatePayroll({ ...basis, monthlyWage: 3400 })
    expect(r.beschaeftigungsart).toBe('regulaer')
    expect(r.pauschsteuerAG).toBe(0)
    expect(r.rvAN).toBeCloseTo(3400 * 0.093, 2)
  })

  it('hat an der Geringfügigkeitsgrenze keinen Sprung nach unten', () => {
    // Ein Euro mehr Brutto darf nie weniger Netto bedeuten — das wäre der
    // klassische Fehler an der Schwelle.
    const knappDrunter = calculatePayroll({
      ...basis, monthlyWage: G, beschaeftigungsart: 'minijob', pauschalsteuer: true,
    })
    const knappDrueber = calculatePayroll({ ...basis, monthlyWage: G + 1 })
    expect(knappDrueber.netto).toBeGreaterThanOrEqual(knappDrunter.netto - 1)
  })
})
