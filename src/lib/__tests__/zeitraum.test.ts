import { describe, it, expect } from 'vitest'
import {
  alsDatum, alsIso, wochentagMontagNull, monatsRaster, monatVerschieben,
  imZeitraum, spanneWaehlen, tageInSpanne, startMonat,
} from '../zeitraum'

/**
 * §283 Die Rechnung hinter der Zeitraumwahl.
 *
 * Geprüft wird vor allem das, was in einer Komponente still danebengeht:
 * ein Raster, das am falschen Wochentag beginnt, eine Spanne über den
 * Jahreswechsel, ein Klick, der eine umgekehrte Spanne erzeugt — und der
 * gemeldete Fall, dass der Kalender im falschen Monat aufgeht.
 */

describe('§283 alsDatum', () => {
  it('liest ein Datum ohne Zeitzonenverschiebung', () => {
    const d = alsDatum('2026-12-14')!
    expect(d.getUTCFullYear()).toBe(2026)
    expect(d.getUTCMonth()).toBe(11)
    expect(d.getUTCDate()).toBe(14)
  })

  /*
   * Der Fehler, der sonst erst auffällt, wenn jemand östlich von Greenwich
   * sitzt: `new Date('2026-12-14')` ist Mitternacht UTC, örtlich also der
   * 13. um 01:00. Ein Kalender, der jeden Tag um eins verschiebt, ist
   * schlimmer als keiner.
   */
  it('und zwar unabhängig von der Zeitzone', () => {
    const vorher = process.env.TZ
    try {
      for (const zone of ['Europe/Berlin', 'Pacific/Auckland', 'America/Los_Angeles']) {
        process.env.TZ = zone
        expect(alsIso(alsDatum('2026-12-14')!), zone).toBe('2026-12-14')
      }
    } finally {
      process.env.TZ = vorher
    }
  })

  it('weist einen Tag zurück, den es nicht gibt', () => {
    expect(alsDatum('2026-02-31')).toBeNull()
    expect(alsDatum('2026-13-01')).toBeNull()
  })

  it('und Unsinn ebenso', () => {
    expect(alsDatum('')).toBeNull()
    expect(alsDatum('morgen')).toBeNull()
    expect(alsDatum(null)).toBeNull()
  })
})

describe('§283 Das Monatsraster', () => {
  it('beginnt am Montag', () => {
    expect(wochentagMontagNull(alsDatum('2026-12-14')!)).toBe(0)   // ein Montag
    expect(wochentagMontagNull(alsDatum('2026-12-20')!)).toBe(6)   // ein Sonntag
  })

  it('ist immer sechs Wochen hoch', () => {
    for (const [j, m] of [[2026, 2], [2026, 12], [2027, 1]] as const) {
      expect(monatsRaster(j, m), `${j}-${m}`).toHaveLength(42)
    }
  })

  it('fängt mit dem Montag vor dem Monatsersten an', () => {
    // Der 1. Dezember 2026 ist ein Dienstag → das Raster beginnt am 30.11.
    expect(monatsRaster(2026, 12)[0].datum).toBe('2026-11-30')
    expect(monatsRaster(2026, 12)[0].imMonat).toBe(false)
    expect(monatsRaster(2026, 12)[1].datum).toBe('2026-12-01')
    expect(monatsRaster(2026, 12)[1].imMonat).toBe(true)
  })

  it('markiert genau die Tage des Monats', () => {
    const dezember = monatsRaster(2026, 12).filter(t => t.imMonat)
    expect(dezember).toHaveLength(31)
    expect(dezember[0].datum).toBe('2026-12-01')
    expect(dezember[30].datum).toBe('2026-12-31')
  })

  it('und kommt mit dem Schaltjahr zurecht', () => {
    expect(monatsRaster(2028, 2).filter(t => t.imMonat)).toHaveLength(29)
  })
})

describe('§283 Blättern', () => {
  it('einen Monat vor und zurück', () => {
    expect(monatVerschieben(2026, 6, 1)).toEqual({ jahr: 2026, monat: 7 })
    expect(monatVerschieben(2026, 6, -1)).toEqual({ jahr: 2026, monat: 5 })
  })

  it('über den Jahreswechsel', () => {
    expect(monatVerschieben(2026, 12, 1)).toEqual({ jahr: 2027, monat: 1 })
    expect(monatVerschieben(2026, 1, -1)).toEqual({ jahr: 2025, monat: 12 })
  })
})

