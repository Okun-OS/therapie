import { describe, it, expect } from 'vitest'
import {
  mutterschaftszuschuss, krankengeld, arbeitsbescheinigung,
  MUTTERSCHAFTSGELD_KASSE, type Abrechnungsmonat,
} from '../bescheinigungen'
import { lohnjahrOderFehler } from '../lohnjahre'

/**
 * §160 Eine Bescheinigung ist keine Gefälligkeit: Ein zu niedriges
 * Regelentgelt heißt ein zu niedriges Krankengeld für bis zu 78 Wochen, ein
 * falscher Beendigungsgrund eine Sperrzeit von bis zu zwölf Wochen.
 */

const j = lohnjahrOderFehler(2026)

const monat = (jahr: number, m: number, extra: Partial<Abrechnungsmonat> = {})
: Abrechnungsmonat => ({
  jahr, monat: m, svBrutto: 3000, einmalzahlungen: 0, netto: 2000,
  stunden: 160, svTage: 30, ...extra,
})

describe('Der Zuschuss zum Mutterschaftsgeld (§20 MuSchG)', () => {
  it('rechnet aus den letzten drei abgerechneten Monaten', () => {
    const m = mutterschaftszuschuss(
      [monat(2026, 1), monat(2026, 2), monat(2026, 3), monat(2025, 12)], 98)
    expect(m.grundlage).toHaveLength(3)
    // Die drei jüngsten, nicht irgendwelche.
    expect(m.grundlage.map(g => g.monat)).toEqual([3, 2, 1])
  })

  it('teilt durch Kalendertage, nicht durch Arbeitstage', () => {
    const m = mutterschaftszuschuss(
      [monat(2026, 1), monat(2026, 2), monat(2026, 3)], 98)
    expect(m.nettoJeTag).toBeCloseTo(2000 / 30, 2)
  })

  it('zieht das Mutterschaftsgeld der Kasse ab', () => {
    const m = mutterschaftszuschuss(
      [monat(2026, 1), monat(2026, 2), monat(2026, 3)], 98)
    expect(m.zuschussJeTag)
      .toBeCloseTo(2000 / 30 - MUTTERSCHAFTSGELD_KASSE, 2)
    expect(m.zuschussGesamt).toBeCloseTo(m.zuschussJeTag * 98, 2)
  })

  it('zahlt nichts, wenn das Netto unter 13 € am Tag liegt', () => {
    const klein = [1, 2, 3].map(x => monat(2026, x, { netto: 300 }))
    const m = mutterschaftszuschuss(klein, 98)
    expect(m.zuschussJeTag).toBe(0)
    expect(m.hinweise.join(' ')).toMatch(/kein Zuschuss/)
  })

  it('lässt Einmalzahlungen außer Ansatz (§21 Abs. 1 Satz 2 MuSchG)', () => {
    const ohne = mutterschaftszuschuss(
      [monat(2026, 1), monat(2026, 2), monat(2026, 3)], 98)
    const mit = mutterschaftszuschuss([
      monat(2026, 1), monat(2026, 2),
      monat(2026, 3, { einmalzahlungen: 3000, netto: 3500 }),
    ], 98)
    // Trotz höherem Netto darf der Zuschuss nicht im gleichen Maß steigen.
    expect(mit.zuschussJeTag).toBeLessThan(
      ohne.zuschussJeTag + 3500 / 90)
    expect(mit.hinweise.join(' ')).toMatch(/§21 Abs\. 1 Satz 2 MuSchG/)
  })

  it('weist auf die vollständige Erstattung über U2 hin', () => {
    const m = mutterschaftszuschuss(
      [monat(2026, 1), monat(2026, 2), monat(2026, 3)], 98)
    expect(m.hinweise.join(' ')).toMatch(/U2 zu 100 %/)
    expect(m.hinweise.join(' ')).toMatch(/Progressionsvorbehalt/)
  })

  it('kommt mit weniger als drei Monaten zurecht und sagt es', () => {
    const m = mutterschaftszuschuss([monat(2026, 3)], 98)
    expect(m.zuschussJeTag).toBeGreaterThan(0)
    expect(m.hinweise.join(' ')).toMatch(/§21 Abs\. 2 MuSchG/)
  })

  it('rechnet ohne abgerechnete Monate gar nicht', () => {
    const m = mutterschaftszuschuss([], 98)
    expect(m.zuschussGesamt).toBe(0)
    expect(m.hinweise.join(' ')).toMatch(/keine abgerechneten Monate/)
  })
})

