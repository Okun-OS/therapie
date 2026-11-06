// Nachweis (Browser): Die Fensterleiste des Desktop-Programms.
//
//     node pruefungen/browser/fensterleiste.mjs
//
// §201 Im Programm für den Rechner hat das Fenster keinen eigenen Rahmen
// mehr. Das Betriebssystem zeichnet nur noch die drei Fensterknöpfe, und zwar
// ÜBER die Kopfleiste der App. Der Eigentümer hat den alten Zustand so
// beschrieben: Es sieht hässlich aus — zwei Kanten, zwei Farben, und genau
// deshalb der Eindruck „Webseite in einem Kasten".
//
// WAS DABEI KAPUTTGEHEN KANN, UND ZWAR STILL
// Ein rahmenloses Fenster lässt sich nur noch dort anfassen, wo eine Fläche
// ausdrücklich zum Ziehen erklärt ist. Fehlt sie, ist das Fenster
// festgenagelt. Umgekehrt: Ist zu viel zum Ziehen erklärt, verschiebt ein
// Klick auf einen Knopf das Fenster, statt den Knopf zu drücken. Beide Fehler
// sieht man dem Quelltext nicht an — nur dem laufenden Programm.
//
// WARUM HIER UND NICHT IM HÜLLEN-TEST
// `pruefungen/desktop/huelle.mjs` startet gegen eine Attrappe ohne unser
// Stylesheet. Die Regel dort zu prüfen hieße, eine Abschrift der Regel zu
// prüfen — das prüft nichts. Hier läuft die echte App mit `globals.css`.
// Die Hülle setzt die Klasse `im-programm`; das macht diese Prüfung von Hand
// nach, denn genau das ist die Schnittstelle zwischen beiden.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'
let ok = 0, fail = 0
const check = (name, wahr, info = '') => {
  console.log(`  ${wahr ? '✓ PASS' : '✗ FAIL'}  ${name}${info ? `\n           ${info}` : ''}`)
  wahr ? ok++ : fail++
}

const browser = await chromium.launch()
const seite = await browser.newPage({ viewport: { width: 1400, height: 900 } })

/** Die Hülle markiert das Wurzelelement, bevor gezeichnet wird. */
const alsProgramm = () => seite.evaluate(() =>
  document.documentElement.classList.add('im-programm'))

const region = (wahl) => seite.evaluate(w => {
  const el = document.querySelector(w)
  return el ? getComputedStyle(el).getPropertyValue('-webkit-app-region') : '(nicht da)'
}, wahl)

async function anmelden(email, passwort = 'Test1234!') {
  await seite.goto(`${BASIS}/login`, { waitUntil: 'networkidle' })
  await seite.fill('input[type="email"]', email)
  await seite.fill('input[type="password"]', passwort)
  // Vor der Hydrierung tut der Klick nichts — dann stünde hier eine
  // Zeitüberschreitung statt eines Befunds.
  await seite.waitForTimeout(1500)
  await seite.click('button[type="submit"]')
  await seite.waitForURL(/\/(company|admin|employee|okun)/, { timeout: 30000 })
  await seite.waitForTimeout(1500)
}

// ── Die Anmeldung: kein Kopf, also ein eigener Streifen ────────────────────
console.log('=== Die Anmeldung ===')

await seite.goto(`${BASIS}/login`, { waitUntil: 'domcontentloaded' })

// Zuerst die Gegenprobe: Im Browser darf nichts davon gelten. Eine
// Ziehfläche im Browser wäre nicht nur sinnlos, sie macht Text unmarkierbar.
const imBrowser = await seite.evaluate(() => ({
  sichtbar: [...document.querySelectorAll('.nur-im-programm')]
    .filter(el => getComputedStyle(el).display !== 'none').length,
  region: (() => {
    const el = document.querySelector('.zieh-flaeche')
    return el ? getComputedStyle(el).getPropertyValue('-webkit-app-region') : 'keine'
  })(),
}))
check('Im Browser ist der Streifen unsichtbar', imBrowser.sichtbar === 0,
  `${imBrowser.sichtbar} sichtbar`)
