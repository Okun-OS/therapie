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
// Negativfassung angefordert und die Überschriftenschrift geladen wird. Sie
// sieht nicht, ob das
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
  ueberschrift: document.fonts.check('700 16px Manrope'),
  inter: document.fonts.check('400 16px Inter'),
  h1: getComputedStyle(document.querySelector('h1')).fontFamily,
  fliess: getComputedStyle(document.querySelector('h1 ~ p') ?? document.body).fontFamily,
}))

check('Die Überschriftenschrift ist im Browser angekommen', geladen.ueberschrift,
  'document.fonts.check sagt nein — dann zeichnet die Seite mit Inter und niemand merkt es')
check('Inter ist weiterhin da', geladen.inter)
check('Die Überschrift steht in der Überschriftenschrift', /^Manrope/.test(geladen.h1),
  `aufgelöst als: ${geladen.h1}`)
check('Der Fließtext steht nicht darin', !/^Manrope/.test(geladen.fliess),
  `aufgelöst als: ${geladen.fliess}`)

// ── Gegenprobe: der Nachbau ist weg ────────────────────────────────────────
console.log('\n=== Gegenprobe ===')

const kopfText = await seite.evaluate(() => document.querySelector('header')?.innerText ?? '')
check('Im Kopf steht die Wortmarke nicht mehr als Text',
  !/OKUN/i.test(kopfText),
  `Der Kopf liest sich als: „${kopfText.replace(/\n/g, ' · ')}"`)

// ── §189 Die Hintergrundbilder: Bleibt der Text darauf lesbar? ─────────────
//
// WARUM DAS NICHT NACH AUGENMASS GEHT
// Ein Bild hinter einer Überschrift ist ein Kontrastproblem. Auf dem Bildschirm
// des Gestalters sieht es gut aus; auf einem hellen Telefon draußen nicht. Und
// wenn eines Tages ein anderes Bild eingehängt wird — eines mit einer hellen
// Stelle genau dort, wo die Überschrift steht —, merkt das niemand, bis sich
// jemand beschwert.
//
// WIE GEMESSEN WIRD
// Der Text wird unsichtbar gemacht (nicht entfernt, sonst rutscht das Layout),
// dann ein Bild der Stelle aufgenommen, an der er stand. Gemessen wird die
// HELLSTE Stelle darunter, nicht der Durchschnitt: Ein heller Fleck quer durch
// ein Wort macht es unleserlich, auch wenn der Rest dunkel ist.
//
// Die Grenze: Weiße Schrift (#FFF) braucht nach WCAG AA für große Schrift ein
// Verhältnis von 3:1. Das ist bei einer Grundhelligkeit bis etwa 0,45 relativer
// Leuchtdichte erfüllt. Hier steht 0,33 — mit Abstand, weil die Messung einen
// einzelnen Bildpunkt nimmt und die Schrift darüber noch Kanten hat.
console.log('\n=== §189 Lesbarkeit auf den Hintergrundbildern ===')

const GRENZE = 0.33

/**
 * Die Leuchtdichte des hellsten Punktes in einem Bild — nach sRGB, nicht als
 * Mittelwert der drei Kanäle. Grün wiegt für das Auge weit schwerer als Blau;
 * ein sattes Blau wäre sonst „hell" und ein mattes Grün „dunkel", und beides
 * stimmt nicht.
 *
 * Der HELLSTE Punkt und nicht der Durchschnitt: Ein heller Fleck quer durch
 * ein Wort macht es unleserlich, auch wenn der Rest dunkel ist.
 */
