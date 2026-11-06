// Nachweis §278: Die Leiste unten lässt sich mit dem Finger wieder öffnen.
//
//     node pruefungen/browser/leiste-mit-dem-finger.mjs
//
// DIE MELDUNG
// Nach dem ersten Lauf aus dem Play Store: „Die Bar wieder zu öffnen, unten,
// wenn die da war, war relativ schwer."
//
// WAS WIRKLICH WAR
// Nicht schwer — unmöglich. Eingeklappt blieben 20 Pixel stehen, gut drei
// Millimeter, am äußersten unteren Rand. Dort fängt Android die Geste zum
// Startbildschirm ab und das iPhone den Home-Balken. Die kleinste Tippfläche,
// die Google nennt, ist 48dp; Apple nennt 44pt — und zwar OBERHALB des
// Bereichs, den das Betriebssystem für sich beansprucht.
//
// Dazu kam: Die einzige Hilfe zum Wiedereinblenden hing an `mousemove`
// („Zeiger an den unteren Rand"). Auf einem Telefon gibt es keinen Zeiger.
//
// WARUM EINE EIGENE DATEI UND NICHT IN `dock-ohne-maus.mjs`
// Jene Prüfung misst etwas anderes (ob Kacheln unter dem Finger wachsen) und
// war in dieser Umgebung schon vor dieser Änderung nicht lauffähig —
// nachgestellt am 02.11.2026 auch mit zurückgesetztem Programmstand. Eine
// neue Messung in eine Datei zu hängen, die nicht läuft, hieße: nicht messen.
//
// ⚠️ DIESE PRÜFUNG WAR HIER NOCH NIE GRÜN, UND ZWAR AUS EINEM GRUND, DER
//    NICHT AN IHR LIEGT.
//
// Gemessen am 02.11.2026 gegen den Entwicklungsserver in diesem Behälter:
// Die Anmeldeseite antwortet in einem Telefon-Kontext (390×844, hasTouch)
// unmittelbar nach dem Laden noch — `document.readyState` sagt
// „interactive" —, und rund eine Sekunde später nie wieder. Der Hauptfaden
// ist dann blockiert; weder ein Klick noch ein `evaluate` kommt durch. Im
// Schreibtisch-Kontext tritt das nicht auf.
//
// Was ich NICHT sagen kann: ob das die Anwendung ist oder die
// Telefon-Nachbildung von Playwright zusammen mit dem Entwicklungsserver.
// Auf einem echten Telefon aus dem Play Store meldet sich der Eigentümer
// ohne Weiteres an — die Anwendung selbst friert dort also nicht ein. Der
// Befund steht trotzdem hier, weil er nachstellbar ist und nachgegangen
// gehört.
//
// Diese Prüfung bleibt deshalb vorerst eine Absichtserklärung und kein
// Nachweis. Sie läuft NICHT in `npm run pruefen` mit (Browser-Prüfungen tun
// das grundsätzlich nicht) und bricht damit nichts.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { pruefer } from '../helfer.mjs'

const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'
const { check, bilanz } = pruefer()

const ZUGANG = 'deniz.yilmaz@beispielbetrieb.de'

const browser = await chromium.launch({ args: ['--no-sandbox'] })

/*
 * Ein Telefon, aber kein Gerätesatz aus Playwrights Liste: Die dortigen
 * Profile schalten `defaultBrowserType` mit um, und damit lief die Anmeldung
 * in dieser Umgebung nicht durch. Gebraucht wird hier nur dreierlei — kleine
 * Fläche, Berührung statt Zeiger, Telefon-Kennung.
 */
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  locale: 'de-DE',
})
await ctx.addInitScript(() => {
  try {
    for (const r of ['employee', 'admin', 'company', 'okun']) {
      localStorage.setItem(`okun_tour_done_v6:${r}`, '1')
    }
    localStorage.setItem('okun_whats_new_v2_location_model', '1')
    // Der Ausgangszustand, den diese Prüfung braucht: Leiste ausgeklappt.
    localStorage.setItem('okun_dock_hidden', '0')
  } catch { /* ohne Speicher eben nicht */ }
})

const seite = await ctx.newPage()
await seite.goto(`${BASIS}/login`, { waitUntil: 'domcontentloaded' })
await seite.waitForSelector('input[type="email"]', { timeout: 30000 })
await seite.fill('input[type="email"]', ZUGANG)
await seite.fill('input[type="password"]', 'Test1234!')
await seite.click('button[type="submit"]')
/*
 * Nach dem Abschicken wird selbst weitergefahren statt auf die Umleitung zu
 * warten. Der Keks sitzt, sobald die Anmeldung durch ist; ob die Oberfläche
 * danach von sich aus navigiert, hängt am Übersetzungsstand des
 * Entwicklungsservers und ist nicht, was hier geprüft werden soll.
 */
