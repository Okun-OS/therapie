import { describe, it, expect } from 'vitest'
import { dienstMinuten, dienstStunden } from '../dienstzeit'

/**
 * §266 Wie lang ein Dienst ist.
 *
 * Gefunden wurde der Fehler auf einem Bildschirmfoto für den App Store:
 * „4 Dienste diese Woche — −58h Stunden geplant". Ein Nachtdienst von 21:00
 * bis 06:30 ergab minus vierzehneinhalb Stunden.
 *
 * Geprüft wird deshalb vor allem der Dienst über Mitternacht. Alles andere
 * hat auch vorher gestimmt — und genau deshalb ist es jahrelang niemandem
 * aufgefallen: In einer Tagesschicht ist die falsche Rechnung richtig.
 */

describe('§266 dienstMinuten', () => {
  it('rechnet einen Tagdienst', () => {
    expect(dienstMinuten('08:00', '16:30')).toBe(510)
  })

  it('und einen Frühdienst', () => {
    expect(dienstMinuten('06:00', '14:30')).toBe(510)
  })

  /*
   * Der Fall, um den es geht. Ohne die Behandlung von Mitternacht kommt hier
   * −870 heraus — und vier solche Dienste ergeben die gemeldeten −58 Stunden.
   */
  it('rechnet einen Nachtdienst über Mitternacht', () => {
    expect(dienstMinuten('21:00', '06:30')).toBe(570)
  })

  it('auch wenn er erst nach Mitternacht beginnt', () => {
    expect(dienstMinuten('23:45', '07:15')).toBe(450)
  })

  it('ein Dienst ist nie negativ — egal, welche Zeiten darin stehen', () => {
    const zeiten = [
      ['22:00', '06:00'], ['21:00', '06:30'], ['00:30', '00:00'],
      ['12:00', '11:59'], ['23:59', '00:01'],
    ]
    for (const [a, e] of zeiten) {
      expect(dienstMinuten(a, e)).toBeGreaterThan(0)
    }
  })

  it('gleiche Anfangs- und Endzeit gilt als voller Tag', () => {
    // Null Minuten stünden in keinem Dienstplan — die einzige Lesart, die
    // Sinn ergibt, ist der Rundumdienst.
    expect(dienstMinuten('08:00', '08:00')).toBe(1440)
  })

  it('mit Unsinn darin wird nichts erfunden', () => {
    expect(dienstMinuten('', '')).toBe(0)
    expect(dienstMinuten('acht', 'halb fünf')).toBe(0)
  })
})

describe('§266 dienstStunden', () => {
  it('gibt Stunden auf eine Nachkommastelle', () => {
    expect(dienstStunden('08:00', '16:30')).toBe(8.5)
    expect(dienstStunden('21:00', '06:30')).toBe(9.5)
  })

  it('zieht die Pause ab, wenn der Dienst lang genug ist', () => {
    expect(dienstStunden('08:00', '16:30', { thresholdMinutes: 360, deductionMinutes: 30 }))
      .toBe(8)
  })

  /*
   * Die Gegenprobe: Ein kurzer Dienst verliert keine Pause. Ohne sie wäre
   * „zieht die Pause ab" auch dann grün, wenn immer abgezogen würde.
   */
  it('aber nicht bei einem kurzen Dienst', () => {
    expect(dienstStunden('08:00', '12:00', { thresholdMinutes: 360, deductionMinutes: 30 }))
      .toBe(4)
  })

  it('und ohne Vorgabe wird nichts abgezogen', () => {
    expect(dienstStunden('08:00', '16:30')).toBe(8.5)
  })

  /*
   * Der Nachtdienst auch hier, und zwar MIT Pause: Das ist die Rechnung, die
   * in der Leitungsansicht schon immer stimmte und in der Ansicht des
   * Mitarbeiters nicht.
   */
  it('der Nachtdienst verliert seine Pause wie jeder andere lange Dienst', () => {
    expect(dienstStunden('21:00', '06:30', { thresholdMinutes: 360, deductionMinutes: 30 }))
      .toBe(9)
  })
})
