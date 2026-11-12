import { describe, it, expect } from 'vitest'
import {
  rechne, pauschaliertesNetto, beitraegeAufFiktivEntgelt, schwelleErreicht,
  antragsfrist, fristAbgelaufen, tageBisFrist, runde,
  LEISTUNGSSATZ_MIT_KIND, LEISTUNGSSATZ_OHNE_KIND, SV_PAUSCHALE, FIKTIV_ANTEIL,
} from '../kurzarbeit'
import { lohnjahrOderFehler } from '../lohnjahre'
import { calculatePayroll } from '../payroll-engine'

/**
 * §157 Der Fehler, der beim Kurzarbeitergeld Geld kostet: 60 % der Differenz
 * der BRUTTObeträge statt der pauschalierten NETTObeträge. Das ist ein
 * deutlich größerer Betrag — und der Betrieb bekommt nur den richtigen
 * erstattet, den Rest zahlt er selbst.
 */

const j = lohnjahrOderFehler(2026)

const person = {
  sollEntgelt: 3000,
  istEntgelt: 1500,
  mitKind: false,
  steuerklasse: 1 as const,
  versicherung: 'GKV' as const,
  zusatzbeitragProzent: 1.7,
  bundesland: 'Nordrhein-Westfalen',
  hatKinder: false,
}

describe('Das pauschalierte Nettoentgelt', () => {
  it('zieht 20 % Sozialversicherung ab, nicht die echten Beiträge', () => {
    const netto = pauschaliertesNetto(3000, person, j)
    // Ohne Steuer wären es genau 2400 — mit Steuer weniger, aber nie mehr.
    expect(netto).toBeLessThan(3000 * (1 - SV_PAUSCHALE))
    expect(netto).toBeGreaterThan(0)
  })

  it('lässt die Kirchensteuer außen vor', () => {
    // §153 SGB III nennt nur Lohnsteuer und Solidaritätszuschlag. Ein
    // Kirchenmitglied bekommt deshalb kein niedrigeres pauschaliertes Netto.
    const mit = pauschaliertesNetto(3000, { ...person }, j)
    const ohne = pauschaliertesNetto(3000, { ...person }, j)
    expect(mit).toBe(ohne)
  })

  it('ist bei Steuerklasse V niedriger als bei Steuerklasse III', () => {
    const drei = pauschaliertesNetto(3000, { ...person, steuerklasse: 3 }, j)
    const fuenf = pauschaliertesNetto(3000, { ...person, steuerklasse: 5 }, j)
    expect(fuenf).toBeLessThan(drei)
  })

  it('bleibt bei null Brutto bei null', () => {
    expect(pauschaliertesNetto(0, person, j)).toBe(0)
  })
})

describe('Die Berechnung des Kurzarbeitergeldes', () => {
  it('rechnet auf der Nettodifferenz, nicht auf der Bruttodifferenz', () => {
    const e = rechne(person, j)
    const bruttoDifferenz = 1500
    expect(e.nettoDifferenz).toBeLessThan(bruttoDifferenz)
    expect(e.kug).toBeCloseTo(
      runde(e.nettoDifferenz * LEISTUNGSSATZ_OHNE_KIND), 2)
    // Der klassische Fehler wäre 60 % von 1500 = 900.
    expect(e.kug).toBeLessThan(900)
  })

  it('zahlt mit Kind 67 statt 60 Prozent', () => {
    const ohne = rechne(person, j)
    const mit = rechne({ ...person, mitKind: true }, j)
    expect(ohne.leistungssatz).toBe(LEISTUNGSSATZ_OHNE_KIND)
    expect(mit.leistungssatz).toBe(LEISTUNGSSATZ_MIT_KIND)
    expect(mit.kug).toBeGreaterThan(ohne.kug)
  })

  it('deckelt Soll und Ist auf die Beitragsbemessungsgrenze', () => {
    const e = rechne(
      { ...person, sollEntgelt: j.bbgRvAvMonat + 2000, istEntgelt: 3000 }, j)
    expect(e.sollGedeckelt).toBe(j.bbgRvAvMonat)
    expect(e.hinweise.join(' ')).toMatch(/Beitragsbemessungsgrenze/)
  })

  it('zahlt nichts, wenn es keinen Ausfall gibt', () => {
    const e = rechne({ ...person, istEntgelt: 3000 }, j)
    expect(e.kug).toBe(0)
    expect(e.fiktivEntgelt).toBe(0)
    expect(e.beitraege.gesamt).toBe(0)
  })

  it('sagt es, wenn das Istentgelt über dem Sollentgelt liegt', () => {
    // Der häufigste Eingabefehler: Mehrarbeit im Sollentgelt vergessen.
    const e = rechne({ ...person, istEntgelt: 3500 }, j)
    expect(e.kug).toBe(0)
    expect(e.hinweise.join(' ')).toMatch(/Mehrarbeit/)
  })

  it('weist auf den Progressionsvorbehalt hin', () => {
    const e = rechne(person, j)
    expect(e.hinweise.join(' ')).toMatch(/§32b/)
    expect(e.hinweise.join(' ')).toMatch(/Lohnsteuerbescheinigung/)
  })

  it('nennt den Entgeltausfall in Prozent', () => {
    const e = rechne(person, j)
    expect(e.ausfallProzent).toBeCloseTo(50, 1)
  })

  it('merkt an, wenn der Ausfall die 10 % nicht überschreitet', () => {
    const e = rechne({ ...person, istEntgelt: 2800 }, j)
    expect(e.ausfallProzent).toBeLessThanOrEqual(10)
    expect(e.hinweise.join(' ')).toMatch(/§96 Abs\. 1 Nr\. 4 SGB III/)
  })
})

