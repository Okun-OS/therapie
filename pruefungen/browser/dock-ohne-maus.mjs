// Nachweis (Browser): Die untere Leiste auf einem Gerät ohne Maus.
//
//     node pruefungen/browser/dock-ohne-maus.mjs
//
// §207 Der Eigentümer hat gemeldet: „Wenn man darauf klickt, sieht das sehr
// unprofessionell aus. Diese Kacheln, der Effekt muss da weg. Weil wenn die
// groß werden, dann geht es aus dem Bereich raus. Aber nur auf der mobilen
// Variante."
//
// Drei Dinge waren schuld, und alle drei sind Antworten auf einen Mauszeiger:
//
//   die Vergrößerung   beim Antippen erzeugen Browser ein künstliches
//                      „mousemove"; die Kachel wuchs auf das 1,42-fache und
//                      blieb so, weil kein „mouseleave" folgt
//   die Welle          wächst auf das Dreifache
//   der Lichtkranz     vierzehn Punkte Schatten rundherum
//
// WAS DIESE PRÜFUNG WIRKLICH PRÜFT
// Nicht „sieht gut aus" — das kann sie nicht. Sie misst, ob eine Kachel nach
// dem Antippen noch INNERHALB der Leiste liegt. Das ist die Beschwerde,
// übersetzt in eine Zahl.
//
// Und die Gegenprobe ist die halbe Prüfung: Am Schreibtisch sollen die
// Effekte bleiben. Eine Änderung, die sie überall abschaltet, wäre genauso
// falsch wie keine.

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'
let ok = 0, fail = 0
const check = (name, wahr, info = '') => {
  console.log(`  ${wahr ? '✓ PASS' : '✗ FAIL'}  ${name}${info ? `\n           ${info}` : ''}`)
  wahr ? ok++ : fail++
}

const browser = await chromium.launch()

/** Anmelden und auf „Mein Tag" warten. */
async function anmelden(seite) {
  await seite.goto(`${BASIS}/login`, { waitUntil: 'networkidle' })
  await seite.fill('input[type="email"]', 'maria.schneider@rheinblick-reha.de')
  await seite.fill('input[type="password"]', 'Test1234!')
  await seite.waitForTimeout(1200)
  await seite.click('button[type="submit"]')
  await seite.waitForURL(/\/employee/, { timeout: 30000 })
  await seite.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      if (/tour|whats|onboard|banner/i.test(k)) localStorage.setItem(k, '1')
    }
  })
  await seite.reload({ waitUntil: 'networkidle' })
  await seite.waitForTimeout(2000)
}

/**
 * Die erste Kachel betätigen und messen, wie weit sie über die Leiste
 * hinausragt.
 */
async function messen(seite, perBeruehrung) {
  const kachel = seite.locator('[data-dock-slot]').first()
  await kachel.waitFor({ state: 'visible', timeout: 15000 })

  if (perBeruehrung) await kachel.tap()
  else await kachel.click()

  // Mitten in der Animation nachsehen — danach ist sie vorbei.
  await seite.waitForTimeout(180)

  return seite.evaluate(() => {
    const el = document.querySelector('[data-dock-slot]')
    if (!el) return null
    // Die Leiste selbst — die abgerundete Fläche, in der die Kacheln sitzen.
    const leiste = el.closest('[data-tour="dock-bar"]')
    if (!leiste) return null
    const k = el.getBoundingClientRect()
    const l = leiste.getBoundingClientRect()
    // Auch die Wellen zählen: Sie liegen IN der Kachel, wachsen aber darüber
    // hinaus. Gemessen wird der äußerste Rand von allem, was dranhängt.
    let oben = k.top
    for (const kind of el.querySelectorAll('span')) {
      const r = kind.getBoundingClientRect()
      if (r.height > 0) oben = Math.min(oben, r.top)
    }
    /*
     * Die Vergrößerung sitzt am KIND, nicht an einem Vorfahren — erster
     * Versuch suchte mit `closest()` nach oben und fand nichts. Gemessen wird
     * der Faktor direkt, nicht die Höhe: Die Kachel ist 56 statt 48 Punkte
     * hoch, weil darunter der Aktiv-Punkt sitzt, und das ist kein Wachstum.
     */
    const innen = el.firstElementChild
    const faktor = Number(
      /scale\(([\d.]+)\)/.exec(innen?.getAttribute('style') ?? '')?.[1] ?? '1')

    return {
      ueberstand: Math.round(l.top - oben),
      kachelHoch: Math.round(k.height),
      faktor,
      wellen: el.querySelectorAll('span[style*="ripple"]').length,
    }
  })
}

// ── Auf dem Telefon ────────────────────────────────────────────────────────
console.log('=== Auf dem Telefon (Finger, kein Zeiger) ===')

const telefon = await browser.newContext({ ...devices['Pixel 7'] })
const t = await telefon.newPage()
await anmelden(t)

const zeigerT = await t.evaluate(() =>
  window.matchMedia('(hover: hover) and (pointer: fine)').matches)
