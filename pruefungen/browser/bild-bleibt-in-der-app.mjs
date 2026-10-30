// Nachweis (Browser) §263: Ein Anhang holt die App nicht aus dem Vollbild.
//
//     node pruefungen/browser/bild-bleibt-in-der-app.mjs
//
// DIE MELDUNG
// „Sieht an sich gut aus aber man kann das Bild nicht richtig schön
//  vergrößern, gibt es da eine Lösung?
//  Plus man sieht jetzt in der App oben in der App, und die Website kommt
//  immernoch!!!!!!!!!!!!!"
//
// Dabei ein Bildschirmfoto, auf dem oben `a0dc8.eu.r2.cloudflarestorage.com`
// stand — die Adresse des Objektspeichers, in einer Adresszeile, die in der
// App nie zu sehen sein darf.
//
// DIE URSACHE, UND SIE WAR MEINE
// Ein Anhang war ein Verweis mit `target="_blank"`. Solange diese Adresse zu
// uns selbst gehörte, blieb eine installierte App dabei im Vollbild. Seit §260
// antwortet sie mit einer Umleitung in den Objektspeicher — auf eine FREMDE
// Adresse —, und dafür holt iOS die App aus dem Vollbild in einen Browser mit
// Adresszeile. Ab da ist man in Safari, und dort steht dann auch wieder die
// Verkaufsseite. Beide Beschwerden, eine Ursache.
//
// WAS HIER GEMESSEN WIRD — UND WARUM GENAU DAS
// §254 hat teuer gelehrt, die richtige Frage zu messen. Die falsche Frage
// wäre „öffnet sich eine Bildschau?". Die richtige ist: VERLÄSST DIE SEITE
// IHRE ADRESSE? Denn das ist, was die App aus dem Vollbild holt — ob dabei
// etwas Hübsches erscheint, ist zweitrangig.
//
// Gemessen wird deshalb vor allem, dass die Adresse dieselbe bleibt und dass
// kein zweites Fenster aufgeht. Dazu die Gegenprobe, dass die Bildschau
// wirklich etwas zeigt und sich vergrößern lässt — sonst wäre „nichts
// passiert" auch ein Bestehen.

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { pruefer } from '../helfer.mjs'

const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'
const { check, bilanz } = pruefer()

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ ...devices['iPhone 13'] })
await ctx.addInitScript(() => {
  localStorage.setItem('okun_whats_new_v2_location_model', '1')
  for (const r of ['employee', 'admin', 'company', 'okun']) {
    localStorage.setItem(`okun_tour_done_v6:${r}`, '1')
  }
})

const seite = await ctx.newPage()
await seite.goto(`${BASIS}/login`)
await seite.fill('input[type="email"]', 'anna.fischer@rheinblick-reha.de')
await seite.fill('input[type="password"]', 'Test1234!')
await seite.click('button[type="submit"]')
await seite.waitForTimeout(4500)

// Ein zweites Fenster würde genau das bedeuten, was gemeldet wurde.
let zweitesFenster = 0
ctx.on('page', () => { zweitesFenster += 1 })

// ── Den Ausgangszustand selbst herstellen ─────────────────────────────────
/*
 * Ein Gespräch mit einem Bild darin. Diese Prüfung verlässt sich nicht
 * darauf, dass irgendwo schon eines liegt — sonst bestünde sie an einem Tag
 * und scheiterte am nächsten, ohne dass sich etwas geändert hätte.
 */
await seite.goto(`${BASIS}/employee/nachrichten`)
await seite.waitForTimeout(2500)

await seite.locator('button').filter({ hasText: 'OKUN Assistent' }).first().click()
await seite.waitForTimeout(2500)

const raumId = await seite.evaluate(async () => {
  const r = await fetch('/api/chat')
  const d = await r.json()
  const raum = (d.raeume ?? []).find(x => x.art === 'assistent') ?? (d.raeume ?? [])[0]
  return raum?.id ?? null
})
check('Ein Gespräch zum Hineinlegen ist da', Boolean(raumId), String(raumId))

/*
 * Ein echtes, winziges PNG. §241 prüft die ersten Bytes — ein Textschnipsel
 * mit dem Typ `image/png` würde zu Recht abgewiesen, und die Prüfung wäre
 * aus dem falschen Grund rot.
 */