describe('Der Betrag aus der amtlichen Tabelle geht vor', () => {
  it('zahlt den eingetragenen Betrag aus', () => {
    const e = rechne({ ...person, kugAusTabelle: 700 }, j)
    expect(e.kug).toBe(700)
    expect(e.quelle).toBe('tabelle')
    expect(e.kugGerechnet).not.toBe(700)
  })

  it('nennt die Abweichung zum gerechneten Betrag', () => {
    const e = rechne({ ...person, kugAusTabelle: 700 }, j)
    expect(e.hinweise.join(' ')).toMatch(/amtlichen Tabelle/)
    expect(e.hinweise.join(' ')).toMatch(/Unterschied/)
  })

  it('schweigt, wenn der eingetragene Betrag passt', () => {
    const gerechnet = rechne(person, j).kugGerechnet
    const e = rechne({ ...person, kugAusTabelle: gerechnet }, j)
    expect(e.hinweise.join(' ')).not.toMatch(/Unterschied/)
  })
})

describe('Die Beiträge auf das fiktive Entgelt', () => {
  it('bemisst sie auf 80 % des Ausfalls', () => {
    const e = rechne(person, j)
    expect(e.fiktivEntgelt).toBeCloseTo(1500 * FIKTIV_ANTEIL, 2)
  })

  it('erhebt keinen Beitrag zur Arbeitslosenversicherung', () => {
    const b = beitraegeAufFiktivEntgelt(1200, person, j)
    expect(b.av).toBe(0)
  })

  it('rechnet den VOLLEN Satz, nicht den halben', () => {
    // Der Arbeitgeber trägt sie allein — wer hier halbiert, rechnet die
    // Kosten der Kurzarbeit um die Hälfte zu niedrig.
    const b = beitraegeAufFiktivEntgelt(1000, person, j)
    expect(b.rv).toBeCloseTo(1000 * j.rvSatz, 2)
    expect(b.pv).toBeCloseTo(1000 * j.pvSatz, 2)
  })

  it('erhebt für privat Versicherte keinen Kassenbeitrag', () => {
    const b = beitraegeAufFiktivEntgelt(
      1000, { ...person, versicherung: 'PKV' }, j)
    expect(b.kv).toBe(0)
    expect(b.pv).toBe(0)
    expect(b.rv).toBeGreaterThan(0)
  })

  it('lässt die Rentenversicherung weg, wo keine Pflicht besteht', () => {
    const b = beitraegeAufFiktivEntgelt(1000, { ...person, rvExempt: true }, j)
    expect(b.rv).toBe(0)
  })

  it('deckelt auf die jeweilige Bemessungsgrenze', () => {
    const b = beitraegeAufFiktivEntgelt(j.bbgRvAvMonat + 5000, person, j)
    expect(b.rv).toBeCloseTo(j.bbgRvAvMonat * j.rvSatz, 2)
    expect(b.kv).toBeCloseTo(
      j.bbgKvPvMonat * (j.kvBasisSatz + 0.017), 2)
  })

  it('sagt dem Betrieb, dass er sie allein trägt', () => {
    const e = rechne(person, j)
    expect(e.hinweise.join(' ')).toMatch(/Arbeitgeber allein/)
    expect(e.hinweise.join(' ')).toMatch(/nicht erstattet/)
  })
})