check('Dieses Gerät meldet keinen Mauszeiger', zeigerT === false,
  `matchMedia sagt ${zeigerT} — ohne das prüft der Rest nichts.`)

/*
 * §207 Das künstliche „mousemove" nachstellen.
 *
 * Erster Versuch: antippen und nachsehen. Der Check blieb grün, auch als ich
 * die Sperre zur Probe wieder herausnahm — also bewies er nichts. Grund:
 * Playwrights `tap()` erzeugt KEIN künstliches Mausereignis, ein echter
 * Telefon-Browser erzeugt es sehr wohl. Genau daran hing der Fehler.
 *
 * Also wird es hier ausdrücklich ausgelöst. Das ist nicht geschummelt,
 * sondern das Gegenteil: Es stellt das her, was auf dem Gerät des
 * Eigentümers wirklich passiert, und was die Prüfung sonst nie zu sehen
 * bekäme.
 */
async function wieEinFinger(seite) {
  const kasten = await seite.locator('[data-dock-slot]').first().boundingBox()
  await seite.evaluate(({ x, y }) => {
    const ziel = document.elementFromPoint(x, y)
    for (const art of ['mousemove', 'mouseover', 'mouseenter']) {
      ziel?.dispatchEvent(new MouseEvent(art, {
        bubbles: art !== 'mouseenter', clientX: x, clientY: y,
      }))
    }
  }, { x: kasten.x + kasten.width / 2, y: kasten.y + kasten.height / 2 })
  await seite.waitForTimeout(350)
}
/** Der Vergrößerungsfaktor der ersten Kachel. */
const faktor = (seite) => seite.evaluate(() => {
  const innen = document.querySelector('[data-dock-slot]')?.firstElementChild
  return Number(/scale\(([\d.]+)\)/.exec(innen?.getAttribute('style') ?? '')?.[1] ?? '1')
})

/*
 * Erst die Vergrößerung messen, DANN antippen.
 *
 * Andersherum ging es schief: Das Antippen löst ein „mouseleave" aus, das die
 * Vergrößerung zurücksetzt — gemessen wurde also immer 1, mit Sperre wie
 * ohne. Der Check war grün und bewies nichts.
 */
await wieEinFinger(t)
const faktorTelefon = await faktor(t)
check('Die Kachel wächst nicht unter dem Finger', faktorTelefon === 1,
  `${faktorTelefon}× — ohne die Sperre steht hier 1,42, und zwar dauerhaft: `
  + 'Nach einer Berührung folgt kein „mouseleave", das es zurücknähme.')

const etikettNachBeruehrung = await t.locator('text=/^(Heute|Plan)$/').count()
check('Und ihr Name erscheint nicht über der Leiste', etikettNachBeruehrung === 0,
  `${etikettNachBeruehrung} gefunden`)

const nachTipp = await messen(t, true)
check('Nach dem Antippen bleibt die Kachel in der Leiste',
  nachTipp && nachTipp.ueberstand <= 2,
  `${nachTipp?.ueberstand} Punkte Überstand (Kachel ${nachTipp?.kachelHoch} hoch)`)
check('Es hängen keine Wellen an ihr', nachTipp?.wellen === 0,
  `${nachTipp?.wellen} gefunden`)

await telefon.close()

// ── Am Schreibtisch — die Gegenprobe ───────────────────────────────────────
console.log('\n=== Am Schreibtisch (mit Maus) — die Effekte bleiben ===')

const tisch = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const d = await tisch.newPage()
await anmelden(d)

const zeigerD = await d.evaluate(() =>
  window.matchMedia('(hover: hover) and (pointer: fine)').matches)
check('Dieses Gerät meldet einen Mauszeiger', zeigerD === true, String(zeigerD))

const nachKlick = await messen(d, false)
check('Hier wachsen die Wellen weiterhin', (nachKlick?.wellen ?? 0) > 0,
  `${nachKlick?.wellen} Wellen — am Schreibtisch schwebt die Leiste frei, `
  + 'dort stört der Überstand nicht, und die Rückmeldung ist gewollt.')

// Und die Vergrößerung: Sie hängt an der Maus, also wird die Maus bewegt.
const kasten = await d.locator('[data-dock-slot]').first().boundingBox()
await d.mouse.move(kasten.x + kasten.width / 2, kasten.y + kasten.height / 2, { steps: 5 })
await d.waitForTimeout(400)
const faktorTisch = await d.evaluate(() => {
  const innen = document.querySelector('[data-dock-slot]')?.firstElementChild
  return Number(/scale\(([\d.]+)\)/.exec(innen?.getAttribute('style') ?? '')?.[1] ?? '1')
})
check('Und die Kacheln vergrößern sich unter der Maus weiterhin',
  faktorTisch > 1.1, `${faktorTisch}× unter dem Zeiger`)

await browser.close()
console.log(`\n${ok}/${ok + fail} Checks bestanden`)
process.exit(fail ? 1 : 0)
