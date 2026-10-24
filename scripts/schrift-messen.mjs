/**
 * §188 Welche frei lizenzierbare Schrift kommt dem Schriftzug am nächsten?
 *
 *     npm run schrift:messen
 *
 * WARUM ES DIESES SKRIPT GIBT
 * Zweimal stand in `globals.css` eine Prozentzahl, und zweimal war sie falsch.
 * Beim ersten Mal gegen die falsche Vorlage gemessen, beim zweiten Mal gegen
 * gar nichts: Der Browser im Prüfbehälter kommt nicht an fonts.googleapis.com
 * heran und zeichnete jeden Kandidaten mit derselben Ersatzschrift. Sechzig
 * Familien, ein identischer Wert — und das ist mir nicht aufgefallen.
 *
 * Eine Behauptung über die Marke, die niemand nachrechnen kann, ist keine
 * Messung, sondern ein Gefühl mit Nachkommastelle. Deshalb liegt das Verfahren
 * jetzt hier und nicht im Verlauf eines Gesprächs.
 *
 * WIE GEMESSEN WIRD
 * 1. Der Schriftzug wird aus der Markenvorlage freigestellt — nach Tintenfarbe,
 *    damit das Emblem links nicht mitkommt.
 * 2. Die Schriftdateien werden mit `curl` geholt und als Datei eingebettet,
 *    nicht im Browser nachgeladen.
 * 3. GEGENPROBE: Zeichnet der Browser die Breite der Ersatzschrift, zählt der
 *    Kandidat nicht. Genau das hat beim letzten Mal gefehlt.
 * 4. Verglichen wird je Buchstabe die Flächenüberdeckung (Schnitt durch
 *    Vereinigung), nachdem jeder Buchstabe einzeln auf dasselbe Raster gebracht
 *    wurde. So entscheidet die FORM und nicht die Laufweite — die stellt man in
 *    CSS ohnehin ein.
 *
 * WARUM DAS O NICHT MITZÄHLT
 * Im echten Schriftzug hat es oben links eine Kerbe, in der der türkise Punkt
 * sitzt. Die hat keine Schrift der Welt. Sie bestraft alle Kandidaten gleich
 * und sagt deshalb nichts über die Ähnlichkeit aus.
 *
 * WAS DAS ERGEBNIS NICHT IST
 * Keine Empfehlung. Die höchsten Werte erreichen Schauschriften für
 * Spielegrafik; die treffen die Form und verfehlen den Zweck. Gesucht ist die
 * beste Schrift, die AUCH in 14 Pixeln eine Tabelle mit Beträgen trägt. Das
 * entscheidet ein Mensch, nicht diese Datei.
 *
 * Playwright ist keine Abhängigkeit des Projekts — es liegt nur auf der
 * Entwicklungsmaschine. Deshalb läuft das hier von Hand und nicht in der
 * Ablaufkette.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { lesen, schreiben, schneiden, tintenkasten } from './png.mjs'

const VORLAGE = 'public/brand/quelle/logo-vorlage.png'
const WORT = 'OKUN'
const OHNE = new Set(['O']) // siehe Kopf: die Kerbe
const RASTER = 72
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) '
  + 'Chrome/120.0 Safari/537.36'

const arbeit = mkdtempSync(join(tmpdir(), 'okun-schrift-'))

// ── 1. Den Schriftzug freistellen ──────────────────────────────────────────
//
// Nach Farbe, nicht nach Lage: Das Emblem links benutzt dieselben drei Tinten,
// steht aber in der linken Bildhälfte. Deshalb beides — Farbe UND ein
// Startpunkt rechts davon.
const TINTE_NAVY = [30, 44, 52]
const naehe = (r, g, b, z) => Math.abs(r - z[0]) + Math.abs(g - z[1]) + Math.abs(b - z[2])

function schriftzugFreistellen() {
  const b = lesen(VORLAGE)
  const xStart = Math.floor(b.w * 0.36)
  const maske = { w: b.w, h: b.h, rgba: Buffer.alloc(b.w * b.h * 4) }
  for (let y = 0; y < b.h; y++) {
    for (let x = xStart; x < b.w; x++) {
      const i = (y * b.w + x) * 4
      if (b.rgba[i + 3] > 128 && naehe(b.rgba[i], b.rgba[i + 1], b.rgba[i + 2], TINTE_NAVY) < 90) {
        maske.rgba[i + 3] = 255
      }
    }
  }
  const k = tintenkasten(maske, 128)
  if (!k) throw new Error(`${VORLAGE}: kein dunkler Schriftzug rechts vom Zeichen gefunden`)
  return schneiden(maske, k.x0, k.y0, k.w, k.h)
}

// ── 2. Ein Bild in seine Buchstaben zerlegen ───────────────────────────────
function buchstaben(bild, erwartet) {
  const belegt = new Array(bild.w).fill(0)
  for (let y = 0; y < bild.h; y++) {
    for (let x = 0; x < bild.w; x++) {
      if (bild.rgba[(y * bild.w + x) * 4 + 3] > 100) belegt[x]++
    }
  }
  const kaesten = []
  let start = -1
  for (let x = 0; x <= bild.w; x++) {
    const voll = x < bild.w && belegt[x] > 0
    if (voll && start < 0) start = x
    if (!voll && start >= 0) { kaesten.push([start, x - 1]); start = -1 }
  }
  if (kaesten.length !== erwartet) return null
  return kaesten.map(([x0, x1]) => {
    let y0 = bild.h, y1 = -1
    for (let y = 0; y < bild.h; y++) {
      for (let x = x0; x <= x1; x++) {
        if (bild.rgba[(y * bild.w + x) * 4 + 3] > 100) {
          if (y < y0) y0 = y
          if (y > y1) y1 = y
          break
        }
      }
    }
    return { x0, x1, y0, y1 }
  })
}

/** Einen Buchstabenkasten auf ein festes Raster bringen — Flächenmittel. */
function raster(bild, k) {
  const w = k.x1 - k.x0 + 1, h = k.y1 - k.y0 + 1
  const aus = new Uint8Array(RASTER * RASTER)
  for (let y = 0; y < RASTER; y++) {
    const sy0 = k.y0 + Math.floor(y * h / RASTER)
    const sy1 = k.y0 + Math.max(Math.floor(y * h / RASTER) + 1, Math.ceil((y + 1) * h / RASTER))
    for (let x = 0; x < RASTER; x++) {
      const sx0 = k.x0 + Math.floor(x * w / RASTER)
      const sx1 = k.x0 + Math.max(Math.floor(x * w / RASTER) + 1, Math.ceil((x + 1) * w / RASTER))
      let summe = 0, n = 0
      for (let sy = sy0; sy < Math.min(sy1, bild.h); sy++) {
        for (let sx = sx0; sx < Math.min(sx1, bild.w); sx++) {
          summe += bild.rgba[(sy * bild.w + sx) * 4 + 3] > 100 ? 1 : 0
          n++
        }
      }
      aus[y * RASTER + x] = n && summe / n > 0.5 ? 1 : 0
    }
  }
  return aus
}

