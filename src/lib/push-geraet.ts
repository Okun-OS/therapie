import { createSign } from 'node:crypto'
import { prisma } from './prisma'

/**
 * §139 Benachrichtigungen an die App aus dem Store.
 *
 * WARUM NOCH EIN WEG, WO ES SCHON EINEN GIBT
 * Der bestehende Weg (Web-Push, `push.ts`) erreicht ein iPhone nur, wenn die
 * Seite auf dem Startbildschirm liegt UND der Dienst-Arbeiter noch lebt. Apple
 * beendet den nach einiger Zeit. Wer am Sonntagabend einen Ausfall für Montag
 * sechs Uhr meldet, erreicht damit niemanden. Der native Weg (APNs über
 * Firebase, und FCM für Android) erreicht das Telefon auch dann, wenn die App
 * seit Tagen zu ist.
 *
 * Beide Wege laufen nebeneinander: Wer die App aus dem Store hat, bekommt sie
 * nativ; wer im Browser arbeitet, über den alten Weg. Doppelt bekommt sie
 * niemand, weil ein Gerät immer nur einen der beiden Wege nutzt.
 *
 * WAS EINGERICHTET SEIN MUSS
 * `FCM_SERVICE_ACCOUNT` — der Inhalt der Schlüsseldatei aus der Firebase-
 * Konsole, als eine Zeile. Fehlt sie, wird nichts verschickt und nichts
 * kaputtgemacht: Der Versand schreibt eine Zeile ins Protokoll und ist fertig.
 * Das ist Absicht — die Entwicklungsumgebung soll ohne Google-Konto laufen.
 */

interface Dienstkonto {
  project_id: string
  client_email: string
  private_key: string
}

function dienstkonto(): Dienstkonto | null {
  const roh = process.env.FCM_SERVICE_ACCOUNT
  if (!roh) return null
  try {
    const k = JSON.parse(roh)
    if (!k.project_id || !k.client_email || !k.private_key) return null
    // In Umgebungsvariablen überleben echte Zeilenumbrüche selten; Google
    // liefert den Schlüssel mit \n im Text. Beides muss funktionieren.
    return { ...k, private_key: String(k.private_key).replace(/\\n/g, '\n') }
  } catch {
    return null
  }
}

export function eingerichtet(): boolean {
  return dienstkonto() !== null
}

// ── Zugang ─────────────────────────────────────────────────────────────────

let zugang: { token: string; gueltigBis: number } | null = null

const base64url = (b: Buffer | string) =>
  Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/**
 * Ein Zugangstoken bei Google holen und behalten, solange es gilt.
 *
 * Für jede einzelne Benachrichtigung eines zu holen, wären bei einem
 * Schichtausfall mit vierzig Angeschriebenen vierzig zusätzliche Anfragen —
 * und Google drosselt das zu Recht.
 */
