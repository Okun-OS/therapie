// Nachweis (Browser): Die Bildschirmfotos auf der Startseite.
//
// WARUM DIESE PRÜFUNG NICHT IM GESAMTLAUF STECKT
// Sie braucht einen echten Browser. Playwright ist keine Abhängigkeit des
// Projekts — es liegt nur auf der Entwicklungsmaschine. Eine Prüfung, die in
// der Ablaufkette aus Umgebungsgründen rot wird, bringt niemandem etwas und
// wird nach zwei Wochen ignoriert. Deshalb liegt sie hier im Unterordner.
//
//     node pruefungen/browser/schaufenster.mjs
//
// WAS SIE PRÜFT, WAS EINE HTTP-PRÜFUNG NICHT KANN
// Die HTTP-Prüfung (K5 in `k-website.mjs`) sieht, dass die Bilder im Quelltext
// stehen und dass die Dateien da sind. Sie sieht nicht, ob sie beim Besucher
// ankommen. Next.js rechnet jedes Bild beim ersten Abruf in ein kleineres
// Format um; schlägt das fehl — zu groß, falsches Format, fehlende
// Berechtigung —, steht im Quelltext weiterhin alles richtig, und auf dem
// Bildschirm ist ein grauer Kasten.
//
// Dazu die Fragen, die nur ein Browser beantwortet: Ist das Bild groß genug,
// um etwas zu erkennen? Läuft auf dem Telefon nichts über den Rand? Und hat
// jedes Bild einen Alternativtext — ein Bildschirmfoto ohne den ist für
// jemanden mit Vorleseprogramm nichts als eine Lücke.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'
let ok = 0, fail = 0
const check = (name, wahr, info = '') => {
  console.log(`  ${wahr ? '✓ PASS' : '✗ FAIL'}  ${name}${info ? `\n           ${info}` : ''}`)
  wahr ? ok++ : fail++
}

const DATEIEN = ['dienstplan', 'stempeluhr', 'lohnabrechnung']

const browser = await chromium.launch()

// ── Am Schreibtisch ────────────────────────────────────────────────────────
console.log('=== Die drei Bilder auf dem Bildschirm ===')

const seite = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await seite.goto(`${BASIS}/`, { waitUntil: 'networkidle' })
await seite.evaluate(() => document.fonts.ready)

// Die Bilder stehen weit unten; ohne Scrollen lädt Next sie gar nicht erst.
for (let i = 0; i < 12; i++) {
  await seite.evaluate(() => window.scrollBy(0, window.innerHeight))
  await seite.waitForTimeout(250)
}
await seite.waitForTimeout(1500)

const bilder = await seite.evaluate(() =>
  [...document.querySelectorAll('img')].map(b => ({
    quelle: decodeURIComponent(b.currentSrc || b.src),
    breite: b.naturalWidth,
    hoehe: b.naturalHeight,
    sichtbar: b.getBoundingClientRect().width,
    alt: b.alt,
  })))

for (const datei of DATEIEN) {
  const b = bilder.find(x => x.quelle.includes(`/schaufenster/${datei}.png`))
  check(`„${datei}" steht auf der Seite`, Boolean(b),
    `gefunden: ${bilder.map(x => x.quelle.split('/').pop()?.slice(0, 40)).join(', ')}`)
  if (!b) continue
  check(`„${datei}" wird wirklich geladen`, b.breite > 0,
    `naturalWidth = ${b.breite} — bei 0 steht dort ein grauer Kasten`)
  check(`„${datei}" ist groß genug, um etwas zu erkennen`, b.sichtbar > 200,
    `${Math.round(b.sichtbar)} px breit`)
  check(`„${datei}" hat einen Alternativtext`, b.alt.length > 5, `alt="${b.alt}"`)
}

// §184 Die Gegenprobe zum Seitenverhältnis. Ein hochkantes Telefonbild, das
// über die ganze Breite gezogen wird, ist nicht falsch geladen — es sieht nur
// aus wie ein Fehler. Deshalb wird gemessen, dass es schmaler bleibt als die
// beiden breiten Bilder.
const stempel = bilder.find(x => x.quelle.includes('stempeluhr'))
const plan = bilder.find(x => x.quelle.includes('dienstplan'))
if (stempel && plan) {
  check('Das Telefonbild bleibt schmaler als der Dienstplan',
    stempel.sichtbar < plan.sichtbar,
    `Stempeluhr ${Math.round(stempel.sichtbar)} px, Dienstplan ${Math.round(plan.sichtbar)} px`)
  check('Und es steht hochkant, nicht verzerrt',
    stempel.hoehe > stempel.breite,
    `${stempel.breite}×${stempel.hoehe}`)
}

// ── Auf dem Telefon ────────────────────────────────────────────────────────
console.log('\n=== Dieselbe Seite auf dem Telefon ===')

const telefon = await browser.newPage({ viewport: { width: 390, height: 844 } })
await telefon.goto(`${BASIS}/`, { waitUntil: 'networkidle' })
for (let i = 0; i < 18; i++) {
  await telefon.evaluate(() => window.scrollBy(0, window.innerHeight))
  await telefon.waitForTimeout(200)
}
await telefon.waitForTimeout(1500)

const ueberlauf = await telefon.evaluate(() =>
  document.documentElement.scrollWidth > window.innerWidth + 1)
check('Kein waagerechtes Scrollen auf dem Telefon', !ueberlauf,
  'Ein Bildschirmfoto, das breiter ist als die Seite, schiebt alles daneben')

const mobil = await telefon.evaluate(() =>
  [...document.querySelectorAll('img')]
    .filter(b => (b.currentSrc || b.src).includes('schaufenster'))
    .map(b => ({ breite: b.naturalWidth, sichtbar: b.getBoundingClientRect().width })))
check('Auch auf dem Telefon laden alle drei Bilder',
  mobil.length === 3 && mobil.every(b => b.breite > 0),
  JSON.stringify(mobil))
check('Und keines ragt über den Rand hinaus',
  mobil.every(b => b.sichtbar <= 390),
  JSON.stringify(mobil.map(b => Math.round(b.sichtbar))))

await browser.close()
console.log(`\n${ok}/${ok + fail} Checks bestanden`)
process.exit(fail ? 1 : 0)
