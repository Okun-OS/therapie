import { describe, it, expect } from 'vitest'
import {
  siegelErzeugen, siegelGueltig, oeffnungSperre, pfadIstFrei, FREIE_PFADE,
  hatZweitenFaktor, oeffnungAktiv, HOECHSTENS_STUNDEN, KEKS_OPTIONEN,
} from '../oeffnungssiegel'

/**
 * §289 Die Bestätigung beim Öffnen der App.
 *
 * Geprüft wird vor allem das, woran §139 gescheitert ist: ob sich damit
 * jemand aussperren kann. Die Antwort muss an jeder Stelle „nein" sein —
 * und zwar nachweislich, nicht nach Augenmaß.
 */

const WER = 'user-1'
const STUNDE = 3600_000

describe('§289 Das Siegel', () => {
  it('ein frisches gilt', () => {
    expect(siegelGueltig(siegelErzeugen(WER), WER)).toBe(true)
  })

  it('ohne Siegel gilt nichts', () => {
    expect(siegelGueltig(undefined, WER)).toBe(false)
    expect(siegelGueltig(null, WER)).toBe(false)
    expect(siegelGueltig('', WER)).toBe(false)
  })

  /*
   * Der Punkt, ohne den die ganze Sperre wertlos wäre: Auf einem geteilten
   * Tablet bliebe das Siegel sonst liegen, wenn sich die nächste Person
   * anmeldet — und die käme ohne Code hinein. Genau der Fall, gegen den die
   * Einstellung gebaut ist.
   */
  it('gilt nur für DEN Benutzer, für den es ausgestellt wurde', () => {
    expect(siegelGueltig(siegelErzeugen('anna'), 'bernd')).toBe(false)
  })

  it('ein selbstgeschriebenes gilt nicht', () => {
    const echt = siegelErzeugen(WER)
    const [daten] = echt.split('.')
    expect(siegelGueltig(`${daten}.gefaelscht`, WER)).toBe(false)
    expect(siegelGueltig('kein-punkt-darin', WER)).toBe(false)
    expect(siegelGueltig(`${daten}.`, WER)).toBe(false)
  })

  it('ein verändertes auch nicht', () => {
    const fremd = siegelErzeugen('anna')
    const meins = siegelErzeugen(WER)
    // Daten des einen, Unterschrift des anderen.
    expect(siegelGueltig(`${fremd.split('.')[0]}.${meins.split('.')[1]}`, 'anna'))
      .toBe(false)
  })

  it('nach der Obergrenze ist Schluss', () => {
    const jetzt = Date.now()
    const alt = siegelErzeugen(WER, jetzt - (HOECHSTENS_STUNDEN * STUNDE + 1000))
    expect(siegelGueltig(alt, WER, jetzt)).toBe(false)
    // Gegenprobe: eine Minute davor gilt es noch.
    const knapp = siegelErzeugen(WER, jetzt - (HOECHSTENS_STUNDEN * STUNDE - 60_000))
    expect(siegelGueltig(knapp, WER, jetzt)).toBe(true)
  })

  it('und ein Siegel aus der Zukunft gilt nicht', () => {
    const jetzt = Date.now()
    expect(siegelGueltig(siegelErzeugen(WER, jetzt + 10 * 60_000), WER, jetzt)).toBe(false)
  })

  /*
   * Kein `maxAge` — daran hängt „beim Öffnen der App". Ein Keks mit
   * Verfallsdatum überlebt das Schließen der App und die Sperre griffe nie.
   */
  it('der Keks ist ein Sitzungskeks', () => {
    expect('maxAge' in KEKS_OPTIONEN).toBe(false)
    expect(KEKS_OPTIONEN.httpOnly).toBe(true)
    expect(KEKS_OPTIONEN.sameSite).toBe('strict')
  })
})

describe('§289 Wann gesperrt wird', () => {
  const basis = { userId: WER, pfad: '/api/schedule-entries' }

  it('ohne die Einstellung nie', () => {
    expect(oeffnungSperre({ ...basis, verlangt: false })).toBeNull()
    expect(oeffnungSperre({ ...basis, verlangt: undefined })).toBeNull()
  })

  it('mit der Einstellung und ohne Siegel: gesperrt', () => {
    const sperre = oeffnungSperre({ ...basis, verlangt: true })
    expect(sperre?.status).toBe(403)
    expect(sperre?.code).toBe('OEFFNUNG_NOETIG')
  })

  it('mit gültigem Siegel: offen', () => {
    expect(oeffnungSperre({ ...basis, verlangt: true, marke: siegelErzeugen(WER) }))
      .toBeNull()
  })

  it('mit dem Siegel eines anderen: gesperrt', () => {
    expect(oeffnungSperre({ ...basis, verlangt: true, marke: siegelErzeugen('anna') }))
      .not.toBeNull()
  })
})

