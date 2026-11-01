import { describe, it, expect } from 'vitest'
import {
  zuschlagSteuerfrei, FREI_NACHT, FREI_SONNTAG, FREI_FEIERTAG,
  GRUNDLOHN_GRENZE_STEUER, GRUNDLOHN_GRENZE_SV,
} from '../zuschlag-steuerfrei'

/**
 * §275 Die Steuerfreiheit der Zuschläge, geprüft an der Vorschrift.
 *
 * Diese Rechnung war bisher nur mittelbar geprüft — über ganze Abrechnungen,
 * in denen sie eine Zwischenzahl war. Wer dort einen Fehler einbaut, sieht
 * im Ergebnis ein um ein paar Euro verschobenes Netto und hält es für die
 * Steuertabelle. Seit sie ein eigenes Modul ist, wird sie einzeln geprüft.
 */

const LEER = {
  grundlohn: 0,
  nachtBetrag: 0, nachtStunden: 0,
  sonntagBetrag: 0, sonntagStunden: 0,
  feiertagBetrag: 0, feiertagStunden: 0,
}

describe('§275 zuschlagSteuerfrei — die Höchstsätze', () => {
  it('stellt den Nachtzuschlag bis 25 % des Grundlohns frei', () => {
    // 20 €/h, 10 Nachtstunden → Höchstbetrag 20 × 10 × 0,25 = 50 €
    const r = zuschlagSteuerfrei({
      ...LEER, grundlohn: 20, nachtBetrag: 50, nachtStunden: 10,
    })
    expect(r.steuerfrei).toBe(50)
  })

  it('und was darüber gezahlt wird, bleibt steuerpflichtig', () => {
    // Derselbe Fall, aber es werden 80 € gezahlt. Frei bleiben trotzdem 50.
    const r = zuschlagSteuerfrei({
      ...LEER, grundlohn: 20, nachtBetrag: 80, nachtStunden: 10,
    })
    expect(r.steuerfrei).toBe(50)
  })

  it('zahlt jemand WENIGER als erlaubt, ist nur das Gezahlte frei', () => {
    /*
     * Die Gegenprobe zu „nimm immer den Höchstsatz": Freigestellt wird der
     * tatsächlich gezahlte Zuschlag, nicht der mögliche. Wer hier den
     * Höchstsatz einsetzt, stellt Geld frei, das nie geflossen ist.
     */
    const r = zuschlagSteuerfrei({
      ...LEER, grundlohn: 20, nachtBetrag: 12, nachtStunden: 10,
    })
    expect(r.steuerfrei).toBe(12)
  })

  it('Sonntag 50 %, Feiertag 125 %', () => {
    const sonntag = zuschlagSteuerfrei({
      ...LEER, grundlohn: 20, sonntagBetrag: 999, sonntagStunden: 8,
    })
    expect(sonntag.steuerfrei).toBe(20 * 8 * FREI_SONNTAG)

    const feiertag = zuschlagSteuerfrei({
      ...LEER, grundlohn: 20, feiertagBetrag: 999, feiertagStunden: 8,
    })
    expect(feiertag.steuerfrei).toBe(20 * 8 * FREI_FEIERTAG)
  })

  it('die Sätze sind die des Gesetzes', () => {
    expect(FREI_NACHT).toBe(0.25)
    expect(FREI_SONNTAG).toBe(0.5)
    expect(FREI_FEIERTAG).toBe(1.25)
  })
})

