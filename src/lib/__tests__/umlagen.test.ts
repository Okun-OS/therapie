import { describe, it, expect } from 'vitest'
import {
  anrechnung, betriebsgroesse, berechne, erstattung, U1_GRENZE,
} from '../umlagen'
import { calculatePayroll } from '../payroll-engine'
import { lohnjahrOderFehler } from '../lohnjahre'

/**
 * §159 Die Umlagen waren eine Lücke: Jeder Arbeitgeber zahlt sie, jeden Monat,
 * und sie standen nirgends. Eine Abrechnung ohne sie zeigt die
 * Arbeitgeberkosten zu niedrig — und führt Geld nicht ab, das die
 * Betriebsprüfung nachfordert.
 */

const j = lohnjahrOderFehler(2026)
const saetze = { u1: 0.021, u2: 0.0065, u1Erstattung: 0.8, kasse: 'AOK' }

describe('Die Betriebsgröße nach §3 AAG', () => {
  it('rechnet Teilzeit anteilig, nicht nach Köpfen', () => {
    // Der Fehler, der eine Pflegeeinrichtung über die Grenze bringt.
    expect(anrechnung(8)).toBe(0.25)
    expect(anrechnung(20)).toBe(0.5)
    expect(anrechnung(30)).toBe(0.75)
    expect(anrechnung(38.5)).toBe(1)
    expect(anrechnung(0)).toBe(0)
  })

  it('lässt Auszubildende außer Betracht', () => {
    const mit = betriebsgroesse([
      { wochenstunden: 39 }, { wochenstunden: 39, auszubildend: true },
    ])
    expect(mit.zahl).toBe(1)
  })

  it('hält vierzig Teilzeitkräfte unter der Grenze', () => {
    // 40 Köpfe zu je 20 Stunden sind 20 Arbeitnehmer im Sinne des §3 AAG.
    const g = betriebsgroesse(
      Array.from({ length: 40 }, () => ({ wochenstunden: 20 })))
    expect(g.zahl).toBe(20)
    expect(g.u1Pflichtig).toBe(true)
  })

  it('erkennt einen zu großen Betrieb', () => {
    const g = betriebsgroesse(
      Array.from({ length: U1_GRENZE + 1 }, () => ({ wochenstunden: 39 })))
    expect(g.u1Pflichtig).toBe(false)
    expect(g.hinweis).toMatch(/keine U1/)
    expect(g.hinweis).toMatch(/U2 bleibt davon unberührt/)
  })

  it('nennt die Zuständigkeit der Krankenkasse', () => {
    expect(betriebsgroesse([{ wochenstunden: 39 }]).hinweis)
      .toMatch(/Krankenkasse/)
  })
})

describe('Die Berechnung der Umlagen', () => {
  it('rechnet alle drei auf das Entgelt', () => {
    const u = berechne(3000, saetze, j, true)
    expect(u.u1).toBeCloseTo(3000 * 0.021, 2)
    expect(u.u2).toBeCloseTo(3000 * 0.0065, 2)
    expect(u.insolvenzgeld).toBeCloseTo(3000 * j.insolvenzgeldUmlage, 2)
    expect(u.gesamt).toBeCloseTo(u.u1 + u.u2 + u.insolvenzgeld, 2)
  })

  it('deckelt auf die Beitragsbemessungsgrenze der Rentenversicherung', () => {
    const u = berechne(j.bbgRvAvMonat + 3000, saetze, j, true)
    expect(u.bemessung).toBe(j.bbgRvAvMonat)
  })

  it('lässt die U1 weg, wenn der Betrieb zu groß ist', () => {
    const u = berechne(3000, saetze, j, false)
    expect(u.u1).toBe(0)
    // Die U2 bleibt: Sie gilt für alle Arbeitgeber.
    expect(u.u2).toBeGreaterThan(0)
  })

  it('rechnet nichts, wenn ein Satz fehlt — und sagt es', () => {
    const u = berechne(3000, { u1: null, u2: null }, j, true)
    expect(u.u1).toBe(0)
    expect(u.u2).toBe(0)
    expect(u.hinweise.join(' ')).toMatch(/U1-Satz/)
    expect(u.hinweise.join(' ')).toMatch(/U2-Satz/)
    expect(u.hinweise.join(' ')).toMatch(/§1 Abs\. 2 AAG/)
  })

  it('lässt die Insolvenzgeldumlage bei der öffentlichen Hand weg', () => {
    const u = berechne(3000, saetze, j, true, false)
    expect(u.insolvenzgeld).toBe(0)
  })

  it('warnt, solange der Satz der Insolvenzgeldumlage nicht geprüft ist', () => {
    const u = berechne(3000, saetze, j, true)
    if (!j.insolvenzgeldUmlageGeprueft) {
      expect(u.hinweise.join(' ')).toMatch(/Rechtsverordnung/)
    }
  })
})

describe('Was die Kasse erstattet', () => {
  it('zahlt Mutterschaftsaufwendungen zu hundert Prozent zurück', () => {
    const e = erstattung('u2', 2400, saetze)
    expect(e.betrag).toBe(2400)
    expect(e.satz).toBe(1)
  })

  it('zahlt bei Krankheit nur die gewählte Stufe', () => {
    const e = erstattung('u1', 2000, saetze)
    expect(e.betrag).toBe(1600)
    expect(e.hinweis).toMatch(/80 %/)
  })

  it('rechnet nichts ohne gewählte Stufe', () => {
    const e = erstattung('u1', 2000, { u1: 0.021, u2: 0.0065 })
    expect(e.betrag).toBe(0)
    expect(e.hinweis).toMatch(/nicht hinterlegt/)
  })
})

describe('Die Umlagen in der Abrechnung', () => {
  const basis = {
    jahr: 2026, monat: 3,
    monthlyWage: 3000,
    regularHours: 160, overtimeHours: 0,
    nightHours: 0, sundayHours: 0, holidayHours: 0, saturdayHours: 0,
    vacationDays: 0, sickDays: 0,
    taxClass: 1 as const, childCount: 0,
    insuranceType: 'GKV' as const, zusatzbeitragPercent: 1.7,
    churchTax: false, bundesland: 'Nordrhein-Westfalen',
  }

  it('stehen in den Arbeitgeberkosten', () => {
    const ohne = calculatePayroll(basis)
    const mit = calculatePayroll({ ...basis, umlagesaetze: saetze })
    expect(mit.totalAgCost).toBeGreaterThan(ohne.totalAgCost)
    expect(mit.totalAgCost - ohne.totalAgCost)
      .toBeCloseTo(mit.umlageU1 + mit.umlageU2, 2)
  })

  it('mindern das Netto des Arbeitnehmers nicht', () => {
    const ohne = calculatePayroll(basis)
    const mit = calculatePayroll({ ...basis, umlagesaetze: saetze })
    expect(mit.netto).toBe(ohne.netto)
    expect(mit.svTotal).toBe(ohne.svTotal)
  })

  it('fallen auch ohne hinterlegte Sätze für Insolvenzgeld an', () => {
    const r = calculatePayroll(basis)
    expect(r.insolvenzgeldUmlage).toBeGreaterThan(0)
    expect(r.umlageU1).toBe(0)
    expect(r.umlageU2).toBe(0)
  })

  it('sagt auf der Abrechnung, welcher Satz fehlt', () => {
    const r = calculatePayroll(basis)
    expect(r.warnings.join(' ')).toMatch(/U1-Satz/)
  })
})
