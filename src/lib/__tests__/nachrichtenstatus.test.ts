import { describe, it, expect } from 'vitest'
import { nachrichtenstatus, zurueckziehbar } from '../nachrichtenstatus'

/**
 * §240 Gesendet, zugestellt, gelesen.
 *
 * Gemeldet: „Ich konnte eine Nachricht nicht löschen, weil da stand, dass es
 * schon gelesen wurde … obwohl das wurde noch gar nicht gelesen."
 */

const ICH = 'ich'
const DU = 'du'
const DRITTE = 'dritte'

const GESENDET = '2026-10-29T12:00:00.000Z'
const VORHER = '2026-10-29T11:00:00.000Z'
const NACHHER = '2026-10-29T13:00:00.000Z'

const nachricht = { createdAt: GESENDET, userId: ICH }

describe('nachrichtenstatus', () => {
  it('ohne jeden Stand: gesendet', () => {
    expect(nachrichtenstatus(nachricht, [{ userId: ICH }, { userId: DU }]))
      .toBe('gesendet')
  })

  it('ein Stand von VOR der Nachricht zählt nicht', () => {
    // Wer gestern zuletzt hineingesehen hat, hat das von heute nicht bekommen.
    expect(nachrichtenstatus(nachricht, [
      { userId: ICH }, { userId: DU, zugestelltBis: VORHER, gelesenBis: VORHER },
    ])).toBe('gesendet')
  })

  it('zugestellt, wenn es auf dem Gerät liegt', () => {
    expect(nachrichtenstatus(nachricht, [
      { userId: ICH }, { userId: DU, zugestelltBis: NACHHER },
    ])).toBe('zugestellt')
  })

  it('gelesen, wenn jemand hingesehen hat', () => {
    expect(nachrichtenstatus(nachricht, [
      { userId: ICH }, { userId: DU, zugestelltBis: NACHHER, gelesenBis: NACHHER },
    ])).toBe('gelesen')
  })

  /*
   * §240 Alte Zeilen haben einen Lesestand, aber keinen Zustellstand: Das Feld
   * gab es nicht. Ohne diese Regel stünde dort ein Haken weniger, als der
   * Wahrheit entspricht.
   */
  it('gelesen schließt zugestellt ein, auch ohne Zustellstand', () => {
    expect(nachrichtenstatus(nachricht, [
      { userId: ICH }, { userId: DU, gelesenBis: NACHHER },
    ])).toBe('gelesen')
    expect(nachrichtenstatus(nachricht, [
      { userId: ICH },
      { userId: DU, gelesenBis: NACHHER },
      { userId: DRITTE, zugestelltBis: NACHHER },
    ])).toBe('zugestellt')
  })

  /*
   * In der Gruppe zählt der Langsamste. Zwei Haken, weil einer von acht das
   * Gerät angehabt hat, wären eine Auskunft über niemanden.
   */
  it('in der Gruppe zählt der Langsamste', () => {
    const alle = [
      { userId: ICH },
      { userId: DU, zugestelltBis: NACHHER, gelesenBis: NACHHER },
      { userId: DRITTE, zugestelltBis: NACHHER },
    ]
    expect(nachrichtenstatus(nachricht, alle)).toBe('zugestellt')

    const gelesen = alle.map(m => m.userId === DRITTE
      ? { ...m, gelesenBis: NACHHER } : m)
    expect(nachrichtenstatus(nachricht, gelesen)).toBe('gelesen')
  })

  it('der eigene Stand zählt nie mit', () => {
    // Dass ich meine eigene Nachricht kenne, sagt über ihre Zustellung nichts.
    expect(nachrichtenstatus(nachricht, [
      { userId: ICH, gelesenBis: NACHHER }, { userId: DU },
    ])).toBe('gesendet')
  })

  it('ohne Gegenüber bleibt es gesendet', () => {
    expect(nachrichtenstatus(nachricht, [{ userId: ICH, gelesenBis: NACHHER }]))
      .toBe('gesendet')
  })

  it('Datumsangaben gehen als Date oder als Text', () => {
    expect(nachrichtenstatus(
      { createdAt: new Date(GESENDET), userId: ICH },
      [{ userId: ICH }, { userId: DU, gelesenBis: new Date(NACHHER) }],
    )).toBe('gelesen')
  })
})

describe('zurueckziehbar', () => {
  /*
   * DER GEMELDETE FALL: Die Nachricht liegt auf dem Telefon des anderen, aber
   * niemand hat hingesehen. Vorher hieß das „gelesen" und das Zurückziehen war
   * gesperrt.
   */
  it('zugestellt reicht NICHT, um es zu sperren', () => {
    expect(zurueckziehbar(nachricht, [
      { userId: ICH }, { userId: DU, zugestelltBis: NACHHER },
    ], ICH)).toBe(true)
  })

  it('gelesen sperrt es', () => {
    expect(zurueckziehbar(nachricht, [
      { userId: ICH }, { userId: DU, gelesenBis: NACHHER },
    ], ICH)).toBe(false)
  })

  it('solange einer es nicht gelesen hat, geht es', () => {
    // Bei dem, der es kennt, hilft Löschen ohnehin nicht mehr — für alle
    // anderen schon.
    expect(zurueckziehbar(nachricht, [
      { userId: ICH },
      { userId: DU, gelesenBis: NACHHER },
      { userId: DRITTE, zugestelltBis: NACHHER },
    ], ICH)).toBe(true)
  })

  it('fremde Nachrichten lassen sich nie zurückziehen', () => {
    expect(zurueckziehbar({ createdAt: GESENDET, userId: DU }, [
      { userId: ICH }, { userId: DU },
    ], ICH)).toBe(false)
  })

  it('und Systemhinweise auch nicht', () => {
    expect(zurueckziehbar({ ...nachricht, art: 'system' }, [
      { userId: ICH }, { userId: DU },
    ], ICH)).toBe(false)
  })
})
