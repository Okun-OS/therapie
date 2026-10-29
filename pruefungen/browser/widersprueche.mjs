// Nachweis (Browser) §243: Wo sich das Programm selbst widerspricht.
//
//     node pruefungen/browser/widersprueche.mjs
//
// DIE MELDUNG
// „Es gibt eine Diskrepanz zwischen dem Stundenkonto, was da angezeigt wird …
// du bist offiziell eigentlich im Minus, aber dann wird Stundenkonto 0
// angezeigt ganz oft. Das beißt sich halt wieder. Auf solche Fehler bitte auch
// nochmal testen, ne, ob es mehr solche Sachen gibt, wo sich Sachen
// widersprechen."
//
// WARUM DIESE PRÜFUNG ANDERS GEBAUT IST ALS DIE ANDEREN
// Die übrigen Prüfungen messen je eine Zusage, die ich kenne. Diese hier sucht
// nach einer ART von Fehler, ohne die einzelnen Fälle zu kennen — das ist der
// Unterschied zwischen „ich habe den gemeldeten Fehler behoben" und „ich habe
// nachgesehen, ob es mehr davon gibt".
//
// VIER ARTEN VON WIDERSPRUCH
//
//   1. EIN ZIEL, ZWEI VERSPRECHEN
//      Zwei Einträge mit verschiedenen Überschriften, die auf dieselbe Seite
//      führen. Gefunden hat das „Meine Unterlagen" und „Profil und
//      Einstellungen" — beide auf `/employee/profile`. Wer den ersten nahm und
//      seine Kontaktdaten suchte, hatte sie vor sich und wusste es nicht.
//
//   2. EIN WEG, DER INS LEERE FÜHRT
//      Ein Verweis in der Oberfläche auf eine Seite, die es nicht gibt.
//      Gefunden hat das `/admin/settings` — 404, und zwar seit Langem.
//
//   3. EINE ÜBERSCHRIFT, DIE IHRER EIGENEN AUFSTELLUNG WIDERSPRICHT
//      „Stundenkonto +0:00" über einer Aufstellung, die 105 Minusstunden
//      ausweist.
//
//   4. DASSELBE ZWEIMAL VERSCHIEDEN
//      Dieselbe Größe auf zwei Seiten mit zwei Zahlen. Das messen
//      `urlaubstage-stimmen-ueberein` und `zeiten-stimmen-ueberein` bereits
//      für Urlaub und Stunden; hier wird es nicht doppelt geprüft.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'
let ok = 0, fail = 0
const check = (name, wahr, info = '') => {
  console.log(`  ${wahr ? '✓ PASS' : '✗ FAIL'}  ${name}${info ? `\n           ${info}` : ''}`)
  wahr ? ok++ : fail++
}

const ROLLEN = [
  { name: 'Mitarbeiter', email: 'anna.fischer@rheinblick-reha.de', start: '/employee/ich' },
  { name: 'Standortleitung', email: 'leitung@rheinblick-reha.de', start: '/admin' },
  { name: 'Unternehmen', email: 'gf@rheinblick-reha.de', start: '/company' },
]

/*
 * Ziele, die absichtlich kein eigener Ort sind.
 *
 * `/logout` meldet ab — eine Prüfung, die ihm folgt, verliert ihre Sitzung und
 * meldet danach lauter Fehler, die sie selbst verursacht hat.
 */
const NICHT_FOLGEN = [/^\/logout/, /^\/api\//, /^\/datenschutz/, /^\/impressum/]

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})

async function sitzung(email) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
  await ctx.addInitScript(() => {
    localStorage.setItem('okun_whats_new_v2_location_model', '1')
    for (const r of ['employee', 'admin', 'company', 'okun']) {
      localStorage.setItem(`okun_tour_done_v6:${r}`, '1')
    }
  })
  const seite = await ctx.newPage()
  await seite.goto(`${BASIS}/login`)
  await seite.fill('input[type="email"]', email)
  await seite.fill('input[type="password"]', 'Test1234!')
  await seite.click('button[type="submit"]')
  await seite.waitForTimeout(5000)
  return { ctx, seite }
}

