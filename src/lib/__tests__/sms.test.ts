import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { sendSms, smsEingerichtet, generateOtp } from '../sms'

/**
 * §195 Was passiert, wenn kein SMS-Versand eingerichtet ist?
 *
 * WARUM DAS EINEN TEST BRAUCHT
 * Die Antwort war ein Jahr lang: „Der Code wird ins Serverprotokoll
 * geschrieben, und dem Benutzer wird gesagt, es sei alles gut." In der
 * Entwicklung ist das bequem. Im Betrieb waren das zwei Fehler auf einmal —
 * ein Anmeldecode im Klartext im Protokoll, und eine Oberfläche, die
 * „gesendet" meldet, obwohl nichts gesendet wurde.
 *
 * Der Unterschied hängt an einer einzigen Umgebungsvariablen. So etwas
 * bemerkt niemand beim Lesen; es muss nachgerechnet werden.
 */

const SICHERN = { ...process.env }

beforeEach(() => {
  delete process.env.TWILIO_ACCOUNT_SID
  delete process.env.TWILIO_AUTH_TOKEN
  delete process.env.SMS_FROM
})

afterEach(() => {
  process.env = { ...SICHERN }
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** NODE_ENV ist schreibgeschützt — über die Eigenschaft geht es trotzdem. */
function betriebsart(wert: string) {
  Object.defineProperty(process.env, 'NODE_ENV', {
    value: wert, configurable: true, writable: true,
  })
}

describe('§195 SMS ohne eingerichteten Versand', () => {
  it('erkennt, dass nichts eingerichtet ist', () => {
    expect(smsEingerichtet()).toBe(false)
  })

  it('erkennt es als eingerichtet, sobald alle drei Angaben stehen', () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC-test'
    process.env.TWILIO_AUTH_TOKEN = 'geheim'
    process.env.SMS_FROM = '+4915900000000'
    expect(smsEingerichtet()).toBe(true)
  })

  it('gilt NICHT als eingerichtet, wenn nur zwei der drei Angaben stehen', () => {
    // Halb eingerichtet ist nicht eingerichtet: Twilio lehnt ab, und der
    // Benutzer bekäme wieder eine Meldung, die nichts erklärt.
    process.env.TWILIO_ACCOUNT_SID = 'AC-test'
    process.env.TWILIO_AUTH_TOKEN = 'geheim'
    expect(smsEingerichtet()).toBe(false)
  })

  describe('im Betrieb', () => {
    beforeEach(() => betriebsart('production'))

    it('meldet ehrlich einen Fehlschlag statt Erfolg', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const r = await sendSms('+4915900000000', 'Dein OKUN Anmelde-Code: 123456.')
      expect(r.success).toBe(false)
      expect(r.error).toMatch(/nicht eingerichtet/i)
    })

    it('schreibt den Code NICHT ins Protokoll', async () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {})
      const fehler = vi.spyOn(console, 'error').mockImplementation(() => {})

      await sendSms('+4915900000000', 'Dein OKUN Anmelde-Code: 123456.')

      const alles = [...log.mock.calls, ...fehler.mock.calls].flat().join(' ')
      expect(alles).not.toContain('123456')
      expect(alles).not.toContain('+4915900000000')
      // Gemeldet werden MUSS trotzdem etwas — sonst sucht der Betreiber den
      // Fehler im Dunkeln.
      expect(fehler).toHaveBeenCalled()
    })
  })

  describe('in der Entwicklung', () => {
    beforeEach(() => betriebsart('development'))

    it('bleibt die Konsole die Notlösung — sonst bräuchte jeder ein Telefon', async () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {})
      const r = await sendSms('+4915900000000', 'Dein OKUN Anmelde-Code: 123456.')
      expect(r.success).toBe(true)
      expect(log.mock.calls.flat().join(' ')).toContain('123456')
    })
  })
})

describe('§197 Wenn Twilio ablehnt', () => {
  beforeEach(() => {
    process.env.TWILIO_ACCOUNT_SID = 'AC-test'
    process.env.TWILIO_AUTH_TOKEN = 'geheim'
    process.env.SMS_FROM = 'OKUN'
    betriebsart('production')
  })

  /** Twilios Antwort nachstellen, ohne Twilio zu fragen. */
  function twilioAntwortet(status: number, koerper: unknown) {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      typeof koerper === 'string' ? koerper : JSON.stringify(koerper),
      { status },
    )))
  }

  it('reicht Fehlernummer und Originaltext durch', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    twilioAntwortet(400, {
      code: 21212,
      message: "The From phone number OKUN is not a valid phone number",
    })

    const r = await sendSms('+4915900000000', 'Code: 123456')

    expect(r.success).toBe(false)
    expect(r.fehler?.code).toBe(21212)
    expect(r.fehler?.twilio).toContain('OKUN')
  })

  it('erklärt die häufigen Nummern auf Deutsch', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    twilioAntwortet(400, { code: 21212, message: 'nope' })

    const r = await sendSms('+4915900000000', 'Code: 123456')

    // Der Hinweis muss die tatsächliche Abhilfe nennen, nicht das Symptom
    // wiederholen. Beim häufigsten Fall ist das: Konto noch im Testbetrieb.
    expect(r.fehler?.hinweis).toMatch(/Testbetrieb|Full access/i)
  })

  it('lässt den allgemeinen Satz für den Benutzer unverändert', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    twilioAntwortet(400, { code: 21606, message: 'irgendwas Internes' })

    const r = await sendSms('+4915900000000', 'Code: 123456')

    // `error` ist das, was eine Route notfalls an einen Unbekannten gibt.
    // Dort darf nichts über unsere Einrichtung stehen.
    expect(r.error).toBe('SMS konnte nicht gesendet werden.')
    expect(r.error).not.toContain('irgendwas Internes')
    expect(r.error).not.toContain('21606')
  })

  it('kommt auch mit einer Antwort zurecht, die kein JSON ist', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    twilioAntwortet(502, '<html>Bad Gateway</html>')

    const r = await sendSms('+4915900000000', 'Code: 123456')

    expect(r.success).toBe(false)
    expect(r.fehler?.code).toBeUndefined()
    expect(r.fehler?.twilio).toContain('Bad Gateway')
  })

  it('nennt für eine unbekannte Nummer keinen erfundenen Hinweis', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    twilioAntwortet(400, { code: 99999, message: 'etwas Neues' })

    const r = await sendSms('+4915900000000', 'Code: 123456')

    expect(r.fehler?.code).toBe(99999)
    expect(r.fehler?.hinweis).toBeUndefined()
  })
})

describe('§195 Der Code selbst', () => {
  it('ist sechsstellig und besteht nur aus Ziffern', () => {
    for (let i = 0; i < 200; i++) expect(generateOtp()).toMatch(/^[0-9]{6}$/)
  })

  it('ist nicht jedes Mal derselbe', () => {
    const gesehen = new Set(Array.from({ length: 200 }, () => generateOtp()))
    expect(gesehen.size).toBeGreaterThan(150)
  })
})
