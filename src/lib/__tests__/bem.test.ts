import { describe, it, expect } from 'vitest'
import {
  auTageImFenster, schwelleUeberschritten, bemStand, lage, zaehlungAb,
  istArbeitsunfaehig, SCHWELLE_TAGE, FENSTER_TAGE, type Fehlzeit,
} from '../bem'

/**
 * §147 An dieser Rechnung hängt eine gesetzliche Pflicht: Wer die Schwelle
 * überschreitet, dem MUSS ein BEM angeboten werden (§167 Abs. 2 SGB IX). Ohne
 * Angebot ist eine spätere krankheitsbedingte Kündigung praktisch nicht
 * haltbar.
 *
 * Zu früh auslösen ist unangenehm — jemand bekommt ein Angebot, das ihm nicht
 * zusteht, und fragt sich warum. Zu spät auslösen ist teuer. Deshalb wird die
 * Grenze hier auf den Tag genau nachgerechnet.
 */

const heute = new Date('2026-09-21T12:00:00Z')
const TAG = 86_400_000
const vorTagen = (n: number) =>
  new Date(heute.getTime() - n * TAG).toISOString().slice(0, 10)

/** Eine Krankmeldung, die vor `von` Tagen begann und `laenge` Tage dauerte. */
const krank = (von: number, laenge: number): Fehlzeit => ({
  type: 'krankheit',
  startDate: vorTagen(von),
  endDate: vorTagen(von - laenge + 1),
})

describe('Welche Fehlzeiten zählen', () => {
  it('zählt Krankheit', () => {
    expect(istArbeitsunfaehig('krankheit')).toBe(true)
    expect(istArbeitsunfaehig('KRANKHEIT')).toBe(true)
  })

  it('zählt Urlaub und Fortbildung nicht', () => {
    // Wer im Urlaub war, war nicht arbeitsunfähig. Würde beides zusammengezählt,
    // löste die Schwelle bei jedem aus, der einmal drei Wochen weg war.
    expect(istArbeitsunfaehig('urlaub')).toBe(false)
    expect(istArbeitsunfaehig('fortbildung')).toBe(false)
    expect(auTageImFenster([
      { type: 'urlaub', startDate: vorTagen(100), endDate: vorTagen(50) },
    ], heute)).toBe(0)
  })
})

describe('Die Tage im rollenden Fenster', () => {
  it('zählt Kalendertage einschließlich beider Ränder', () => {
    expect(auTageImFenster([krank(10, 5)], heute)).toBe(5)
  })

  it('zählt „wiederholt" zusammen — es müssen keine sechs Wochen am Stück sein', () => {
    // Der häufigste Irrtum. §167 sagt „ununterbrochen ODER wiederholt".
    const tage = auTageImFenster([krank(300, 20), krank(100, 20), krank(10, 10)], heute)
    expect(tage).toBe(50)
    expect(schwelleUeberschritten(tage)).toBe(true)
  })

  it('zählt überlappende Meldungen nicht doppelt', () => {
    // Eine Folgebescheinigung, die einen Tag zurückreicht, darf die Schwelle
    // nicht zu früh auslösen.
    // −20 bis −11 und −12 bis −3: zusammen −20 bis −3, also 18 Tage — nicht 20.
    const tage = auTageImFenster([krank(20, 10), krank(12, 10)], heute)
    expect(tage).toBe(18)
  })

  it('nimmt von einer Fehlzeit am Fensterrand nur den Teil im Fenster', () => {
    // Die Krankmeldung begann vor 380 Tagen und lief 30 Tage (bis Tag −351).
    // Das Fenster beginnt bei −364, also zählen 14 Tage davon — plus der eine
    // von vorgestern.
    const tage = auTageImFenster([krank(380, 30), krank(5, 1)], heute)
    expect(tage).toBe(15)
  })

  it('lässt alles Ältere ganz draußen', () => {
    // −400 bis −381: endet vor dem Fensteranfang bei −364.
    expect(auTageImFenster([krank(400, 20)], heute)).toBe(0)
  })

  it('rechnet zwölf rollende Monate, nicht das Kalenderjahr', () => {
    // November vier Wochen, Februar drei Wochen: In keinem Kalenderjahr sind
    // das sechs Wochen — im rollenden Fenster schon.
    const stichtag = new Date('2026-03-01T12:00:00Z')
    const tage = auTageImFenster([
      { type: 'krankheit', startDate: '2025-11-03', endDate: '2025-11-30' },
      { type: 'krankheit', startDate: '2026-02-05', endDate: '2026-02-25' },
    ], stichtag)
    expect(tage).toBe(49)
    expect(schwelleUeberschritten(tage)).toBe(true)
  })

  it('kommt mit einem verdrehten Zeitraum klar, statt ins Negative zu rechnen', () => {
    expect(auTageImFenster([
      { type: 'krankheit', startDate: '2026-05-10', endDate: '2026-05-01' },
    ], heute)).toBe(0)
  })

  it('verträgt ein unbrauchbares Datum', () => {
    expect(auTageImFenster([
      { type: 'krankheit', startDate: 'kaputt', endDate: '2026-05-01' },
    ], heute)).toBe(0)
  })
})

