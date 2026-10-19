// Nachweis (Browser): Regelpaket und Freischaltung je Standort, unter Kunden.
//
//     node --env-file=.env pruefungen/browser/dienstplanung-am-standort.mjs
//
// §200 Die Zuweisung lag auf einer eigenen Seite `/okun/dienstplanung`, die
// alle Standorte aller Kunden untereinander zeigte. Sie sitzt jetzt unter
// Kunden → Kunde → Standort. Diese Prüfung zeigt, dass sie dort bedienbar ist
// und dass sie wirklich JE STANDORT wirkt — ein Kunde mit zwei Standorten
// darf beim Zuweisen am einen den anderen nicht mitnehmen. Das ist die
// Gegenprobe: Ohne sie wäre eine Bedienung, die versehentlich alle Standorte
// eines Kunden ändert, genauso grün.
//
// Es gibt in den Testdaten keinen Kunden mit zwei Standorten. Die Prüfung
// legt sich deshalb einen zweiten an und räumt ihn am Ende wieder weg; den
// ersten setzt sie vorher auf „gesperrt, ohne Paket" und danach zurück.
// Sie spricht Prisma direkt an und braucht deshalb `--env-file=.env`.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { PrismaClient } from '@prisma/client'

const BASIS = 'http://localhost:3000'
let ok = 0, fail = 0
const check = (name, wahr, info = '') => {
  console.log(`  ${wahr ? '✓ PASS' : '✗ FAIL'}  ${name}${info ? `\n           ${info}` : ''}`)
  wahr ? ok++ : fail++
}

const prisma = new PrismaClient()
const MARKE = Date.now().toString(36)

const kunde = await prisma.customer.findFirst({ where: { name: 'Reha-Zentrum Köln GmbH' } })
const standortA = kunde && await prisma.location.findFirst({ where: { customerId: kunde.id, active: true } })
if (!kunde || !standortA) {
  console.log('  ✗ FAIL  Testdaten fehlen (Reha-Zentrum Köln) — erst `npm run seed`')
  process.exit(1)
}
const vorher = {
  rulePackId: standortA.rulePackId, dienstplanungFrei: standortA.dienstplanungFrei,
  dienstplanungFreiSeit: standortA.dienstplanungFreiSeit, dienstplanungFreiVon: standortA.dienstplanungFreiVon,
}

// Ausgangszustand selbst herstellen
await prisma.location.update({
  where: { id: standortA.id },
  data: { rulePackId: null, dienstplanungFrei: false },
})
const standortB = await prisma.location.create({
  data: {
    customerId: kunde.id, name: `Prüfstandort ${MARKE}`, address: 'Prüfweg 1',
    city: 'Köln', state: 'NW', adminId: standortA.adminId, dienstplanungFrei: false,
  },
})

const pakete = await (await fetch('http://127.0.0.1:8080/version')).json()
  .then(v => v.rulePacks ?? []).catch(() => [])
// Ein echtes Kundenpaket, keine Vorlage — die hätte einen eigenen Hinweis.
const paket = pakete.find(p => !p.muster)
if (!paket) {
  console.log('  ✗ FAIL  Der Rechendienst meldet kein Regelpaket — läuft er auf 8080?')
  await aufraeumen(); process.exit(1)
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})