async function hellster(seite, aufnahme) {
  return seite.evaluate(async (daten) => {
    const bild = new Image()
    bild.src = `data:image/png;base64,${daten}`
    await bild.decode()
    const l = document.createElement('canvas')
    l.width = bild.naturalWidth
    l.height = bild.naturalHeight
    const stift = l.getContext('2d')
    stift.drawImage(bild, 0, 0)
    const d = stift.getImageData(0, 0, l.width, l.height).data
    const kanal = (v) => {
      const s = v / 255
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    let hellste = 0
    for (let i = 0; i < d.length; i += 4) {
      const y = 0.2126 * kanal(d[i]) + 0.7152 * kanal(d[i + 1]) + 0.0722 * kanal(d[i + 2])
      if (y > hellste) hellste = y
    }
    return hellste
  }, aufnahme.toString('base64'))
}

/*
 * Zwei Breiten, und die schmale ist die gefährliche.
 *
 * Auf dem großen Bildschirm steht der Text links und das Motiv rechts — da
 * geht es gut. Auf dem Telefon ist dafür kein Platz: Dort liegt die
 * Überschrift ÜBER dem Motiv, und nur der Verlauf hält sie lesbar. Wer nur
 * breit prüft, prüft genau den Fall nicht, in dem es schiefgeht.
 */
for (const [breite, geraet] of [[1280, 'Bildschirm'], [390, 'Telefon']]) {
  await seite.setViewportSize({ width: breite, height: 900 })
  for (const [pfad, name] of [['/', 'Startseite'], ['/funktionen', 'Funktionen']]) {
    await seite.goto(`${BASIS}${pfad}`, { waitUntil: 'networkidle' })
    await seite.evaluate(() => document.fonts.ready)

    // `next/image` liefert nicht den Pfad aus, sondern eine Adresse auf den
    // eigenen Umwandler: /_next/image?url=%2Fhintergrund%2F... Wer hier nicht
    // entschlüsselt, prüft am Ziel vorbei.
    const bild = await seite.evaluate(() =>
      [...document.querySelectorAll('img')]
        .map(b => decodeURIComponent(b.currentSrc || b.src))
        .find(s => s.includes('/hintergrund/')) ?? null)
    check(`${name} (${geraet}): der Aufmacher trägt ein Hintergrundbild`, Boolean(bild),
      bild ?? 'kein Bild aus /hintergrund/ auf der Seite')

    /*
     * §190 Gemessen wird, wo BUCHSTABEN stehen — nicht der Kasten um sie
     * herum. Eine Überschrift mit `max-w-4xl` ist so breit wie erlaubt, der
     * Text darin oft deutlich kürzer. Wer den Kasten misst, verlangt
     * Abdunklung an Stellen, an denen gar nichts steht, und dunkelt dafür
     * das halbe Bild ab.
     *
     * `Range.getClientRects()` liefert je Textzeile ein Rechteck. Ihre
     * Vereinigung ist die Fläche, auf die es ankommt.
     */
    const kasten = await seite.evaluate(() => {
      const h = document.querySelector('h1')
      const bereich = document.createRange()
      bereich.selectNodeContents(h)
      const teile = [...bereich.getClientRects()].filter(r => r.width > 1 && r.height > 1)
      if (!teile.length) return h.getBoundingClientRect().toJSON()
      const x = Math.min(...teile.map(r => r.left))
      const y = Math.min(...teile.map(r => r.top))
      return {
        x,
        y,
        width: Math.max(...teile.map(r => r.right)) - x,
        height: Math.max(...teile.map(r => r.bottom)) - y,
      }
    })
    await seite.addStyleTag({ content: 'h1, h1 * { color: transparent !important }' })
    await seite.waitForTimeout(150)
    const roh = await seite.screenshot({ clip: kasten })
    await seite.reload({ waitUntil: 'networkidle' })

    const hellste = await hellster(seite, roh)

    check(`${name} (${geraet}): unter der Überschrift bleibt der Grund dunkel genug`,
      hellste <= GRENZE,
      `hellster Punkt: ${hellste.toFixed(3)} (erlaubt bis ${GRENZE})`)
  }
}
await seite.setViewportSize({ width: 1280, height: 900 })

/*
 * GEGENPROBE — und warum die erste Fassung davon wertlos war.
 *
 * Zuerst stand hier: das Bild auf 40×10 Punkte zeichnen und den hellsten
 * Punkt nehmen. Das Ergebnis war 0,315 — unter der Grenze, also „bestanden",
 * obwohl gar nichts abgedunkelt war. Beim Herunterrechnen auf Briefmarkengröße
 * verschwinden genau die hellen Stellen, um die es geht.
 *
 * Jetzt wird dieselbe Stelle zweimal gemessen: einmal wie sie ist, einmal
 * ohne die Verläufe. Ohne sie MUSS es zu hell sein — sonst tut der Verlauf
 * nichts, und die Zahl oben ist ein Zufall.
 */
await seite.goto(`${BASIS}/funktionen`, { waitUntil: 'networkidle' })
await seite.evaluate(() => document.fonts.ready)
const stelle = await seite.locator('h1').boundingBox()
await seite.addStyleTag({
  content: 'h1, h1 * { color: transparent !important } [data-verlauf] { display: none !important }',
})
await seite.waitForTimeout(150)
const blank = await seite.screenshot({ clip: stelle })
const ohneVerlauf = await hellster(seite, blank)

check('Gegenprobe: ohne die Verläufe wäre dieselbe Stelle zu hell',
  ohneVerlauf > GRENZE,
  `ohne Verlauf: ${ohneVerlauf.toFixed(3)} — darüber liegt die Grenze von ${GRENZE}. `
  + 'Ist dieser Wert niedrig, dunkelt nicht der Verlauf ab, sondern das Bild ist '
  + 'an der Stelle ohnehin dunkel, und die Messung oben beweist nichts.')

// Und auf hellem Grund die helle Fassung — sonst wäre Weiß auf Weiß.
await seite.goto(`${BASIS}/impressum`, { waitUntil: 'networkidle' })
const hell = await seite.evaluate(() =>
  [...document.querySelectorAll('img')].some(b => /negativ/.test(decodeURIComponent(b.currentSrc || b.src))))
check('Auf hellem Grund steht keine Negativfassung', !hell,
  'Weiße Schrift auf weißem Papier')

await browser.close()
console.log(`\n${ok}/${ok + fail} Checks bestanden`)
process.exit(fail ? 1 : 0)
