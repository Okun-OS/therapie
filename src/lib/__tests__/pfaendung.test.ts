import { describe, it, expect } from 'vitest'
import {
  TABELLEN, tabelleFuer, tabelleOderFehler, pfaendbaresEinkommen,
  freieZehntel, berechnePfaendbar, verteile, rechne, runde,
  WEIHNACHTSGELD_HOECHSTBETRAG, ungepruefteTabellen, type Pfaendung,
} from '../pfaendung'

/**
 * §155 Bei jedem anderen Rechenfehler merkt es irgendwann jemand. Hier nicht:
 * Zu viel gepfändet heißt, dass jemandem das Existenzminimum fehlt; zu wenig
 * heißt, dass der Arbeitgeber dem Gläubiger persönlich haftet (§840 ZPO).
 * Deshalb wird hier jeder Schritt einzeln nachgerechnet.
 */

const JULI25 = '2025-09-15'   // liegt in der Tabelle ab 1.7.2025
const t25 = TABELLEN.find(t => t.ab === '2025-07-01')!

describe('Die Tabelle gilt ab dem 1. Juli, nicht ab Januar', () => {
  it('nimmt im Juni noch die alte Tabelle', () => {
    expect(tabelleFuer('2025-06-30')!.ab).toBe('2024-07-01')
  })

  it('und ab dem 1. Juli die neue', () => {
    expect(tabelleFuer('2025-07-01')!.ab).toBe('2025-07-01')
  })

  it('kennt keine Tabelle vor der ältesten', () => {
    expect(tabelleFuer('2020-01-01')).toBeNull()
  })

  it('verweigert die Auskunft, sobald ein neuer 1. Juli vergangen ist', () => {
    // Das ist der wichtige Fall: Die Freigrenzen sind gestiegen, unsere
    // Tabelle weiß es nicht — weiterzurechnen hieße, zu viel zu pfänden.
    const neueste = TABELLEN[TABELLEN.length - 1]
    const naechstes = `${Number(neueste.ab.slice(0, 4)) + 1}-07-01`
    expect(tabelleFuer(naechstes)).toBeNull()
    expect(tabelleFuer(`${Number(neueste.ab.slice(0, 4)) + 1}-06-30`))
      .not.toBeNull()
  })

  it('bricht mit einer erklärenden Meldung ab statt zu schätzen', () => {
    const jahr = Number(TABELLEN[TABELLEN.length - 1].ab.slice(0, 4)) + 1
    expect(() => tabelleOderFehler(`${jahr}-08-01`)).toThrow(/1\. Juli/)
    expect(() => tabelleOderFehler(`${jahr}-08-01`)).toThrow(/zu viel gepfändet/)
  })

  it('sagt, welche Tabellen noch ungeprüft sind', () => {
    // Ein fortgeschriebener Wert sieht im Programm aus wie ein geprüfter.
    // Genau das ist die Gefahr, also muss es abrufbar sein. Seit dem
    // Abgleich am 26.09.2026 ist keine Tabelle mehr offen — die Liste muss
    // es trotzdem geben, denn im Juli kommt die nächste.
    expect(ungepruefteTabellen()).toEqual(
      TABELLEN.filter(t => !t.bestaetigt))
  })

  it('sagt zu jeder Tabelle, ob sie geprüft ist', () => {
    for (const t of TABELLEN) {
      expect(t.quelle.length, t.ab).toBeGreaterThan(10)
      expect(t.geprueft.length, t.ab).toBeGreaterThan(10)
    }
  })

  it('führt keine unbestätigte Tabelle mehr', () => {
    // Die Werte ab Juli 2025 und Juli 2026 waren fortgeschrieben und falsch:
    // der Grundbetrag ab Juli 2026 um 31,31 € zu hoch. Bei jeder Pfändung in
    // diesem Zeitraum wäre zu wenig einbehalten worden, und dafür haftet der
    // Arbeitgeber dem Gläubiger persönlich (§840 ZPO).
    expect(ungepruefteTabellen()).toEqual([])
  })

  it('kennt die geltenden Freigrenzen ab Juli 2026', () => {
    const t = tabelleFuer('2026-09-26')
    expect(t?.grundbetrag).toBe(1587.40)
    expect(t?.ersteUnterhaltspflicht).toBe(597.42)
    expect(t?.weitereUnterhaltspflicht).toBe(332.83)
    expect(t?.hoechstbetrag).toBe(4866.30)
  })
})

