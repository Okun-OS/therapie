import { describe, it, expect } from 'vitest'
import { zuschnitt } from '../bildzuschnitt'

/**
 * §203 Der Zuschnitt des Profilbilds.
 *
 * Der Fehler war reine Arithmetik: Das Foto wurde in Originalgröße auf eine
 * 256er Fläche gemalt, statt auf sie skaliert. Übrig blieb ein Ausschnitt aus
 * der Mitte — bei einem Porträt die Augen.
 *
 * Genau so eine Zeile prüft niemand beim Lesen nach. Als Funktion ist sie in
 * vier Zeilen nachgerechnet.
 */

const KANTE = 256

describe('§203 Profilbild in den Kreis', () => {
  it('malt ein quadratisches Bild genau auf die Fläche', () => {
    expect(zuschnitt(1000, 1000, KANTE))
      .toEqual({ dx: 0, dy: 0, dw: 256, dh: 256 })
  })

  it('verkleinert ein Handyfoto, statt einen Ausschnitt zu nehmen', () => {
    /*
     * Der gemeldete Fall. Mit dem alten Code wurden hier dw=3000 und dh=4000
     * gezeichnet — also 1:1 auf 256 Punkte Fläche. Entscheidend ist: Die
     * Zielbreite muss KLEINER als das Original sein.
     */
    const z = zuschnitt(3000, 4000, KANTE)
    expect(z.dw).toBe(256)
    expect(z.dw).toBeLessThan(3000)
    expect(Math.round(z.dh)).toBe(341) // 4000 * (256/3000)
  })

  it('füllt die Fläche immer ganz aus', () => {
    // Keine weißen Ränder: ein Profilbild mit Streifen sieht aus wie ein Fehler.
    for (const [b, h] of [[3000, 4000], [4000, 3000], [800, 200], [200, 800]]) {
      const z = zuschnitt(b, h, KANTE)
      expect(z.dw).toBeGreaterThanOrEqual(KANTE - 0.001)
      expect(z.dh).toBeGreaterThanOrEqual(KANTE - 0.001)
    }
  })

  it('schneidet mittig zu, nicht an einer Ecke', () => {
    // Bei einem Porträt ist das Gesicht in der Mitte. Ein Zuschnitt ab der
    // linken oberen Ecke träfe die Stirn.
    const hoch = zuschnitt(3000, 4000, KANTE)
    expect(hoch.dx).toBe(0)
    expect(hoch.dy).toBeCloseTo((KANTE - hoch.dh) / 2)
    expect(hoch.dy).toBeLessThan(0) // oben und unten wird gleich viel abgeschnitten

    const quer = zuschnitt(4000, 3000, KANTE)
    expect(quer.dy).toBe(0)
    expect(quer.dx).toBeCloseTo((KANTE - quer.dw) / 2)
  })

  it('vergrößert ein zu kleines Bild, statt es zu belassen', () => {
    const z = zuschnitt(64, 64, KANTE)
    expect(z.dw).toBe(256)
  })

  it('rechnet mit unsinnigen Maßen nicht weiter', () => {
    // Ein Bild ohne Maße gibt es nicht; NaN ergäbe eine leere Fläche.
    for (const [b, h] of [[0, 100], [100, 0], [-5, 100], [NaN, 100]]) {
      const z = zuschnitt(b, h, KANTE)
      expect(Number.isFinite(z.dw)).toBe(true)
      expect(Number.isFinite(z.dh)).toBe(true)
    }
  })
})
