// §265 Die Bildschirmfotos für App Store und Play Store.
//
//     npm run dev          (in einem anderen Fenster)
//     node scripts/store-bilder.mjs
//
// WARUM DAS EIN SKRIPT IST UND KEINE HANDARBEIT
// Beide Stores verlangen Bildschirmfotos in festen Pixelmaßen, und sie
// verlangen sie bei JEDER neuen Fassung neu, sobald sich die Oberfläche
// ändert. Von Hand sind das jedes Mal zwanzig Aufnahmen auf vier Geräten, die
// niemand hat. Hier sind es zwei Minuten.
//
// Und sie zeigen die ECHTE Anwendung. Beide Stores verlangen das ausdrücklich
// — gemalte Oberflächen sind ein Ablehnungsgrund, und zwar ein peinlicher.
//
// WELCHE MASSE
// Die Angaben dazu widersprechen sich zwischen den Quellen: Mal gilt 6,9 Zoll
// (1320×2868) als Pflicht, mal die mittlere Größe mit Dynamic Island
// (1206×2622). Statt auf eine Angabe zu wetten, entstehen hier beide — und
// dazu das iPad, weil die Hülle `TARGETED_DEVICE_FAMILY = "1,2"` trägt und
// Apple dann iPad-Aufnahmen verlangt.
//
// WAS DARAUF ZU SEHEN IST
// Die Testdaten aus `npm run seed`: ein erfundener Betrieb, erfundene
// Menschen. Nichts davon gehört jemandem.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { mkdir, writeFile } from 'node:fs/promises'

const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'
const ZIEL = 'store'

/**
 * Die Geräte. `breite`/`hoehe` sind CSS-Pixel, `dichte` der Faktor — das
 * Ergebnis ist genau das Pixelmaß, das der Store verlangt.
 */
const GERAETE = [
  { ordner: 'ios/6.9-zoll', breite: 440, hoehe: 956, dichte: 3, maß: '1320×2868' },
  { ordner: 'ios/mittel', breite: 402, hoehe: 874, dichte: 3, maß: '1206×2622' },
  { ordner: 'ios/ipad-13-zoll', breite: 1032, hoehe: 1376, dichte: 2, maß: '2064×2752' },
  { ordner: 'android/telefon', breite: 360, hoehe: 800, dichte: 3, maß: '1080×2400' },
]

/**
 * Die Seiten. Die Reihenfolge ist die im Store — das erste Bild entscheidet,
 * ob jemand weiterschaut, und das ist hier der Dienstplan und nicht das
 * Anmeldefenster.
 */
const SEITEN = [
  { datei: '1-mein-tag', pfad: '/employee', warten: 3000 },
  { datei: '2-dienstplan', pfad: '/employee/schedule', warten: 3500 },
  { datei: '3-zeiten', pfad: '/employee/time-tracking', warten: 3000 },
  { datei: '4-nachrichten', pfad: '/employee/nachrichten', warten: 3000 },
  { datei: '5-lohn', pfad: '/employee/lohn', warten: 3000 },
]

/*
 * §265 Der Beispielbetrieb, nicht die Prüfdaten.
 *
 * `npm run seed:schaufenster` legt einen erfundenen Betrieb mit zehn Menschen,
 * einem veröffentlichten Dienstplan über vier Wochen und vollständigen Zeiten
 * an. Genau das braucht ein Store-Bild: Ein Dienstplan, in dem viermal „Frei"
 * steht, ist bei Apple ein Ablehnungsgrund — „app appears incomplete" — und
 * bei Google ein verschenkter Eintrag.
 *
 * Nichts davon gehört einem Menschen: Der Betrieb heißt „Beispielbetrieb
 * GmbH", und das steht auch auf den Bildern.
 */
const ZUGANG = 'deniz.yilmaz@beispielbetrieb.de'

async function anmelden(ctx) {
  const seite = await ctx.newPage()
  await seite.goto(`${BASIS}/login`)
  await seite.fill('input[type="email"]', ZUGANG)
  await seite.fill('input[type="password"]', 'Test1234!')
  await seite.click('button[type="submit"]')
  await seite.waitForTimeout(4500)
  return seite
}

const browser = await chromium.launch({ args: ['--no-sandbox'] })