describe('§850a — was gar nicht erst in die Tabelle geht', () => {
  it('lässt die Hälfte der Mehrarbeit frei', () => {
    const e = pfaendbaresEinkommen({ nettoGesamt: 2400, mehrarbeit: 400 })
    expect(e.nettoFuerTabelle).toBe(2200)
    expect(e.abzuege[0].grundlage).toBe('§850a Nr. 1 ZPO')
  })

  it('lässt das Urlaubsgeld ganz frei', () => {
    const e = pfaendbaresEinkommen({ nettoGesamt: 2500, urlaubsgeld: 500 })
    expect(e.nettoFuerTabelle).toBe(2000)
  })

  it('lässt Erschwerniszulagen frei — das trifft die Nachtdienste', () => {
    const e = pfaendbaresEinkommen({ nettoGesamt: 2300, erschwerniszulagen: 180 })
    expect(e.nettoFuerTabelle).toBe(2120)
  })

  it('deckelt das Weihnachtsgeld beim Höchstbetrag', () => {
    // Halbes Monatseinkommen wäre 1500 — der Höchstbetrag ist niedriger.
    const e = pfaendbaresEinkommen({ nettoGesamt: 3000, weihnachtsgeld: 1200 })
    const abzug = e.abzuege.find(a => a.bezeichnung.includes('Weihnachtsgeld'))!
    expect(abzug.betrag).toBe(WEIHNACHTSGELD_HOECHSTBETRAG)
  })

  it('deckelt es bei der Hälfte, wenn die niedriger ist', () => {
    // Halbes Monatseinkommen 600 < Höchstbetrag 705.
    const e = pfaendbaresEinkommen({ nettoGesamt: 1200, weihnachtsgeld: 900 })
    const abzug = e.abzuege.find(a => a.bezeichnung.includes('Weihnachtsgeld'))!
    expect(abzug.betrag).toBe(600)
  })

  it('zieht nur ab, was auch da ist', () => {
    const e = pfaendbaresEinkommen({ nettoGesamt: 2000, weihnachtsgeld: 100 })
    expect(e.abzuege.find(a => a.bezeichnung.includes('Weihnachtsgeld'))!.betrag)
      .toBe(100)
  })

  it('kommt ohne Zusatzbezüge aus', () => {
    const e = pfaendbaresEinkommen({ nettoGesamt: 2000 })
    expect(e.nettoFuerTabelle).toBe(2000)
    expect(e.abzuege).toEqual([])
  })

  it('wird nie negativ', () => {
    const e = pfaendbaresEinkommen({ nettoGesamt: 300, urlaubsgeld: 500 })
    expect(e.nettoFuerTabelle).toBe(0)
  })
})

describe('§850c Abs. 3 — die Zehntel', () => {
  it('lässt ohne Unterhaltspflicht drei Zehntel frei', () => {
    expect(freieZehntel(0)).toBe(3)
  })

  it('erhöht für die erste Person um zwei Zehntel', () => {
    expect(freieZehntel(1)).toBe(5)
  })

  it('und für jede weitere um eins', () => {
    expect(freieZehntel(2)).toBe(6)
    expect(freieZehntel(3)).toBe(7)
    expect(freieZehntel(4)).toBe(8)
    expect(freieZehntel(5)).toBe(9)
  })

  it('bleibt bei neun Zehnteln stehen', () => {
    expect(freieZehntel(6)).toBe(9)
    expect(freieZehntel(12)).toBe(9)
  })
})

