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
 * §236 Hosts, die zur Anlage gehören und niemals umgeleitet werden dürfen.
 *
 * DAS HAT DREI AUSROLLUNGEN GEKOSTET
 * §235 hat die Weiterleitung eingebaut und an alles gedacht, was ein Mensch
 * tut — POST, `/api`, localhost. Nicht gedacht war an den, der als Erster
 * anklopft: Railway prüft nach jedem Ausrollen, ob die neue Fassung lebt, und
 * ruft dafür `/` mit `Host: healthcheck.railway.app` auf. Die Weiterleitung
 * antwortete mit 308 statt 200. Railway wertete das als „Anwendung antwortet
 * nicht", verwarf die Fassung und ließ die alte stehen — achtmal in Folge, und
 * das bei drei Ausrollungen hintereinander.
 *
 * Im Protokoll stand „Healthcheck failure", während Build und Migration
 * sauber durchliefen. Von außen sah es aus, als sei nichts angekommen; in
 * Wahrheit kam alles an und wurde jedes Mal wieder weggeworfen.
 *
 * WARUM EINE LISTE UND KEINE REGEL
 * „Alles unter railway.app ausnehmen" ginge nicht: `…up.railway.app` ist
 * genau der alte Name, von dem weggeleitet werden SOLL. Es bleibt also die
 * Aufzählung — und sie ist der Grund, warum darunter zusätzlich der Pfad
 * ausgenommen wird. Ändert Railway den Namen seines Prüfers, hält die
 * zweite Absicherung.
 */
const INFRASTRUKTUR = [
  'healthcheck.railway.app',
]

/** §236 Hosts der internen Vernetzung — Dienst zu Dienst im selben Projekt. */
const INTERN = /\.railway\.internal(:\d+)?$/i

/**
 * §237 Der von Railway erzeugte Name — das Ziel, von dem WEG geleitet wird.
 *
 * NACHGEMESSEN AM LAUFENDEN SYSTEM, 25.10.
 * Nach dem Ausrollen von §236 lief die Weiterleitung rückwärts:
 *
 *     okun-workforce.com/            308 → therapie-production.up.railway.app/
 *     therapie-production.up.…/      200
 *
 * Also genau umgekehrt. Der Grund steht nicht im Code: `APP_URL` in Railway
 * trägt den alten erzeugten Namen. Die Weiterleitung hat getreu getan, was
 * dort stand — und damit jeden Besucher vom richtigen Namen auf den alten
 * geschoben. Damit installiert die App dort, und in der Push-Meldung sowie im
 * Kalender-Abo steht wieder der alte Name. Das war die ursprüngliche Meldung.
 *
 * WARUM DER CODE DAS ABLEHNEN DARF, OHNE DIE EINSTELLUNG ZU KENNEN
 * Der einzige Zweck dieser Weiterleitung ist, Menschen VOM erzeugten Namen
 * wegzubringen. Eine Einstellung, die ihn zum ZIEL macht, widerspricht dem
 * Zweck der Regel selbst — die muss man nicht nachschlagen, um sie als falsch
 * zu erkennen. Steht dort der erzeugte Name, wird nicht umgeleitet: Dann
 * antwortet jeder Name einfach selbst, und das ist der Zustand von vor §235,
 * nicht ein schlimmerer.
 *
 * Die Einstellung selbst kann der Code nicht richtigstellen; sie gehört nach
 * Railway. Was er kann, ist aufhören, aus ihr Schaden zu machen.
 */
const ERZEUGT = /\.up\.railway\.app(:\d+)?$/i

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
 *   §236 Healthcheck   — der Prüfer der Anlage muss die Anwendung sehen,
 *                        nicht eine Weiterleitung auf sie
 *   §237 falsches Ziel  — zeigt `APP_URL` auf den erzeugten Railway-Namen,
 *                        wäre die Weiterleitung ihr eigenes Gegenteil
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

  // §237 Niemals AUF den erzeugten Railway-Namen leiten — siehe `ERZEUGT`.
  if (ERZEUGT.test(ziel.host)) return null

  const host = anfrage.host
  if (!host || host === ziel.host) return null
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) return null

  // §236 Der Prüfer der Anlage und die interne Vernetzung bleiben unberührt.
  const ohnePort = host.replace(/:\d+$/, '').toLowerCase()
  if (INFRASTRUKTUR.includes(ohnePort)) return null
  if (INTERN.test(host)) return null

  return new URL(anfrage.pfad + (anfrage.suche ?? ''), erwartet).toString()
}
