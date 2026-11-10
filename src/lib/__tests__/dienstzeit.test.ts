import { describe, it, expect } from 'vitest'
import {
  dienstMinuten, dienstStunden, geplanteMinuten, pausenregelAus,
  GESETZLICHE_PAUSE,
} from '../dienstzeit'

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

/**
 * §284 Die geplante Arbeitszeit — die Zahl, die der Mitarbeiter liest.
 *
 * GEMELDET: „Oben sind 42,5 Stunden eingeplant. Wenn der 7 bis 15:30
 * arbeitet, sind es ja 8 Arbeitsstunden."
 */
describe('§284 geplanteMinuten', () => {
  /* Genau der gemeldete Dienst. */
  it('07:00 bis 15:30 sind 480 Minuten, nicht 510', () => {
    expect(geplanteMinuten('07:00', '15:30', GESETZLICHE_PAUSE)).toBe(480)
  })

  /* Und genau die gemeldete Woche: fünfmal dieser Dienst. */
  it('fünf solche Dienste sind 40 Stunden, nicht 42,5', () => {
    const woche = Array.from({ length: 5 })
      .reduce<number>(summe => summe + geplanteMinuten('07:00', '15:30', GESETZLICHE_PAUSE), 0)
    expect(woche).toBe(40 * 60)
  })

  /*
   * Die Gegenprobe: Unter der Schwelle wird NICHTS abgezogen. Ohne sie wäre
   * die Prüfung oben auch dann grün, wenn blind eine halbe Stunde verschwände.
   */
  it('ein kurzer Dienst behält seine volle Zeit', () => {
    expect(geplanteMinuten('08:00', '12:00', GESETZLICHE_PAUSE)).toBe(240)
    // Genau auf der Schwelle wird abgezogen — „ab sechs Stunden".
    expect(geplanteMinuten('08:00', '14:00', GESETZLICHE_PAUSE)).toBe(330)
    expect(geplanteMinuten('08:00', '13:59', GESETZLICHE_PAUSE)).toBe(359)
  })

  it('der Nachtdienst über Mitternacht verliert seine Pause wie jeder andere', () => {
    expect(geplanteMinuten('21:00', '06:30', GESETZLICHE_PAUSE)).toBe(540)
  })

  it('die Regel des Standorts gilt, nicht die gesetzliche Vorgabe', () => {
    expect(geplanteMinuten('07:00', '15:30', { thresholdMinutes: 480, deductionMinutes: 45 }))
      .toBe(465)
    // Unter der strengeren Schwelle dieses Standorts bliebe derselbe Dienst
    // ungekürzt — hier liegt er mit 510 Minuten darüber.
    expect(geplanteMinuten('07:00', '14:00', { thresholdMinutes: 480, deductionMinutes: 45 }))
      .toBe(420)
  })

  /*
   * Eine falsch gepflegte Regel darf keine negative Arbeitszeit ergeben:
   * „−2h geplant" ist derselbe Unsinn wie die −58 Stunden aus §266.
   */
  it('zieht nie mehr ab, als der Dienst lang ist', () => {
    expect(geplanteMinuten('08:00', '14:00', { thresholdMinutes: 60, deductionMinutes: 600 }))
      .toBe(0)
  })

  it('und bleibt bei unlesbaren Zeiten bei null', () => {
    expect(geplanteMinuten('', '', GESETZLICHE_PAUSE)).toBe(0)
  })
})

describe('§284 pausenregelAus', () => {
  it('nimmt, was der Standort hinterlegt hat', () => {
    expect(pausenregelAus({ breakThresholdMinutes: 480, breakDeductionMinutes: 45 }))
      .toEqual({ thresholdMinutes: 480, deductionMinutes: 45 })
  })

  it('und sonst die gesetzliche Vorgabe', () => {
    expect(pausenregelAus(null)).toEqual(GESETZLICHE_PAUSE)
    expect(pausenregelAus({})).toEqual(GESETZLICHE_PAUSE)
    expect(pausenregelAus({ breakThresholdMinutes: null, breakDeductionMinutes: null }))
      .toEqual(GESETZLICHE_PAUSE)
  })

  /*
   * Eine Schwelle von null hieße „immer abziehen" — das ist keine Regel,
   * sondern ein nicht ausgefülltes Feld.
   */
  it('eine Schwelle von null ist keine Regel, sondern eine Lücke', () => {
    expect(pausenregelAus({ breakThresholdMinutes: 0, breakDeductionMinutes: 30 }).thresholdMinutes)
      .toBe(360)
  })

  /* Ein Abzug von null dagegen ist eine Aussage: kein Abzug. */
  it('ein Abzug von null bleibt stehen', () => {
    expect(pausenregelAus({ breakThresholdMinutes: 360, breakDeductionMinutes: 0 }).deductionMinutes)
      .toBe(0)
  })

  it('die gesetzliche Vorgabe ist das, was auch in der Datenbank steht', () => {
    expect(GESETZLICHE_PAUSE).toEqual({ thresholdMinutes: 360, deductionMinutes: 30 })
  })
})
