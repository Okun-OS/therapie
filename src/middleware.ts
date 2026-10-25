import { NextResponse, type NextRequest } from 'next/server'
import { kanonischesZiel } from '@/lib/kanonische-domain'

/**
 * §201 Wer angemeldet ist, sieht die Verkaufsseite gar nicht erst.
 *
 * WAS VORHER DA STAND — UND WARUM ES WEG MUSS
 * Die Weiterleitung lief im Browser (`AngemeldeteWeiterleiten`), und im
 * Kommentar dazu stand ehrlich: „Die Verkaufsseite ist dabei kurz sichtbar.
 * Das ist gewollt." Für eine Website war das eine vertretbare Abwägung —
 * lieber ein kurzer Blick auf die richtige Seite als ein leerer Bildschirm
 * für alle anderen.
 *
 * Im Desktop-Programm ist es keine Abwägung mehr, sondern ein Fehler: Da
 * blitzt beim Öffnen die Werbeseite auf, bevor die Anmeldung kommt. Der
 * Eigentümer hat genau das gemeldet — „dass jedes Mal kurz die Website
 * aufpoppt" —, und es nimmt dem Programm in einer halben Sekunde den
 * Anschein, etwas anderes zu sein als ein Browser mit Rahmen.
 *
 * WARUM DAS DIE STATISCHE AUSLIEFERUNG NICHT KAPUTT MACHT
 * Das war das Gegenargument von §177, und es galt für eine Server-Komponente,
 * die bei jedem Aufruf das Sitzungs-Cookie prüft. Hier prüft nicht die Seite,
 * sondern die Schicht davor: Wer kein Cookie mitbringt — jeder Interessent,
 * jeder Suchmaschinen-Besucher — fällt sofort durch und bekommt dieselbe
 * statisch erzeugte Seite wie bisher. Nur wer eine gültige Sitzung vorzeigt,
 * wird umgeleitet.
 *
 * WARUM DIE UNTERSCHRIFT TROTZDEM GEPRÜFT WIRD
 * Es ginge auch ohne: Ein erfundenes Cookie führte nur auf eine Seite, die
 * den Betreffenden ohnehin abweist. Aber dann wäre das hier eine Weiche, die
 * sich von außen stellen lässt — und solche Weichen werden später als
 * Berechtigung missverstanden. Die Prüfung kostet eine Rechenoperation.
 */

const KEKS = 'okun_session'

/** Dieselben Ziele wie in `AngemeldeteWeiterleiten` — eine Rolle, ein Ort. */
const ZIELE: Record<string, string> = {
  employee: '/employee',
  admin: '/admin',
  okun: '/okun',
  company: '/company',
}

function geheimnis(): string | null {
  const wert = process.env.SESSION_SECRET
  if (wert) return wert
  // In der Entwicklung signiert `session.ts` mit diesem festen Wert. Im
  // Betrieb gibt es ihn nicht — dort ist ein fehlendes Geheimnis ein Grund,
  // niemanden weiterzuleiten, statt einen zu erfinden.
  return process.env.NODE_ENV === 'production'
    ? null
    : 'dev-insecure-session-secret-do-not-use-in-production'
}

/** Base64url → Bytes. `atob` kennt nur das klassische Alphabet. */
function ausBase64url(text: string): Uint8Array<ArrayBuffer> {
  const roh = atob(text.replace(/-/g, '+').replace(/_/g, '/')
    .padEnd(text.length + ((4 - text.length % 4) % 4), '='))
  const bytes = new Uint8Array(new ArrayBuffer(roh.length))
  for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i)
  return bytes
}

/**
 * Die Rolle aus einer gültigen Sitzungsmarke lesen — oder `null`.
 *
 * Bewusst eine eigene, kleine Umsetzung statt eines Aufrufs in `session.ts`:
 * Diese Schicht läuft in Next.js in einer Umgebung ohne Node-Module, und ein
 * Import von `node:crypto` würde den ganzen Bau zum Scheitern bringen. Was
 * hier doppelt steht, ist die Rechenvorschrift — nicht die Entscheidung,
 * wer hereindarf. Die trifft weiterhin `requireRole`.
 */
async function rolleAus(marke: string | undefined): Promise<string | null> {
  if (!marke) return null
  const teile = marke.split('.')
  if (teile.length !== 2) return null

  const schluesselRoh = geheimnis()
  if (!schluesselRoh) return null

  try {
    const schluessel = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(schluesselRoh),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
    )
    const stimmt = await crypto.subtle.verify(
      'HMAC', schluessel, ausBase64url(teile[1]),
      new TextEncoder().encode(teile[0]),
    )
    if (!stimmt) return null

    const inhalt = JSON.parse(new TextDecoder().decode(ausBase64url(teile[0])))
    // Dieselbe Laufzeit wie in `session.ts` — 30 Tage.
    if ((Date.now() - inhalt.iat) / 1000 > 60 * 60 * 24 * 30) return null
    return typeof inhalt.role === 'string' ? inhalt.role : null
  } catch {
    return null
  }
}