describe('Das Regelentgelt für das Krankengeld (§47 SGB V)', () => {
  it('teilt das Monatsentgelt durch dreißig', () => {
    const k = krankengeld(monat(2026, 3), 0, j)
    expect(k.regelentgeltJeTag).toBeCloseTo(100, 2)
  })

  it('rechnet Einmalzahlungen der letzten zwölf Monate hinzu', () => {
    // Der häufigste Fehler: das Weihnachtsgeld vergessen.
    const ohne = krankengeld(monat(2026, 3), 0, j)
    const mit = krankengeld(monat(2026, 3), 3600, j)
    expect(mit.einmalJeTag).toBeCloseTo(10, 2)
    expect(mit.regelentgeltJeTag).toBeCloseTo(ohne.regelentgeltJeTag + 10, 2)
    expect(mit.hinweise.join(' ')).toMatch(/§47 Abs\. 2 Satz 6 SGB V/)
  })

  it('nimmt 70 % des Regelentgelts', () => {
    const k = krankengeld(monat(2026, 3, { netto: 2700 }), 0, j)
    expect(k.siebzigProzent).toBeCloseTo(70, 2)
    expect(k.krankengeldJeTag).toBeCloseTo(70, 2)
  })

  it('deckelt bei 90 % des Nettoentgelts', () => {
    // Niedriges Netto bei hohem Brutto — dann greift die Obergrenze.
    const k = krankengeld(monat(2026, 3, { netto: 2000 }), 0, j)
    expect(k.neunzigProzent).toBeCloseTo(60, 2)
    expect(k.krankengeldJeTag).toBe(k.neunzigProzent)
    expect(k.hinweise.join(' ')).toMatch(/§47 Abs\. 1 Satz 2 SGB V/)
  })

  it('begrenzt auf die Beitragsbemessungsgrenze der Krankenversicherung', () => {
    const k = krankengeld(
      monat(2026, 3, { svBrutto: 20000, netto: 12000 }), 0, j)
    expect(k.regelentgeltJeTag).toBeCloseTo(j.bbgKvPvMonat / 30, 2)
    expect(k.hinweise.join(' ')).toMatch(/Beitragsbemessungsgrenze/)
  })

  it('sagt ausdrücklich, dass die Kasse rechnet', () => {
    const k = krankengeld(monat(2026, 3), 0, j)
    expect(k.hinweise.join(' ')).toMatch(/Vorschau/)
    expect(k.hinweise.join(' ')).toMatch(/Kasse/)
  })

  it('rechnet ohne abgerechneten Zeitraum gar nicht', () => {
    const k = krankengeld(null, 0, j)
    expect(k.krankengeldJeTag).toBe(0)
    expect(k.hinweise.join(' ')).toMatch(/§47 Abs\. 2 SGB V/)
  })
})

describe('Die Arbeitsbescheinigung (§312 SGB III)', () => {
  const zwoelf = Array.from({ length: 14 }, (_, i) => monat(2026, (i % 12) + 1))

  it('nimmt höchstens zwölf Monate', () => {
    const a = arbeitsbescheinigung(zwoelf)
    expect(a.monate.length).toBe(12)
  })

  it('sortiert sie aufsteigend', () => {
    const a = arbeitsbescheinigung([monat(2026, 3), monat(2026, 1), monat(2026, 2)])
    expect(a.monate.map(m => m.monat)).toEqual([1, 2, 3])
  })

  it('zählt Einmalzahlungen zum Bemessungsentgelt', () => {
    const ohne = arbeitsbescheinigung([monat(2026, 1)])
    const mit = arbeitsbescheinigung(
      [monat(2026, 1, { einmalzahlungen: 3000 })])
    expect(mit.entgeltGesamt).toBe(ohne.entgeltGesamt + 3000)
  })

  it('rechnet das Bemessungsentgelt je Kalendertag', () => {
    const a = arbeitsbescheinigung([monat(2026, 1), monat(2026, 2)])
    expect(a.tage).toBe(60)
    expect(a.bemessungsentgeltJeTag).toBeCloseTo(100, 2)
  })

  it('lässt den Beendigungsgrund ausdrücklich offen', () => {
    // Er entscheidet über eine Sperrzeit und lässt sich nicht aus Daten
    // ableiten. Geraten wird er nicht.
    const a = arbeitsbescheinigung([monat(2026, 1)])
    expect(a.offeneAngaben.join(' ')).toMatch(/Grund der Beendigung/)
    expect(a.offeneAngaben.join(' ')).toMatch(/§159 SGB III/)
    expect(a.offeneAngaben.join(' ')).toMatch(/Kündigungsfrist|Frist gekündigt/)
  })

  it('sagt es, wenn der Bemessungsrahmen nicht reicht', () => {
    const a = arbeitsbescheinigung([monat(2026, 1), monat(2026, 2)])
    expect(a.hinweise.join(' ')).toMatch(/§150 Abs\. 3 SGB III/)
  })

  it('nennt das Verfahren und die Eile', () => {
    const a = arbeitsbescheinigung([monat(2026, 1)])
    expect(a.hinweise.join(' ')).toMatch(/BEA/)
    expect(a.hinweise.join(' ')).toMatch(/unverzüglich/)
  })
})