describe('§275 Die beiden Grundlohngrenzen greifen getrennt', () => {
  /*
   * Der Fall, auf den es ankommt und den eine einzige Zahl nicht abbilden
   * kann: Bei 40 €/h Grundlohn ist der Zuschlag voll STEUERfrei (Grenze 50),
   * aber nur bis 25 €/h BEITRAGSfrei. Wer beide Grenzen gleichsetzt, rechnet
   * entweder zu viel Steuer oder zu wenig Beitrag — und beides fällt erst
   * bei einer Prüfung auf, Jahre später.
   */
  it('über 25 €/h ist mehr steuerfrei als beitragsfrei', () => {
    const r = zuschlagSteuerfrei({
      ...LEER, grundlohn: 40, nachtBetrag: 500, nachtStunden: 20,
    })
    expect(r.steuerfrei).toBe(40 * 20 * 0.25)        // 200
    expect(r.svfrei).toBe(GRUNDLOHN_GRENZE_SV * 20 * 0.25)  // 125
    expect(r.svfrei).toBeLessThan(r.steuerfrei)
  })

  it('unter 25 €/h sind beide gleich', () => {
    const r = zuschlagSteuerfrei({
      ...LEER, grundlohn: 18, nachtBetrag: 500, nachtStunden: 20,
    })
    expect(r.svfrei).toBe(r.steuerfrei)
  })

  it('über 50 €/h wird bei 50 gedeckelt', () => {
    const r = zuschlagSteuerfrei({
      ...LEER, grundlohn: 90, nachtBetrag: 9999, nachtStunden: 10,
    })
    expect(r.steuerfrei).toBe(GRUNDLOHN_GRENZE_STEUER * 10 * 0.25)  // 125
  })
})

describe('§275 Was NICHT freigestellt wird', () => {
  /*
   * Für Samstagszuschläge gibt es keine Vorschrift. Das Modul kennt sie
   * deshalb gar nicht — diese Prüfung hält fest, dass das Absicht ist und
   * nicht eine vergessene Zeile.
   */
  it('Samstagszuschläge kommen gar nicht vor', () => {
    const lage = { ...LEER, grundlohn: 20 }
    expect(Object.keys(lage)).not.toContain('samstagBetrag')
    expect(zuschlagSteuerfrei(lage).steuerfrei).toBe(0)
  })

  it('ohne Grundlohn wird nichts freigestellt — und es wird gesagt, warum', () => {
    const r = zuschlagSteuerfrei({
      ...LEER, grundlohn: 0, nachtBetrag: 80, nachtStunden: 10,
    })
    expect(r.steuerfrei).toBe(0)
    expect(r.svfrei).toBe(0)
    expect(r.hinweis).toMatch(/§3b/)
  })

  it('ohne Grundlohn UND ohne Zuschlag gibt es auch nichts zu erklären', () => {
    expect(zuschlagSteuerfrei(LEER).hinweis).toBeUndefined()
  })

  it('ein negativer Grundlohn wird wie keiner behandelt', () => {
    const r = zuschlagSteuerfrei({
      ...LEER, grundlohn: -5, nachtBetrag: 80, nachtStunden: 10,
    })
    expect(r.steuerfrei).toBe(0)
  })

  it('Zuschlag ohne Stunden stellt nichts frei', () => {
    /*
     * Die Grenze ist ein Produkt aus Stunden. Ohne Stunden ist sie null —
     * ein Betrag, der ohne zugehörige Stunden dasteht, ist entweder falsch
     * erfasst oder kein §3b-Zuschlag. In beiden Fällen wäre Freistellen die
     * teurere Antwort.
     */
    const r = zuschlagSteuerfrei({
      ...LEER, grundlohn: 20, nachtBetrag: 80, nachtStunden: 0,
    })
    expect(r.steuerfrei).toBe(0)
  })
})

describe('§275 Mehrere Arten zugleich', () => {
  it('werden einzeln begrenzt und dann addiert', () => {
    /*
     * Nicht ein gemeinsamer Topf: Jede Art hat ihren eigenen Höchstsatz.
     * Wer die Beträge zusammenwirft und einmal begrenzt, verschiebt Geld
     * zwischen Nacht und Feiertag — und bekommt bei genau derselben Arbeit
     * ein anderes Ergebnis.
     */
    const r = zuschlagSteuerfrei({
      grundlohn: 20,
      nachtBetrag: 999, nachtStunden: 10,       // frei: 20×10×0,25 = 50
      sonntagBetrag: 999, sonntagStunden: 8,    // frei: 20×8×0,50  = 80
      feiertagBetrag: 999, feiertagStunden: 4,  // frei: 20×4×1,25  = 100
    })
    expect(r.steuerfrei).toBe(230)
  })

  it('und auf zwei Stellen gerundet', () => {
    const r = zuschlagSteuerfrei({
      ...LEER, grundlohn: 17.37, nachtBetrag: 999, nachtStunden: 7,
    })
    expect(r.steuerfrei).toBe(30.40)   // 17,37 × 7 × 0,25 = 30,3975
  })
})
