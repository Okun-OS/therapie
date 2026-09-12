import { describe, it, expect } from 'vitest'
import { freigabelage, FREIGEGEBEN } from '../monatsfreigabe'

/**
 * §136 Diese Regel entscheidet darüber, ob Geld fließt. Sie gehört deshalb zu
 * den Stellen, die man einzeln nachrechnen können muss — und zwar in beide
 * Richtungen: Wer durchgelassen wird, ist die eine Hälfte. Die andere ist, wer
 * aufgehalten wird und ob die Begründung stimmt.
 */

describe('Wann abgerechnet werden darf', () => {
  it('lässt einen freigegebenen Monat durch', () => {
    const l = freigabelage({ abschlussStatus: FREIGEGEBEN, hatZeiten: true, lohnart: 'monat' })
    expect(l.frei).toBe(true)
    expect(l.grund).toBe('freigegeben')
  })

  it('lässt ihn auch bei Stundenlohn durch', () => {
    expect(freigabelage({ abschlussStatus: FREIGEGEBEN, hatZeiten: true, lohnart: 'stunde' }).frei)
      .toBe(true)
  })

  it('hält einen geprüften, aber nicht freigegebenen Monat auf', () => {
    // "Geprüft" heißt angesehen, nicht abgenommen. Solange kann sich noch etwas
    // ändern — und genau darauf ruht die Abrechnung nicht.
    const l = freigabelage({ abschlussStatus: 'geprueft', hatZeiten: true, lohnart: 'monat' })
    expect(l.frei).toBe(false)
    expect(l.grund).toBe('nicht_freigegeben')
    expect(l.text).toContain('geprueft')
  })

  it('hält einen offenen Monat auf', () => {
    expect(freigabelage({ abschlussStatus: 'offen', hatZeiten: true, lohnart: 'monat' }).frei)
      .toBe(false)
  })

  it('hält auf, wenn es Zeiten gibt, aber gar keinen Abschluss', () => {
    const l = freigabelage({ abschlussStatus: null, hatZeiten: true, lohnart: 'monat' })
    expect(l.frei).toBe(false)
    expect(l.grund).toBe('kein_abschluss')
    expect(l.text).toContain('Standortleitung')
  })
})

describe('Wo die Regel nicht greift', () => {
  it('lässt ein festes Gehalt ohne erfasste Zeiten durch', () => {
    // Es gäbe nichts, was durch eine Freigabe sicherer würde. Hier zu blockieren
    // wäre keine Sorgfalt, sondern eine Schikane.
    const l = freigabelage({ abschlussStatus: null, hatZeiten: false, lohnart: 'monat' })
    expect(l.frei).toBe(true)
    expect(l.grund).toBe('ohne_zeitbezug')
  })

  it('hält einen Stundenlöhner trotzdem auf', () => {
    // Bei ihm ist die erfasste Zeit nicht nur Grundlage der Zuschläge, sondern
    // des Entgelts selbst. Keine Zeiten heißt hier: etwas stimmt nicht.
    const l = freigabelage({ abschlussStatus: null, hatZeiten: false, lohnart: 'stunde' })
    expect(l.frei).toBe(false)
    expect(l.text).toContain('Stundenlohn')
  })

  it('hält auch ein festes Gehalt auf, sobald Zeiten da sind', () => {
    // Aus den Zeiten entstehen Zuschläge — und die sind Geld.
    expect(freigabelage({ abschlussStatus: null, hatZeiten: true, lohnart: 'monat' }).frei)
      .toBe(false)
  })

  it('behandelt eine fehlende Lohnart wie ein festes Gehalt', () => {
    expect(freigabelage({ abschlussStatus: null, hatZeiten: false }).frei).toBe(true)
    expect(freigabelage({ abschlussStatus: null, hatZeiten: true }).frei).toBe(false)
  })
})

describe('Die Begründung ist für Menschen', () => {
  it('sagt bei jeder Lage in einem Satz, woran es liegt', () => {
    const lagen = [
      { abschlussStatus: FREIGEGEBEN, hatZeiten: true },
      { abschlussStatus: 'offen', hatZeiten: true },
      { abschlussStatus: null, hatZeiten: true },
      { abschlussStatus: null, hatZeiten: false },
    ]
    for (const e of lagen) {
      const l = freigabelage(e)
      expect(l.text.length).toBeGreaterThan(30)
      expect(l.text.endsWith('.')).toBe(true)
    }
  })
})