const hochgeladen = await seite.evaluate(async (raum) => {
  const roh = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==')
  const bytes = new Uint8Array(roh.length)
  for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i)
  const daten = new FormData()
  daten.append('datei', new Blob([bytes], { type: 'image/png' }), 'Nachweis263.png')
  daten.append('text', 'Nachweis §263')
  const r = await fetch(`/api/chat/${raum}/datei`, { method: 'POST', body: daten })
  const d = await r.json().catch(() => ({}))
  return { status: r.status, id: d?.nachricht?.datei?.id ?? null, fehler: d?.error ?? null }
}, raumId)
check('Das Bild liegt im Gespräch', hochgeladen.status === 200 && Boolean(hochgeladen.id),
  `HTTP ${hochgeladen.status} ${hochgeladen.fehler ?? ''}`)

await seite.reload()
await seite.waitForTimeout(2000)
await seite.locator('button').filter({ hasText: 'OKUN Assistent' }).first().click()
await seite.waitForTimeout(2500)

// ── Der Kern ───────────────────────────────────────────────────────────────
console.log('=== §263 Das Bild holt die App nicht aus dem Vollbild ===')

const adresseVorher = seite.url()
const bild = seite.locator('button[aria-label*="groß ansehen"]').last()
check('Das Bild ist ein Knopf und kein Verweis', await bild.count() === 1,
  `${await bild.count()} gefunden`)

/*
 * Die Gegenprobe zu „kein Verweis": Es darf im Verlauf KEIN Verweis mehr auf
 * die Datei-Adresse stehen. Ohne diese Zeile könnte der alte Verweis
 * unbemerkt danebenstehen und weiter in den Browser führen.
 */
const verweise = await seite.locator('a[href*="/datei?id="]').count()
check('Und es gibt auch sonst keinen Verweis auf die Datei-Adresse',
  verweise === 0, `${verweise} gefunden`)

await bild.click()
await seite.waitForTimeout(1200)

check('Die Adresse der Seite hat sich NICHT geändert',
  seite.url() === adresseVorher, `${adresseVorher} → ${seite.url()}`)
check('Und es ist kein zweites Fenster aufgegangen',
  zweitesFenster === 0, `${zweitesFenster}`)

const schau = seite.locator('div[role="dialog"][aria-label^="Bild:"]')
check('Die Bildschau ist offen', await schau.count() === 1)

/*
 * Ohne diese Zeile wäre „die Schau ist offen" wertlos: Ein schwarzes Fenster,
 * in dem das Bild nicht ankommt, besteht die Prüfung sonst genauso.
 */
const bildGeladen = await seite.evaluate(() => {
  const i = document.querySelector('div[role="dialog"] img')
  return i ? { breite: i.naturalWidth, fertig: i.complete } : null
})
check('Und das Bild ist darin wirklich angekommen',
  Boolean(bildGeladen?.fertig && bildGeladen.breite > 0), JSON.stringify(bildGeladen))

// ── Vergrößern ─────────────────────────────────────────────────────────────
console.log('\n=== §263 Und es lässt sich vergrößern ===')

const massstab = () => seite.evaluate(() => {
  const el = document.querySelector('div[role="dialog"] img')?.parentElement
  const t = el ? getComputedStyle(el).transform : 'none'
  if (!t || t === 'none') return 1
  const m = t.match(/matrix\(([^,]+)/)
  return m ? Number(m[1]) : 1
})

check('Zu Beginn ist das Bild ganz zu sehen', await massstab() === 1)

const kasten = await schau.boundingBox()
await seite.mouse.dblclick(kasten.x + kasten.width / 2, kasten.y + kasten.height / 2)
await seite.waitForTimeout(500)
const nachDoppel = await massstab()
check('Doppeltippen vergrößert', nachDoppel > 1.5, `Maßstab ${nachDoppel}`)

await seite.mouse.dblclick(kasten.x + kasten.width / 2, kasten.y + kasten.height / 2)
await seite.waitForTimeout(500)
check('Und noch einmal zeigt wieder das ganze Bild', await massstab() === 1)

// Schließen, und die Seite ist unverändert da.
await schau.locator('button[aria-label="Schließen"]').click()
await seite.waitForTimeout(500)
check('Nach dem Schließen ist die Bildschau weg', await schau.count() === 0)
check('Und die Seite steht noch an derselben Adresse',
  seite.url() === adresseVorher, seite.url())

// ── Aufräumen ──────────────────────────────────────────────────────────────
if (hochgeladen.id) {
  await seite.evaluate(async ({ raum, id }) => {
    await fetch(`/api/chat/${raum}/nachricht?dateiId=${id}`, { method: 'DELETE' })
      .catch(() => undefined)
  }, { raum: raumId, id: hochgeladen.id })
}

await browser.close()
const fails = bilanz()
process.exit(fails > 0 ? 1 : 0)
