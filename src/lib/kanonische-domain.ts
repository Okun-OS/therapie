/**
 * §235 Welche Anfrage auf die richtige Domain gehört — und welche nicht.
 *
 * DIE MELDUNG
 * „Bei dieser Google-Synchronisation steht noch die alte generierte
 * Railway-Domain. Und die steht auch übrigens bei den Pop-Up-Nachrichten, die
 * ich bekomme aufs Handy."
 *
 * §228 hat die Abo-Adresse auf `APP_URL` umgestellt. Das war richtig und
 * reichte nicht: Die Push-Meldung auf dem Telefon zeigt die Adresse, unter der
 * die App INSTALLIERT wurde — das entscheidet der Browser, nicht die Nutzlast.
 * Im Code steht die alte Domain nirgends; sie steckt in der Installation.
 *
 * Solange der alte Name beide Seiten ausliefert, bleibt jede dort installierte
 * App darauf. Eine Weiterleitung ist der einzige Ort, an dem sich das beheben
 * lässt: Wer über den alten Namen kommt, wird auf den richtigen geschickt,
 * installiert dort und bekommt von da an die richtige Adresse — im
 * Kalender-Abo, in der Push-Meldung und in der Adresszeile.
 *
 * WARUM DIESE ENTSCHEIDUNG IN EINER EIGENEN DATEI STEHT
 * Damit die Prüfung sie LIEST statt sie nachzubauen. Eine Prüfung, die die
 * Bedingungen abschreibt, prüft ihre eigene Abschrift — und genau diese Art
 * Dublette ist in §229, §232 und §235 dreimal als Fehler aufgefallen.
 */

/** Die Anfrage, so viel wie diese Entscheidung davon braucht. */
export interface Anfrage {
  method: string
  /** Der Wirtsname aus dem `Host`-Kopf. */
  host: string | null
  pfad: string
  suche?: string
}

/**
 * Wohin umgeleitet werden soll — oder `null`, wenn nicht.
 *
 * WANN NICHT UMGELEITET WIRD
 *   ohne `APP_URL`     — sonst nähme eine fehlende Umgebungsvariable den
 *                        Betrieb mit, und das ist der Fall, in dem niemand
 *                        mehr hineinkommt, um sie zu setzen
 *   bei POST und Co.   — eine Weiterleitung verliert den Rumpf; ein
 *                        abgeschickter Urlaubsantrag wäre still weg
 *   für `/api`         — eine laufende App, die nach dem Umzug noch mit dem
 *                        alten Namen spricht, soll Antworten bekommen
 *   lokal und intern   — Entwicklung und Aufrufe aus dem eigenen Container
 */
export function kanonischesZiel(anfrage: Anfrage, appUrl?: string | null): string | null {
  const erwartet = appUrl?.replace(/\/+$/, '')
  if (!erwartet) return null
  if (anfrage.method !== 'GET') return null
  if (anfrage.pfad.startsWith('/api')) return null

  let ziel: URL
  try {
    ziel = new URL(erwartet)
  } catch {
    // Eine kaputte `APP_URL` darf den Betrieb nicht anhalten.
    return null
  }

  const host = anfrage.host
  if (!host || host === ziel.host) return null
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) return null

  return new URL(anfrage.pfad + (anfrage.suche ?? ''), erwartet).toString()
}