describe('Die Ausschlussfrist des §109 SGB III', () => {
  it('läuft drei Monate nach Ablauf des Abrechnungsmonats', () => {
    expect(antragsfrist(2026, 1)).toBe('2026-04-30')
    expect(antragsfrist(2026, 9)).toBe('2026-12-31')
  })

  it('rechnet über den Jahreswechsel', () => {
    expect(antragsfrist(2026, 11)).toBe('2027-02-28')
    expect(antragsfrist(2026, 12)).toBe('2027-03-31')
  })

  it('erkennt eine abgelaufene Frist', () => {
    expect(fristAbgelaufen(2026, 1, new Date('2026-05-01T09:00:00Z'))).toBe(true)
    expect(fristAbgelaufen(2026, 1, new Date('2026-04-30T09:00:00Z'))).toBe(false)
  })

  it('zählt die verbleibenden Tage', () => {
    expect(tageBisFrist(2026, 1, new Date('2026-04-20T09:00:00Z'))).toBe(10)
    expect(tageBisFrist(2026, 1, new Date('2026-05-10T09:00:00Z'))).toBe(-10)
  })
})

describe('Die Abrechnung in einem Monat mit Kurzarbeit', () => {
  const basis = {
    jahr: 2026, monat: 3,
    monthlyWage: 4000,
    regularHours: 80, overtimeHours: 0,
    nightHours: 0, sundayHours: 0, holidayHours: 0, saturdayHours: 0,
    vacationDays: 0, sickDays: 0,
    taxClass: 1 as const, childCount: 0,
    insuranceType: 'GKV' as const, zusatzbeitragPercent: 1.7,
    churchTax: false, bundesland: 'Nordrhein-Westfalen',
  }

  it('rechnet das Istentgelt ab, nicht das vertragliche Entgelt', () => {
    // Sonst zahlt der Betrieb das volle Gehalt UND das Kurzarbeitergeld.
    const r = calculatePayroll({ ...basis, kurzarbeitIstEntgelt: 2000 })
    expect(r.brutto).toBe(2000)
    expect(r.warnings.join(' ')).toMatch(/Istentgelt/)
  })

  it('lässt das Kurzarbeitergeld aus Steuer- und Beitragsbrutto heraus', () => {
    const r = calculatePayroll({
      ...basis, kurzarbeitIstEntgelt: 2000, kug: 700, kugSvAG: 500,
    })
    expect(r.steuerBrutto).toBe(2000)
    expect(r.svBrutto).toBe(2000)
    // Und auch aus dem Netto: Es kommt zur Auszahlung hinzu, nicht ins Entgelt.
    expect(r.netto).toBeLessThan(2000)
    expect(r.kug).toBe(700)
  })

  it('zählt die Beiträge auf das fiktive Entgelt zu den Arbeitgeberkosten', () => {
    const ohne = calculatePayroll({ ...basis, kurzarbeitIstEntgelt: 2000 })
    const mit = calculatePayroll({
      ...basis, kurzarbeitIstEntgelt: 2000, kug: 700, kugSvAG: 500,
    })
    expect(mit.totalAgCost).toBeCloseTo(ohne.totalAgCost + 500, 2)
    expect(mit.kugSvAG).toBe(500)
  })

  it('zieht die Zuschläge vom Istentgelt ab, statt sie zu verdoppeln', () => {
    const r = calculatePayroll({
      ...basis, kurzarbeitIstEntgelt: 2000,
      nightHours: 10, nightSurcharge: 100, grundlohnHourly: 25,
    })
    // Das laufende Brutto ist genau das Istentgelt — Zuschläge stecken darin.
    expect(r.brutto).toBe(2000)
  })

  it('bleibt ohne Kurzarbeit unverändert', () => {
    const r = calculatePayroll(basis)
    expect(r.brutto).toBe(4000)
    expect(r.kug).toBe(0)
    expect(r.kugSvAG).toBe(0)
  })
})

describe('Die Betriebsschwelle des §96 SGB III', () => {
  it('zählt nur, wer mehr als 10 % Ausfall hat', () => {
    const s = schwelleErreicht([50, 40, 8, 0, 0, 0])
    expect(s.betroffen).toBe(2)
    expect(s.gesamt).toBe(6)
  })

  it('ist bei einem Drittel erreicht', () => {
    expect(schwelleErreicht([50, 50, 0, 0, 0, 0]).erreicht).toBe(true)
    expect(schwelleErreicht([50, 0, 0, 0, 0, 0]).erreicht).toBe(false)
  })

  it('bleibt ohne Beschäftigte unerreicht', () => {
    expect(schwelleErreicht([]).erreicht).toBe(false)
  })
})
