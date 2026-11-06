// Nachweis §280: Die Seite, die ohne Netz erscheint — und was sie kann.
//
//     node pruefungen/browser/offline-seite.mjs
//
// DIE MELDUNG
// „Offline geht nix." Die App zeigte im Flugmodus einen schwarzen Bildschirm.
//
// WARUM AUSGERECHNET DIESE SEITE
// Weil sie das Einzige ist, was ohne Netz noch da ist. Der Dienst-Arbeiter
// greift in einer Android-WebView nicht in die oberste Navigation ein; der
// Aufruf des Servers scheitert unterhalb von ihm. Was bleibt, liegt IM
// Programm — und das ist `native/web/fehler.html`.
//
// WAS HIER GEPRÜFT WIRD, UND WAS NICHT
// Geprüft wird die Seite selbst, mit einer nachgebauten Brücke: Zeigt sie den
// hinterlegten Stand? Nimmt sie einen Stempel an? Legt sie ihn richtig ab?
// Führt „Erneut versuchen" zurück in die Anwendung?
//
// NICHT geprüft wird, ob die Hülle diese Seite im Flugmodus überhaupt lädt —
// das entscheidet Android-Code auf einem echten Telefon und ist von hier aus
// nicht nachstellbar. Diese Prüfung sagt: Wenn die Seite kommt, taugt sie.
//
// Sie braucht weder Netz noch Datenbank noch Entwicklungsserver.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { pruefer } from '../helfer.mjs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const HIER = dirname(fileURLToPath(import.meta.url))
const SEITE = 'file://' + join(HIER, '..', '..', 'native', 'web', 'fehler.html')
const { check, bilanz } = pruefer()

const APP = 'https://probe.beispiel.de/app'

const browser = await chromium.launch({ args: ['--no-sandbox'] })

/**
 * Die Brücke der Hülle nachgebaut.
 *
 * Sie hält ihren Zustand im Fenster, damit die Prüfung nachsehen kann, was
 * die Seite wirklich abgelegt hat — nicht nur, was sie anzeigt.
 */
async function seiteMit(schnappschuss) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  })
  await ctx.addInitScript(({ s, app }) => {
    window.__abgelegt = []
    window.__geleert = 0
    window.OkunOffline = {
      appAdresse: () => app,
      schnappschussLesen: () => (s === null ? '' : JSON.stringify(s)),
      schnappschussSchreiben: () => {},
      stempelMerken: (json) => { window.__abgelegt.push(JSON.parse(json)) },
      stempelHolen: () => JSON.stringify(window.__abgelegt),
      stempelLeeren: () => { window.__abgelegt = []; window.__geleert++ },
    }
  }, { s: schnappschuss, app: APP })
  const seite = await ctx.newPage()
  await seite.goto(SEITE, { waitUntil: 'domcontentloaded' })
  await seite.waitForTimeout(400)
  return { ctx, seite }
}

const DIENST = {
  stand: '2026-11-06T05:40:00.000Z',
  name: 'Deniz',
  zustand: { laeuft: false, pause: false },
  dienst: { von: '06:00', bis: '14:30', name: 'Frühdienst' },
}

// ── Was die Seite zeigt ────────────────────────────────────────────────────
console.log('=== §280 Was ohne Netz dasteht ===')

let { ctx, seite } = await seiteMit(DIENST)
let text = await seite.innerText('body')

check('Sie sagt, dass kein Netz da ist',
  /Kein Netz|Keine Verbindung/.test(text), text.split('\n')[0])

check('Und spricht den Menschen an', /Deniz/.test(text),
  'ohne Namen wäre es irgendeine Fehlerseite')

check('Der heutige Dienst steht da', /06:00\s*–\s*14:30/.test(text),
  text.match(/06:00[^\n]*/)?.[0] ?? 'nicht gefunden')

check('Und der Stempelzustand', /nicht eingestempelt/.test(text),
  text.match(/nicht eingestempelt|eingestempelt|in Pause/)?.[0] ?? '—')

/*
 * Die Zeit, auf die sich der Stand bezieht, muss dabeistehen. Ein Dienstplan
 * von gestern, der aussieht wie von jetzt, ist schlimmer als keiner.
 */
check('Es steht dabei, von wann der Stand ist',
  /Stand von/.test(text) && /\d\d:\d\d Uhr/.test(text),
  text.match(/Stand von[^\n]*\n?[^\n]*/)?.[0]?.replace('\n', ' ') ?? '—')

// ── Stempeln ───────────────────────────────────────────────────────────────
console.log('\n=== §280 Stempeln geht trotzdem ===')

const einstempeln = seite.getByRole('button', { name: 'Einstempeln' })
check('Es gibt einen Knopf zum Einstempeln', await einstempeln.count() === 1)

await einstempeln.tap()
await seite.waitForTimeout(300)

const abgelegt = await seite.evaluate(() => window.__abgelegt)
check('Der Stempel wird im Gerät abgelegt', abgelegt.length === 1,
  JSON.stringify(abgelegt))

check('Mit der Aktion, die die Stempeluhr kennt',
  abgelegt[0]?.aktion === 'kommen', String(abgelegt[0]?.aktion))

/*
 * Der Zeitpunkt entsteht beim Stempeln, nicht beim späteren Abschicken.
 * Alles andere verschiebt Arbeitszeit — und damit Geld.
 */