async function anmelden(email) {
  const ctx = await browser.newContext()
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

async function aufraeumen() {
  await prisma.location.delete({ where: { id: standortB.id } }).catch(() => {})
  await prisma.location.update({ where: { id: standortA.id }, data: vorher })
}

// Auf die Antwort des Servers warten, nicht auf eine feste Zeit — und sie
// zurückgeben, damit ein Fehlschlag seinen Grund nennt.
async function nachAenderung(seite, handlung) {
  const [antwort] = await Promise.all([
    seite.waitForResponse(r => r.url().endsWith('/api/okun/dienstplanung') && r.request().method() === 'PATCH'),
    handlung(),
  ])
  const text = `${antwort.status()} ${await antwort.text()}`
  await seite.waitForResponse(r => r.url().endsWith('/api/okun/dienstplanung') && r.request().method() === 'GET')
    .catch(() => {})
  await seite.waitForTimeout(300)
  return text
}

const stand = id => prisma.location.findUnique({
  where: { id }, select: { rulePackId: true, dienstplanungFrei: true },
})

try {
  console.log('=== Unter Kunden, als OKUN ===')
  const { ctx, seite } = await anmelden('okun@okun.de')
  await seite.goto(`${BASIS}/okun/customers`)
  await seite.waitForLoadState('networkidle')

  const zeileA = seite.locator(`[data-standort="${standortA.id}"]`)
  const zeileB = seite.locator(`[data-standort="${standortB.id}"]`)

  await seite.click(`[data-kunde="${kunde.id}"]`)
  await zeileA.waitFor()
  check('Der Kunde klappt zu beiden Standorten auf',
    await zeileA.count() === 1 && await zeileB.count() === 1)

  const chipA = zeileA.locator('[data-test="dienstplanung-stand"]')
  check('Die zugeklappte Zeile zeigt den Stand der Dienstplanung',
    /kein Regelpaket/.test(await chipA.innerText()), await chipA.innerText())
  check('Vor dem Aufklappen ist die Einrichtung nicht zu sehen',
    await zeileA.locator('[data-test="standort-dienstplanung"]').count() === 0)

  await zeileA.locator('> div').first().click()
  const blockA = zeileA.locator('[data-test="standort-dienstplanung"]')
  await blockA.waitFor()
  check('Am aufgeklappten Standort steht die Einrichtung',
    /Regelpaket/i.test(await blockA.innerText()) && /Freischalten/.test(await blockA.innerText()))
  check('Und nur an diesem — der zweite Standort bleibt zu',
    await zeileB.locator('[data-test="standort-dienstplanung"]').count() === 0)

  console.log('\n=== Regelpaket zuweisen: wirkt je Standort ===')
  const antwort1 = await nachAenderung(seite, () => blockA.locator('select').first().selectOption(paket.id))
  const a1 = await stand(standortA.id), b1 = await stand(standortB.id)
  check(`Standort A hat das Paket „${paket.id}"`, a1.rulePackId === paket.id, `${JSON.stringify(a1)} · ${antwort1}`)
  check('Gegenprobe: Standort B desselben Kunden hat es NICHT', b1.rulePackId === null, JSON.stringify(b1))
  check('Die Zeile zeigt das neue Paket',
    (await chipA.innerText()).includes(paket.kunde ?? paket.id), await chipA.innerText())

  console.log('\n=== Freischalten: wirkt je Standort ===')
  await nachAenderung(seite, () => blockA.getByRole('button', { name: /Freischalten/ }).click())
  const a2 = await stand(standortA.id), b2 = await stand(standortB.id)
  check('Standort A ist freigeschaltet', a2.dienstplanungFrei === true)
  check('Gegenprobe: Standort B bleibt gesperrt', b2.dienstplanungFrei === false)
  check('Der Knopf heißt jetzt „Sperren"',
    await blockA.getByRole('button', { name: /Sperren/ }).count() === 1)

  console.log('\n=== Der stille Fall fällt schon zugeklappt auf ===')
  await zeileB.locator('> div').first().click()
  const blockB = zeileB.locator('[data-test="standort-dienstplanung"]')
  await blockB.waitFor()
  await nachAenderung(seite, () => blockB.getByRole('button', { name: /Freischalten/ }).click())
  const chipB = zeileB.locator('[data-test="dienstplanung-stand"]')
  check('Freigeschaltet ohne Paket: die Zeile warnt',
    /Freigeschaltet ohne Regelpaket/.test(await chipB.getAttribute('title') ?? ''),
    await chipB.getAttribute('title') ?? '')
  check('Gegenprobe: die Zeile mit Paket warnt nicht',
    !/ohne Regelpaket|fehlt/.test(await chipA.getAttribute('title') ?? ''),
    await chipA.getAttribute('title') ?? '')
  check('Im Block steht die ausführliche Warnung',
    /Freigeschaltet, aber ohne Regelpaket/.test(await blockB.innerText()))

  console.log('\n=== Die alte Seite ===')
  await seite.goto(`${BASIS}/okun/dienstplanung`)
  await seite.waitForLoadState('networkidle')
  check('/okun/dienstplanung leitet zu den Kunden weiter',
    new URL(seite.url()).pathname === '/okun/customers', seite.url())
  // Das Verwaltungsmenü zeichnet seine Links erst beim Öffnen. Ohne Öffnen
  // wäre „kein Link da" immer wahr — die Gegenprobe ist der Nachbarlink.
  await seite.getByRole('button', { name: 'Verwaltung' }).first().click()
  await seite.locator('[data-megapanel]').waitFor({ state: 'attached' })
  check('Gegenprobe: das geöffnete Verwaltungsmenü zeigt seine Links',
    await seite.locator('[data-megapanel] a[href="/okun/test-accounts"]').count() === 1)
  check('Das Menü verweist nicht mehr auf die alte Seite',
    await seite.locator('a[href="/okun/dienstplanung"]').count() === 0)
  await ctx.close()

  console.log('\n=== Gegenprobe: das Unternehmen kommt nicht heran ===')
  const { ctx: c2, seite: gf } = await anmelden('gf@rheinblick-reha.de')
  await gf.goto(`${BASIS}/okun/customers`)
  await gf.waitForTimeout(3000)
  check('Keine Einrichtung der Dienstplanung für die Geschäftsführung',
    await gf.locator('[data-test="standort-dienstplanung"]').count() === 0
      && new URL(gf.url()).pathname !== '/okun/customers', gf.url())
  // §200 Beim Bauen gefunden: Vorher stürzte die Seite für eine fremde Rolle
  // ab, und die Fehlerseite verdrängte die Umleitung.
  check('Sie landet auf ihrer eigenen Übersicht, nicht auf der Fehlerseite',
    new URL(gf.url()).pathname === '/company'
      && !/Etwas ist schiefgelaufen/.test(await gf.locator('body').innerText()), gf.url())
  await c2.close()
} finally {
  await browser.close()
  await aufraeumen()
  const zurueck = await stand(standortA.id)
  check('Aufgeräumt: Standort A wie vorher, Prüfstandort entfernt',
    zurueck.rulePackId === vorher.rulePackId && zurueck.dienstplanungFrei === vorher.dienstplanungFrei
      && !(await prisma.location.findUnique({ where: { id: standortB.id } })))
  await prisma.$disconnect()
}

console.log(`\n${ok} bestanden, ${fail} fehlgeschlagen`)
process.exit(fail > 0 ? 1 : 0)