const deckung = (a, b) => {
  let schnitt = 0, vereinigung = 0
  for (let i = 0; i < a.length; i++) {
    if (a[i] || b[i]) vereinigung++
    if (a[i] && b[i]) schnitt++
  }
  return vereinigung ? schnitt / vereinigung : 0
}

// ── 3. Eine Schriftdatei besorgen ──────────────────────────────────────────
function schriftHolen(familie, gewicht) {
  const ziel = join(arbeit, `${familie.replace(/\W/g, '')}-${gewicht}.woff2`)
  if (existsSync(ziel)) return ziel
  const url = `https://fonts.googleapis.com/css2?family=`
    + `${encodeURIComponent(familie).replace(/%20/g, '+')}:wght@${gewicht}&display=block`
  let css
  try {
    css = execFileSync('curl', ['-sfL', '-A', UA, url], { encoding: 'utf8', timeout: 30_000 })
  } catch { return null }
  // Den lateinischen Schnitt nehmen. Google liefert je Zeichensatz einen
  // eigenen Block; der letzte passende ist der lateinische.
  let gewaehlt = null
  for (const block of css.split('@font-face').slice(1)) {
    const quelle = /url\((https:[^)]+\.woff2)\)/.exec(block)?.[1]
    if (!quelle) continue
    const bereich = /unicode-range:\s*([^;]+);/.exec(block)?.[1] ?? ''
    if (!bereich || bereich.split(',').some(t => /U\+00[0-9A-F]{2}/.test(t.trim()))) gewaehlt = quelle
  }
  if (!gewaehlt) return null
  try {
    execFileSync('curl', ['-sfL', '-A', UA, '-o', ziel, gewaehlt], { timeout: 30_000 })
  } catch { return null }
  return ziel
}

