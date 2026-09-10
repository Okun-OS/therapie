import { describe, it, expect } from 'vitest'
import {
  einmalbezugBeitraege, anteiligeJahresgrenze, voraussichtlicherJahreslohn,
} from '../einmalbezug'
import { calculatePayroll, type PayrollInput } from '../payroll-engine'
import { lohnjahr } from '../lohnjahre'

/**
 * §120 Der teuerste Fehler bei Einmalzahlungen ist, sie mit der monatlichen
 * Beitragsbemessungsgrenze zu rechnen. Dann zahlt ein Gutverdiener auf sein
 * Weihnachtsgeld keine Beiträge, obwohl er müsste — und das fällt erst bei der
 * Betriebsprüfung auf, Jahre später.
 */

const J = lohnjahr(2026)!

describe('Anteilige Jahres-Beitragsbemessungsgrenze', () => {
  it('ist im Dezember das volle Jahr', () => {
    expect(anteiligeJahresgrenze(J.bbgRvAvMonat, 12)).toBe(J.bbgRvAvMonat * 12)
  })

  it('ist im Juni das halbe Jahr', () => {
    expect(anteiligeJahresgrenze(J.bbgRvAvMonat, 6)).toBe(J.bbgRvAvMonat * 6)
  })

  it('zählt ab dem Eintrittsmonat, nicht ab Januar', () => {
    // Eintritt im September, Auszahlung im Dezember → vier Monate
    expect(anteiligeJahresgrenze(J.bbgRvAvMonat, 12, 9)).toBe(J.bbgRvAvMonat * 4)
  })

  it('ist im Eintrittsmonat selbst ein Monat', () => {
    expect(anteiligeJahresgrenze(J.bbgRvAvMonat, 9, 9)).toBe(J.bbgRvAvMonat)
  })
})

describe('Beiträge auf eine Einmalzahlung', () => {
  const basis = {
    jahr: 2026, monat: 11, betrag: 3000,
    versicherung: 'GKV' as const, zusatzbeitragProzent: 1.7,
    bundesland: 'Nordrhein-Westfalen',
    hatKinder: true, kinderUnter25: 1,
  }

  it('verbeitragt eine Einmalzahlung voll, wenn Luft unter der Jahresgrenze ist', () => {
    const r = einmalbezugBeitraege({
      ...basis, bisherBeitragspflichtig: 30000, laufendesEntgelt: 3000,
    })
    expect(r.beitragspflichtig).toBe(3000)
    expect(r.rvAN).toBeCloseTo(3000 * 0.093, 2)
    expect(r.kvAN).toBeCloseTo(3000 * 0.0815, 2)
  })

  it('deckelt an der anteiligen Jahresgrenze, nicht an der Monatsgrenze', () => {
    // November, Grenze RV = 8.450 · 11 = 92.950. Bereits 91.000 verbeitragt.
    // Es bleiben 1.950 Luft — obwohl die Monatsgrenze 8.450 wäre.
    const r = einmalbezugBeitraege({
      ...basis, bisherBeitragspflichtig: 91000, laufendesEntgelt: 0,
    })
    expect(r.rvAN).toBeCloseTo(1950 * 0.093, 2)
    expect(r.warnungen.join(' ')).toMatch(/Jahres-/)
  })

  it('erhebt gar keine Beiträge, wenn die Jahresgrenze ausgeschöpft ist', () => {
    const r = einmalbezugBeitraege({
      ...basis, bisherBeitragspflichtig: 200000, laufendesEntgelt: 0,
    })
    expect(r.rvAN).toBe(0)
    expect(r.kvAN).toBe(0)
    expect(r.svAN).toBe(0)
  })

  it('rechnet Kranken- und Rentenversicherung an getrennten Grenzen', () => {
    // 70.000 bereits verbeitragt: über der KV-Jahresgrenze (5.812,50 · 11 =
    // 63.937,50), aber unter der RV-Grenze (92.950).
    const r = einmalbezugBeitraege({
      ...basis, bisherBeitragspflichtig: 70000, laufendesEntgelt: 0,
    })
    expect(r.kvAN).toBe(0)          // KV-Grenze schon überschritten
    expect(r.rvAN).toBeGreaterThan(0) // RV hat noch Luft
  })

  it('warnt bei einer Zahlung im ersten Quartal wegen der Märzklausel', () => {
    const r = einmalbezugBeitraege({
      ...basis, monat: 2, bisherBeitragspflichtig: 3000, laufendesEntgelt: 3000,
    })
    expect(r.warnungen.join(' ')).toMatch(/Märzklausel/)
  })

  it('erhöht bei privat Versicherten die Kranken- und Pflegeversicherung nicht', () => {
    const r = einmalbezugBeitraege({
      ...basis, versicherung: 'PKV',
      bisherBeitragspflichtig: 30000, laufendesEntgelt: 3000,
    })
    expect(r.kvAN).toBe(0)
    expect(r.pvAN).toBe(0)
    expect(r.rvAN).toBeGreaterThan(0)   // Rente bleibt
    expect(r.warnungen.join(' ')).toMatch(/Privat versichert/)
  })

  it('liefert bei einem Betrag von null gar nichts', () => {
    const r = einmalbezugBeitraege({
      ...basis, betrag: 0, bisherBeitragspflichtig: 0, laufendesEntgelt: 3000,
    })
    expect(r.svAN).toBe(0)
    expect(r.warnungen).toHaveLength(0)
  })
})

