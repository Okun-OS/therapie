// Nachweis (Browser) §222: Wegwischen in der Glocke, Löschen im Gespräch —
// auf dem Telefon, wo die schwebende Leiste steht.
//
//     node pruefungen/browser/wegwischen-und-loeschen.mjs
//
// DREI MELDUNGEN AUS DEM BETRIEB, ALLE AM SELBEN ABEND
//
//   1. „Bei der Glocke kann ich die Nachrichten immer noch nicht wegwischen."
//      Es gibt ZWEI Glocken — eine in der Kopfzeile (`Header.tsx`) und eine
//      in der Leiste (`CommandRail.tsx`). §220 hat nur die erste bekommen,
//      und auf dem Telefon ist genau die andere zu sehen.
//
//   2. „Den ganzen Chat kann man immer noch nicht löschen."
//      Der Knopf lag in der Verwalten-Maske — und die gibt es nur für
//      Gruppen. In einem Gespräch zu zweit führte kein Weg dorthin.
//
//   3. „Hier überschneidet sich sowas, sieht auch nicht gut aus."
//      Die Rückfrage war ein eigenes `fixed inset-0`; auf dem Telefon lag
//      ihr Knopf unter der schwebenden Leiste.
//
// WAS DIESE PRÜFUNG WIRKLICH PRÜFT
// Nicht „sieht gut aus" — das kann sie nicht. Sie prüft, ob die Knöpfe DA
// sind, ob ein Klick wirklich etwas entfernt, und ob der Knopf der Rückfrage
// frei liegt: Sie rechnet nach, ob sich sein Rechteck mit dem der Leiste
// überschneidet. Das ist die Beschwerde, übersetzt in eine Zahl.

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { login, hole, sende } from '../helfer.mjs'

const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'
let ok = 0, fail = 0
const check = (name, wahr, info = '') => {
  console.log(`  ${wahr ? '✓ PASS' : '✗ FAIL'}  ${name}${info ? `\n           ${info}` : ''}`)
  wahr ? ok++ : fail++
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})
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
await seite.waitForTimeout(5000)

// ── Die Glocke ─────────────────────────────────────────────────────────────
console.log('\n=== §222 Wegwischen in der Glocke ===')

/*
 * Der Ausgangszustand, den diese Prüfung selbst herstellt.
 *
 * Ein leeres Postfach hat keine Knöpfe — und dann wäre „kein Knopf gefunden"
 * grün wie rot und bewiese nichts. Beim ersten Versuch ist genau das
 * passiert: Eine andere Prüfung hatte vorher aufgeräumt.
 */
const leitung = await login('leitung@rheinblick-reha.de')
const anna = await login('anna.fischer@rheinblick-reha.de')
const annaId = (await hole(anna, '/api/auth/me')).body.user.employeeId
for (const n of [1, 2]) {
  await sende(leitung, '/api/notifications/broadcast', 'POST', {
    employeeIds: [annaId], type: 'info',
    title: `Nachweis §222 (${n})`, body: 'Diese Nachricht wird weggewischt.',
  })
}

await seite.goto(`${BASIS}/employee`)
await seite.waitForTimeout(2500)

const glocke = seite.locator('button[aria-label="Benachrichtigungen"], button:has(svg.lucide-bell)').first()
await glocke.click().catch(() => undefined)
await seite.waitForTimeout(1200)

const wegKnoepfe = seite.locator('button[aria-label="Benachrichtigung entfernen"]')
const vorher = await wegKnoepfe.count()
check('Jede Benachrichtigung hat einen Knopf zum Wegwischen', vorher > 0,
  `${vorher} Knöpfe gefunden`)

if (vorher > 0) {
  await wegKnoepfe.first().click()
  await seite.waitForTimeout(900)
  const nachher = await seite.locator('button[aria-label="Benachrichtigung entfernen"]').count()
  check('Ein Klick entfernt sie wirklich', nachher === vorher - 1,
    `${vorher} → ${nachher}`)
}

const sammel = await seite.getByRole('button', { name: /Alle gelesen|Gelesene aufräumen/ }).count()
check('Und es gibt den Weg für alle auf einmal', sammel > 0, `${sammel} Sammelknöpfe`)

// ── Das Gespräch ───────────────────────────────────────────────────────────
console.log('\n=== §222 Löschen im Gespräch ===')

await seite.goto(`${BASIS}/employee/nachrichten`)
await seite.waitForTimeout(3000)

/*
 * Ein Gespräch ZU ZWEIT öffnen, und zwar ausdrücklich.
 *
 * Für Gruppen gab es den Weg zum Löschen schon (über die Verwalten-Maske) —
 * gefehlt hat er genau hier. Eine Prüfung, die irgendein Gespräch nimmt,
 * könnte zufällig eine Gruppe erwischen und wäre dann grün, ohne das
 * Gemeldete berührt zu haben.
 */
const gespraech = seite.locator('button').filter({ hasText: 'Thomas Weber' }).first()
check('Ein Gespräch zu zweit steht in der Liste', await gespraech.count() > 0)
await gespraech.click().catch(() => undefined)
await seite.waitForTimeout(2000)
check('Es ist ein Gespräch zu zweit',
  (await seite.innerText('body')).includes('Nur Sie beide'))

const loeschKopf = seite.locator('button[aria-label="Gespräch bei mir löschen"]')
check('Auch ein Gespräch zu zweit hat den Löschknopf im Kopf',
  await loeschKopf.count() > 0, `${await loeschKopf.count()} gefunden`)

if (await loeschKopf.count() > 0) {
  await loeschKopf.first().click()
  await seite.waitForTimeout(1200)

  const knopf = seite.getByRole('button', { name: /^Löschen$/ }).first()
  check('Die Rückfrage steht da', await knopf.count() > 0)

  if (await knopf.count() > 0) {
    /*
     * Der Kern dieser Prüfung: Liegt der Knopf frei?
     *
     * Gemessen wird die Überschneidung seines Rechtecks mit dem der
     * schwebenden Leiste. Ein Knopf, den die Leiste zur Hälfte verdeckt, ist
     * kein Knopf — und genau so sah es auf dem Bildschirm aus.
     */
    const kasten = await knopf.boundingBox()
    // Die Leiste wird über dieselbe Kennung gefunden wie in
    // `dock-ohne-maus.mjs` — eine zweite Schreibweise wäre eine zweite
    // Gelegenheit, am falschen Element zu messen.
    const leisteEl = seite.locator('[data-tour="dock-bar"]').first()
    const leiste = await leisteEl.count() > 0 ? await leisteEl.boundingBox() : null
    const ueberschneidung = (!kasten || !leiste) ? 0
      : Math.max(0, Math.min(kasten.y + kasten.height, leiste.y + leiste.height)
        - Math.max(kasten.y, leiste.y))
      * Math.max(0, Math.min(kasten.x + kasten.width, leiste.x + leiste.width)
        - Math.max(kasten.x, leiste.x))

    check('Und ihr Knopf liegt frei, nicht unter der Leiste',
      ueberschneidung === 0,
      leiste
        ? `Überschneidung ${Math.round(ueberschneidung)} px²`
        : 'Die Leiste nimmt sich zurück, solange die Rückfrage offen ist')

    const sichtbar = await knopf.isVisible()
    check('Er ist anklickbar', sichtbar)
  }
}

console.log(`\n${ok}/${ok + fail} Checks bestanden`)
await browser.close()
process.exit(fail > 0 ? 1 : 0)