// ── Die Kandidaten ─────────────────────────────────────────────────────────
// Alle über Google Fonts frei verfügbar — inklusive Weblizenz. Eine Schrift,
// die man nicht auf die Website legen darf, braucht hier nicht anzutreten.
const KANDIDATEN = []
const dazu = (familie, ...gewichte) => gewichte.forEach(g => KANDIDATEN.push([familie, g]))
dazu('Manrope', 700, 800)
dazu('Bai Jamjuree', 700)
dazu('Wix Madefor Display', 700, 800)
dazu('Red Hat Display', 700, 800, 900)
dazu('Syne', 700, 800)
dazu('Orbitron', 700, 800, 900)
dazu('Chakra Petch', 700)
dazu('Exo 2', 700, 800, 900)
dazu('Montserrat', 700, 800, 900)
dazu('Rubik', 700, 800, 900)
dazu('Poppins', 700, 800)
dazu('Archivo', 700, 800, 900)
dazu('Saira', 700, 800, 900)
dazu('Anybody', 700, 800, 900)
dazu('Inter', 700, 800, 900)
dazu('Onest', 700, 800, 900)
dazu('Hanken Grotesk', 700, 800, 900)
dazu('Nunito Sans', 800, 900)
dazu('Encode Sans', 700, 800, 900)
dazu('Mulish', 800, 900)
dazu('DM Sans', 700, 800, 900)
dazu('Plus Jakarta Sans', 700, 800)
dazu('Gabarito', 700, 800, 900)
dazu('Readex Pro', 600, 700)
dazu('Jost', 700, 800, 900)
dazu('Outfit', 700, 800, 900)
dazu('Figtree', 800, 900)
dazu('Sora', 700, 800)
dazu('Space Grotesk', 700)
dazu('Urbanist', 800, 900)
dazu('Lexend', 700, 800, 900)
dazu('Chivo', 700, 800, 900)
dazu('Work Sans', 700, 800, 900)
dazu('Public Sans', 700, 800, 900)
dazu('Barlow', 700, 800, 900)
dazu('Titillium Web', 700, 900)
dazu('Familjen Grotesk', 700)
dazu('Overpass', 700, 800, 900)
dazu('Schibsted Grotesk', 700, 800, 900)
dazu('Geologica', 700, 800, 900)
dazu('Bricolage Grotesque', 700, 800)
dazu('Unbounded', 700, 800)
dazu('Kanit', 700, 800, 900)
dazu('Russo One', 400)
dazu('Michroma', 400)
dazu('Archivo Black', 400)
dazu('Bakbak One', 400)
dazu('Changa', 700, 800)
dazu('Maven Pro', 700, 800, 900)
dazu('Raleway', 800, 900)
dazu('Catamaran', 800, 900)

// ── Los ────────────────────────────────────────────────────────────────────
const vorlage = schriftzugFreistellen()
const vKaesten = buchstaben(vorlage, WORT.length)
if (!vKaesten) {
  throw new Error(
    `Der Schriftzug zerfällt nicht in ${WORT.length} Buchstaben. Liegt in `
    + `${VORLAGE} noch dasselbe Logo? Sonst stimmt die Erwartung nicht mehr.`,
  )
}
schreiben(join(arbeit, 'vorlage.png'), vorlage)
const vRaster = vKaesten.map(k => raster(vorlage, k))
console.log(`Vorlage zerlegt: ${vKaesten.map(k => `${k.x1 - k.x0 + 1}×${k.y1 - k.y0 + 1}`).join(' ')}`)

const browser = await chromium.launch()
const seite = await browser.newPage({ viewport: { width: 1600, height: 500 } })