for (const g of GERAETE) {
  const ctx = await browser.newContext({
    viewport: { width: g.breite, height: g.hoehe },
    deviceScaleFactor: g.dichte,
    isMobile: g.ordner.startsWith('android') || !g.ordner.includes('ipad'),
    hasTouch: true,
  })
  /*
   * Einführungen und Hinweisbänder ausschalten. Ein Store-Bild, auf dem ein
   * „Neu hier?"-Fenster klebt, zeigt das Fenster und nicht das Programm.
   */
  await ctx.addInitScript((pfade) => {
    try {
      localStorage.setItem('okun_whats_new_v2_location_model', '1')
      localStorage.setItem('okun_lm_migration_done', '1')
      for (const r of ['employee', 'admin', 'company', 'okun']) {
        localStorage.setItem(`okun_tour_done_v6:${r}`, '1')
      }
      /*
       * Die Seitenhinweise („Deine Woche auf einen Blick … Verstanden").
       * Sie erscheinen beim ERSTEN Besuch einer Seite und gehören ins
       * Produkt — aber nicht auf ein Bild, das in zwei Sekunden verstanden
       * werden soll. Weggeklickt über denselben Schalter, den auch ein
       * Mensch betätigt.
       */
      localStorage.setItem('okun_visited_pages_v1', JSON.stringify(pfade))
    } catch { /* ohne Speicher wird eben mehr angezeigt */ }
  }, SEITEN.map(s => s.pfad))

  const seite = await anmelden(ctx)
  await mkdir(`${ZIEL}/${g.ordner}`, { recursive: true })

  for (const s of SEITEN) {
    await seite.goto(`${BASIS}${s.pfad}`)
    await seite.waitForTimeout(s.warten)
    const pfad = `${ZIEL}/${g.ordner}/${s.datei}.png`
    await seite.screenshot({ path: pfad })
    console.log(`  ✓ ${pfad}  (${g.maß})`)
  }

  await ctx.close()
}

// ── Das Titelbild für den Play Store ──────────────────────────────────────
/*
 * 1024×500, Pflicht bei Google. Es ist kein Bildschirmfoto, sondern ein
 * Aushängeschild — und es wird oben im Eintrag groß angezeigt. Hier entsteht
 * es aus den Hausfarben, damit es nicht irgendwann irgendwo zusammengeklickt
 * wird und dann nicht mehr zum Rest passt.
 */
const TITELBILD = `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1024px; height: 500px; display: flex; align-items: center;
    background: #1A1D1F;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #fff; overflow: hidden; position: relative;
  }
  /* Ein ruhiger Verlauf statt eines Fotos: Er bleibt in jeder Größe scharf. */
  .schimmer {
    position: absolute; width: 760px; height: 760px; border-radius: 50%;
    right: -220px; top: -260px;
    background: radial-gradient(circle, rgba(93,194,189,.30) 0%, rgba(93,194,189,0) 68%);
  }
  .inhalt { padding: 0 72px; position: relative; max-width: 700px; }
  .marke { display: flex; align-items: center; gap: 14px; margin-bottom: 26px; }
  .marke img { height: 38px; }
  h1 {
    font-size: 42px; line-height: 1.18; font-weight: 700; letter-spacing: -.5px;
  }
  h1 em { font-style: normal; color: #5DC2BD; }
  p { margin-top: 18px; font-size: 21px; line-height: 1.45; color: #C7CCD1; }
</style></head>
<body>
  <div class="schimmer"></div>
  <div class="inhalt">
    <div class="marke"><img src="${BASIS}/brand/logo-horizontal-negativ.png" alt=""></div>
    <h1>Dienstplan, Zeiterfassung<br>und Lohnabrechnung —<br><em>in einer App</em></h1>
    <p>Für Pflege, Therapie und soziale Einrichtungen.</p>
  </div>
</body></html>`

const ctxTitel = await browser.newContext({
  viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1,
})
const titel = await ctxTitel.newPage()
await titel.setContent(TITELBILD, { waitUntil: 'networkidle' })
await mkdir(`${ZIEL}/android`, { recursive: true })
await titel.screenshot({ path: `${ZIEL}/android/titelbild-1024x500.png` })
console.log(`  ✓ ${ZIEL}/android/titelbild-1024x500.png  (1024×500)`)

await browser.close()

await writeFile(`${ZIEL}/GEMACHT-AM.txt`,
  `Erzeugt am ${new Date().toISOString()}\n`
  + `Quelle: ${BASIS}\n`
  + `Erzeugt mit: node scripts/store-bilder.mjs\n`
  + `Zu sehen sind die Testdaten aus npm run seed — ein erfundener Betrieb.\n`)

console.log('\nFertig. Die Bilder liegen unter store/.')