async function zugangstoken(konto: Dienstkonto): Promise<string | null> {
  if (zugang && zugang.gueltigBis > Date.now() + 60_000) return zugang.token

  const jetzt = Math.floor(Date.now() / 1000)
  const kopf = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const inhalt = base64url(JSON.stringify({
    iss: konto.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: jetzt,
    exp: jetzt + 3600,
  }))

  let unterschrift: string
  try {
    const s = createSign('RSA-SHA256')
    s.update(`${kopf}.${inhalt}`)
    s.end()
    unterschrift = base64url(s.sign(konto.private_key))
  } catch {
    // Ein kaputter Schlüssel ist ein Einrichtungsfehler, kein Grund, den
    // Aufrufer scheitern zu lassen — die Benachrichtigung ist Beiwerk, die
    // Schicht wird trotzdem besetzt.
    console.error('[push:nativ] Der hinterlegte Schlüssel lässt sich nicht verwenden.')
    return null
  }

  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${kopf}.${inhalt}.${unterschrift}`,
      }),
    })
    if (!r.ok) {
      console.error(`[push:nativ] Google verweigert den Zugang: HTTP ${r.status}`)
      return null
    }
    const d = await r.json()
    zugang = {
      token: d.access_token,
      gueltigBis: Date.now() + (Number(d.expires_in ?? 3600) * 1000),
    }
    return zugang.token
  } catch {
    return null
  }
}

// ── Was eine Antwort bedeutet ──────────────────────────────────────────────

export type Geraeteausgang =
  /** Angekommen */
  | 'zugestellt'
  /** Die Kennung taugt nicht mehr — Gerät zurückgegeben, App gelöscht */
  | 'entfernen'
  /** Vorübergehend; beim nächsten Mal geht es wieder */
  | 'spaeter'

/**
 * Der einzige Fall, der wirklich zählt: Wann wird eine Gerätekennung gelöscht?
 *
 * Zu früh gelöscht heißt, dass jemand keine Benachrichtigungen mehr bekommt und
 * es nie erfährt. Zu spät gelöscht heißt, dass wir auf ewig gegen tote
 * Kennungen senden. Google unterscheidet beides sauber — und nur diese zwei
 * Antworten dürfen zum Löschen führen.
 */
export function beurteileAntwort(status: number, fehlerText?: string): Geraeteausgang {
  if (status >= 200 && status < 300) return 'zugestellt'
  // 404 UNREGISTERED: App deinstalliert oder Kennung abgelaufen.
  if (status === 404) return 'entfernen'
  // 400 INVALID_ARGUMENT auf das Feld „token": die Kennung ist unbrauchbar.
  // Ein anderes ungültiges Feld wäre unser Fehler und darf kein Gerät kosten.
  if (status === 400 && /token/i.test(fehlerText ?? '')) return 'entfernen'
  // 403 kann auch heißen, dass unser Dienstkonto falsch eingerichtet ist —
  // dann liegt es nicht am Gerät.
  return 'spaeter'
}

// ── Versand ────────────────────────────────────────────────────────────────

export interface Meldung {
  titel: string
  text: string
  /** Wohin getippt werden soll, z. B. /employee/schedule */
  url?: string
}

/**
 * An alle Geräte eines Menschen senden.
 *
 * Gibt zurück, an wie viele Geräte es ging. Der Aufrufer wartet nicht darauf,
 * dass alles klappt — eine Benachrichtigung, die nicht ankommt, darf keine
 * Krankmeldung und keinen Dienstplan aufhalten.
 */
export async function sendeAnGeraete(employeeId: string, meldung: Meldung): Promise<number> {
  const geraete = await prisma.geraet.findMany({ where: { employeeId } })
  if (geraete.length === 0) return 0

  const konto = dienstkonto()
  if (!konto) {
    console.log(`[push:nativ:entwicklung] ${geraete.length} Gerät(e) von ${employeeId}`
      + ` – "${meldung.titel}": ${meldung.text}`)
    return 0
  }

  const token = await zugangstoken(konto)
  if (!token) return 0

  let zugestellt = 0

  await Promise.all(geraete.map(async geraet => {
    const nachricht = {
      message: {
        token: geraet.kennung,
        notification: { title: meldung.titel, body: meldung.text },
        // Daten kommen als Text an — alles andere lehnt FCM ab.
        data: meldung.url ? { url: meldung.url } : {},
        android: {
          priority: 'HIGH',
          notification: { channel_id: 'okun', sound: 'default' },
        },
        apns: {
          payload: { aps: { sound: 'default', badge: 1 } },
        },
      },
    }

    try {
      const r = await fetch(
        `https://fcm.googleapis.com/v1/projects/${konto.project_id}/messages:send`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(nachricht),
        },
      )

      const antwort = r.ok ? '' : await r.text().catch(() => '')
      const ausgang = beurteileAntwort(r.status, antwort)

      if (ausgang === 'zugestellt') { zugestellt++; return }
      if (ausgang === 'entfernen') {
        await prisma.geraet.delete({ where: { id: geraet.id } }).catch(() => {})
        return
      }
      console.error(`[push:nativ] HTTP ${r.status} für ein Gerät von ${employeeId}`)
    } catch {
      // Netz weg auf unserer Seite. Beim nächsten Anlass wieder.
    }
  }))

  return zugestellt
}
