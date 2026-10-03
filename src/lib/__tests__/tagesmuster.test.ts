import { describe, it, expect } from 'vitest'
import { pruefeTagesmuster, musterText, moeglicheArbeitstage } from '../tagesmuster'

/**
 * §181 Die Prüfung, die einen Betrieb davor bewahrt, ohne Dienstplan dazustehen.
 *
 * WAS AUF DEM SPIEL STEHT
 * Tagesmuster und Wochenstundenzahl sind zwei Angaben über dieselbe Sache.
 * Laufen sie auseinander, findet der Rechendienst nicht etwa für diese Person
 * keinen Dienst, sondern für den GANZEN Standort keinen Plan — und meldet
 * dabei Ursachen, die nicht zutreffen. Gemessen am 02.10.2026: 35 Std. → Plan,
 * 28 → kein Plan, 40 → kein Plan, 35 → Plan.
 *
 * Diese Funktion ist der Ort, an dem das abgefangen wird. Deshalb wird hier
 * nicht nur geprüft, dass sie Unsinn ablehnt, sondern auch — und das ist die
 * wichtigere Hälfte —, dass sie Richtiges durchlässt. Eine Prüfung, die zu
 * viel ablehnt, macht die Maske unbenutzbar, und dann trägt niemand mehr ein
 * Muster ein.
 */

