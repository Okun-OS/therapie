import { describe, it, expect } from 'vitest'
import {
  laufzeitText, laufzeitGenau, zeitversatz, HOECHSTER_VERSATZ,
} from '../laufzeit'

/**
 * §286 Die laufende Zeit in der Stempeluhr.
 *
 * GEMELDET, mit Bild: Direkt nach dem Einstempeln stand „-1:-1" in der Uhr,
 * eine Minute später war es wieder richtig.
 *
 * Geprüft wird deshalb vor allem die negative Differenz — der Fall, der
 * entsteht, wenn die Uhr des Telefons ein paar Sekunden hinter der des
 * Servers zurückliegt. Dass eine positive Dauer richtig angezeigt wird, hat
 * auch vorher gestimmt; genau deshalb ist es nie aufgefallen.
 */

const MIN = 60_000
const STD = 60 * MIN

describe('§286 laufzeitText', () => {
  it('zeigt eine gewöhnliche Dauer', () => {
    expect(laufzeitText(0)).toBe('0:00')
    expect(laufzeitText(7 * MIN)).toBe('0:07')
    expect(laufzeitText(STD + 5 * MIN)).toBe('1:05')
    expect(laufzeitText(8 * STD + 30 * MIN)).toBe('8:30')
  })

  it('schneidet angefangene Minuten ab, statt zu runden', () => {
    // 1:59 Minuten sind eine Minute — eine Uhr, die vorgeht, behauptet
    // Arbeitszeit, die noch nicht geleistet ist.
    expect(laufzeitText(119_000)).toBe('0:01')
  })

  /* DER GEMELDETE FALL. Die alte Zeile ergab hier „-1:-1". */
  it('zwei Sekunden Gangunterschied ergeben 0:00 — nicht „-1:-1"', () => {
    expect(laufzeitText(-2000)).toBe('0:00')
  })

  it('und jede andere negative Dauer ebenfalls', () => {
    for (const ms of [-1, -59_000, -MIN, -90 * MIN, -36 * STD]) {
      expect(laufzeitText(ms), String(ms)).toBe('0:00')
    }
  })

  /*
   * Die Gegenprobe zur Schranke: Sie darf nur Negatives abfangen. Eine
   * Schranke, die auch eine Minute verschluckt, wäre schlimmer als der
   * Fehler — dann stünde die Uhr still.
   */
  it('eine Sekunde ÜBER null ist keine negative Dauer', () => {
    expect(laufzeitText(1000)).toBe('0:00')
    expect(laufzeitText(MIN)).toBe('0:01')
  })

  it('und mit Unsinn darin steht die Uhr bei null, nicht bei NaN', () => {
    expect(laufzeitText(Number.NaN)).toBe('0:00')
    expect(laufzeitText(Number.POSITIVE_INFINITY)).toBe('0:00')
  })

  it('in keinem Fall erscheint ein Minuszeichen', () => {
    for (const ms of [-1, -2000, -MIN, 0, 1000, MIN, STD, 99 * STD]) {
      expect(laufzeitText(ms).includes('-'), String(ms)).toBe(false)
    }
  })
})

describe('§286 laufzeitGenau', () => {
  it('zeigt Stunden, Minuten und Sekunden zweistellig', () => {
    expect(laufzeitGenau(0)).toBe('00:00:00')
    expect(laufzeitGenau(5000)).toBe('00:00:05')
    expect(laufzeitGenau(STD + 2 * MIN + 3000)).toBe('01:02:03')
    expect(laufzeitGenau(12 * STD)).toBe('12:00:00')
  })

  /* Dieselbe Krankheit auf der Zeiterfassungsseite: dort „00:-1:-1". */
  it('eine Sekunde Gangunterschied ergibt 00:00:00', () => {
    expect(laufzeitGenau(-1000)).toBe('00:00:00')
    expect(laufzeitGenau(-2000)).toBe('00:00:00')
  })

  it('und zeigt nie ein Minuszeichen', () => {
    for (const ms of [-1, -1000, -STD, 0, 1000, STD]) {
      expect(laufzeitGenau(ms).includes('-'), String(ms)).toBe(false)
    }
  })

  it('mit Unsinn darin steht sie bei null', () => {
    expect(laufzeitGenau(Number.NaN)).toBe('00:00:00')
  })
})

describe('§286 zeitversatz', () => {
  const GERAET = Date.UTC(2026, 10, 10, 9, 4, 0)

  it('misst, wie weit die Serveruhr vorgeht', () => {
    const server = new Date(GERAET + 2000).toISOString()
    expect(zeitversatz(server, GERAET)).toBe(2000)
  })

  it('und wie weit sie nachgeht', () => {
    const server = new Date(GERAET - 3000).toISOString()
    expect(zeitversatz(server, GERAET)).toBe(-3000)
  })

  it('gehen beide gleich, ist der Versatz null', () => {
    expect(zeitversatz(new Date(GERAET).toISOString(), GERAET)).toBe(0)
  })

  /*
   * Die Schranke: Über eine Viertelstunde ist das kein Gangunterschied mehr,
   * sondern eine falsch gestellte Uhr. Dann gilt die Gerätezeit — aus ihr
   * entsteht auch der Zeitpunkt, der ohne Netz gemerkt wird (§138).
   */
  it('verwirft, was keine Ungenauigkeit mehr sein kann', () => {
    expect(zeitversatz(new Date(GERAET + 2 * STD).toISOString(), GERAET)).toBe(0)
    expect(zeitversatz(new Date(GERAET - 26 * STD).toISOString(), GERAET)).toBe(0)
  })

  it('genau an der Schranke gilt er noch', () => {
    expect(zeitversatz(new Date(GERAET + HOECHSTER_VERSATZ).toISOString(), GERAET))
      .toBe(HOECHSTER_VERSATZ)
    expect(zeitversatz(new Date(GERAET + HOECHSTER_VERSATZ + 1).toISOString(), GERAET))
      .toBe(0)
  })

  it('ohne Serverzeit wird nichts verschoben', () => {
    expect(zeitversatz(null, GERAET)).toBe(0)
    expect(zeitversatz(undefined, GERAET)).toBe(0)
    expect(zeitversatz('', GERAET)).toBe(0)
    expect(zeitversatz('morgen früh', GERAET)).toBe(0)
  })

  /*
   * Das Zusammenspiel, um das es geht: Der Einstempelzeitpunkt stammt vom
   * Server, `Date.now()` vom Telefon. Ohne den Versatz ist die Differenz
   * negativ — mit ihm steht die Uhr auf null.
   */
  it('zusammen mit laufzeitText verschwindet der gemeldete Fall', () => {
    const serverJetzt = GERAET + 2000
    const eingestempelt = serverJetzt            // gerade eben, nach Serveruhr
    const versatz = zeitversatz(new Date(serverJetzt).toISOString(), GERAET)
    expect(laufzeitText((GERAET + versatz) - eingestempelt)).toBe('0:00')

    // Und zehn Minuten später steht dort auch zehn.
    expect(laufzeitText((GERAET + 10 * MIN + versatz) - eingestempelt)).toBe('0:10')
  })
})
