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

export async function sendSms(to: string, body: string): Promise<{ success: boolean; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.SMS_FROM

  if (!sid || !token || !from) {
    // Dev / staging fallback: print to server console only
    console.log(`[SMS-DEV] To: ${to} | Message: ${body}`)
    return { success: true }
  }

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
