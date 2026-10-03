// Nachweis (Browser): Die Marke — dasselbe Logo, dieselbe Schrift, überall.
//
// WARUM DIESE PRÜFUNG NICHT IM GESAMTLAUF STECKT
// Sie braucht einen echten Browser. Playwright ist keine Abhängigkeit des
// Projekts — es liegt nur auf der Entwicklungsmaschine. Eine Prüfung, die in
// der Ablaufkette aus Umgebungsgründen rot wird, bringt niemandem etwas und
// wird nach zwei Wochen ignoriert. Deshalb liegt sie hier im Unterordner:
// `readdirSync` in `lauf.mjs` steigt nicht hinab.
//
//     node pruefungen/browser/marke.mjs
//
// WAS SIE PRÜFT, WAS EINE HTTP-PRÜFUNG NICHT KANN
// Die HTTP-Prüfung (K4 in `k-website.mjs`) sieht den Quelltext: dass die
// Negativfassung angefordert und Gantari geladen wird. Sie sieht nicht, ob das
// Bild wirklich ankommt und ob die Schrift am Ende tatsächlich auf der
// Überschrift liegt. Ein falscher Dateiname, eine geblockte Schriftquelle, ein
// Tippfehler in der Tailwind-Familie — alles das bestünde die HTTP-Prüfung und
// sähe auf dem Bildschirm trotzdem falsch aus.
//
// Deshalb steht hier: geladene Bildbreite größer null, geladene Schrift laut
// `document.fonts.check`, und die vom Browser aufgelöste Schriftfamilie der
// Überschrift. Dazu die Gegenprobe, dass im Kopf kein Text mehr steht, der die
// Wortmarke nachbaut.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'
let ok = 0, fail = 0
const check = (name, wahr, info = '') => {
  console.log(`  ${wahr ? '✓ PASS' : '✗ FAIL'}  ${name}${info ? `\n           ${info}` : ''}`)
  wahr ? ok++ : fail++
}

const browser = await chromium.launch()
const seite = await browser.newPage({ viewport: { width: 1280, height: 900 } })

// ── Die öffentlichen Seiten ────────────────────────────────────────────────
console.log('=== Wortmarke auf dunklem Grund ===')

for (const [pfad, name] of [['/', 'Startseite'], ['/funktionen', 'Funktionen'],
  ['/kontakt', 'Kontakt'], ['/login', 'Anmeldung']]) {
  await seite.goto(`${BASIS}${pfad}`, { waitUntil: 'networkidle' })

  const bilder = await seite.evaluate(() =>
    [...document.querySelectorAll('img')].map(b => ({
      src: b.currentSrc || b.src,
      breite: b.naturalWidth,
      alt: b.alt,
      sichtbar: b.getBoundingClientRect().width > 0,
    })))

  const wortmarke = bilder.find(b => /logo-(horizontal|full-tagline)-negativ/.test(decodeURIComponent(b.src)))
  check(`${name}: die Negativfassung steht auf der Seite`, Boolean(wortmarke),
    `gefunden: ${bilder.map(b => b.src.split('/').pop()).join(', ') || 'kein Bild'}`)
  if (wortmarke) {
    check(`${name}: und das Bild lädt wirklich`, wortmarke.breite > 0,
      `naturalWidth = ${wortmarke.breite} — bei 0 ist die Datei nicht da`)
    check(`${name}: es trägt den Namen als Alternativtext`,
      wortmarke.alt === 'OKUN Workforce', `alt="${wortmarke.alt}"`)
    check(`${name}: und ist sichtbar, nicht nur vorhanden`, wortmarke.sichtbar)
  }
}

// ── Die Schrift ────────────────────────────────────────────────────────────
console.log('\n=== Die Schrift des Logos ===')

await seite.goto(`${BASIS}/`, { waitUntil: 'networkidle' })
await seite.evaluate(() => document.fonts.ready)

const geladen = await seite.evaluate(() => ({
  gantari600: document.fonts.check('600 16px Gantari'),
  inter: document.fonts.check('400 16px Inter'),
  h1: getComputedStyle(document.querySelector('h1')).fontFamily,
  fliess: getComputedStyle(document.querySelector('h1 ~ p') ?? document.body).fontFamily,
}))

check('Gantari ist im Browser angekommen', geladen.gantari600,
  'document.fonts.check sagt nein — dann zeichnet die Seite mit Inter und niemand merkt es')
check('Inter ist weiterhin da', geladen.inter)
check('Die Überschrift steht in Gantari', /^Gantari/.test(geladen.h1),
  `aufgelöst als: ${geladen.h1}`)
check('Der Fließtext steht nicht in Gantari', !/^Gantari/.test(geladen.fliess),
  `aufgelöst als: ${geladen.fliess}`)

// ── Gegenprobe: der Nachbau ist weg ────────────────────────────────────────
console.log('\n=== Gegenprobe ===')

const kopfText = await seite.evaluate(() => document.querySelector('header')?.innerText ?? '')
check('Im Kopf steht die Wortmarke nicht mehr als Text',
  !/OKUN/i.test(kopfText),
  `Der Kopf liest sich als: „${kopfText.replace(/\n/g, ' · ')}"`)

// Und auf hellem Grund die helle Fassung — sonst wäre Weiß auf Weiß.
await seite.goto(`${BASIS}/impressum`, { waitUntil: 'networkidle' })
const hell = await seite.evaluate(() =>
  [...document.querySelectorAll('img')].some(b => /negativ/.test(decodeURIComponent(b.currentSrc || b.src))))
check('Auf hellem Grund steht keine Negativfassung', !hell,
  'Weiße Schrift auf weißem Papier')

await browser.close()
console.log(`\n${ok}/${ok + fail} Checks bestanden`)
process.exit(fail ? 1 : 0)