// ── §243 Art 1 und 2: Verweise, die nicht halten, was sie sagen ───────────
console.log('=== §243 Verweise auf der Startseite jeder Rolle ===')

const befunde = []

for (const rolle of ROLLEN) {
  const { ctx, seite } = await sitzung(rolle.email)
  await seite.goto(`${BASIS}${rolle.start}`, { waitUntil: 'domcontentloaded' })
  /*
   * Gewartet wird auf VERWEISE, nicht auf die Uhr.
   *
   * Mit festen drei Sekunden fand diese Prüfung auf `/company` null Ziele —
   * die Seite baut sich im Browser auf und war noch nicht fertig. Die
   * Zusicherung darunter („es wurden überhaupt Verweise gefunden") hat das
   * gemeldet, statt es als „keine Widersprüche" durchgehen zu lassen. Genau
   * dafür ist sie da.
   */
  for (let versuch = 0; versuch < 60; versuch++) {
    const anzahl = await seite.evaluate(() =>
      document.querySelectorAll('a[href^="/"]').length)
    if (anzahl >= 1) break
    await seite.waitForTimeout(250)
  }

  /*
   * Auch das, was hinter einem Aufklapper liegt, zählt: Weggeklappt ist nicht
   * weg, und ein Verweis ins Leere wird dort nicht besser.
   */
  await seite.evaluate(() => {
    document.querySelectorAll('details').forEach(d => d.setAttribute('open', ''))
  })
  await seite.waitForTimeout(500)

  const verweise = await seite.evaluate(() =>
    Array.from(document.querySelectorAll('a[href^="/"]'))
      .map(a => ({
        ziel: a.getAttribute('href'),
        titel: (a.textContent ?? '').trim().split('\n')[0].trim(),
      }))
      .filter(v => v.ziel && v.titel))

  /*
   * ── Art 1: ein Ziel, zwei Überschriften ───────────────────────────────
   *
   * §243 Beim ersten Lauf schlug das bei der Leitung zweimal an:
   *
   *     /admin/schedule → „Dienstplan anpassen" / „Dienstplan"
   *     /admin/urlaub   → „Alle" / „Urlaub prüfen"
   *
   * Beides ist KEIN Widerspruch, sondern die normale Bauform einer
   * Übersichtsseite: eine Kachel mit Namen und daneben ein Knopf, der dasselbe
   * öffnet. Meine Regel war zu grob — und eine Prüfung, die bei richtigem
   * Verhalten rot wird, liest nach dem dritten Mal niemand mehr.
   *
   * Gemeint war der Fall aus der Meldung: zwei GLEICHRANGIGE Einträge in einer
   * Liste, die verschiedene Dinge versprechen und am selben Ort landen. Darum
   * zwei Einschränkungen:
   *   — kurze Allerweltswörter („Alle", „Mehr", „Ansehen") sind keine
   *     Überschrift, sondern ein Knopf
   *   — enthält der eine Titel den anderen („Dienstplan" in „Dienstplan
   *     anpassen"), ist es dieselbe Sache, nur ausführlicher
   */
  const ALLERWELT = /^(alle|mehr|ansehen|öffnen|anzeigen|details|weiter|bearbeiten|zur übersicht)$/i

  const jeZiel = new Map()
  for (const v of verweise) {
    if (ALLERWELT.test(v.titel)) continue
    const liste = jeZiel.get(v.ziel) ?? new Set()
    liste.add(v.titel)
    jeZiel.set(v.ziel, liste)
  }
  const doppelt = [...jeZiel.entries()]
    .filter(([, titel]) => {
      const namen = [...titel].map(t => t.toLowerCase())
      // Enthält einer den anderen, ist es dieselbe Sache.
      return namen.some(a => namen.some(b => a !== b && !b.includes(a) && !a.includes(b)))
    })
    .map(([ziel, titel]) => `${ziel} → ${[...titel].join(' / ')}`)
  check(`${rolle.name}: kein Ziel mit zwei verschiedenen Überschriften`,
    doppelt.length === 0, doppelt.join('\n           '))
  if (doppelt.length > 0) befunde.push(...doppelt.map(d => `${rolle.name}: ${d}`))

  // ── Art 2: ein Weg, der ins Leere führt ─────────────────────────────────
  const ziele = [...new Set(verweise.map(v => v.ziel))]
    .filter(z => !NICHT_FOLGEN.some(m => m.test(z)))
  const kaputt = []
  for (const ziel of ziele) {
    const antwort = await seite.evaluate(async (pfad) => {
      const r = await fetch(pfad, { redirect: 'follow' })
      return { status: r.status, text: (await r.text()).slice(0, 4000) }
    }, ziel)
    const istLeer = antwort.status === 404
      || /Diese Seite gibt es nicht/i.test(antwort.text)
    if (istLeer) kaputt.push(`${ziel} (HTTP ${antwort.status})`)
  }
  check(`${rolle.name}: jeder Verweis führt auf eine Seite, die es gibt`,
    kaputt.length === 0, kaputt.join('\n           '))
  if (kaputt.length > 0) befunde.push(...kaputt.map(d => `${rolle.name}: ${d}`))
  /*
   * §243 Die Zusicherung, dass hier überhaupt gemessen wurde.
   *
   * Ohne sie wäre „keine Widersprüche" auch auf einer Seite grün, die nichts
   * geladen hat. Genau das ist beim ersten Lauf passiert: `/company` lieferte
   * null Ziele, und die Prüfung meldete fröhlich „alles in Ordnung".
   *
   * DIE GRENZE DIESER PRÜFUNG, AUSDRÜCKLICH
   * Die Unternehmensübersicht navigiert über `<button onClick={router.push}>`
   * statt über Verweise. Wohin ein solcher Knopf führt, steht nirgends im
   * Dokument — diese Prüfung kann es also nicht sehen und prüft dort nur, was
   * als Verweis da ist. (Nebenbei ist das auch für Menschen ein Nachteil: Ein
   * Knopf lässt sich nicht in einem neuen Reiter öffnen, zeigt sein Ziel nicht
   * beim Darüberfahren und wird Vorlesehilfen als Knopf angesagt. Das zu
   * ändern ist eine eigene Sache und gehört nicht in diese Prüfung.)
   *
   * Darum EINS statt vier: Es bleibt die Zusicherung, dass die Seite
   * aufgebaut ist — ohne so zu tun, als sähe sie mehr, als sie sieht.
   */
  check(`${rolle.name}: es wurden überhaupt Verweise gefunden`,
    ziele.length >= 1, `${ziele.length} Ziele`)

  await ctx.close()
}