check('Und im Browser zieht nichts', imBrowser.region !== 'drag', imBrowser.region)

await alsProgramm()
check('Im Programm gibt es eine Ziehfläche auf der Anmeldung',
  await seite.locator('.zieh-flaeche').count() > 0,
  `${await seite.locator('.zieh-flaeche').count()} gefunden`)
check('Und sie ist wirklich zum Ziehen erklärt',
  await region('.zieh-flaeche') === 'drag', await region('.zieh-flaeche'))

const streifen = await seite.evaluate(() => {
  const el = document.querySelector('.nur-im-programm.zieh-flaeche')
  if (!el) return null
  const k = el.getBoundingClientRect()
  return { oben: k.top, hoch: k.height, breit: k.width }
})
check('Der Streifen liegt oben und ist so hoch wie die Kopfleiste',
  streifen && streifen.oben === 0 && streifen.hoch === 70,
  JSON.stringify(streifen))
check('Er geht über die ganze Breite — sonst packt man daneben',
  streifen && streifen.breit >= 1390, JSON.stringify(streifen))

// Die Gegenprobe, die zählt: Das Anmeldeformular muss bedienbar bleiben.
// Läge der Streifen darüber, wäre das Programm beim ersten Start unbrauchbar.
const formularFrei = await seite.evaluate(() => {
  const feld = document.querySelector('input[type="email"]')
  if (!feld) return 'kein Feld'
  const k = feld.getBoundingClientRect()
  const getroffen = document.elementFromPoint(k.left + k.width / 2, k.top + k.height / 2)
  return feld.contains(getroffen) || getroffen === feld ? 'frei' : 'verdeckt'
})
check('Das Anmeldefeld bleibt anklickbar', formularFrei === 'frei', formularFrei)

// ── Die App dahinter: die Kopfleiste IST die Fensterleiste ─────────────────
console.log('\n=== Die Kopfleiste der App ===')

await anmelden('gf@rheinblick-reha.de')
await alsProgramm()

check('Die Kopfleiste ist die Ziehfläche',
  await region('.zieh-flaeche') === 'drag', await region('.zieh-flaeche'))

// Und die Gegenprobe dazu: Alles Anklickbare darin muss freigegeben sein.
const knoepfe = await seite.evaluate(() => {
  const leiste = document.querySelector('.zieh-flaeche')
  if (!leiste) return null
  const teile = [...leiste.querySelectorAll('button, a')]
  return {
    anzahl: teile.length,
    ziehend: teile.filter(el =>
      getComputedStyle(el).getPropertyValue('-webkit-app-region') !== 'no-drag').length,
  }
})
check('In der Leiste stehen überhaupt Bedienelemente',
  knoepfe && knoepfe.anzahl > 0, JSON.stringify(knoepfe))
check('Und KEINES davon zieht das Fenster',
  knoepfe && knoepfe.ziehend === 0,
  knoepfe ? `${knoepfe.ziehend} von ${knoepfe.anzahl} ziehen` : 'keine Leiste')

// Platz für die Fensterknöpfe: Ohne ihn verschwindet das rechte Ende der
// Leiste unter „Schließen".
const platz = await seite.evaluate(() => {
  const el = document.querySelector('.zieh-flaeche')
  return el ? parseInt(getComputedStyle(el).paddingRight, 10) : -1
})
check('Rechts bleibt Platz für die drei Fensterknöpfe', platz >= 120, `${platz}px`)

const ohneProgramm = await seite.evaluate(() => {
  document.documentElement.classList.remove('im-programm')
  const el = document.querySelector('.zieh-flaeche')
  return el ? parseInt(getComputedStyle(el).paddingRight, 10) : -1
})
check('Im Browser ist dieser Platz NICHT reserviert', ohneProgramm < 120,
  `${ohneProgramm}px — sonst klafft im Browser rechts eine Lücke`)

await browser.close()
console.log(`\n${ok}/${ok + fail} Checks bestanden`)
process.exit(fail ? 1 : 0)