/**
 * §288 DER KERN: Kann diese Sperre jemanden aussperren?
 *
 * Die alte Gerätesperre konnte es, weil ihr Notausgang zurück in die Sperre
 * führte. Diese Prüfungen halten fest, dass der Ausgang hier offen bleibt.
 */
describe('§289 Der Ausweg bleibt offen', () => {
  it('das Abmelden ist nie gesperrt', () => {
    expect(oeffnungSperre({
      verlangt: true, userId: WER, pfad: '/api/auth/logout',
    })).toBeNull()
  })

  it('und die Wege, die zum Passieren gebraucht werden, auch nicht', () => {
    for (const pfad of [
      '/api/auth/oeffnung',
      '/api/auth/oeffnung/code',
      '/api/auth/oeffnung/pruefen',
      '/api/auth/me',
      '/api/health',
    ]) {
      expect(oeffnungSperre({ verlangt: true, userId: WER, pfad }), pfad).toBeNull()
    }
  })

  /*
   * Die Gegenprobe zur Freiliste: Sie darf nicht so weit sein, dass sie die
   * Sperre aushebelt. Ohne diese Prüfung wäre „der Ausweg ist offen" auch
   * dann grün, wenn ALLES offen wäre.
   */
  it('aber sonst nichts — die Freiliste ist keine Hintertür', () => {
    for (const pfad of [
      '/api/payroll/abrechnung',
      '/api/time-logs',
      '/api/employees',
      '/api/dsgvo/auskunft',
      '/api/auth/profile',
      '/api/auth/2fa/disable',
    ]) {
      expect(oeffnungSperre({ verlangt: true, userId: WER, pfad }), pfad).not.toBeNull()
    }
  })

  /*
   * Besonders heikel: `/api/auth/2fa/disable` schaltet den zweiten Faktor ab.
   * Wäre dieser Weg frei, könnte jemand vor der Tür den Schlüssel
   * wegwerfen — und stünde danach vor einer Tür ohne Schlüssel.
   */
  it('und das Abschalten des zweiten Faktors gehört nicht dazu', () => {
    expect(pfadIstFrei('/api/auth/2fa/disable')).toBe(false)
    expect(pfadIstFrei('/api/auth/2fa/sms-disable')).toBe(false)
  })

  it('ein Pfad, der nur so ähnlich heißt, ist nicht frei', () => {
    expect(pfadIstFrei('/api/auth/logout-alles')).toBe(false)
    expect(pfadIstFrei('/api/auth/oeffnungszeiten')).toBe(false)
    expect(pfadIstFrei('/api/healthcheck')).toBe(false)
  })

  it('die Freiliste enthält das Abmelden wirklich', () => {
    // Ohne diese Zeile könnte jemand den Eintrag entfernen, und die Prüfung
    // oben wäre weiter grün — sie prüft ja nur das Ergebnis.
    expect(FREIE_PFADE).toContain('/api/auth/logout')
  })
})

describe('§289 Keine Tür ohne Schlüssel', () => {
  it('ohne zweiten Faktor gilt die Einstellung nicht', () => {
    const ohne = { sms: false, email: false, totp: false }
    expect(hatZweitenFaktor(ohne)).toBe(false)
    expect(oeffnungAktiv(true, ohne)).toBe(false)
  })

  /*
   * Der Fall, der §288 war: Die Einstellung steht an, der Faktor fällt
   * später weg (Telefon verloren, SMS-2FA abgeschaltet). Dann MUSS
   * nachgegeben werden — sonst steht jemand vor einer Tür, zu der es keinen
   * Schlüssel mehr gibt.
   */
  it('fällt der Faktor später weg, gilt sie nicht mehr', () => {
    expect(oeffnungAktiv(true, { sms: true, email: false, totp: false })).toBe(true)
    expect(oeffnungAktiv(true, { sms: false, email: false, totp: false })).toBe(false)
  })

  it('jeder einzelne Faktor genügt', () => {
    expect(oeffnungAktiv(true, { sms: true, email: false, totp: false })).toBe(true)
    expect(oeffnungAktiv(true, { sms: false, email: true, totp: false })).toBe(true)
    expect(oeffnungAktiv(true, { sms: false, email: false, totp: true })).toBe(true)
  })

  it('und ohne die Einstellung bleibt sie aus, egal wie viele Faktoren da sind', () => {
    expect(oeffnungAktiv(false, { sms: true, email: true, totp: true })).toBe(false)
  })
})