describe('Die Schwelle', () => {
  it('liegt bei mehr als sechs Wochen — nicht bei genau sechs', () => {
    // Der Unterschied ist ein Tag und entscheidet über eine Rechtspflicht.
    expect(schwelleUeberschritten(SCHWELLE_TAGE)).toBe(false)
    expect(schwelleUeberschritten(SCHWELLE_TAGE + 1)).toBe(true)
  })

  it('löst bei genau 42 Tagen Fehlzeit noch nicht aus', () => {
    expect(bemStand(auTageImFenster([krank(50, 42)], heute))).toBe('unauffaellig')
  })

  it('löst beim dreiundvierzigsten Tag aus', () => {
    expect(bemStand(auTageImFenster([krank(50, 43)], heute))).toBe('faellig')
  })

  it('rechnet mit einem Fenster von einem Jahr', () => {
    expect(FENSTER_TAGE).toBe(365)
  })
})

describe('Der Stand eines Vorgangs', () => {
  const ueber = SCHWELLE_TAGE + 10

  it('ist fällig, solange nichts angeboten wurde', () => {
    expect(bemStand(ueber, null)).toBe('faellig')
  })

  it('wird mit dem Angebot zu „angeboten"', () => {
    expect(bemStand(ueber, { angebotenAm: heute })).toBe('angeboten')
  })

  it('läuft nach der Zustimmung', () => {
    expect(bemStand(ueber, { angebotenAm: heute, antwort: 'zugestimmt' })).toBe('laeuft')
  })

  it('hält eine Ablehnung fest, statt sie zu verwerfen', () => {
    // Die Ablehnung ist der Nachweis, dass angeboten wurde — sie ist das
    // Wertvollste an dem ganzen Vorgang.
    expect(bemStand(ueber, { angebotenAm: heute, antwort: 'abgelehnt' })).toBe('abgelehnt')
  })

  it('bleibt abgeschlossen, auch wenn die Tage weiterzählen', () => {
    // Sonst stünde jemand nach jedem einzelnen Krankheitstag wieder auf der
    // Liste, obwohl das Verfahren gerade erst gelaufen ist.
    expect(bemStand(ueber + 50, {
      angebotenAm: heute, antwort: 'zugestimmt', abgeschlossenAm: heute,
    })).toBe('abgeschlossen')
  })
})

describe('Ab wann nach einem Abschluss neu gezählt wird', () => {
  it('zählt ohne Vorgang ab dem Fensteranfang', () => {
    const ab = zaehlungAb(null)
    const erwartet = Date.now() - FENSTER_TAGE * TAG
    expect(Math.abs(ab.getTime() - erwartet)).toBeLessThan(2000)
  })

  it('zählt nach einem Abschluss ab dem Abschluss', () => {
    // Sonst löste derselbe Zeitraum ein zweites Mal aus.
    const abschluss = new Date(Date.now() - 30 * TAG)
    expect(zaehlungAb({ abgeschlossenAm: abschluss }).getTime())
      .toBe(abschluss.getTime())
  })

  it('ignoriert einen Abschluss, der älter ist als das Fenster', () => {
    const alt = new Date(Date.now() - 500 * TAG)
    expect(zaehlungAb({ abgeschlossenAm: alt }).getTime()).toBeGreaterThan(alt.getTime())
  })
})

describe('Was dem Menschen gesagt wird', () => {
  it('nennt bei jedem Stand, was als Nächstes ansteht', () => {
    for (const v of [
      null,
      { angebotenAm: heute },
      { angebotenAm: heute, antwort: 'zugestimmt' },
    ]) {
      expect(lage(SCHWELLE_TAGE + 5, v).naechsterSchritt.length).toBeGreaterThan(10)
    }
  })

  it('nennt bei „fällig" die Vorschrift', () => {
    expect(lage(SCHWELLE_TAGE + 1).naechsterSchritt).toMatch(/167/)
  })

  it('schweigt, wo nichts zu tun ist', () => {
    expect(lage(5).naechsterSchritt).toBe('')
    expect(lage(99, { abgeschlossenAm: heute }).naechsterSchritt).toBe('')
  })

  it('sagt, wie viele Tage noch bis zur Schwelle fehlen', () => {
    expect(lage(40).bisSchwelle).toBe(3)
    expect(lage(SCHWELLE_TAGE + 1).bisSchwelle).toBe(0)
  })
})
