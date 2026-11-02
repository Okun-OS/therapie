// Nachweis §279: Womit die native Hülle startet.
//
//     node pruefungen/w-huelle-startadresse.mjs
//
// DIE MELDUNG
// Nach dem ersten Lauf aus dem Play Store: „Da haben wir wieder vorher die
// Website gesehen." Und: „Offline geht nix."
//
// DIE URSACHE, UND WARUM SIE NIEMAND SAH
// Im gebauten Paket stand `"url": "https://okun-workforce.com"` — ohne Pfad.
// Die App startete damit auf `/`, wo die Verkaufsseite steht und wo der
// Dienst-Arbeiter grundsätzlich nichts zwischenspeichert (§251). Beide
// Meldungen, eine Ursache.
//
// Die Quelle war in Ordnung. Kaputt war die ERZEUGTE Datei, und die liegt in
// .gitignore: `capacitor.config.json` entsteht beim Synchronisieren aus
// `capacitor.config.ts` und der Umgebung. In `APP-STORES.md` stand als
// Bauanleitung `export OKUN_APP_URL=https://okun-workforce.com` — der eine
// Wert, der die Vorgabe mit dem Pfad überschreibt.
//
// WAS HIER GEPRÜFT WIRD
// Nicht die Quelle. Das Ergebnis — die Datei, die wirklich im Paket landet.
// Eine Prüfung, die `capacitor.config.ts` liest, hätte diesen Fehler nie
// gefunden: Dort stand die ganze Zeit das Richtige.
//
// Diese Prüfung braucht kein Netz und keine Datenbank.

import { execFileSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { pruefer } from './helfer.mjs'

const { check, bilanz } = pruefer()

const ERZEUGT = 'android/app/src/main/assets/capacitor.config.json'

/*
 * Der Ausgangszustand, den diese Prüfung selbst herstellt: Die erzeugte
 * Datei wird neu geschrieben. Ohne das prüfte sie einen Stand von
 * irgendwann — und genau so ist der Fehler entstanden.
 *
 * `cap copy` reicht; es braucht weder Android-SDK noch Gradle.
 */
console.log('=== §279 Die Hülle wird neu synchronisiert ===')
let synchronisiert = true
try {
  execFileSync('npx', ['cap', 'copy', 'android'], {
    stdio: 'pipe', timeout: 180_000,
  })
} catch (fehler) {
  synchronisiert = false
  console.log(`           ${String(fehler.message).split('\n')[0]}`)
}
check('`cap copy android` läuft durch', synchronisiert,
  'ohne das prüft der Rest einen alten Stand')

check('Die erzeugte Einstellungsdatei liegt vor', existsSync(ERZEUGT), ERZEUGT)

const roh = existsSync(ERZEUGT) ? readFileSync(ERZEUGT, 'utf8') : '{}'
let conf = {}
try { conf = JSON.parse(roh) } catch { /* unten rot */ }

const url = conf?.server?.url
check('Sie nennt eine Startadresse', typeof url === 'string' && url.length > 0, String(url))

// ── Der Kern ───────────────────────────────────────────────────────────────
console.log('\n=== §279 Die Startadresse ist nicht die Verkaufsseite ===')

let pfad = null
try { pfad = new URL(url).pathname } catch { /* unten rot */ }

check('Die Adresse ist gültig', pfad !== null, String(url))

/*
 * Der eigentliche Fund. `/` ist aus zwei Gründen falsch, und beide hat der
 * Betrieb an einem Abend vorgeführt:
 *   — dort steht die Verkaufsseite
 *   — und der Dienst-Arbeiter speichert sie nie (§251), also gibt es ohne
 *     Netz nichts auszuliefern
 */
check('Sie zeigt NICHT auf `/`', pfad !== '/',
  `${url} — dort steht die Verkaufsseite, und sie wird nie zwischengespeichert`)

/*
 * Und sie zeigt auch nicht auf eine Weiterleitung. `/login` schickt eine
 * angemeldete Person weiter; eine Weiterleitung lässt sich nicht
 * zwischenspeichern (`cache.put` weist sie ab) und zeichnet nichts, was als
 * Standbild taugt (§254).
 */
check('Und nicht auf eine Weiterleitung wie `/login`', pfad !== '/login',
  `${url} — Angemeldete werden von dort weitergereicht`)

check('Sondern auf die Startseite der App', pfad === '/app', String(pfad))

// ── Die Gegenprobe ─────────────────────────────────────────────────────────
console.log('\n=== §279 Eine blanke Domain erzeugt den Fehler nicht mehr ===')

/*
 * Die Bauanleitung in APP-STORES.md hat genau das getan: die Domain ohne
 * Pfad gesetzt. Hier wird nachgestellt, dass `capacitor.config.ts` das
 * selbst abfängt — sonst hinge die Behebung an einem Satz in einem Dokument,
 * und Dokumente werden nicht ausgeführt.
 */
let mitBlankerDomain = null
try {
  execFileSync('npx', ['cap', 'copy', 'android'], {
    stdio: 'pipe', timeout: 180_000,
    env: { ...process.env, OKUN_APP_URL: 'https://okun-workforce.com' },
  })
  mitBlankerDomain = JSON.parse(readFileSync(ERZEUGT, 'utf8'))?.server?.url
} catch (fehler) {
  console.log(`           ${String(fehler.message).split('\n')[0]}`)
}

check('Auch `OKUN_APP_URL=https://okun-workforce.com` landet auf `/app`',
  mitBlankerDomain === 'https://okun-workforce.com/app',
  String(mitBlankerDomain))

/*
 * Und die Gegenprobe zur Gegenprobe: Ein ausdrücklich angegebener Pfad muss
 * erhalten bleiben. Sonst wäre aus der Korrektur eine Bevormundung geworden,
 * und eine Testanlage ließe sich nicht mehr ansteuern.
 */
let mitPfad = null
try {
  execFileSync('npx', ['cap', 'copy', 'android'], {
    stdio: 'pipe', timeout: 180_000,
    env: { ...process.env, OKUN_APP_URL: 'https://test.beispiel.de/probe' },
  })
  mitPfad = JSON.parse(readFileSync(ERZEUGT, 'utf8'))?.server?.url
} catch { /* unten rot */ }

check('Ein ausdrücklich genannter Pfad bleibt erhalten',
  mitPfad === 'https://test.beispiel.de/probe', String(mitPfad))

// Und am Ende den richtigen Stand wiederherstellen — die Datei liegt im
// Arbeitsverzeichnis und wird gebaut.
try {
  execFileSync('npx', ['cap', 'copy', 'android'], { stdio: 'pipe', timeout: 180_000 })
} catch { /* siehe oben */ }

const endstand = existsSync(ERZEUGT)
  ? JSON.parse(readFileSync(ERZEUGT, 'utf8'))?.server?.url
  : null
check('Danach steht wieder die richtige Adresse in der Datei',
  endstand === 'https://okun-workforce.com/app', String(endstand))

const fehlschlaege = bilanz()
process.exit(fehlschlaege > 0 ? 1 : 0)
