import { describe, it, expect } from 'vitest'
import {
  rufname, stempelPruefen, nachZeit, HOECHSTENS, STEMPEL_AKTIONEN,
} from '../offline-bruecke'

/**
 * §280 Die Brücke zur Offline-Seite.
 *
 * Geprüft wird vor allem das Misstrauen: Was hier hereinkommt, stammt aus
 * einer Datei auf dem Telefon und nicht aus unserer Anwendung. Alles, was
 * durchrutscht, landet in der Warteschlange — und die wiederholt bis zu
 * zwanzigmal.
 */

describe('§280 rufname', () => {
  it('nimmt den Vornamen', () => {
    expect(rufname('Deniz Yilmaz')).toBe('Deniz')
    expect(rufname('Anna Maria Fischer')).toBe('Anna')
  })

  it('kommt mit einem einzelnen Namen zurecht', () => {
    expect(rufname('Deniz')).toBe('Deniz')
  })

  it('und mit gar keinem', () => {
    expect(rufname('')).toBe('')
    expect(rufname(null)).toBe('')
    expect(rufname(undefined)).toBe('')
    expect(rufname('   ')).toBe('')
  })
})

describe('§280 stempelPruefen — was durchgelassen wird', () => {
  const gut = { aktion: 'kommen', zeitpunkt: '2026-11-06T05:58:00.000Z' }

  it('lässt einen gültigen Stempel durch', () => {
    const r = stempelPruefen([gut])
    expect(r.gueltig).toEqual([gut])
    expect(r.verworfen).toBe(0)
  })

  it('kennt alle vier Aktionen der Stempeluhr', () => {
    const alle = STEMPEL_AKTIONEN.map(a => ({ aktion: a, zeitpunkt: gut.zeitpunkt }))
    expect(stempelPruefen(alle).gueltig).toHaveLength(4)
  })

  /*
   * Die Gegenprobe: eine erfundene Aktion. Sie käme beim Server als
   * Ablehnung zurück, und die Warteschlange würde sie zwanzigmal
   * wiederholen — und dabei die gültigen Stempel dahinter aufhalten.
   */
  it('verwirft eine unbekannte Aktion', () => {
    const r = stempelPruefen([{ aktion: 'feierabend', zeitpunkt: gut.zeitpunkt }])
    expect(r.gueltig).toEqual([])
    expect(r.verworfen).toBe(1)
  })

  it('verwirft einen unbrauchbaren Zeitpunkt', () => {
    for (const z of ['gestern', '', null, undefined, 42]) {
      expect(stempelPruefen([{ aktion: 'kommen', zeitpunkt: z }]).gueltig).toEqual([])
    }
  })

  it('verwirft Müll jeder Art, ohne zu werfen', () => {
    for (const unsinn of [null, undefined, 'text', 42, {}, [null], [[]], [{ a: 1 }]]) {
      expect(() => stempelPruefen(unsinn)).not.toThrow()
      expect(stempelPruefen(unsinn).gueltig).toEqual([])
    }
  })

  it('zählt das Verworfene, statt es verschwinden zu lassen', () => {
    const r = stempelPruefen([gut, { aktion: 'x', zeitpunkt: 'y' }, gut])
    expect(r.gueltig).toHaveLength(2)
    expect(r.verworfen).toBe(1)
  })

  /*
   * Eine Obergrenze, weil die Datei im Gerät liegt und niemand sie prüft.
   * Fünfzig Stempel sind mehr als ein Mensch an einem Tag erzeugt; was
   * darüber liegt, ist kein Arbeitstag, sondern ein Fehler.
   */
  it('nimmt höchstens fünfzig — und sagt, wie viele übrig blieben', () => {
    const viele = Array.from({ length: 60 }, () => gut)
    const r = stempelPruefen(viele)
    expect(r.gueltig).toHaveLength(HOECHSTENS)
    expect(r.verworfen).toBe(10)
  })
})

describe('§280 nachZeit', () => {
  /*
   * Der Fall, auf den es ankommt: „gehen" vor „kommen" ergibt eine negative
   * Arbeitszeit. Die Offline-Seite schreibt der Reihe nach, aber die Datei
   * kann auch aus einem früheren Lauf stammen.
   */
  it('bringt die Stempel in die Reihenfolge des Stempelns', () => {
    const durcheinander = [
      { aktion: 'gehen' as const, zeitpunkt: '2026-11-06T14:30:00.000Z' },
      { aktion: 'kommen' as const, zeitpunkt: '2026-11-06T05:58:00.000Z' },
      { aktion: 'pause-start' as const, zeitpunkt: '2026-11-06T11:00:00.000Z' },
    ]
    expect(nachZeit(durcheinander).map(s => s.aktion))
      .toEqual(['kommen', 'pause-start', 'gehen'])
  })

  it('und lässt die Vorlage unberührt', () => {
    const vorlage = [
      { aktion: 'gehen' as const, zeitpunkt: '2026-11-06T14:30:00.000Z' },
      { aktion: 'kommen' as const, zeitpunkt: '2026-11-06T05:58:00.000Z' },
    ]
    nachZeit(vorlage)
    expect(vorlage[0].aktion).toBe('gehen')
  })

  it('zwei gleiche Zeitpunkte behalten ihre Reihenfolge', () => {
    const gleich = [
      { aktion: 'kommen' as const, zeitpunkt: '2026-11-06T06:00:00.000Z' },
      { aktion: 'pause-start' as const, zeitpunkt: '2026-11-06T06:00:00.000Z' },
    ]
    expect(nachZeit(gleich).map(s => s.aktion)).toEqual(['kommen', 'pause-start'])
  })
})
