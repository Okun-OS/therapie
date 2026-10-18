/**
 * SMS provider abstraction. In development (or when TWILIO_* env vars are absent)
 * the code is printed to the server console so developers can test without a real
 * phone number. In production set the three TWILIO_* variables plus SMS_FROM to
 * switch to real SMS delivery.
 *
 * Required env vars for Twilio (production only):
 *   TWILIO_ACCOUNT_SID   — from Twilio Console
 *   TWILIO_AUTH_TOKEN    — from Twilio Console
 *   SMS_FROM             — your Twilio phone number, e.g. "+4915901234567"
 *
 * DSGVO / AVV: Twilio offers a Data Processing Agreement (DPA) at
 * https://www.twilio.com/legal/data-protection-addendum — sign it before
 * storing German phone numbers. Phone numbers are stored encrypted-at-rest
 * by the database (Railway) and never logged in plaintext.
 *
 * Country coverage: Twilio supports Germany (DE) and most EU countries.
 * Per-SMS cost: ~€0.08–0.12 for DE numbers. Check the Twilio pricing page.
 *
 * Security note per NIST SP 800-63B: SMS is weaker than TOTP because it is
 * susceptible to SIM-swapping and SS7 attacks. We offer SMS 2FA for convenience
 * while keeping TOTP as the recommended option.
 */

const MAX_ATTEMPTS = 5
const EXPIRY_MINUTES = 10
const RATE_LIMIT_MINUTES = 1   // minimum gap between sends per user

export { MAX_ATTEMPTS, EXPIRY_MINUTES, RATE_LIMIT_MINUTES }

/**
 * §195 Ist ein SMS-Versand überhaupt eingerichtet?
 *
 * Gebraucht, bevor irgendwo ein Code erzeugt wird. Vorher hat niemand
 * gefragt — und das war der Fehler, siehe unten.
 */
export function smsEingerichtet(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.SMS_FROM,
  )
}

export async function sendSms(to: string, body: string): Promise<{ success: boolean; error?: string }> {
  /*
   * §195 Die Notlösung für die Entwicklung gilt NUR in der Entwicklung.
   *
   * WAS HIER VORHER STAND
   * Fehlten die drei Twilio-Angaben, schrieb diese Funktion den Text ins
   * Serverprotokoll und meldete `success: true`. In der Entwicklung ist das
   * bequem: Man sieht den Code auf der Konsole und braucht kein Telefon.
   *
   * IM BETRIEB WAREN DAS ZWEI FEHLER AUF EINMAL
   * Erstens stand damit ein ANMELDECODE IM KLARTEXT im Protokoll. Bei Railway
   * liest das jeder mit Projektzugang — ein zweiter Faktor, den man im
   * Protokoll nachschlagen kann, ist keiner.
   *
   * Zweitens log die Antwort: Der Benutzer bekam „Code gesendet" zu sehen,
   * obwohl nichts verschickt wurde. Er wartet dann auf eine SMS, die nie
   * kommt, und sucht den Fehler bei seinem Telefon.
   *
   * Jetzt: In der Entwicklung bleibt die Konsole. Im Betrieb ohne Einrichtung
   * wird NICHTS verschickt, NICHTS protokolliert und ehrlich `false`
   * zurückgegeben.
   */
  if (!smsEingerichtet()) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[SMS] Nicht eingerichtet — TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN und SMS_FROM fehlen.')
      return { success: false, error: 'Der SMS-Versand ist nicht eingerichtet.' }
    }
    console.log(`[SMS-DEV] To: ${to} | Message: ${body}`)
    return { success: true }
  }

  // `smsEingerichtet()` oben hat die drei schon geprüft; das Ausrufezeichen
  // sagt dem Übersetzer, was er daraus nicht selbst folgern kann.
  const sid = process.env.TWILIO_ACCOUNT_SID!
  const token = process.env.TWILIO_AUTH_TOKEN!
  const from = process.env.SMS_FROM!

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`
    const params = new URLSearchParams({ To: to, From: from, Body: body })
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error('[SMS] Twilio error:', text)
      return { success: false, error: 'SMS konnte nicht gesendet werden.' }
    }
    return { success: true }
  } catch (err) {
    console.error('[SMS] Network error:', err)
    return { success: false, error: 'SMS-Dienst nicht erreichbar.' }
  }
}

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}
