// Nachweis (Browser) §264: Eine alte gespeicherte Verkaufsseite verschwindet.
//
//     node pruefungen/browser/alter-speicher-wird-geraeumt.mjs
//
// DIE MELDUNG, ZUM FÜNFZEHNTEN MAL
// „Hat sich gar nichts verändert. Ich sehe immer noch die URL und auch immer
//  noch die Website. Langsam werde ich richtig sauer. Es kann doch nicht sein,
//  dass du es nicht hinbekommst. 15 Mal habe ich das bestimmt schon gesagt."
//
// WAS DIESMAL ZUERST GEMESSEN WURDE
// Nicht der Code, sondern der Betrieb. `okun-workforce.com/` und `/app`
// antworten einem Angemeldeten mit dem dunklen Startbildschirm — nicht mit
// der Verkaufsseite. Der Server war also längst richtig.
//
// Zugleich: App vom Startbildschirm, erstes Bild die weiße Verkaufsseite.
// Beides zusammen lässt nur einen Schluss zu: Diese Seite kommt nicht vom
// Server. Sie liegt auf dem Gerät, im Speicher des Dienst-Arbeiters, und wird
// von dort ausgeliefert, ohne dass je jemand fragt.
//
// WARUM §239 UND §251 DAS NICHT ERLEDIGT HABEN
// Beide haben die REGELN geändert — `/` nicht mehr vorspeichern, `/` nie aus
// dem Speicher ausliefern. Neue Regeln gelten aber erst, wenn die neue Fassung
// das Sagen hat, und das Aufräumen löschte nur Speicher, deren Name NICHT zur
// neuen Fassung passt. Was einmal drin war, wanderte mit.
//
// WAS HIER GEPRÜFT WIRD
// Dass eine untergeschobene alte Kopie beim nächsten Einbau VERSCHWINDET. Das
// ist etwas anderes als „die Regel steht im Code" — und genau dieser
// Unterschied hat fünfzehn Runden gekostet.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { pruefer } from '../helfer.mjs'

const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'
const { check, bilanz } = pruefer()

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext()
const seite = await ctx.newPage()

await seite.goto(`${BASIS}/login`)
await seite.fill('input[type="email"]', 'anna.fischer@rheinblick-reha.de')
await seite.fill('input[type="password"]', 'Test1234!')
await seite.click('button[type="submit"]')
await seite.waitForTimeout(4000)

// Warten, bis der Dienst-Arbeiter die Seite wirklich führt.
await seite.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 20000 })
  .catch(() => {})
const fuehrt = await seite.evaluate(() => navigator.serviceWorker.controller !== null)
check('Der Dienst-Arbeiter führt die Seite', fuehrt)

// ── Den Ausgangszustand selbst herstellen ─────────────────────────────────
console.log('\n=== §264 Eine alte Kopie unterschieben ===')

/*
 * Genau das, was auf dem Telefon liegt: ein Speicher einer FRÜHEREN Fassung,
 * und darin die Verkaufsseite unter `/`. So ist sie dort hingekommen — bis
 * §239 stand `'/'` in der Vorspeicherung.
 */
await seite.evaluate(async () => {
  const alt = await caches.open('okun-v5-static')
  await alt.put('/', new Response('<html><body>VERKAUFSSEITE-ALT</body></html>', {
    headers: { 'content-type': 'text/html' },
  }))
  const auchV6 = await caches.open('okun-v6-static')
  await auchV6.put('/', new Response('<html><body>VERKAUFSSEITE-ALT</body></html>', {
    headers: { 'content-type': 'text/html' },
  }))
})

const vorher = await seite.evaluate(() => caches.keys())
check('Die untergeschobene Kopie liegt im Speicher',
  vorher.includes('okun-v5-static') && vorher.includes('okun-v6-static'),
  vorher.join(', '))

const findetSie = await seite.evaluate(async () => {
  const treffer = await caches.match('/')
  return treffer ? (await treffer.text()).includes('VERKAUFSSEITE-ALT') : false
})
check('Und sie ist von dort auch abrufbar — der Fall ist echt', findetSie)

// ── Der Einbau ────────────────────────────────────────────────────────────
console.log('\n=== §264 Und beim nächsten Einbau ist sie weg ===')

/*
 * Den Dienst-Arbeiter abmelden und die Seite neu laden: Damit laufen `install`
 * und `activate` noch einmal — dasselbe, was auf einem Gerät geschieht, wenn
 * eine neue Fassung ausgeliefert wird.
 */
await seite.evaluate(async () => {
  const r = await navigator.serviceWorker.getRegistration()
  if (r) await r.unregister()
})
await seite.reload()
await seite.waitForTimeout(1000)
await seite.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 20000 })
  .catch(() => {})
/*
 * §264 Hier wird es kurz ruppig, und das ist das gute Zeichen: Der neue
 * Dienst-Arbeiter lädt offene Fenster selbst neu, damit niemand auf einer
 * alten Seite sitzen bleibt. Mitten in diese Neuladung hinein zu fragen
 * scheitert mit „Execution context was destroyed" — also abwarten, bis es
 * fertig ist, und erst dann messen.
 */
await seite.waitForTimeout(3500)
await seite.waitForLoadState('domcontentloaded').catch(() => {})

/** Eine Messung, die eine Neuladung mitten im Satz übersteht. */
async function messen(fn) {
  for (let versuch = 0; versuch < 4; versuch++) {
    try { return await seite.evaluate(fn) } catch {
      await seite.waitForTimeout(1500)
    }
  }
  return await seite.evaluate(fn)
}

const nachher = await messen(() => caches.keys())
check('Die alten Speicher sind weg',
  !nachher.includes('okun-v5-static') && !nachher.includes('okun-v6-static'),
  nachher.join(', ') || 'keiner')

const nochDa = await messen(async () => {
  const treffer = await caches.match('/')
  return treffer ? (await treffer.text()).includes('VERKAUFSSEITE-ALT') : false
})
check('Und die Verkaufsseite ist nirgends mehr gespeichert', !nochDa)

/*
 * Die Gegenprobe, ohne die „alles weg" nichts wert wäre: Was gespeichert
 * gehört, ist auch wieder da. Ein Dienst-Arbeiter, der nur löscht, hätte die
 * Prüfung oben genauso bestanden — und die Offline-Seite mitgenommen.
 */
const offlineDa = await messen(async () => Boolean(await caches.match('/offline')))
check('Die Offline-Seite liegt wieder bereit — es wurde nicht nur geleert',
  offlineDa)

// ── Die Regel selbst ──────────────────────────────────────────────────────
console.log('\n=== §251 Und `/` landet gar nicht erst wieder im Speicher ===')

await seite.goto(`${BASIS}/`)
await seite.waitForTimeout(2500)
const wiederDrin = await messen(async () => Boolean(await caches.match('/')))
check('Nach einem Besuch der Startseite liegt sie NICHT im Speicher', !wiederDrin)

await browser.close()
const fails = bilanz()
process.exit(fails > 0 ? 1 : 0)