describe('§850c — der pfändbare Betrag', () => {
  it('pfändet nichts unter dem Freibetrag', () => {
    const b = berechnePfaendbar(1400, 0, JULI25)
    expect(b.pfaendbar).toBe(0)
    expect(b.herleitung.join(' ')).toMatch(/nichts pfändbar/)
  })

  it('pfändet nichts genau auf dem Freibetrag', () => {
    expect(berechnePfaendbar(t25.grundbetrag, 0, JULI25).pfaendbar).toBe(0)
  })

  it('rechnet den Mehrbetrag ohne Unterhaltspflicht richtig', () => {
    // 2.000 € − 1.555,00 € = 445,00 € Mehrbetrag. Davon 3/10 frei = 133,50 €,
    // pfändbar also 311,50 €.
    const b = berechnePfaendbar(2000, 0, JULI25)
    expect(b.freibetrag).toBe(1555.00)
    expect(b.mehrbetrag).toBe(445.00)
    expect(b.mehrbetragFrei).toBe(133.5)
    expect(b.pfaendbar).toBe(311.5)
  })

  it('erhöht den Freibetrag mit jeder Unterhaltspflicht', () => {
    const ohne = berechnePfaendbar(3000, 0, JULI25).freibetrag
    const eine = berechnePfaendbar(3000, 1, JULI25).freibetrag
    const zwei = berechnePfaendbar(3000, 2, JULI25).freibetrag
    expect(eine - ohne).toBeCloseTo(t25.ersteUnterhaltspflicht, 2)
    expect(zwei - eine).toBeCloseTo(t25.weitereUnterhaltspflicht, 2)
  })

  it('zählt höchstens fünf Unterhaltspflichten', () => {
    const fuenf = berechnePfaendbar(6000, 5, JULI25).freibetrag
    const acht = berechnePfaendbar(6000, 8, JULI25).freibetrag
    expect(acht).toBe(fuenf)
  })

  it('sagt es, wenn mehr angegeben wurden als zählen', () => {
    expect(berechnePfaendbar(6000, 8, JULI25).herleitung.join(' '))
      .toMatch(/höchstens fünf/)
  })

  it('pfändet oberhalb des Höchstbetrags alles', () => {
    // 6.000 €: bis 4.786,52 € gilt die Zehntelrechnung, der Rest ist voll
    // pfändbar.
    const b = berechnePfaendbar(6000, 0, JULI25)
    const ueber = 6000 - t25.hoechstbetrag
    const mehrbetrag = t25.hoechstbetrag - t25.grundbetrag
    const erwartet = runde(mehrbetrag * 7 / 10 + ueber)
    expect(b.pfaendbar).toBeCloseTo(erwartet, 2)
    expect(b.herleitung.join(' ')).toMatch(/voll pfändbar/)
  })

  it('lässt bei fünf Unterhaltspflichten nur ein Zehntel übrig', () => {
    const b = berechnePfaendbar(3000, 5, JULI25)
    expect(b.mehrbetragFrei).toBeCloseTo(b.mehrbetrag * 0.9, 2)
  })

  it('nennt in der Herleitung die Vorschriften', () => {
    const h = berechnePfaendbar(2500, 1, JULI25).herleitung.join(' ')
    expect(h).toMatch(/§850c Abs\. 1/)
    expect(h).toMatch(/§850c Abs\. 2/)
    expect(h).toMatch(/§850c Abs\. 3/)
  })
})

describe('§804 Abs. 3 — wer zuerst kommt', () => {
  const alt: Pfaendung = {
    id: 'a', art: 'normal', glaeubiger: 'Stadtkasse',
    zugestelltAm: '2025-01-10', forderung: 5000,
  }
  const neu: Pfaendung = {
    id: 'b', art: 'normal', glaeubiger: 'Versandhaus',
    zugestelltAm: '2025-06-01', forderung: 5000,
  }

  it('bedient die ältere Pfändung zuerst', () => {
    const v = verteile(300, 2000, [neu, alt])
    expect(v.zuteilungen[0].glaeubiger).toBe('Stadtkasse')
    expect(v.zuteilungen[0].betrag).toBe(300)
  })

  it('gibt der zweiten nichts, solange die erste offen ist', () => {
    const v = verteile(300, 2000, [alt, neu])
    expect(v.zuteilungen.length).toBe(1)
    expect(v.unbedient[0].glaeubiger).toBe('Versandhaus')
    expect(v.unbedient[0].grund).toMatch(/vorrangige Pfändung/)
  })

  it('reicht den Rest weiter, wenn die erste fast getilgt ist', () => {
    const fast = { ...alt, forderung: 5000, getilgt: 4900 }
    const v = verteile(300, 2000, [fast, neu])
    expect(v.zuteilungen[0].betrag).toBe(100)
    expect(v.zuteilungen[1].betrag).toBe(200)
  })

  it('überspringt eine getilgte Forderung', () => {
    const fertig = { ...alt, forderung: 5000, getilgt: 5000 }
    const v = verteile(300, 2000, [fertig, neu])
    expect(v.zuteilungen.length).toBe(1)
    expect(v.zuteilungen[0].glaeubiger).toBe('Versandhaus')
    expect(v.unbedient[0].grund).toMatch(/getilgt/)
  })

  it('nimmt nie mehr, als noch offen ist', () => {
    const klein = { ...alt, forderung: 120 }
    const v = verteile(300, 2000, [klein])
    expect(v.zuteilungen[0].betrag).toBe(120)
    expect(v.verbleibt).toBe(1880)
  })

  it('lässt eine abgeschaltete Pfändung außen vor', () => {
    const v = verteile(300, 2000, [{ ...alt, aktiv: false }])
    expect(v.zuteilungen).toEqual([])
    expect(v.verbleibt).toBe(2000)
  })
})

