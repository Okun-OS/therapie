import { describe, it, expect } from 'vitest'
import { letzterDienst, istFreitag } from '../belastung'

/**
 * §268 Die Vorgeschichte als Datum.
 *
 * Geprüft wird vor allem der Fall, der sich nicht durch Zählen ersetzen
 * lässt: Zwei Menschen mit genau gleich vielen Spätdiensten, aber einer
 * hatte den letzten gestern und der andere vor vier Wochen.
 */

const SCHICHTEN = [
  { id: 'f', typ: 'frueh' },
  { id: 's', typ: 'spaet' },
  { id: 'm', typ: 'mittel' },
]

// Absteigend nach Datum — so kommt die Liste aus der Datenbank.
const EINTRAEGE = [
  { date: '2026-10-29', shiftId: 'm' }, // Donnerstag
  { date: '2026-10-28', shiftId: 's' }, // Mittwoch
  { date: '2026-10-23', shiftId: 'f' }, // Freitag
  { date: '2026-10-16', shiftId: 's' }, // Freitag
  { date: '2026-10-09', shiftId: 'f' }, // Freitag
]

describe('§268 istFreitag', () => {
  it('erkennt einen Freitag', () => {
    expect(istFreitag('2026-10-23')).toBe(true)
    expect(istFreitag('2026-10-16')).toBe(true)
  })

  it('und alles andere nicht', () => {
    expect(istFreitag('2026-10-29')).toBe(false)
    expect(istFreitag('2026-10-24')).toBe(false)
  })

  /*
   * Die Zeile, auf die es ankommt. `new Date('2026-10-23')` liest Mitternacht
   * UTC; in Deutschland ist das örtlich der 22. um 1 oder 2 Uhr. Wer mit
   * `getDay()` rechnet, bekommt Donnerstag — und ein Dienstplan, der den
   * Freitag um einen Tag verfehlt, verfehlt genau das, was eigens geregelt
   * werden sollte.
   */
  it('und zwar unabhängig von der Zeitzone', () => {
    const vorher = process.env.TZ
    try {
      for (const zone of ['Europe/Berlin', 'Pacific/Auckland', 'America/Los_Angeles']) {
        process.env.TZ = zone
        expect(istFreitag('2026-10-23'), zone).toBe(true)
        expect(istFreitag('2026-10-22'), zone).toBe(false)
      }
    } finally {
      process.env.TZ = vorher
    }
  })

  it('mit Unsinn darin wird nichts erfunden', () => {
    expect(istFreitag('')).toBe(false)
    expect(istFreitag('irgendwann')).toBe(false)
  })
})

describe('§268 letzterDienst', () => {
  it('findet den jüngsten Dienst einer Art', () => {
    expect(letzterDienst(EINTRAEGE, SCHICHTEN, 'spaet')).toBe('2026-10-28')
    expect(letzterDienst(EINTRAEGE, SCHICHTEN, 'frueh')).toBe('2026-10-23')
  })

  /*
   * Der Kern: Der jüngste Spätdienst ist ein Mittwoch, der jüngste
   * Freitagsspätdienst zwölf Tage früher. Wer nur nach „spaet" sucht, bekommt
   * für die Freitagsregel das falsche Datum — und sperrt den falschen Tag.
   */
  it('und auf Wunsch nur den an einem Freitag', () => {
    expect(letzterDienst(EINTRAEGE, SCHICHTEN, 'spaet', true)).toBe('2026-10-16')
    expect(letzterDienst(EINTRAEGE, SCHICHTEN, 'frueh', true)).toBe('2026-10-23')
  })

  it('gibt nichts zurück, wenn es die Art nicht gab', () => {
    expect(letzterDienst(EINTRAEGE, SCHICHTEN, 'nacht')).toBeNull()
    expect(letzterDienst([], SCHICHTEN, 'spaet')).toBeNull()
  })

  /*
   * Die Gegenprobe zum Zählen: Beide Listen enthalten genau zwei Spätdienste.
   * Eine Anzahl könnte die beiden nicht unterscheiden — ein Datum schon, und
   * genau darauf beruhen die beiden neuen Regeln.
   */
  it('unterscheidet zwei Menschen, die gleich viele Dienste hatten', () => {
    const frisch = [
      { date: '2026-10-28', shiftId: 's' },
      { date: '2026-10-21', shiftId: 's' },
    ]
    const laengerHer = [
      { date: '2026-10-02', shiftId: 's' },
      { date: '2026-09-25', shiftId: 's' },
    ]
    expect(frisch.length).toBe(laengerHer.length)
    expect(letzterDienst(frisch, SCHICHTEN, 'spaet')).toBe('2026-10-28')
    expect(letzterDienst(laengerHer, SCHICHTEN, 'spaet')).toBe('2026-10-02')
  })

  it('ein unbekannter Dienst zählt nicht mit', () => {
    const mitLeiche = [{ date: '2026-10-30', shiftId: 'gibtsNichtMehr' }, ...EINTRAEGE]
    expect(letzterDienst(mitLeiche, SCHICHTEN, 'spaet')).toBe('2026-10-28')
  })

  it('Groß- und Kleinschreibung der Art stört nicht', () => {
    expect(letzterDienst(EINTRAEGE, [{ id: 's', typ: 'SPAET' }], 'spaet')).toBe('2026-10-28')
  })
})
