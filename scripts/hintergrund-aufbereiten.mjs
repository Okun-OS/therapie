/**
 * §189 Aus den gelieferten Hintergrundbildern Dateien machen, die man einem
 * Besucher zumuten kann.
 *
 *     npm run hintergrund:aufbereiten
 *
 * WARUM DAS NÖTIG IST
 * Die Bilder kommen als PNG, weil Bildgeneratoren PNG ausgeben. Für eine
 * Fotografie ist PNG das falsche Format: Es speichert jeden Bildpunkt genau,
 * obwohl bei einem weichen Farbverlauf niemand den Unterschied sieht. Die drei
 * Dateien wiegen zusammen 4,8 MB. Auf einem Telefon im Zug sind das mehrere
 * Sekunden, in denen die Seite leer ist — und die Startseite ist die eine
 * Seite, bei der niemand wartet.
 *
 * WARUM OHNE NEUE ABHÄNGIGKEIT
 * Auf dieser Maschine gibt es weder sharp noch ImageMagick, und eine
 * Bildbibliothek aufzunehmen, um zweimal im Jahr drei Dateien umzuwandeln,
 * zieht Binärpakete nach, die bei jedem `npm install` gebaut werden wollen.
 * Chromium liegt ohnehin da (für die Browserprüfungen) und kann WebP
 * schreiben. Also macht es Chromium.
 *
 * WARUM DIE QUELLEN MIT IM HAUS BLEIBEN
 * `public/hintergrund/quelle/` wandert mit ins Verzeichnis. Das ist die Lehre
 * aus §186: Damals lag in den Markendateien ein anderer Schriftzug als der, den
 * der Betrieb benutzt, und niemand konnte nachsehen, welcher richtig war. Eine
 * gebaute Datei ohne ihre Vorlage ist eine Behauptung.
 *
 * Playwright ist keine Abhängigkeit des Projekts — es liegt nur auf der
 * Entwicklungsmaschine. Deshalb läuft das hier von Hand, und die fertigen
 * `.webp` wandern mit ins Verzeichnis, damit eine Auslieferung sie nicht
 * bauen muss.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const QUELLE = 'public/hintergrund/quelle'
const ZIEL = 'public/hintergrund'

// 0.82 ist nachgesehen, nicht geraten: Darunter werden die weichen Verläufe
// im Hintergrund fleckig („banding"), darüber wächst die Datei schneller als
// das, was man sieht.
const GUETE = 0.82

// Breiter als 1920 braucht es nicht: Das Bild liegt HINTER Text, wird
// abgedunkelt und beschnitten. Wer einen 5K-Bildschirm hat, sieht den
// Unterschied an einem unscharfen Verlauf nicht.
const MAX_BREITE = 1920

const browser = await chromium.launch()
const seite = await browser.newPage()

let gesamtVorher = 0, gesamtNachher = 0

for (const datei of readdirSync(QUELLE).filter(d => d.endsWith('.png')).sort()) {
  const vorher = statSync(join(QUELLE, datei)).size
  const roh = readFileSync(join(QUELLE, datei)).toString('base64')

  const { base64, breite, hoehe, quellbreite } = await seite.evaluate(
    async ([daten, guete, maxBreite]) => {
      const bild = new Image()
      bild.src = `data:image/png;base64,${daten}`
      await bild.decode()
      const faktor = Math.min(1, maxBreite / bild.naturalWidth)
      const w = Math.round(bild.naturalWidth * faktor)
      const h = Math.round(bild.naturalHeight * faktor)
      const leinwand = document.createElement('canvas')
      leinwand.width = w
      leinwand.height = h
      const stift = leinwand.getContext('2d')
      stift.imageSmoothingEnabled = true
      stift.imageSmoothingQuality = 'high'
      stift.drawImage(bild, 0, 0, w, h)
      const url = leinwand.toDataURL('image/webp', guete)
      return {
        base64: url.split(',')[1],
        breite: w,
        hoehe: h,
        quellbreite: bild.naturalWidth,
        art: url.slice(5, url.indexOf(';')),
      }
    },
    [roh, GUETE, MAX_BREITE],
  )

  const inhalt = Buffer.from(base64, 'base64')

  // GEGENPROBE: Chromium gibt bei unbekanntem Format stillschweigend PNG
  // zurück. Dann wäre die Datei größer statt kleiner, und niemand merkte es
  // außer am Ladebalken. Die Kennung im Dateikopf sagt die Wahrheit.
  const istWebp = inhalt.toString('ascii', 0, 4) === 'RIFF'
    && inhalt.toString('ascii', 8, 12) === 'WEBP'
  if (!istWebp) {
    throw new Error(
      `${datei}: Chromium hat kein WebP geliefert, sondern `
      + `${inhalt.toString('ascii', 1, 4)}. Ohne WebP bringt der ganze Schritt nichts.`,
    )
  }

  const name = datei.replace(/\.png$/, '.webp')
  writeFileSync(join(ZIEL, name), inhalt)
  gesamtVorher += vorher
  gesamtNachher += inhalt.length

  const kb = (n) => (n / 1024).toFixed(0).padStart(5) + ' kB'
  console.log(
    `${name.padEnd(28)} ${String(breite).padStart(4)}×${hoehe}`
    + `${breite < quellbreite ? ` (aus ${quellbreite})` : ''.padEnd(0)}`
    + `   ${kb(vorher)} → ${kb(inhalt.length)}`
    + `   −${(100 - inhalt.length / vorher * 100).toFixed(0)} %`,
  )
}

await browser.close()
console.log(
  `\nZusammen ${(gesamtVorher / 1024 / 1024).toFixed(2)} MB → `
  + `${(gesamtNachher / 1024).toFixed(0)} kB `
  + `(−${(100 - gesamtNachher / gesamtVorher * 100).toFixed(0)} %)`,
)
