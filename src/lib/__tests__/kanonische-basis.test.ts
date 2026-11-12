import { describe, it, expect, afterEach } from 'vitest'
import { kanonischeBasis, BETRIEBS_ADRESSE } from '../kanonische-basis'

/**
 * §238 Welche Adresse nach außen geht.
 *
 * Gemeldet, dreimal: „Bei dieser Google-Kalender-Synchronisation steht immer
 * noch diese Therapie-Domain." Nachgemessen trug `APP_URL` in Railway den von
 * Railway erzeugten Namen, und jede Stelle, die sie las, las ihn mit — das
 * Kalender-Abo, die Links in allen E-Mails, die Stellenmeldung.
 *
 * Diese Tests halten beide Richtungen fest: Der erzeugte Name wird nie
 * herausgegeben, und eine richtig gesetzte Adresse behält den Vorrang. Ohne
 * die zweite Hälfte wäre die Einstellung stillgelegt statt abgesichert.
 */

const ALT = process.env.APP_URL
const ALT_ENV = process.env.NODE_ENV

/** NODE_ENV ist schreibgeschützt typisiert — hier wird es bewusst gesetzt. */
function setzeUmgebung(wert: string | undefined) {
  Object.defineProperty(process.env, 'NODE_ENV', {
    value: wert, configurable: true, writable: true, enumerable: true,
  })
}

afterEach(() => {
  if (ALT === undefined) delete process.env.APP_URL
  else process.env.APP_URL = ALT
  setzeUmgebung(ALT_ENV)
})

describe('kanonischeBasis', () => {
  it('nimmt eine gesetzte eigene Adresse — sie hat Vorrang', () => {
    process.env.APP_URL = 'https://okun-workforce.com'
    setzeUmgebung('production')
    expect(kanonischeBasis()).toBe('https://okun-workforce.com')
  })

  it('auch eine ANDERE eigene Adresse — die Einstellung ist nicht stillgelegt', () => {
    // Die Gegenprobe zum Rückfall: Eine Testumgebung mit eigener Adresse muss
    // bei ihrer bleiben. Ohne diesen Fall hätte §238 die Einstellung ersetzt
    // statt sie abzusichern.
    process.env.APP_URL = 'https://test.okun-systems.com'
    setzeUmgebung('production')
    expect(kanonischeBasis()).toBe('https://test.okun-systems.com')
  })

  it('schneidet den Schrägstrich am Ende ab', () => {
    process.env.APP_URL = 'https://okun-workforce.com/'
    setzeUmgebung('production')
    expect(kanonischeBasis()).toBe('https://okun-workforce.com')
  })

  /*
   * Der gemeldete Fall.
   */
  it('gibt den von Railway erzeugten Namen niemals heraus', () => {
    process.env.APP_URL = 'https://therapie-production.up.railway.app'
    setzeUmgebung('production')
    expect(kanonischeBasis()).toBe(BETRIEBS_ADRESSE)
  })

  it('auch nicht in anderer Schreibweise oder mit Schrägstrich', () => {
    setzeUmgebung('production')
    for (const wert of [
      'https://THERAPIE-PRODUCTION.UP.RAILWAY.APP',
      'https://therapie-production.up.railway.app/',
      'https://irgendwas-anderes.up.railway.app',
    ]) {
      process.env.APP_URL = wert
      expect(kanonischeBasis()).toBe(BETRIEBS_ADRESSE)
    }
  })

  it('und nicht, wenn gar nichts gesetzt ist', () => {
    delete process.env.APP_URL
    setzeUmgebung('production')
    expect(kanonischeBasis()).toBe(BETRIEBS_ADRESSE)
  })

  it('eine kaputte Angabe wird behandelt wie keine', () => {
    process.env.APP_URL = 'kein-gueltiger-wert'
    setzeUmgebung('production')
    expect(kanonischeBasis()).toBe(BETRIEBS_ADRESSE)
  })

  /*
   * In der Entwicklung darf die Betriebsadresse NICHT einspringen — sonst
   * zeigten alle Links aus einem lokalen Lauf auf das laufende System.
   */
  it('in der Entwicklung die Adresse der Anfrage', () => {
    delete process.env.APP_URL
    setzeUmgebung('development')
    expect(kanonischeBasis('http://localhost:3000')).toBe('http://localhost:3000')
  })

  it('und ohne Anfrage dort localhost', () => {
    delete process.env.APP_URL
    setzeUmgebung('development')
    expect(kanonischeBasis()).toBe('http://localhost:3000')
  })

  it('aber auch in der Entwicklung nie den erzeugten Namen', () => {
    process.env.APP_URL = 'https://therapie-production.up.railway.app'
    setzeUmgebung('development')
    expect(kanonischeBasis('http://localhost:3000')).toBe('http://localhost:3000')
  })
})
