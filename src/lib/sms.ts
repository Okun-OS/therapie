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

/**
 * §197 Was Twilio zu einer abgelehnten Nachricht sagt.
 *
 * `code` ist die Nummer aus Twilios Fehlerverzeichnis (21212, 21606, …) und
 * sagt genau, woran es lag. Sie gehört NICHT zu dem, was ein Benutzer vor der
 * Anmeldung zu sehen bekommt — aber unbedingt zu dem, was derjenige sieht,
 * der den Versand gerade einrichtet.
 */
export interface SmsFehler {
  code?: number
  twilio?: string
  hinweis?: string
}

/**
 * §197 Die paar Fehler, die beim Einrichten wirklich vorkommen — übersetzt.
 *
 * Twilios eigene Meldungen sind englisch und beschreiben das Symptom, nicht
 * die Abhilfe. „The From phone number OKUN is not a valid phone number" sagt
 * einem Betreiber nicht, dass sein Konto noch im Testbetrieb ist.
 */
const ERKLAERUNGEN: Record<number, string> = {
  21212:
    'Twilio erkennt den Absender nicht an. Bei einem Absendernamen wie „OKUN" '
    + 'ist die häufigste Ursache ein Konto, das noch im Testbetrieb läuft — '
    + 'Testkonten dürfen keine Absendernamen benutzen. Prüfen, ob das Konto '
    + 'wirklich auf „Full access" steht.',
  21606:
    'Der Absender gehört nicht zu diesem Konto oder kann keine SMS. Bei einer '
    + 'gekauften Nummer: Ist sie SMS-fähig und in genau diesem Konto? Bei '
    + 'einem Absendernamen: Erlaubt das Zielland ihn ohne Voranmeldung? '
    + '(Deutschland: ja.)',
  21612:
    'Diese Kombination aus Absender und Empfänger ist nicht zustellbar — '
    + 'meist ein Absender, der im Land des Empfängers nicht zugelassen ist.',
  21614: 'Die Zielnummer ist eine Festnetznummer. Dorthin geht keine SMS.',
  21408:
    'Für dieses Zielland ist der Versand im Konto nicht freigeschaltet. In '
    + 'Twilio unter Messaging → Settings → Geo permissions das Land erlauben.',
  20003:
    'Twilio verweigert den Zugang. Entweder stimmen TWILIO_ACCOUNT_SID und '
    + 'TWILIO_AUTH_TOKEN nicht — oder das Konto ist noch nicht freigegeben. '
    + 'Die genaue Ursache steht in Twilios eigener Meldung daneben.',
}

/**
 * §197 Wenn Twilio selbst deutlicher ist als unsere Nummerntabelle.
 *
 * WARUM ES DAS GIBT
 * Beim ersten echten Versuch kam Fehler 20003 — und unsere Erklärung dazu
 * lautete „Stimmen SID und Token, ist das Konto bezahlt?". Beides war falsch.
 * Twilios eigene Meldung sagte es genau: „Primary compliance profile is not
 * approved. Complete the KYC process in Trust Hub."
 *
 * 20003 ist bei Twilio ein Sammelbecken für „Zugang verweigert", und die
 * Nummer allein sagt zu wenig. Eine Erklärung, die an der Nummer hängt und
 * den Text daneben ignoriert, schickt den Betreiber in die falsche Richtung —
 * er sucht dann im Zugangsschlüssel, während die Firmenprüfung hängt.
 *
 * Deshalb: Erst im Text nachsehen, dann in der Nummerntabelle.
 */
const AM_TEXT: Array<[RegExp, string]> = [
  [
    /compliance profile|trust hub|kyc/i,
    'Die Firmenprüfung bei Twilio (Trust Hub) ist noch nicht freigegeben. '
    + 'Solange sie läuft, verschickt das Konto gar nichts — unabhängig von '
    + 'Absender und Zugangsdaten. In der Twilio-Konsole unter Trust Hub den '
    + 'Stand ansehen: „Pending Review" heißt warten (in der Regel ein bis '
    + 'zwei Werktage), „Rejected" nennt dort den Grund zum Nachbessern.',
  ],
  [
    /trial account/i,
    'Das Konto läuft noch im Testbetrieb. Testkonten dürfen nur an vorher '
    + 'freigeschaltete Nummern senden und keine Absendernamen benutzen.',
  ],
  [
    /not a valid phone number|is not a valid/i,
    'Twilio erkennt den Absender nicht an. Bei einem Absendernamen wie '
    + '„OKUN" ist die häufigste Ursache ein Konto, das noch nicht vollständig '
    + 'freigegeben ist.',
  ],
]

/** Die Erklärung zu einer Ablehnung — Text schlägt Nummer. */
function erklaerung(code: number | undefined, meldung: string | undefined): string | undefined {
  if (meldung) {
    for (const [muster, text] of AM_TEXT) if (muster.test(meldung)) return text
  }
  return code ? ERKLAERUNGEN[code] : undefined
}

export async function sendSms(
  to: string,
  body: string,
): Promise<{ success: boolean; error?: string; fehler?: SmsFehler }> {
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
      /*
       * §197 Den Grund mitgeben — aber nur als zweites Feld.
       *
       * `error` bleibt der Satz, den ein Benutzer sehen darf. `fehler` ist
       * für den Betreiber: Nummer, Originaltext und eine Erklärung auf
       * Deutsch. Wer es weitergibt, entscheidet die Route — vor der
       * Anmeldung darf niemand erfahren, wie unsere Einrichtung aussieht.
       */
      let code: number | undefined
      let twilio: string | undefined
      try {
        const d = JSON.parse(text)
        code = typeof d?.code === 'number' ? d.code : undefined
        twilio = typeof d?.message === 'string' ? d.message : undefined
      } catch { /* kein JSON — dann eben nur der Rohtext */ }
      return {
        success: false,
        error: 'SMS konnte nicht gesendet werden.',
        fehler: {
          code,
          twilio: twilio ?? text.slice(0, 300),
          hinweis: erklaerung(code, twilio ?? text),
        },
      }
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