describe('§850d — Unterhalt geht vor', () => {
  const unterhalt: Pfaendung = {
    id: 'u', art: 'unterhalt', glaeubiger: 'Jugendamt',
    zugestelltAm: '2025-06-01', notwendigerUnterhalt: 1200,
  }
  const normal: Pfaendung = {
    id: 'n', art: 'normal', glaeubiger: 'Bank',
    zugestelltAm: '2025-01-01', forderung: 9000,
  }

  it('bedient den Unterhalt zuerst, auch wenn er später zugestellt wurde', () => {
    const v = verteile(300, 2000, [normal, unterhalt])
    expect(v.zuteilungen[0].glaeubiger).toBe('Jugendamt')
  })

  it('greift tiefer als die Tabelle — bis an den notwendigen Unterhalt', () => {
    // Nach Tabelle wären nur 300 € pfändbar. §850d erlaubt den Zugriff bis
    // auf den im Beschluss festgesetzten Betrag: 2000 − 1200 = 800 €.
    const v = verteile(300, 2000, [unterhalt])
    expect(v.zuteilungen[0].betrag).toBe(800)
    expect(v.verbleibt).toBe(1200)
  })

  it('behält nichts ein, wenn der notwendige Unterhalt fehlt', () => {
    // Den Betrag setzt das Gericht fest, nicht das Programm. Ohne ihn zu
    // raten wäre der gefährlichste Fehler in diesem ganzen Modul.
    const ohne = { ...unterhalt, notwendigerUnterhalt: null }
    const v = verteile(300, 2000, [ohne])
    expect(v.zuteilungen).toEqual([])
    expect(v.unbedient[0].grund).toMatch(/§850d/)
    expect(v.unbedient[0].grund).toMatch(/Gericht setzt den Betrag fest/)
  })

  it('nennt im Hinweis den verbleibenden Unterhalt', () => {
    const v = verteile(300, 2000, [unterhalt])
    expect(v.zuteilungen[0].hinweis).toMatch(/1\.200,00 €/)
    expect(v.zuteilungen[0].hinweis).toMatch(/§850d/)
  })
})

describe('Der ganze Weg', () => {
  it('rechnet von den Bezügen bis zur Auszahlung durch', () => {
    const e = rechne(
      { nettoGesamt: 2600, mehrarbeit: 200, erschwerniszulagen: 100 },
      1,
      [{
        id: 'x', art: 'normal', glaeubiger: 'Stadtkasse',
        zugestelltAm: '2025-02-01', forderung: 8000,
      }],
      JULI25,
    )

    // §850a: 2600 − 100 (halbe Mehrarbeit) − 100 (Zulagen) = 2400
    expect(e.einkommen.nettoFuerTabelle).toBe(2400)
    // §850c mit einer Unterhaltspflicht
    expect(e.berechnung.freibetrag)
      .toBeCloseTo(t25.grundbetrag + t25.ersteUnterhaltspflicht, 2)
    // Einbehalten wird genau der pfändbare Betrag
    expect(e.einbehalten).toBe(e.berechnung.pfaendbar)
    // Und ausgezahlt der Rest vom vollen Netto
    expect(e.verteilung.verbleibt).toBe(runde(2600 - e.einbehalten))
  })

  it('behält nichts ein, wenn es keine Pfändung gibt', () => {
    const e = rechne({ nettoGesamt: 3000 }, 0, [], JULI25)
    expect(e.einbehalten).toBe(0)
    expect(e.verteilung.verbleibt).toBe(3000)
    // Gerechnet wird trotzdem — der Beleg soll zeigen, was pfändbar WÄRE.
    expect(e.berechnung.pfaendbar).toBeGreaterThan(0)
  })

  it('bricht ab, wenn die Tabelle für den Zeitraum fehlt', () => {
    const jahr = Number(TABELLEN[TABELLEN.length - 1].ab.slice(0, 4)) + 1
    expect(() => rechne({ nettoGesamt: 3000 }, 0, [], `${jahr}-12-01`))
      .toThrow(/Pfändungstabelle/)
  })
})
