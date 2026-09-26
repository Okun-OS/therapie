import { describe, it, expect } from 'vitest'
import {
  anteiligeGrenze, lage, minijobNeben, runde,
} from '../mehrfachbeschaeftigung'
import {
  fuenftelregelungImAbzug, zusammenballung, hinweise,
} from '../abfindung'
import { calculatePayroll } from '../payroll-engine'
import { lohnjahrOderFehler } from '../lohnjahre'

/**
 * §158 Zwei Dinge, die in der Pflege häufig sind und fast überall falsch
 * gerechnet werden: zwei Arbeitgeber und die Abfindung beim Ausscheiden.
 */

const j = lohnjahrOderFehler(2026)

describe('Die geteilte Beitragsbemessungsgrenze (§22 Abs. 2 SGB IV)', () => {
  it('teilt nicht, solange die Summe unter der Grenze bleibt', () => {
    const a = anteiligeGrenze(2000, 1000, j.bbgRvAvMonat)
    expect(a.geteilt).toBe(false)
    expect(a.grenze).toBe(j.bbgRvAvMonat)
  })

  it('teilt im Verhältnis der Entgelte', () => {
    // Zwei gleich große Entgelte, zusammen über der Grenze: jeder die Hälfte.
    const halb = j.bbgRvAvMonat
    const a = anteiligeGrenze(halb, halb, j.bbgRvAvMonat)
    expect(a.geteilt).toBe(true)
    expect(a.grenze).toBeCloseTo(j.bbgRvAvMonat / 2, 2)
  })

  it('gibt dem größeren Arbeitgeber den größeren Anteil', () => {
    const gross = anteiligeGrenze(6000, 3000, j.bbgRvAvMonat)
    const klein = anteiligeGrenze(3000, 6000, j.bbgRvAvMonat)
    expect(gross.grenze).toBeGreaterThan(klein.grenze)
    expect(runde(gross.grenze + klein.grenze)).toBeCloseTo(j.bbgRvAvMonat, 1)
  })

  it('lässt die Grenze unangetastet, wenn kein weiteres Entgelt bekannt ist', () => {
    // Der sichere Weg: Ohne Angabe wird normal gerechnet. Zu viel abgeführte
    // Beiträge holt die Person zurück, zu wenig holt die Prüfung beim Betrieb.
    const a = anteiligeGrenze(9000, 0, j.bbgRvAvMonat)
    expect(a.geteilt).toBe(false)
    expect(a.grenze).toBe(j.bbgRvAvMonat)
  })

  it('kommt mit null zurecht', () => {
    expect(anteiligeGrenze(0, 0, j.bbgRvAvMonat).grenze).toBe(j.bbgRvAvMonat)
  })
})

describe('Was zur Mehrfachbeschäftigung gesagt wird', () => {
  it('nennt das Gesamtentgelt', () => {
    const l = lage(5000, 4000, 1, j, false)
    expect(l.hinweise.join(' ')).toMatch(/Mehrfachbeschäftigung/)
  })

  it('verweist auf die Aufteilung, wenn die Grenze überschritten wird', () => {
    const l = lage(6000, 5000, 1, j, false)
    expect(l.hinweise.join(' ')).toMatch(/§22 Abs\. 2 SGB IV/)
    expect(l.kasseFragen).toBe(true)
  })

  it('bemängelt eine fehlende Steuerklasse VI im zweiten Verhältnis', () => {
    const l = lage(1000, 3000, 1, j, true)
    expect(l.hinweise.join(' ')).toMatch(/Steuerklasse VI/)
    expect(l.hinweise.join(' ')).toMatch(/§38b/)
  })

  it('schweigt dazu, wenn Steuerklasse VI eingestellt ist', () => {
    const l = lage(1000, 3000, 6, j, true)
    expect(l.hinweise.join(' ')).not.toMatch(/Steuerklasse VI/)
  })
})

describe('Minijob neben einer Hauptbeschäftigung (§8 Abs. 2 SGB IV)', () => {
  it('lässt den ersten geringfügig', () => {
    const m = minijobNeben(0, true)
    expect(m.pflichtig).toBe(false)
    expect(m.hinweis).toMatch(/bleibt geringfügig/)
  })

  it('macht den zweiten versicherungspflichtig', () => {
    const m = minijobNeben(1, true)
    expect(m.pflichtig).toBe(true)
    expect(m.hinweis).toMatch(/versicherungspflichtig/)
    expect(m.hinweis).toMatch(/Arbeitslosenversicherung/)
  })

  it('rechnet mehrere Minijobs ohne Hauptbeschäftigung zusammen', () => {
    const m = minijobNeben(2, false)
    expect(m.hinweis).toMatch(/zusammengerechnet/)
  })

  it('sagt nichts bei einem einzelnen Minijob', () => {
    expect(minijobNeben(0, false).hinweis).toBeNull()
  })
})