describe('Tagesmuster lesen und prüfen', () => {
  it('nimmt ein Muster an, das zur Stundenzahl passt', () => {
    const r = pruefeTagesmuster([{ stunden: 8, tage: 5 }], 40, 5)
    expect(r.fehler).toBeNull()
    expect(r.muster).toEqual([{ stunden: 8, tage: 5 }])
    expect(r.wochenstunden).toBe(40)
    expect(r.arbeitstage).toBe(5)
  })

  it('nimmt auch ein gemischtes Muster an', () => {
    const r = pruefeTagesmuster([{ stunden: 8, tage: 3 }, { stunden: 6, tage: 1 }], 30, 4)
    expect(r.fehler).toBeNull()
    expect(r.wochenstunden).toBe(30)
  })

  it('nimmt halbe und viertel Stunden an', () => {
    expect(pruefeTagesmuster([{ stunden: 7.75, tage: 4 }], 31, 5).fehler).toBeNull()
  })

  // ── Kein Muster ist ein gültiger Zustand ─────────────────────────────

  it('lässt „kein Muster" zu — nicht jeder Betrieb arbeitet in festen Portionen', () => {
    for (const leer of [null, undefined, []]) {
      const r = pruefeTagesmuster(leer, 40, 5)
      expect(r.fehler).toBeNull()
      expect(r.muster).toBeNull()
    }
  })

  it('prüft ohne Sollstunden nur die Form', () => {
    const r = pruefeTagesmuster([{ stunden: 8, tage: 5 }])
    expect(r.fehler).toBeNull()
    expect(r.wochenstunden).toBe(40)
  })

  // ── Der eigentliche Zweck ────────────────────────────────────────────

  it('lehnt ein Muster ab, dessen Summe nicht zur Stundenzahl passt', () => {
    const r = pruefeTagesmuster([{ stunden: 7, tage: 5 }], 28, 5)
    expect(r.muster).toBeNull()
    expect(r.fehler).toContain('35')
    expect(r.fehler).toContain('28')
  })

  it('nennt im Fehler beide Zahlen — sonst weiß niemand, was zu ändern ist', () => {
    const r = pruefeTagesmuster([{ stunden: 8, tage: 5 }], 32)
    expect(r.fehler).toMatch(/40/)
    expect(r.fehler).toMatch(/32/)
    expect(r.fehler).toMatch(/Dienstplan/)
  })

  it('merkt auch eine Abweichung von einer halben Stunde', () => {
    expect(pruefeTagesmuster([{ stunden: 8, tage: 5 }], 39.5).fehler).not.toBeNull()
  })

  it('verzeiht Rundungsfehler aus Gleitkommazahlen', () => {
    // 7 × 7,25 ergibt in JavaScript 50.75000000000001
    const r = pruefeTagesmuster([{ stunden: 7.25, tage: 7 }], 7.25 * 7)
    expect(r.fehler).toBeNull()
  })

  // ── Mehr Tage als die Woche hergibt ──────────────────────────────────

  it('lehnt ein Muster ab, das mehr Tage belegt als zur Verfügung stehen', () => {
    const r = pruefeTagesmuster([{ stunden: 8, tage: 5 }], 40, 4)
    expect(r.muster).toBeNull()
    expect(r.fehler).toContain('5')
    expect(r.fehler).toContain('4')
  })

  it('rechnet feste freie Tage aus den möglichen Arbeitstagen heraus', () => {
    expect(moeglicheArbeitstage(5, ['Fr'])).toBe(4)
    expect(moeglicheArbeitstage(5, ['Do', 'Fr'])).toBe(3)
    expect(moeglicheArbeitstage(5, [])).toBe(5)
    expect(moeglicheArbeitstage(null, null)).toBe(5)
    // Mehr freie Tage als Arbeitstage ergibt null, nicht eine negative Zahl.
    expect(moeglicheArbeitstage(2, ['Mo', 'Di', 'Mi'])).toBe(0)
  })

  it('passt für eine Vier-Tage-Kraft mit festem freien Freitag', () => {
    const r = pruefeTagesmuster(
      [{ stunden: 8, tage: 3 }, { stunden: 6, tage: 1 }], 30, moeglicheArbeitstage(5, ['Fr']),
    )
    expect(r.fehler).toBeNull()
  })

  // ── Kaputte Eingaben ─────────────────────────────────────────────────

  it('lehnt ab, was gar keine Liste ist', () => {
    expect(pruefeTagesmuster({ stunden: 8 }).fehler).not.toBeNull()
    expect(pruefeTagesmuster('8×5').fehler).not.toBeNull()
    expect(pruefeTagesmuster(40).fehler).not.toBeNull()
  })

  it('lehnt Einträge ohne Zahlen ab', () => {
    expect(pruefeTagesmuster([{ stunden: 'acht', tage: 5 }]).fehler).not.toBeNull()
    expect(pruefeTagesmuster([{ tage: 5 }]).fehler).not.toBeNull()
    expect(pruefeTagesmuster([null]).fehler).not.toBeNull()
  })

  it('lehnt unmögliche Dienstlängen ab', () => {
    expect(pruefeTagesmuster([{ stunden: 0, tage: 5 }]).fehler).not.toBeNull()
    expect(pruefeTagesmuster([{ stunden: 13, tage: 5 }]).fehler).not.toBeNull()
    expect(pruefeTagesmuster([{ stunden: -8, tage: 5 }]).fehler).not.toBeNull()
  })

  it('lehnt krumme Dienstlängen ab — das ist ein Tippfehler, keine Angabe', () => {
    const r = pruefeTagesmuster([{ stunden: 7.37, tage: 5 }])
    expect(r.fehler).toContain('Viertelstunden')
  })

  it('lehnt unmögliche Tageszahlen ab', () => {
    expect(pruefeTagesmuster([{ stunden: 8, tage: 0 }]).fehler).not.toBeNull()
    expect(pruefeTagesmuster([{ stunden: 8, tage: 8 }]).fehler).not.toBeNull()
    expect(pruefeTagesmuster([{ stunden: 8, tage: 2.5 }]).fehler).not.toBeNull()
  })

  it('lehnt dieselbe Dienstlänge zweimal ab', () => {
    const r = pruefeTagesmuster([{ stunden: 8, tage: 2 }, { stunden: 8, tage: 3 }])
    expect(r.fehler).toContain('zweimal')
  })

  it('lehnt mehr als vier verschiedene Dienstlängen ab', () => {
    const r = pruefeTagesmuster([
      { stunden: 8, tage: 1 }, { stunden: 7, tage: 1 },
      { stunden: 6, tage: 1 }, { stunden: 5, tage: 1 }, { stunden: 4, tage: 1 },
    ])
    expect(r.fehler).not.toBeNull()
  })

  it('gibt bei jedem Fehler kein Muster zurück — halb gültig gibt es nicht', () => {
    for (const kaputt of [
      [{ stunden: 8, tage: 99 }],
      [{ stunden: 99, tage: 1 }],
      'quatsch',
    ]) {
      expect(pruefeTagesmuster(kaputt).muster).toBeNull()
    }
  })
})

describe('Das Muster aufschreiben', () => {
  it('schreibt es so, wie ein Mensch es sagt', () => {
    expect(musterText([{ stunden: 8, tage: 3 }, { stunden: 6, tage: 1 }]))
      .toBe('3 × 8 Std., 1 × 6 Std.')
  })

  it('sortiert von lang nach kurz', () => {
    expect(musterText([{ stunden: 6, tage: 1 }, { stunden: 8, tage: 3 }]))
      .toBe('3 × 8 Std., 1 × 6 Std.')
  })

  it('schreibt Kommazahlen deutsch', () => {
    expect(musterText([{ stunden: 7.5, tage: 4 }])).toBe('4 × 7,5 Std.')
  })

  it('sagt es auch, wenn es keines gibt', () => {
    expect(musterText(null)).toBe('kein festes Muster')
    expect(musterText([])).toBe('kein festes Muster')
  })
})