describe('Voraussichtlicher Jahresarbeitslohn', () => {
  it('rechnet den laufenden Monat auf die Restmonate hoch', () => {
    // Im September: 8 Monate à 3.000 gelaufen, der laufende plus 3 weitere
    expect(voraussichtlicherJahreslohn({
      bisherSteuerBrutto: 24000, laufendesSteuerBrutto: 3000,
      monat: 9, bisherigeEinmalzahlungen: 0,
    })).toBe(24000 + 3000 * 4)
  })

  it('rechnet bereits gezahlte Einmalzahlungen hinzu', () => {
    expect(voraussichtlicherJahreslohn({
      bisherSteuerBrutto: 24000, laufendesSteuerBrutto: 3000,
      monat: 9, bisherigeEinmalzahlungen: 2000,
    })).toBe(24000 + 3000 * 4 + 2000)
  })

  it('rechnet im Dezember nur noch den laufenden Monat', () => {
    expect(voraussichtlicherJahreslohn({
      bisherSteuerBrutto: 33000, laufendesSteuerBrutto: 3000,
      monat: 12, bisherigeEinmalzahlungen: 0,
    })).toBe(36000)
  })
})

describe('Einmalzahlung in der ganzen Abrechnung', () => {
  const basis: PayrollInput = {
    jahr: 2026, monat: 11, monthlyWage: 3400,
    regularHours: 160, overtimeHours: 0,
    nightHours: 0, sundayHours: 0, holidayHours: 0, saturdayHours: 0,
    vacationDays: 0, sickDays: 0,
    taxClass: 1, childCount: 0,
    insuranceType: 'GKV', churchTax: false, zusatzbeitragPercent: 1.7,
    bundesland: 'Nordrhein-Westfalen',
  }

  it('zählt das Weihnachtsgeld ins Gesamtbrutto', () => {
    const r = calculatePayroll({
      ...basis, sonstigeBezuege: 3400,
      jahresArbeitslohn: 3400 * 12, bisherBeitragspflichtig: 3400 * 10,
    })
    expect(r.brutto).toBeCloseTo(6800, 2)
    expect(r.sonstigeBezuege).toBeCloseTo(3400, 2)
  })

  it('lässt das Steuerbrutto des laufenden Lohns unberührt', () => {
    const ohne = calculatePayroll(basis)
    const mit = calculatePayroll({
      ...basis, sonstigeBezuege: 3400,
      jahresArbeitslohn: 3400 * 12, bisherBeitragspflichtig: 3400 * 10,
    })
    expect(mit.steuerBrutto).toBeCloseTo(ohne.steuerBrutto, 2)
    expect(mit.svBrutto).toBeCloseTo(ohne.svBrutto, 2)
  })

  it('besteuert das Weihnachtsgeld und weist die Steuer getrennt aus', () => {
    const ohne = calculatePayroll(basis)
    const mit = calculatePayroll({
      ...basis, sonstigeBezuege: 3400,
      jahresArbeitslohn: 3400 * 12, bisherBeitragspflichtig: 3400 * 10,
    })
    expect(mit.lohnsteuerSonstige).toBeGreaterThan(0)
    // Die Gesamtsteuer enthält beides
    expect(mit.lohnsteuerMonthly).toBeCloseTo(
      ohne.lohnsteuerMonthly + mit.lohnsteuerSonstige, 2)
  })

  it('verbeitragt es an der anteiligen Jahresgrenze', () => {
    const r = calculatePayroll({
      ...basis, sonstigeBezuege: 3400,
      jahresArbeitslohn: 3400 * 12, bisherBeitragspflichtig: 3400 * 10,
    })
    expect(r.svANSonstige).toBeGreaterThan(0)
    expect(r.svAGSonstige).toBeGreaterThan(0)
  })

  it('lässt eine Abfindung beitragsfrei', () => {
    const r = calculatePayroll({
      ...basis, sonstigeBezuege: 10000, sonstigeBezuegeBeitragsfrei: 10000,
      jahresArbeitslohn: 3400 * 12, bisherBeitragspflichtig: 3400 * 10,
    })
    expect(r.svANSonstige).toBe(0)
    expect(r.svAGSonstige).toBe(0)
    // Versteuert wird sie trotzdem
    expect(r.lohnsteuerSonstige).toBeGreaterThan(0)
  })

  it('lässt vom Weihnachtsgeld etwas übrig', () => {
    const ohne = calculatePayroll(basis)
    const mit = calculatePayroll({
      ...basis, sonstigeBezuege: 3400,
      jahresArbeitslohn: 3400 * 12, bisherBeitragspflichtig: 3400 * 10,
    })
    const mehrNetto = mit.netto - ohne.netto
    expect(mehrNetto).toBeGreaterThan(0)
    expect(mehrNetto).toBeLessThan(3400)
  })

  it('bleibt ohne Einmalzahlung unverändert zum Vorherigen', () => {
    const r = calculatePayroll(basis)
    expect(r.sonstigeBezuege).toBe(0)
    expect(r.lohnsteuerSonstige).toBe(0)
    expect(r.svANSonstige).toBe(0)
  })
})
