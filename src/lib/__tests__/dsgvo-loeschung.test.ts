import { describe, it, expect } from 'vitest'
import { modelleOhneZugriff, anonymisierungOhneVerfahren } from '../dsgvo-loeschung'
import { modelleOhneAbfrage } from '../dsgvo-auskunft'
import { DATENARTEN } from '../dsgvo-katalog'

/**
 * §128 Diese beiden Prüfungen decken den stillsten Fehler des Löschkonzepts ab:
 * eine Datenart steht im Katalog, erscheint brav in der Auskunft — und wird
 * beim Löschen übersprungen, weil nie jemand eine Abfrage dafür geschrieben
 * hat. Nichts schlägt fehl, nichts fällt auf, die Daten bleiben liegen.
 */

describe('Jede Tabelle im Katalog ist auch löschbar', () => {
  it('hat für jedes Modell einen Zugriff', () => {
    const fehlend = modelleOhneZugriff()
    expect(fehlend,
      `Diese Tabellen stehen im Katalog, werden beim Löschen aber übersprungen:\n`
      + `  ${fehlend.join('\n  ')}\n\n`
      + `Trage sie in ZUGRIFF in src/lib/dsgvo-loeschung.ts ein — mit Zählen `
      + `und Löschen. Sonst bleiben die Daten nach einer Löschung liegen.`,
    ).toEqual([])
  })

  it('führt jedes Modell auch in der Auskunft', () => {
    const fehlend = modelleOhneAbfrage()
    expect(fehlend,
      `Diese Tabellen stehen im Katalog, erscheinen in der Auskunft aber leer:\n`
      + `  ${fehlend.join('\n  ')}\n\n`
      + `Trage sie in ABFRAGEN in src/lib/dsgvo-auskunft.ts ein. Sonst sieht eine `
      + `unvollständige Auskunft aus wie „darüber haben wir nichts".`,
    ).toEqual([])
  })

  it('kann jede zu anonymisierende Tabelle wirklich anonymisieren', () => {
    // Ohne eigenes Verfahren fiele die Datenart auf Löschen zurück — der
    // Betrieb verlöre seine Plangeschichte, ohne dass es jemand merkt.
    expect(anonymisierungOhneVerfahren()).toEqual([])
  })
})

describe('Der Katalog beschreibt einen vollständigen Ablauf', () => {
  it('behandelt jede Datenart genau einmal', () => {
    const ids = DATENARTEN.map(d => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('führt keine Tabelle in zwei Datenarten', () => {
    // Sonst würde dieselbe Tabelle zweimal angefasst — beim zweiten Mal mit
    // einer anderen Behandlung, und welche gewinnt, wäre Zufall der Reihenfolge.
    const gesehen = new Map<string, string>()
    const doppelt: string[] = []
    for (const art of DATENARTEN) {
      for (const modell of art.modelle) {
        const vorher = gesehen.get(modell)
        if (vorher) doppelt.push(`${modell}: ${vorher} und ${art.id}`)
        else gesehen.set(modell, art.id)
      }
    }
    expect(doppelt).toEqual([])
  })
})
