import { describe, it, expect, afterEach, vi } from 'vitest'

/**
 * §235 Die Weiterleitung auf die richtige Domain — und wo sie schweigen muss.
 *
 * Gemeldet: „Bei der Google-Synchronisation steht noch die alte generierte
 * Railway-Domain. Und die steht auch bei den Pop-Up-Nachrichten, die ich
 * aufs Handy bekomme."
 *
 * §228 hat die Abo-Adresse umgestellt; die Push-Meldung zeigt dagegen die
 * Adresse, unter der die App INSTALLIERT wurde — das entscheidet der Browser.
 * Solange der alte Name beide Seiten ausliefert, bleibt jede dort installierte
 * App darauf. Eine Weiterleitung ist der einzige Ort, an dem sich das beheben
 * lässt.
 *
 * Diese Prüfung misst die Entscheidung, nicht die Umsetzung: WANN wird
 * umgeleitet und wann nicht. Eine Weiterleitung, die zu viel umleitet, nimmt
 * einem abgeschickten Urlaubsantrag den Rumpf — deshalb stehen hier mehr
 * Gegenproben als Proben.
 */

import { kanonischesZiel } from '../kanonische-domain'

/**
 * Gelesen, nicht nachgebaut.
 *
 * Hier stand erst eine Abschrift der Bedingungen aus `middleware.ts`. Die
 * hätte ihre eigene Abschrift geprüft — und genau diese Art Dublette ist in
 * §229, §232 und §235 dreimal als Fehler aufgefallen. Jetzt entscheidet
 * dieselbe Funktion, die auch im Betrieb entscheidet.
 */
const sollUmleiten = (opt: {
  appUrl?: string; method: string; pfad: string; host: string
}) => kanonischesZiel(
  { method: opt.method, host: opt.host, pfad: opt.pfad }, opt.appUrl,
)

const BETRIEB = 'https://okun-workforce.com'
const ALT = 'therapie-production.up.railway.app'

afterEach(() => vi.restoreAllMocks())

describe('Wer über den alten Namen kommt', () => {
  it('wird auf den richtigen geschickt', () => {
    expect(sollUmleiten({ appUrl: BETRIEB, method: 'GET', pfad: '/employee', host: ALT }))
      .toBe('https://okun-workforce.com/employee')
  })

  it('auch tief in der App — sonst bliebe die installierte App für immer dort', () => {
    expect(sollUmleiten({ appUrl: BETRIEB, method: 'GET', pfad: '/employee/schedule', host: ALT }))
      .toBe('https://okun-workforce.com/employee/schedule')
  })
})

describe('Wann NICHT umgeleitet wird', () => {
  it('wer schon richtig ist, bleibt', () => {
    expect(sollUmleiten({ appUrl: BETRIEB, method: 'GET', pfad: '/employee', host: 'okun-workforce.com' }))
      .toBeNull()
  })

  /*
   * Die wichtigste Gegenprobe: Eine Weiterleitung verliert den Rumpf einer
   * POST-Anfrage. Ein abgeschickter Urlaubsantrag wäre dann weg — und zwar
   * still, mit einer 2xx-Antwort.
   */
  it('niemals bei POST — der Rumpf ginge verloren', () => {
    expect(sollUmleiten({ appUrl: BETRIEB, method: 'POST', pfad: '/employee', host: ALT })).toBeNull()
    expect(sollUmleiten({ appUrl: BETRIEB, method: 'PATCH', pfad: '/x', host: ALT })).toBeNull()
    expect(sollUmleiten({ appUrl: BETRIEB, method: 'DELETE', pfad: '/x', host: ALT })).toBeNull()
  })

  /*
   * Und nie für die Schnittstelle: Eine laufende App, die nach dem Umzug noch
   * mit dem alten Namen spricht, soll Antworten bekommen statt
   * Weiterleitungen.
   */
  it('niemals für /api', () => {
    expect(sollUmleiten({ appUrl: BETRIEB, method: 'GET', pfad: '/api/employees', host: ALT })).toBeNull()
  })

  it('nicht in der Entwicklung — dort ist APP_URL localhost', () => {
    expect(sollUmleiten({ appUrl: 'http://localhost:3000', method: 'GET', pfad: '/', host: 'localhost:3000' }))
      .toBeNull()
  })

  it('und nicht bei internen Aufrufen', () => {
    expect(sollUmleiten({ appUrl: BETRIEB, method: 'GET', pfad: '/', host: 'localhost:3000' })).toBeNull()
    expect(sollUmleiten({ appUrl: BETRIEB, method: 'GET', pfad: '/', host: '127.0.0.1:8080' })).toBeNull()
  })

  /*
   * Ohne `APP_URL` darf gar nichts geschehen. Sonst nähme eine fehlende
   * Umgebungsvariable den Betrieb mit — und das ist der Fall, in dem niemand
   * mehr hineinkommt, um sie zu setzen.
   */
  it('ohne APP_URL gar nicht', () => {
    expect(sollUmleiten({ method: 'GET', pfad: '/', host: ALT })).toBeNull()
    expect(sollUmleiten({ appUrl: '', method: 'GET', pfad: '/', host: ALT })).toBeNull()
  })

  it('und eine kaputte APP_URL hält den Betrieb nicht an', () => {
    expect(sollUmleiten({ appUrl: 'keine-adresse', method: 'GET', pfad: '/', host: ALT })).toBeNull()
  })
})

describe('Die Adresse bleibt erhalten', () => {
  it('der Pfad wandert mit', () => {
    expect(sollUmleiten({ appUrl: BETRIEB, method: 'GET', pfad: '/admin/schedule', host: ALT }))
      .toBe('https://okun-workforce.com/admin/schedule')
  })

  it('ein Schrägstrich am Ende von APP_URL stört nicht', () => {
    expect(sollUmleiten({ appUrl: 'https://okun-workforce.com/', method: 'GET', pfad: '/employee', host: ALT }))
      .toBe('https://okun-workforce.com/employee')
  })
})
