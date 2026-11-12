import { describe, it, expect } from 'vitest'
import {
  stundenProAusfalltag, hatDienstpflicht, ausfallStundenAmTag,
  arbeitstageDerFehlzeit, ausfallStundenDerFehlzeit, tageVonBis,
  type AusfallPerson,
} from '../ausfallstunden'

/**
 * §227 An dieser Rechnung hängt Geld und ein Plan, der stimmt.
 *
 * Zu wenig gutschreiben heißt: Die Person steht mit Minderstunden da, obwohl
 * ihr die Stunden nach §3 EntgFG zustehen — und die Leitung sieht einen Plan,
 * der nach Unterbesetzung aussieht. Zu viel gutschreiben heißt: Eine Woche
 * Krankheit bringt mehr Stunden als eine Woche Arbeit. Deshalb wird hier beides
 * geprüft, nicht nur die Richtung, die gemeldet wurde.
 */

/** Juliane: der gemeldete Fall. 35 Stunden, fünf Tage, kein eigenes Muster. */
const juliane: AusfallPerson = { weeklyHours: 35, workDaysPerWeek: 5 }
/** Shelley: 40 Stunden auf fünf Tage. */
const shelley: AusfallPerson = { weeklyHours: 40, workDaysPerWeek: 5 }
/** Heike: dreimal acht, einmal sechs — 30 Stunden auf vier Tage, Freitag frei. */
const heike: AusfallPerson = {
  weeklyHours: 30,
  workDaysPerWeek: 4,
  fixedOffDays: ['Fr'],
  tagesmuster: [{ stunden: 8, tage: 3 }, { stunden: 6, tage: 1 }],
}

// 2026: der 19.10. ist ein Montag, der 25.10. ein Sonntag.
const MO = '2026-10-19', DI = '2026-10-20', FR = '2026-10-23'
const SA = '2026-10-24', SO = '2026-10-25'

describe('Stunden pro Ausfalltag', () => {
  it('schreibt einer 35-Stunden-Kraft an fünf Tagen sieben Stunden gut', () => {
    expect(stundenProAusfalltag(juliane)).toBe(7)
  })

  it('und einer 40-Stunden-Kraft acht — die Zahl aus der Meldung', () => {
    expect(stundenProAusfalltag(shelley)).toBe(8)
  })

  it('nimmt bei vier Tagen den Vierteiler, nicht den Fünfteiler', () => {
    expect(stundenProAusfalltag({ weeklyHours: 30, workDaysPerWeek: 4 })).toBe(7.5)
  })

  /*
   * Der Kern der Entscheidung: Heikes Muster ist 8/8/8/6. Welcher Wochentag
   * der sechsstündige ist, steht nirgends. Also der Durchschnitt — 7,5 — und
   * nicht acht, was an einem von vier Tagen anderthalb Stunden zu viel wäre.
   */
  it('rechnet bei ungleichen Tagen den Durchschnitt über die eigenen Tage', () => {
    expect(stundenProAusfalltag(heike)).toBe(7.5)
  })

  it('zieht das Muster der Stundenzahl vor, wenn beide da sind', () => {
    // Das Muster sagt vier Tage, `workDaysPerWeek` sagt fünf. Das Muster
    // gewinnt: Wer eines hinterlegt hat, hat seine Tage selbst benannt.
    const mitBeidem: AusfallPerson = { ...heike, workDaysPerWeek: 5 }
    expect(stundenProAusfalltag(mitBeidem)).toBe(7.5)
  })

  it('nimmt die Planstunden, wo sie von den Vertragsstunden abweichen', () => {
    // §171 Eine Leitung mit 40 Vertrags- und 10 Planstunden.
    expect(stundenProAusfalltag(
      { weeklyHours: 40, planungsStundenSoll: 10, workDaysPerWeek: 5 },
    )).toBe(2)
  })

  it('zieht feste freie Tage von den Tagen ab, über die geteilt wird', () => {
    // 30 Stunden, fünf Arbeitstage laut Vertrag, aber Freitag fest frei: Die
    // Stunden liegen auf vier Tagen, also 7,5 — nicht 6.
    expect(stundenProAusfalltag(
      { weeklyHours: 30, workDaysPerWeek: 5, fixedOffDays: ['Fr'] },
    )).toBe(7.5)
  })

  it('schreibt nichts gut, wo keine Stunden zu verteilen sind', () => {
    expect(stundenProAusfalltag({ weeklyHours: 0, workDaysPerWeek: 5 })).toBe(0)
  })

  it('nimmt fünf Tage an, wo die Tagezahl fehlt', () => {
    /*
     * Eine fehlende oder auf null stehende Tagezahl ist ein leeres Feld, kein
     * Nulltagevertrag. Die Annahme steht in `tagesmuster.ts` und gilt dort
     * schon für die Maske und den Rechendienst — zwei Antworten auf dieselbe
     * Frage wären eine zu viel.
     */
    expect(stundenProAusfalltag({ weeklyHours: 35 })).toBe(7)
    expect(stundenProAusfalltag({ weeklyHours: 35, workDaysPerWeek: 0 })).toBe(7)
    expect(stundenProAusfalltag({ weeklyHours: 35, workDaysPerWeek: null })).toBe(7)
  })

  it('übergeht ein kaputtes Muster statt daran zu scheitern', () => {
    // Ein unlesbares Muster darf die Gutschrift nicht auf null setzen — dann
    // wäre ein Datenfehler ein Lohnabzug.
    expect(stundenProAusfalltag({ ...juliane, tagesmuster: 'fünfmal sieben' })).toBe(7)
    expect(stundenProAusfalltag({ ...juliane, tagesmuster: [{ stunden: 99, tage: 1 }] })).toBe(7)
  })
})

