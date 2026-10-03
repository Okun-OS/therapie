import { describe, it, expect } from 'vitest'
import {
  pruefeAktion, bestimmeZeitpunkt, gearbeiteteMinuten, alsTag, alsUhrzeit,
  MAX_NACHREICHUNG_STUNDEN,
} from '../stempeluhr'

/**
 * §137 Die Reihenfolge der Handgriffe entscheidet darüber, ob am Monatsende die
 * richtige Zahl herauskommt. Und der Zeitpunkt entscheidet darüber, wie viel
 * Geld fließt. Beides gehört einzeln nachgerechnet.
 */

const aus = { laeuft: false, pause: false }
const drin = { laeuft: true, pause: false }
const inPause = { laeuft: true, pause: true }

describe('Welcher Handgriff wann erlaubt ist', () => {
  it('lässt einstempeln, wenn nichts läuft', () => {
    expect(pruefeAktion('kommen', aus).erlaubt).toBe(true)
  })

  it('verhindert doppeltes Einstempeln', () => {
    // Zweimal einstempeln ohne auszustempeln liesse die Zeit doppelt laufen.
    const p = pruefeAktion('kommen', drin)
    expect(p.erlaubt).toBe(false)
    expect(p.text).toContain('bereits eingestempelt')
  })

  it('verhindert Ausstempeln ohne Einstempeln', () => {
    expect(pruefeAktion('gehen', aus).erlaubt).toBe(false)
  })

  it('lässt ausstempeln, wenn etwas läuft', () => {
    expect(pruefeAktion('gehen', drin).erlaubt).toBe(true)
  })

  it('erlaubt eine Pause nur während der Arbeitszeit', () => {
    expect(pruefeAktion('pause-start', aus).erlaubt).toBe(false)
    expect(pruefeAktion('pause-start', drin).erlaubt).toBe(true)
  })

  it('verhindert eine zweite Pause in der Pause', () => {
    expect(pruefeAktion('pause-start', inPause).erlaubt).toBe(false)
  })

  it('beendet nur eine laufende Pause', () => {
    expect(pruefeAktion('pause-ende', drin).erlaubt).toBe(false)
    expect(pruefeAktion('pause-ende', inPause).erlaubt).toBe(true)
  })

  it('erklärt jede Ablehnung in einem Satz', () => {
    const faelle = [
      pruefeAktion('kommen', drin),
      pruefeAktion('gehen', aus),
      pruefeAktion('pause-start', aus),
      pruefeAktion('pause-ende', drin),
    ]
    for (const f of faelle) {
      expect(f.erlaubt).toBe(false)
      expect(f.text!.length).toBeGreaterThan(20)
    }
  })
})

describe('Welcher Zeitpunkt gilt', () => {
  const jetzt = new Date('2026-09-12T08:00:00Z')

  it('nimmt ohne Angabe die Uhrzeit des Servers', () => {
    const z = bestimmeZeitpunkt(null, jetzt)
    expect(z.zeitpunkt).toEqual(jetzt)
    expect(z.quelle).toBe('app')
  })

  it('übernimmt einen Zeitpunkt aus dem Funkloch', () => {
    // Um 05:50 gestempelt, um 08:00 übertragen: Es zählt 05:50.
    const z = bestimmeZeitpunkt('2026-09-12T05:50:00Z', jetzt)
    expect(z.zeitpunkt.toISOString()).toBe('2026-09-12T05:50:00.000Z')
    expect(z.quelle).toBe('offline')
  })

  it('verwirft einen Zeitpunkt aus der Zukunft', () => {
    // Wer die Uhr seines Telefons verstellt, soll nicht bestimmen, was am
    // Monatsende ausgezahlt wird.
    const z = bestimmeZeitpunkt('2026-09-12T09:00:00Z', jetzt)
    expect(z.zeitpunkt).toEqual(jetzt)
    expect(z.quelle).toBe('app')
    expect(z.hinweis).toContain('Zukunft')
  })

  it('duldet die kleine Abweichung zwischen zwei Uhren', () => {
    const z = bestimmeZeitpunkt('2026-09-12T08:01:00Z', jetzt)
    expect(z.zeitpunkt).toEqual(jetzt)
    expect(z.hinweis).toBeUndefined()
  })

  it(`verwirft, was länger als ${MAX_NACHREICHUNG_STUNDEN} Stunden zurückliegt`, () => {
    const z = bestimmeZeitpunkt('2026-09-10T08:00:00Z', jetzt)
    expect(z.zeitpunkt).toEqual(jetzt)
    expect(z.hinweis).toContain('Standortleitung')
  })

  it('verwirft Unlesbares, statt zu raten', () => {
    const z = bestimmeZeitpunkt('gestern früh', jetzt)
    expect(z.zeitpunkt).toEqual(jetzt)
    expect(z.hinweis).toContain('unlesbar')
  })
})

describe('Rechnen mit Zeiten', () => {
  it('rechnet eine Nachtschicht über Mitternacht richtig', () => {
    // 22:00 bis 06:00 sind acht Stunden, nicht minus sechzehn.
    const von = new Date('2026-09-12T22:00:00')
    const bis = new Date('2026-09-13T06:00:00')
    expect(gearbeiteteMinuten(von, bis)).toBe(480)
  })

  it('gibt bei verdrehten Zeiten nichts zurück statt einer negativen Zahl', () => {
    expect(gearbeiteteMinuten(new Date('2026-09-12T18:00:00'),
      new Date('2026-09-12T09:00:00'))).toBe(0)
  })

  it('schreibt den Tag in der Zeitzone des Betriebs', () => {
    const d = new Date(2026, 8, 5, 22, 30)
    expect(alsTag(d)).toBe('2026-09-05')
    expect(alsUhrzeit(d)).toBe('22:30')
  })
})