describe('Die Abrechnung bei zwei Arbeitgebern', () => {
  const basis = {
    jahr: 2026, monat: 3,
    monthlyWage: 5000,
    regularHours: 160, overtimeHours: 0,
    nightHours: 0, sundayHours: 0, holidayHours: 0, saturdayHours: 0,
    vacationDays: 0, sickDays: 0,
    taxClass: 1 as const, childCount: 0,
    insuranceType: 'GKV' as const, zusatzbeitragPercent: 1.7,
    churchTax: false, bundesland: 'Nordrhein-Westfalen',
  }

  it('senkt die Beiträge, wenn die Summe über der Grenze liegt', () => {
    const allein = calculatePayroll(basis)
    const geteilt = calculatePayroll({ ...basis, weiteresEntgelt: 5000 })
    // 5000 + 5000 = 10.000 liegt über beiden Grenzen — dieser Arbeitgeber
    // verbeitragt nur die Hälfte davon.
    expect(geteilt.rvAN).toBeLessThan(allein.rvAN)
    expect(geteilt.kvAN).toBeLessThan(allein.kvAN)
  })

  it('ändert nichts, solange die Summe unter der Grenze bleibt', () => {
    const allein = calculatePayroll(basis)
    const dazu = calculatePayroll({ ...basis, weiteresEntgelt: 500 })
    expect(dazu.rvAN).toBeCloseTo(allein.rvAN, 2)
    expect(dazu.kvAN).toBeCloseTo(allein.kvAN, 2)
  })

  it('sagt auf der Abrechnung, dass geteilt wurde', () => {
    const r = calculatePayroll({ ...basis, weiteresEntgelt: 5000 })
    expect(r.warnings.join(' ')).toMatch(/§22 Abs\. 2 SGB IV/)
  })

  it('mindert Brutto und Netto nicht — nur die Bemessung', () => {
    const r = calculatePayroll({ ...basis, weiteresEntgelt: 5000 })
    expect(r.brutto).toBe(5000)
    // Weniger Beiträge heißt mehr Netto, nicht weniger.
    expect(r.netto).toBeGreaterThan(calculatePayroll(basis).netto)
  })
})

describe('Die Abfindung', () => {
  it('kennt das Ende der Fünftelregelung im Lohnsteuerabzug', () => {
    // §39b Abs. 3 Satz 9 EStG ist zum 1. Januar 2025 entfallen.
    expect(fuenftelregelungImAbzug(2024)).toBe(true)
    expect(fuenftelregelungImAbzug(2025)).toBe(false)
    expect(fuenftelregelungImAbzug(2026)).toBe(false)
  })

  it('sagt ab 2025, dass die Ermäßigung über die Steuererklärung läuft', () => {
    const h = hinweise(2026, 30000, true).join(' ')
    expect(h).toMatch(/NICHT mehr an/)
    expect(h).toMatch(/Einkommensteuererklärung/)
    expect(h).toMatch(/§34 EStG/)
  })

  it('erklärt die Beitragsfreiheit und ihre Grenze', () => {
    const h = hinweise(2026, 30000, true).join(' ')
    expect(h).toMatch(/§14 SGB IV/)
    expect(h).toMatch(/Karenzentschädigung|Urlaub/)
  })

  it('meldet eine als beitragspflichtig gekennzeichnete Abfindung', () => {
    const h = hinweise(2026, 30000, false).join(' ')
    expect(h).toMatch(/beitragspflichtig gekennzeichnet/)
  })

  it('erkennt eine Zusammenballung', () => {
    // Austritt im Juni, 4.000 € im Monat: bis Jahresende entgehen 24.000 €.
    const z = zusammenballung(30000, 4000, 6)
    expect(z.entgangen).toBe(24000)
    expect(z.erfuellt).toBe(true)
    expect(z.begruendung).toMatch(/§34 Abs\. 1 EStG/)
  })

  it('erkennt, wenn sie fehlt', () => {
    const z = zusammenballung(10000, 4000, 6)
    expect(z.erfuellt).toBe(false)
    expect(z.begruendung).toMatch(/Ohne Zusammenballung/)
  })

  it('rechnet bei einem Austritt im Dezember ohne entgangene Einnahmen', () => {
    const z = zusammenballung(5000, 4000, 12)
    expect(z.entgangen).toBe(0)
    expect(z.erfuellt).toBe(true)
  })
})