await seite.waitForTimeout(6000)
await seite.goto(`${BASIS}/employee`, { waitUntil: 'domcontentloaded' })
await seite.waitForSelector('[data-dock-slot]', { timeout: 45000 })
await seite.waitForTimeout(1500)

console.log('=== §278 Ohne Zeiger ===')

const zeiger = await seite.evaluate(() =>
  window.matchMedia('(hover: hover) and (pointer: fine)').matches)
check('Dieses Gerät meldet keinen Mauszeiger', zeiger === false,
  `matchMedia sagt ${zeiger} — ohne das prüft der Rest nichts`)

const griff = seite.locator('button[aria-label*="Menüleiste"]').first()
check('Es gibt einen Griff mit erkennbarem Namen',
  await griff.count() > 0,
  await griff.getAttribute('aria-label').catch(() => '—'))

// ── Einklappen ─────────────────────────────────────────────────────────────
console.log('\n=== §278 Eingeklappt bleibt er erreichbar ===')

await griff.tap()
await seite.waitForTimeout(800)

check('Die Leiste ist eingeklappt',
  (await griff.getAttribute('aria-label')) === 'Menüleiste einblenden',
  String(await griff.getAttribute('aria-label')))

const lage = await seite.evaluate(() => {
  const b = document.querySelector('button[aria-label*="Menüleiste"]')
  if (!b) return null
  const r = b.getBoundingClientRect()
  return {
    hoehe: Math.round(r.height),
    oben: Math.round(r.top),
    unten: Math.round(r.bottom),
    fenster: window.innerHeight,
  }
})

check('Der Griff ist mindestens 48 Pixel hoch',
  (lage?.hoehe ?? 0) >= 48,
  `${lage?.hoehe} px — vorher waren es 20`)

check('Und er liegt vollständig im Bild',
  lage != null && lage.oben >= 0 && lage.unten <= lage.fenster,
  `oben ${lage?.oben}, unten ${lage?.unten}, Fenster ${lage?.fenster}`)

/*
 * Die Gegenprobe zu „es steht etwas da": Der Griff muss auch wirklich
 * angetippt werden können. `tap()` schlägt fehl, wenn etwas darüberliegt
 * oder er außerhalb des Bildes steht — genau die beiden Fälle, die vorher
 * zutrafen.
 */
let erreichbar = true
try {
  await griff.tap({ timeout: 5000 })
} catch (fehler) {
  erreichbar = false
  console.log(`           ${String(fehler.message).split('\n')[0]}`)
}
await seite.waitForTimeout(800)

check('Ein Tippen erreicht ihn', erreichbar, 'sonst kommt die Leiste nie zurück')

check('Und holt die Leiste zurück',
  (await griff.getAttribute('aria-label')) === 'Menüleiste ausblenden',
  String(await griff.getAttribute('aria-label')))

const kacheln = await seite.evaluate(() => {
  const k = document.querySelector('[data-dock-slot]')
  if (!k) return null
  const r = k.getBoundingClientRect()
  return { unten: Math.round(r.bottom), fenster: window.innerHeight }
})
check('Die Kacheln stehen wieder im Bild',
  kacheln != null && kacheln.unten <= kacheln.fenster + 1,
  `Unterkante ${kacheln?.unten} bei ${kacheln?.fenster} Fensterhöhe`)

// ── Und die Tour bleibt weg ────────────────────────────────────────────────
console.log('\n=== §278 Was auf dem Telefon NICHT erscheinen soll ===')

/*
 * Die Tour wird in der App gar nicht mehr gestartet (`istApp()`). Hier läuft
 * ein Browser, also greift die Abschaltung nicht — geprüft wird deshalb nur,
 * dass sie den Griff nicht verdeckt. Die Abschaltung selbst hängt an
 * Capacitor und lässt sich ohne die Hülle nicht nachstellen; das steht so
 * auch im Bericht.
 */
const verdeckt = await seite.evaluate(() => {
  const b = document.querySelector('button[aria-label*="Menüleiste"]')
  if (!b) return null
  const r = b.getBoundingClientRect()
  const mitte = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
  return b.contains(mitte) || mitte === b ? null : (mitte?.className ?? 'unbekannt')
})
check('Nichts liegt über dem Griff',
  verdeckt === null,
  verdeckt === null ? 'frei' : `verdeckt von: ${String(verdeckt).slice(0, 80)}`)

await browser.close()
const fehlschlaege = bilanz()
process.exit(fehlschlaege > 0 ? 1 : 0)