// ── §243 Art 3: Überschrift gegen eigene Aufstellung ──────────────────────
console.log('\n=== §243 Das Stundenkonto gegen seine eigene Aufstellung ===')

{
  const { ctx, seite } = await sitzung('anna.fischer@rheinblick-reha.de')

  await seite.goto(`${BASIS}/employee/time-tracking`, { waitUntil: 'domcontentloaded' })
  await seite.waitForTimeout(4000)
  const zeitText = await seite.innerText('body')

  /** „105h 50min" oder „0h" → Minuten. */
  const alsMinuten = (text) => {
    const m = text.match(/(\d+)\s*h(?:\s*(\d+)\s*min)?/)
    return m ? Number(m[1]) * 60 + Number(m[2] ?? 0) : null
  }
  const nachLabel = (text, label) => {
    const m = text.match(new RegExp(`${label}\\s*\\n?\\s*([0-9]+\\s*h[^\\n]*)`, 'i'))
    return m ? alsMinuten(m[1]) : null
  }

  const soll = nachLabel(zeitText, 'Soll')
  const ist = nachLabel(zeitText, 'Ist')
  const minus = nachLabel(zeitText, 'Minusstunden')
  const plus = nachLabel(zeitText, 'Überstunden')

  check('Die Zeiterfassung nennt Soll und Ist', soll !== null && ist !== null,
    `Soll ${soll} · Ist ${ist} Minuten`)
  /*
   * Die Aufstellung muss in sich aufgehen. Ohne diese Zeile wäre „kein
   * Widerspruch" auch dann grün, wenn die vier Zahlen gar nichts miteinander
   * zu tun hätten.
   */
  if (soll !== null && ist !== null && minus !== null) {
    check('Und die Minusstunden sind genau die Lücke dazwischen',
      minus === Math.max(0, soll - ist),
      `${soll} − ${ist} = ${Math.max(0, soll - ist)}, angezeigt ${minus}`)
  }

  /*
   * §243 Der gemeldete Widerspruch: oben „Stundenkonto +0:00", hier 105
   * Minusstunden. Jetzt steht die laufende Zahl BENANNT auf der Startseite —
   * und sie muss zu dem passen, was die Zeiterfassung ausweist.
   */
  await seite.goto(`${BASIS}/employee/ich`, { waitUntil: 'domcontentloaded' })
  await seite.waitForTimeout(4000)
  const laufendFeld = seite.locator('[data-test="laufender-monat"]')
  const hatLaufend = await laufendFeld.count() > 0
  const erwartet = soll !== null && ist !== null && plus !== null
    ? ist + plus - soll : null

  if (erwartet !== null && erwartet !== 0) {
    check('Die Startseite nennt den laufenden Monat eigens',
      hatLaufend, hatLaufend ? '' : 'kein Feld gefunden')
    if (hatLaufend) {
      const roh = (await laufendFeld.first().textContent() ?? '').trim()
      const vorzeichen = roh.startsWith('−') || roh.startsWith('-') ? -1 : 1
      const betrag = roh.match(/(\d+):(\d{2})/)
      const gezeigt = betrag
        ? vorzeichen * (Number(betrag[1]) * 60 + Number(betrag[2])) : null
      check('Und zwar mit derselben Zahl wie die Zeiterfassung',
        gezeigt === erwartet, `Startseite ${gezeigt} · Zeiterfassung ${erwartet} Minuten`)
    }
  } else {
    check('Ohne Abweichung steht auch keine zweite Zahl da', !hatLaufend,
      `erwartet ${erwartet}, Feld da: ${hatLaufend}`)
  }

  await ctx.close()
}