const alter = Date.now() - Date.parse(abgelegt[0]?.zeitpunkt ?? 0)
check('Und mit der Zeit des Stempelns, nicht der des Absendens',
  alter >= 0 && alter < 60_000, `${Math.round(alter / 1000)} s alt`)

text = await seite.innerText('body')
check('Der Mensch sieht, dass es gemerkt wurde',
  /Gemerkt/i.test(text) && /Eingestempelt um \d\d:\d\d/.test(text),
  text.match(/Eingestempelt um[^\n]*/)?.[0] ?? 'kein Beleg auf dem Bildschirm')

check('Danach steht nicht mehr „Einstempeln" da',
  await seite.getByRole('button', { name: 'Einstempeln' }).count() === 0,
  'sonst stempelt jemand zweimal ein')

check('Sondern Pause und Ausstempeln',
  await seite.getByRole('button', { name: 'Pause beginnen' }).count() === 1
  && await seite.getByRole('button', { name: 'Ausstempeln' }).count() === 1)

// Und die Reihenfolge über mehrere Handgriffe.
await seite.getByRole('button', { name: 'Pause beginnen' }).tap()
await seite.waitForTimeout(250)
await seite.getByRole('button', { name: 'Pause beenden' }).tap()
await seite.waitForTimeout(250)
await seite.getByRole('button', { name: 'Ausstempeln' }).tap()
await seite.waitForTimeout(250)

const vier = await seite.evaluate(() => window.__abgelegt)
check('Vier Handgriffe ergeben vier Einträge, in der Reihenfolge',
  vier.map(v => v.aktion).join(',') === 'kommen,pause-start,pause-ende,gehen',
  vier.map(v => v.aktion).join(' → '))

check('Nach dem Ausstempeln steht wieder „Einstempeln" da',
  await seite.getByRole('button', { name: 'Einstempeln' }).count() === 1)

await ctx.close()

// ── Zurück in die Anwendung ────────────────────────────────────────────────
console.log('\n=== §280 Zurück in die Anwendung ===')

;({ ctx, seite } = await seiteMit(DIENST))

/*
 * §280 Hier lag ein eigener Fehler: „Erneut versuchen" rief
 * `location.reload()` — das lud DIESE Seite neu, nicht die Anwendung. Man
 * kam nie zurück, auch mit Netz nicht.
 */
/*
 * Gemessen wird die ANGESTEUERTE Adresse, nicht die, auf der der Browser
 * landet: Die Anwendung ist von hier aus nicht erreichbar, der Aufruf wird
 * abgebrochen, und `framenavigated` meldete dann die Fehlerseite des
 * Browsers. Das war die erste Fassung dieser Prüfung — sie maß das Falsche.
 */
let ziel = null
seite.on('request', r => {
  if (r.isNavigationRequest() && r.frame() === seite.mainFrame()) ziel = r.url()
})
await seite.route('**/*', r => r.abort())
await seite.getByRole('button', { name: 'Erneut versuchen' }).tap()
await seite.waitForTimeout(900)

check('„Erneut versuchen" führt in die Anwendung, nicht auf diese Seite',
  ziel === APP, String(ziel))

check('Und zwar an die Adresse, die die Hülle nennt',
  ziel === APP && !/fehler\.html/.test(String(ziel)),
  'eine fest eingetippte Adresse träfe eine Testanlage nicht')

await ctx.close()

// ── Ohne Brücke und ohne Stand ─────────────────────────────────────────────
console.log('\n=== §280 Wenn nichts hinterlegt ist ===')

;({ ctx, seite } = await seiteMit(null))
text = await seite.innerText('body')
check('Ohne hinterlegten Stand bleibt es bei der Meldung',
  /Keine Verbindung/.test(text) && !/Heutiger Dienst/.test(text),
  text.split('\n').slice(0, 2).join(' · '))

/*
 * Und die Gegenprobe: Ohne Stand darf trotzdem gestempelt werden können —
 * wer zum ersten Mal im Funkloch steht, hat noch keinen Schnappschuss, und
 * seine Arbeitszeit zählt genauso.
 */
check('Gestempelt werden kann trotzdem',
  await seite.getByRole('button', { name: 'Einstempeln' }).count() === 1,
  'ohne Stand ist der Mensch nicht eingestempelt — also „Einstempeln"')

await ctx.close()

// Und ganz ohne Hülle (im Browser geöffnet) darf nichts zerbrechen.
const ctx3 = await browser.newContext()
const s3 = await ctx3.newPage()
let fehlerAufDerSeite = null
s3.on('pageerror', e => { fehlerAufDerSeite = String(e).split('\n')[0] })
await s3.goto(SEITE, { waitUntil: 'domcontentloaded' })
await s3.waitForTimeout(400)
check('Ohne Brücke läuft die Seite ohne Fehler',
  fehlerAufDerSeite === null, String(fehlerAufDerSeite))
check('Und zeigt keine Knöpfe, die nichts täten',
  await s3.getByRole('button', { name: 'Einstempeln' }).count() === 0,
  'ein Stempelknopf ohne Speicher wäre eine Lüge')
await ctx3.close()

await browser.close()
const fehlschlaege = bilanz()
process.exit(fehlschlaege > 0 ? 1 : 0)
