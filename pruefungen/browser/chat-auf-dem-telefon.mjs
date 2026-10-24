// Nachweis (Browser) §223: Ein Gespräch ist auf dem Telefon eine eigene Seite.
//
//     node pruefungen/browser/chat-auf-dem-telefon.mjs
//
// DIE MELDUNG
// „Wenn ich auf einer Übersicht von allen Chats bin und auf den Chat
// raufgehe, bin ich nur auf dem Chat — dann sehe ich die anderen Chats nicht
// mehr. Sonst ist es so unaufgeräumt. Und dann scroll ich nach oben, dann bin
// ich wieder bei den ganz vielen Chats, dann bin ich wieder bei dem Chat, wo
// ich gerade schreibe. Das ist alles so unübersichtlich."
//
// WAS SCHULD WAR, UND ES WAR NICHT NUR DIE AUFTEILUNG
// Erstens standen Liste und Verlauf untereinander — auf einem Bildschirm mit
// Platz ist das eine Übersicht, auf einem Telefon ein Durcheinander.
//
// Zweitens, und das war der eigentliche Grund für das Rutschen: Das Gerüst
// hält unter jeder Seite 176 px für die schwebende Leiste frei, obwohl die
// Leiste nur rund 90 px hoch ist. Auf dem Telefon war damit mehr Seite da als
// Bildschirm — und beim Wischen ging das ganze Gespräch mit.
//
// WAS DIESE PRÜFUNG MISST
// Nicht „sieht aufgeräumt aus" — das kann sie nicht. Sie prüft, ob die Liste
// verschwindet, ob es zurückgeht, und sie rechnet nach, ob die Seite
// überhaupt noch scrollbar ist. Das ist die Beschwerde, übersetzt in Zahlen.

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'
let ok = 0, fail = 0
const check = (name, wahr, info = '') => {
  console.log(`  ${wahr ? '✓ PASS' : '✗ FAIL'}  ${name}${info ? `\n           ${info}` : ''}`)
  wahr ? ok++ : fail++
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})

async function anmelden(geraet) {
  const ctx = await browser.newContext(geraet)
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
  await seite.waitForTimeout(4500)
  await seite.goto(`${BASIS}/employee/nachrichten`)
  await seite.waitForTimeout(3000)
  return seite
}

// ── Auf dem Telefon ────────────────────────────────────────────────────────
console.log('\n=== §223 Auf dem Telefon ===')

const telefon = await anmelden({ ...devices['iPhone 13'] })

const listeVorher = await telefon.innerText('body')
check('Die Übersicht zeigt die Gespräche', /OKUN Assistent/.test(listeVorher))
check('Und die Kopfzeile der Seite', /Schreiben Sie Kolleginnen/.test(listeVorher))

await telefon.locator('button').filter({ hasText: 'OKUN Assistent' }).first().click()
await telefon.waitForTimeout(2500)

const offenText = await telefon.innerText('body')
check('Im Gespräch ist die Liste weg', !/Neue Nachricht/.test(offenText))
check('Und die Kopfzeile der Seite auch', !/Schreiben Sie Kolleginnen/.test(offenText))
check('Dafür gibt es einen Weg zurück',
  await telefon.locator('button[aria-label="Zurück zur Übersicht"]').count() === 1)

/*
 * Der Kern: Die Seite darf sich nicht mehr bewegen.
 *
 * Gemessen wird beides — wie viel Seite über den Bildschirm hinausragt, und
 * was ein tatsächlicher Scrollversuch bewirkt. Die erste Zahl allein wäre zu
 * wenig: Eine gesperrte Seite kann trotzdem zu hoch sein.
 */
const mass = await telefon.evaluate(() => {
  window.scrollTo({ top: 600 })
  const karte = document.querySelector('[class*="h-[calc(100dvh"]')?.getBoundingClientRect()
  const leiste = document.querySelector('[data-tour="dock-bar"]')?.getBoundingClientRect()
  return {
    ueberhang: document.body.scrollHeight - window.innerHeight,
    nachScrollversuch: window.scrollY,
    karteUnten: karte ? Math.round(karte.bottom) : null,
    leisteOben: leiste ? Math.round(leiste.top) : null,
  }
})

check('Die Seite ragt nicht über den Bildschirm hinaus', mass.ueberhang === 0,
  `${mass.ueberhang} px Überhang`)
check('Und ein Wischen verschiebt sie nicht', mass.nachScrollversuch === 0,
  `nach dem Versuch bei ${mass.nachScrollversuch} px`)
check('Der Verlauf endet über der schwebenden Leiste',
  mass.karteUnten !== null && mass.leisteOben !== null
    && mass.karteUnten <= mass.leisteOben,
  `Verlauf bis ${mass.karteUnten} px, Leiste ab ${mass.leisteOben} px`)

await telefon.locator('button[aria-label="Zurück zur Übersicht"]').click()
await telefon.waitForTimeout(1500)
check('Zurück führt wieder zur Übersicht',
  /Neue Nachricht/.test(await telefon.innerText('body')))

// ── Gegenprobe am Schreibtisch ─────────────────────────────────────────────
console.log('\n=== §223 Gegenprobe: am Schreibtisch bleibt beides stehen ===')

/*
 * Ohne diese Gegenprobe wäre „die Liste ist weg" auch dann grün, wenn sie
 * überall verschwände — und am Schreibtisch ist das Nebeneinander kein
 * Durcheinander, sondern der Grund, warum man dort schneller arbeitet.
 */
const schreibtisch = await anmelden({ viewport: { width: 1440, height: 900 } })
await schreibtisch.locator('button').filter({ hasText: 'OKUN Assistent' }).first().click()
await schreibtisch.waitForTimeout(2500)

const breitText = await schreibtisch.innerText('body')
check('Am Schreibtisch steht die Liste weiter daneben', /Neue Nachricht/.test(breitText))
check('Und die Kopfzeile bleibt', /Schreiben Sie Kolleginnen/.test(breitText))
check('Einen Zurück-Pfeil braucht es dort nicht',
  await schreibtisch.locator('button[aria-label="Zurück zur Übersicht"]:visible').count() === 0)

console.log(`\n${ok}/${ok + fail} Checks bestanden`)
await browser.close()
process.exit(fail > 0 ? 1 : 0)