// ── §243 Die Gegenprobe: findet diese Prüfung überhaupt etwas? ────────────
console.log('\n=== §243 Gegenprobe — die Suche schlägt an ===')

{
  const ctx = await browser.newContext()
  const seite = await ctx.newPage()
  await seite.setContent(`
    <a href="/a">Erster Name</a>
    <a href="/a">Zweiter Name</a>
    <a href="/b">Eindeutig</a>
  `)
  const verweise = await seite.evaluate(() =>
    Array.from(document.querySelectorAll('a[href^="/"]'))
      .map(a => ({ ziel: a.getAttribute('href'), titel: (a.textContent ?? '').trim() })))
  const jeZiel = new Map()
  for (const v of verweise) {
    const liste = jeZiel.get(v.ziel) ?? new Set()
    liste.add(v.titel)
    jeZiel.set(v.ziel, liste)
  }
  const doppelt = [...jeZiel.entries()].filter(([, t]) => t.size > 1)
  check('Zwei Überschriften auf ein Ziel werden erkannt', doppelt.length === 1,
    JSON.stringify(doppelt.map(([z]) => z)))
  check('Und ein eindeutiges Ziel schlägt nicht an',
    !doppelt.some(([z]) => z === '/b'), '')
  await ctx.close()
}

if (befunde.length > 0) {
  console.log('\n── Befunde ──────────────────────────────────────────────')
  for (const b of befunde) console.log(`  ${b}`)
}

console.log(`\n${ok}/${ok + fail} Checks bestanden`)
await browser.close()
process.exit(fail > 0 ? 1 : 0)
