import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
// Bewusst reines JavaScript: Skript und Prüfung benutzen dieselbe Datei,
// damit nicht zwei Leser auseinanderlaufen.
import { lesen, schriftBeginn } from '../../../scripts/png.mjs'
import { negativ, DUNKEL, AUFGABEN } from '../../../scripts/logo-negativ.mjs'

/**
 * §180 Die Negativfassung des Logos.
 *
 * WAS HIER WIRKLICH AUF DEM SPIEL STEHT
 * Die Anweisung war: das Zeichen absolut unberührt lassen, nur den Schriftzug
 * einsetzen. „Absolut unberührt" ist eine Zusage, die man nicht mit einem
 * Blick auf den Bildschirm einlöst — ein um zwei Punkte verschobener Farbton
 * im Schild sieht man nicht, und in einem Jahr weiß niemand mehr, ob das Logo
 * im Programm noch dasselbe ist wie das in der Signatur des Geschäftsführers.
 * Diese Prüfung vergleicht deshalb Byte für Byte.
 *
 * DIE GEGENPROBEN
 * Eine Prüfung, die nur sagt „links der Grenze ist nichts anders", wäre auch
 * dann grün, wenn das Skript gar nichts täte. Deshalb steht daneben: rechts
 * der Grenze IST etwas anders, dort ist kein Dunkel mehr übrig, und Türkis
 * und Gold sind trotzdem unangetastet.
 */

const MARKE = join(process.cwd(), 'public', 'brand')

type Bild = { w: number; h: number; rgba: Buffer }

/** Alle Farben eines Ausschnitts, gezählt — Alpha 0 zählt nicht mit. */
function farben(bild: Bild, x0: number, x1: number): Map<string, number> {
  const zaehler = new Map<string, number>()
  for (let y = 0; y < bild.h; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * bild.w + x) * 4
      if (bild.rgba[i + 3] === 0) continue
      const s = `${bild.rgba[i]},${bild.rgba[i + 1]},${bild.rgba[i + 2]},${bild.rgba[i + 3]}`
      zaehler.set(s, (zaehler.get(s) ?? 0) + 1)
    }
  }
  return zaehler
}

describe.each(AUFGABEN as [string, string][])('%s → %s', (quelle, ziel) => {
  const hell: Bild = lesen(join(MARKE, quelle))
  const dunkel: Bild = lesen(join(MARKE, ziel))
  const grenze: number = schriftBeginn(hell)

  it('findet die Grenze zwischen Zeichen und Schriftzug', () => {
    expect(grenze).toBeGreaterThan(0)
    expect(grenze).toBeLessThan(hell.w)
  })

  it('hat dieselben Maße wie die Vorlage', () => {
    expect([dunkel.w, dunkel.h]).toEqual([hell.w, hell.h])
  })

  it('lässt das Zeichen Byte für Byte unberührt', () => {
    let abweichungen = 0
    for (let y = 0; y < hell.h; y++) {
      for (let x = 0; x < grenze; x++) {
        const i = (y * hell.w + x) * 4
        for (let k = 0; k < 4; k++) if (hell.rgba[i + k] !== dunkel.rgba[i + k]) abweichungen++
      }
    }
    expect(abweichungen).toBe(0)
  })

  it('lässt die Deckung im ganzen Bild unberührt — also auch die weichen Kanten', () => {
    let abweichungen = 0
    for (let i = 3; i < hell.rgba.length; i += 4) {
      if (hell.rgba[i] !== dunkel.rgba[i]) abweichungen++
    }
    expect(abweichungen).toBe(0)
  })

  // ── Gegenproben: das Skript hat wirklich etwas getan ────────────────

  it('hat im Schriftzug etwas geändert', () => {
    let geaendert = 0
    for (let y = 0; y < hell.h; y++) {
      for (let x = grenze; x < hell.w; x++) {
        const i = (y * hell.w + x) * 4
        if (hell.rgba[i] !== dunkel.rgba[i]) geaendert++
      }
    }
    expect(geaendert).toBeGreaterThan(1000)
  })

  it('hatte im Schriftzug Dunkel — und hat danach keines mehr', () => {
    const dunkelZaehlen = (b: Bild) => {
      let n = 0
      for (let y = 0; y < b.h; y++) {
        for (let x = grenze; x < b.w; x++) {
          const i = (y * b.w + x) * 4
          if (b.rgba[i + 3] === 0) continue
          if (Math.max(b.rgba[i], b.rgba[i + 1], b.rgba[i + 2]) < DUNKEL) n++
        }
      }
      return n
    }
    expect(dunkelZaehlen(hell)).toBeGreaterThan(1000)
    expect(dunkelZaehlen(dunkel)).toBe(0)
  })

  it('lässt Türkis und Gold im Schriftzug unangetastet', () => {
    // Punktweise, nicht über gezählte Farben: sonst fiele nicht auf, wenn ein
    // türkiser Punkt weiß würde, während anderswo ein weißer türkis wird.
    let angefasst = 0
    for (let y = 0; y < hell.h; y++) {
      for (let x = grenze; x < hell.w; x++) {
        const i = (y * hell.w + x) * 4
        const warDunkel = hell.rgba[i + 3] !== 0
          && Math.max(hell.rgba[i], hell.rgba[i + 1], hell.rgba[i + 2]) < DUNKEL
        if (warDunkel) continue
        for (let k = 0; k < 4; k++) if (hell.rgba[i + k] !== dunkel.rgba[i + k]) angefasst++
      }
    }
    expect(angefasst).toBe(0)
  })

  it('ist genau das, was das Skript erzeugt — nicht von Hand nachgebessert', () => {
    const { bild: erwartet } = negativ(hell, grenze) as { bild: Bild }
    expect(Buffer.compare(erwartet.rgba, dunkel.rgba)).toBe(0)
  })

  it('trägt genug Kontrast auf dem dunklen Grund der Anwendung', () => {
    // §180 #0F1112 ist `navy-900`, der Grund von Website und Anmeldeseite.
    const GRUND = [0x0f, 0x11, 0x12]
    const anteil = (v: number) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    const helligkeit = ([r, g, b]: number[]) =>
      0.2126 * anteil(r) + 0.7152 * anteil(g) + 0.0722 * anteil(b)
    const grund = helligkeit(GRUND)

    // Jede deckende Farbe des Schriftzugs gegen den Grund messen.
    const zuSchwach: string[] = []
    for (const [ton, anzahl] of Array.from(farben(dunkel, grenze, dunkel.w))) {
      const [r, g, b, a] = ton.split(',').map(Number)
      if (a < 250 || anzahl < 200) continue // Kantenpunkte und Einzelgänger
      const f = helligkeit([r, g, b])
      const verhaeltnis = (Math.max(f, grund) + 0.05) / (Math.min(f, grund) + 0.05)
      if (verhaeltnis < 3) zuSchwach.push(`${ton} → ${verhaeltnis.toFixed(2)}:1`)
    }
    expect(zuSchwach).toEqual([])
  })
})