/*
 * §237 Eine falsche `APP_URL` soll nicht noch einmal still sein.
 *
 * Nach §236 lief die Weiterleitung rückwärts, weil in Railway der erzeugte
 * Name stand. `kanonische-domain.ts` lehnt das jetzt ab — aber damit ist die
 * Einstellung nur unschädlich, nicht richtig. An `APP_URL` hängen außerdem
 * alle Links in E-Mails (Registrierung, Passwort zurücksetzen), das
 * Kalender-Abo und die Stellenmeldung an Google. Alle vier zeigten auf den
 * alten Namen, und nichts davon hat sich beschwert.
 *
 * Diese Zeilen laufen einmal beim Laden des Moduls, also einmal je Fassung,
 * und schreiben es in das Protokoll, in das nach jedem Ausrollen ohnehin
 * jemand schaut. Nicht geworfen wird: Eine falsche Adresse ist kein Grund,
 * niemanden mehr hereinzulassen.
 */
if (process.env.NODE_ENV === 'production') {
  const gesetzt = process.env.APP_URL
  if (!gesetzt) {
    console.warn('[APP_URL] nicht gesetzt — E-Mail-Links, Kalender-Abo und '
      + 'Stellenmeldung fallen auf die Adresse der Anfrage zurück.')
  } else if (/\.up\.railway\.app\/?$/i.test(gesetzt)) {
    console.warn(`[APP_URL] steht auf dem von Railway erzeugten Namen (${gesetzt}). `
      + 'Erwartet wird die eigene Domain. Solange das so ist, tragen E-Mail-Links, '
      + 'Kalender-Abo und Stellenmeldung den erzeugten Namen, und die '
      + 'Weiterleitung auf die richtige Domain bleibt aus (§237).')
  }
}

/**
 * §235 Jeder landet auf der richtigen Adresse — egal, über welche er kommt.
 *
 * Die Entscheidung selbst steht in `kanonische-domain.ts`, damit die Prüfung
 * sie liest statt sie nachzubauen. Hier wird nur die Anfrage übersetzt.
 */
function kanonischeWeiterleitung(req: NextRequest): NextResponse | null {
  const ziel = kanonischesZiel(
    {
      method: req.method,
      host: req.headers.get('host'),
      pfad: req.nextUrl.pathname,
      suche: req.nextUrl.search,
    },
    process.env.APP_URL,
  )
  // 308: dauerhaft, und die Methode bleibt erhalten — anders als bei 301,
  // das manche Browser zu einem GET machen.
  return ziel ? NextResponse.redirect(ziel, 308) : null
}

export async function middleware(req: NextRequest) {
  const umzug = kanonischeWeiterleitung(req)
  if (umzug) return umzug

  /*
   * §235 Die Rollenweiterleitung gilt NUR für die Startseite.
   *
   * Bis §235 sagte das der Matcher (`['/']`). Seit die Weiterleitung auf die
   * richtige Domain überall greifen muss, läuft diese Funktion auf jedem
   * Pfad — und ohne diese Zeile schickte sie eine angemeldete Person von
   * `/employee/schedule` zurück auf `/employee`. Die Einschränkung ist mit dem
   * Matcher aus der Konfiguration hierher gewandert, nicht verschwunden.
   */
  if (req.nextUrl.pathname !== '/') return NextResponse.next()

  const rolle = await rolleAus(req.cookies.get(KEKS)?.value)
  const ziel = rolle ? ZIELE[rolle] : null
  if (!ziel) return NextResponse.next()
  return NextResponse.redirect(new URL(ziel, req.url))
}

/**
 * Die Startseite — und seit §235 jede Seite.
 *
 * Für die Rollenweiterleitung gilt weiter nur `/`: `/funktionen` und
 * `/kontakt` bleiben absichtlich draußen, auch wer angemeldet ist, darf
 * nachlesen, was das Programm kann. Das entscheidet die Funktion selbst.
 *
 * §235 Die Weiterleitung auf die richtige Domain muss dagegen überall
 * greifen. Wer die App unter dem alten Namen installiert hat, öffnet sie auf
 * `/employee` — und bliebe sonst für immer dort.
 *
 * Ausgenommen sind die Pfade, die Next.js selbst ausliefert, und die Dateien
 * im öffentlichen Ordner: Für sie kostet die Prüfung nur Zeit.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand|icons|hintergrund|sw.js|manifest.json).*)'],
}
