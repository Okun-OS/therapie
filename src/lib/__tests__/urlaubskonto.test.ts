import { describe, it, expect } from 'vitest'
import { urlaubskonto } from '../urlaubskonto'

/**
 * §235 Der gemeldete Fall, in Zahlen.
 *
 * „Bei Bild 1 und 2 stimmen die Urlaubstage nicht überein." Juliane Saul:
 * 30 Tage Anspruch, 14 genommen, ein Antrag über 4 Tage offen. Die
 * Urlaubsseite zeigte 12, das Profil 16 — beide unter der Überschrift
 * „Resturlaub".
 */

/** Juliane: der gemeldete Fall. */
const juliane = { vacationDaysTotal: 30, vacationDaysUsed: 14 }
const offenerAntrag = [{ status: 'pending', days: 4 }]

describe('Der gemeldete Fall', () => {
  it('rechnet beide Zahlen aus — sie sind verschieden und beide richtig', () => {
    const k = urlaubskonto(juliane, offenerAntrag)
    expect(k.verfuegbar).toBe(12)   // was noch beantragt werden kann
    expect(k.offen).toBe(16)        // was dieses Jahr noch zusteht
  })

  it('und benennt, woher der Unterschied kommt', () => {
    const k = urlaubskonto(juliane, offenerAntrag)
    expect(k.beantragt).toBe(4)
    expect(k.offen - k.verfuegbar).toBe(k.beantragt)
  })

  /*
   * Die Gegenprobe: Ohne offene Anträge fallen beide zusammen. Hier hätte der
   * Fehler nie auffallen können — und genau deshalb stand er so lange da.
   */
  it('ohne offene Anträge sind beide Zahlen gleich', () => {
    const k = urlaubskonto(juliane, [{ status: 'approved', days: 4 }])
    expect(k.verfuegbar).toBe(16)
    expect(k.offen).toBe(16)
  })
})

describe('Was zählt und was nicht', () => {
  it('ein abgelehnter Antrag zählt nicht — über ihn ist entschieden', () => {
    const k = urlaubskonto(juliane, [{ status: 'denied', days: 10 }])
    expect(k.verfuegbar).toBe(16)
  })

  it('genehmigte Anträge werden eigens ausgewiesen', () => {
    const k = urlaubskonto(juliane, [
      { status: 'approved', days: 5 },
      { status: 'pending', days: 2 },
    ])
    expect(k.genehmigt).toBe(5)
    expect(k.beantragt).toBe(2)
  })

  /*
   * Ein genehmigter Antrag mindert `verfuegbar` NICHT eigens: Sobald er
   * genehmigt ist, steht er in `vacationDaysUsed`. Würde er hier noch einmal
   * abgezogen, fehlten die Tage doppelt — und das wäre derselbe Fehlertyp wie
   * der gemeldete, nur in die andere Richtung.
   */
  it('zieht genehmigte Tage nicht ein zweites Mal ab', () => {
    const k = urlaubskonto({ vacationDaysTotal: 30, vacationDaysUsed: 5 },
      [{ status: 'approved', days: 5 }])
    expect(k.verfuegbar).toBe(25)
  })
})

describe('Krumme Eingaben', () => {
  it('ohne Anspruch werden 30 Tage angenommen', () => {
    expect(urlaubskonto({}, []).gesamt).toBe(30)
    expect(urlaubskonto({ vacationDaysTotal: null }, []).gesamt).toBe(30)
  })

  it('niemand bekommt eine negative Kachel', () => {
    const k = urlaubskonto({ vacationDaysTotal: 30, vacationDaysUsed: 28 },
      [{ status: 'pending', days: 10 }])
    expect(k.verfuegbar).toBe(0)
    expect(k.offen).toBe(2)
  })

  it('ein Antrag ohne Tagezahl bringt die Rechnung nicht durcheinander', () => {
    const k = urlaubskonto(juliane, [{ status: 'pending', days: undefined as never }])
    expect(k.beantragt).toBe(0)
    expect(k.verfuegbar).toBe(16)
  })
})