describe('§283 Eine Spanne wählen', () => {
  const leer = { von: '', bis: '' }

  it('der erste Klick setzt den Anfang', () => {
    expect(spanneWaehlen(leer, '2026-12-14')).toEqual({ von: '2026-12-14', bis: '' })
  })

  it('der zweite das Ende', () => {
    expect(spanneWaehlen({ von: '2026-12-14', bis: '' }, '2026-12-20'))
      .toEqual({ von: '2026-12-14', bis: '2026-12-20' })
  })

  it('derselbe Tag zweimal ist ein Tag', () => {
    const eins = spanneWaehlen({ von: '2026-12-14', bis: '' }, '2026-12-14')
    expect(eins).toEqual({ von: '2026-12-14', bis: '2026-12-14' })
    expect(tageInSpanne(eins)).toBe(1)
  })

  /*
   * Der Fall, den eine naive Fassung falsch macht: Wer nach dem 20. auf den
   * 14. klickt, meint nicht „vom 20. bis zum 14." — das wären null Tage.
   * Er fängt neu an.
   */
  it('ein Klick vor den Anfang beginnt neu, statt umzudrehen', () => {
    expect(spanneWaehlen({ von: '2026-12-20', bis: '' }, '2026-12-14'))
      .toEqual({ von: '2026-12-14', bis: '' })
  })

  it('ist die Spanne vollständig, beginnt der nächste Klick von vorn', () => {
    expect(spanneWaehlen({ von: '2026-12-14', bis: '2026-12-20' }, '2026-12-28'))
      .toEqual({ von: '2026-12-28', bis: '' })
  })
})

describe('§283 Was in der Spanne liegt', () => {
  const spanne = { von: '2026-12-14', bis: '2026-12-20' }

  it('beide Enden gehören dazu', () => {
    expect(imZeitraum('2026-12-14', spanne)).toBe(true)
    expect(imZeitraum('2026-12-20', spanne)).toBe(true)
  })

  it('was davor oder danach liegt, nicht', () => {
    expect(imZeitraum('2026-12-13', spanne)).toBe(false)
    expect(imZeitraum('2026-12-21', spanne)).toBe(false)
  })

  it('ohne Ende zählt nur der Anfangstag', () => {
    expect(imZeitraum('2026-12-14', { von: '2026-12-14', bis: '' })).toBe(true)
    expect(imZeitraum('2026-12-15', { von: '2026-12-14', bis: '' })).toBe(false)
  })

  it('ohne Anfang liegt nichts darin', () => {
    expect(imZeitraum('2026-12-14', { von: '', bis: '' })).toBe(false)
  })
})

describe('§283 Tage zählen', () => {
  it('zählt beide Enden mit', () => {
    expect(tageInSpanne({ von: '2026-12-14', bis: '2026-12-20' })).toBe(7)
  })

  it('über den Monatswechsel', () => {
    expect(tageInSpanne({ von: '2026-12-28', bis: '2027-01-03' })).toBe(7)
  })

  it('eine umgekehrte Spanne zählt null, statt negativ zu werden', () => {
    expect(tageInSpanne({ von: '2026-12-20', bis: '2026-12-14' })).toBe(0)
  })

  it('und eine leere auch', () => {
    expect(tageInSpanne({ von: '', bis: '' })).toBe(0)
  })
})

describe('§283 Welcher Monat beim Öffnen gezeigt wird', () => {
  /*
   * DER GEMELDETE FALL: „Erster Tag war der 14. Dezember, und wenn ich dann
   * auf den letzten Tag gehen wollte, war ich wieder im November."
   */
  it('der des gewählten Anfangs — nicht der laufende', () => {
    const imNovember = new Date(Date.UTC(2026, 10, 6))
    expect(startMonat({ von: '2026-12-14', bis: '' }, imNovember))
      .toEqual({ jahr: 2026, monat: 12 })
  })

  it('ohne Auswahl der laufende Monat', () => {
    const imNovember = new Date(Date.UTC(2026, 10, 6))
    expect(startMonat({ von: '', bis: '' }, imNovember))
      .toEqual({ jahr: 2026, monat: 11 })
  })

  it('und bei einem unlesbaren Anfang ebenfalls', () => {
    const imNovember = new Date(Date.UTC(2026, 10, 6))
    expect(startMonat({ von: 'morgen', bis: '' }, imNovember))
      .toEqual({ jahr: 2026, monat: 11 })
  })
})