describe('Hätte an diesem Tag überhaupt Dienst bestanden', () => {
  it('ja an einem Werktag', () => {
    expect(hatDienstpflicht(juliane, MO)).toBe(true)
    expect(hatDienstpflicht(juliane, FR)).toBe(true)
  })

  it('nein am Wochenende eines Montag-bis-Freitag-Betriebs', () => {
    expect(hatDienstpflicht(juliane, SA)).toBe(false)
    expect(hatDienstpflicht(juliane, SO)).toBe(false)
  })

  it('ja am Samstag, wenn der Betrieb samstags offen hat', () => {
    expect(hatDienstpflicht(juliane, SA, ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'])).toBe(true)
  })

  it('nein an einem festen freien Wochentag', () => {
    expect(hatDienstpflicht(heike, FR)).toBe(false)
    expect(hatDienstpflicht(heike, MO)).toBe(true)
  })

  it('versteht freie Tage auch als Zahl', () => {
    // Ältere Datensätze haben '2' statt 'Di' stehen.
    expect(hatDienstpflicht({ ...juliane, fixedOffDays: ['2'] }, DI)).toBe(false)
  })

  it('nein bei einem Datum, das keines ist', () => {
    expect(hatDienstpflicht(juliane, 'bald')).toBe(false)
  })
})

describe('Die Stunden eines einzelnen Ausfalltags', () => {
  it('sind die Tagesstunden an einem Diensttag', () => {
    expect(ausfallStundenAmTag(juliane, MO)).toBe(7)
  })

  it('sind null an einem Tag ohne Dienstpflicht', () => {
    expect(ausfallStundenAmTag(juliane, SO)).toBe(0)
    expect(ausfallStundenAmTag(heike, FR)).toBe(0)
  })

  /*
   * Stand der Dienst schon im Plan, ist der Ausfall genau bekannt. Dann wird
   * nicht geschätzt — auch dann nicht, wenn die Schätzung näher an der
   * Vertragslage läge.
   */
  it('nehmen den geplanten Dienst, wenn es einen gab', () => {
    expect(ausfallStundenAmTag(juliane, MO, { geplanteStunden: 9.5 })).toBe(9.5)
  })

  it('ignorieren einen geplanten Dienst von null Stunden', () => {
    expect(ausfallStundenAmTag(juliane, MO, { geplanteStunden: 0 })).toBe(7)
  })

  it('sind null am Feiertag — der ist schon bezahlt', () => {
    expect(ausfallStundenAmTag(juliane, MO, { feiertag: true })).toBe(0)
  })
})

describe('Eine ganze Fehlzeit', () => {
  it('zählt Arbeitstage, nicht Kalendertage', () => {
    // Montag bis Sonntag sind sieben Kalendertage und fünf Arbeitstage. Genau
    // hier kürzte das Monatssoll vorher um zwei Tage zu viel.
    expect(tageVonBis(MO, SO)).toHaveLength(7)
    expect(arbeitstageDerFehlzeit(juliane, MO, SO)).toBe(5)
  })

  it('und bei Heike nur vier, weil Freitag fest frei ist', () => {
    expect(arbeitstageDerFehlzeit(heike, MO, SO)).toBe(4)
  })

  it('ergibt eine ganze Woche Krankheit genau die Wochenstunden', () => {
    // Die Zusage in einem Satz: Eine Woche krank kostet keine Stunde.
    expect(ausfallStundenDerFehlzeit(juliane, MO, SO)).toBe(35)
    expect(ausfallStundenDerFehlzeit(shelley, MO, SO)).toBe(40)
    expect(ausfallStundenDerFehlzeit(heike, MO, SO)).toBe(30)
  })

  it('zählt einen einzelnen Tag als einen', () => {
    expect(arbeitstageDerFehlzeit(juliane, MO, MO)).toBe(1)
    expect(ausfallStundenDerFehlzeit(juliane, MO, MO)).toBe(7)
  })

  it('zählt nichts bei einem Ende vor dem Anfang', () => {
    expect(tageVonBis(FR, MO)).toEqual([])
    expect(arbeitstageDerFehlzeit(juliane, FR, MO)).toBe(0)
  })

  it('zählt nichts bei einem vertippten Jahr statt endlos zu rechnen', () => {
    // „2206" statt „2026" ist ein Tippfehler, keine 180-jährige Krankheit.
    expect(tageVonBis(MO, '2206-10-19')).toEqual([])
  })

  it('rechnet über den Monatswechsel hinweg', () => {
    // 26.10.2026 ist ein Montag; bis zum 6.11. sind es zehn Arbeitstage.
    expect(arbeitstageDerFehlzeit(juliane, '2026-10-26', '2026-11-06')).toBe(10)
  })
})