// Die Breite der Ersatzschrift. Alles, was genauso breit herauskommt, wurde
// NICHT mit der geholten Schrift gezeichnet — das ist die Gegenprobe, deren
// Fehlen beim letzten Mal sechzig falsche Zahlen erzeugt hat.
await seite.setContent(`<!doctype html><html><head><style>
  html,body{margin:0;background:#fff}
  #w{font-family:'KeineSchriftDieEsGibt';font-size:220px;white-space:nowrap;display:inline-block}
</style></head><body><span id="w">${WORT}</span></body></html>`)
const ERSATZ = await seite.evaluate(() => document.querySelector('#w').getBoundingClientRect().width)

const ergebnisse = []
for (const [familie, gewicht] of KANDIDATEN) {
  const datei = schriftHolen(familie, gewicht)
  if (!datei) { ergebnisse.push({ familie, gewicht, grund: 'nicht ladbar' }); continue }
  const roh = readFileSync(datei).toString('base64')
  await seite.setContent(`<!doctype html><html><head><style>
    @font-face{font-family:'Probe';font-weight:${gewicht};font-style:normal;
      src:url(data:font/woff2;base64,${roh}) format('woff2')}
    html,body{margin:0;padding:0;background:#fff}
    #w{font-family:'Probe';font-weight:${gewicht};font-size:220px;color:#000;
       white-space:nowrap;letter-spacing:.02em;display:inline-block;padding:40px}
  </style></head><body><span id="w">${WORT}</span></body></html>`)
  await seite.evaluate(() => document.fonts.ready).catch(() => {})

  const breite = await seite.evaluate(() => document.querySelector('#w').getBoundingClientRect().width)
  if (Math.abs(breite - ERSATZ - 80) < 1.5) {
    ergebnisse.push({ familie, gewicht, grund: 'Ersatzschrift gezeichnet' }); continue
  }

  const bildDatei = join(arbeit, 'kandidat.png')
  await seite.locator('#w').screenshot({ path: bildDatei })
  const k = lesen(bildDatei)
  for (let i = 0; i < k.w * k.h; i++) {
    const j = i * 4
    k.rgba[j + 3] = (k.rgba[j] + k.rgba[j + 1] + k.rgba[j + 2]) / 3 < 128 ? 255 : 0
  }
  const kk = buchstaben(k, WORT.length)
  if (!kk) { ergebnisse.push({ familie, gewicht, grund: 'zerfällt nicht in Buchstaben' }); continue }

  const je = kk.map((kasten, i) => deckung(raster(k, kasten), vRaster[i]))
  const zaehlt = je.filter((_, i) => !OHNE.has(WORT[i]))
  ergebnisse.push({ familie, gewicht, je, wert: zaehlt.reduce((a, b) => a + b, 0) / zaehlt.length })
}
await browser.close()

const gut = ergebnisse.filter(e => e.wert != null).sort((a, b) => b.wert - a.wert)
if (!gut.length) {
  console.error('\nKEIN EINZIGER KANDIDAT MESSBAR. Kommt `curl` ins Netz?')
  rmSync(arbeit, { recursive: true, force: true })
  process.exit(1)
}

console.log(`\n=== Formähnlichkeit zu „${WORT}" (${[...WORT].filter(c => !OHNE.has(c)).join('')}, `
  + `ohne ${[...OHNE].join('')}) ===`)
for (const e of gut.slice(0, 25)) {
  const je = [...WORT].map((c, i) => `${c} ${(e.je[i] * 100).toFixed(0)}`).join(' · ')
  console.log(`${(e.wert * 100).toFixed(1)}%  ${(e.familie + ' ' + e.gewicht).padEnd(28)} [${je}]`)
}

const ohneWert = ergebnisse.filter(e => e.wert == null)
if (ohneWert.length) {
  console.log(`\nNicht gewertet (${ohneWert.length}): `
    + ohneWert.map(e => `${e.familie} ${e.gewicht} — ${e.grund}`).join(', '))
}
console.log(
  '\nDie oberste Zeile ist NICHT die Empfehlung. Schauschriften treffen die Form\n'
  + 'und verfehlen den Zweck. Gesucht ist die beste Schrift, die auch in 14 Pixeln\n'
  + 'eine Tabelle mit Beträgen trägt — das entscheidet ein Mensch.',
)
rmSync(arbeit, { recursive: true, force: true })
