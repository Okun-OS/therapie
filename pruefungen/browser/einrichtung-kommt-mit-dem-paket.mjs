// Nachweis (Browser) §201: Der Standort richtet nichts mehr selbst ein —
// die Einrichtung kommt mit dem Regelpaket.
//
//     node --env-file=.env pruefungen/browser/einrichtung-kommt-mit-dem-paket.mjs
//
// Der Fall, um den es geht, ist die Kita „Krümelkiste": Paket zugewiesen,
// bevor es Dienstzeiten mitbrachte — und auf dem Dienstplan stand „Noch keine
// Dienstzeiten … Zu den Dienstzeiten". Diese Prüfung baut genau das nach (ein
// Standort mit Paket, ohne Dienste, mit eigener Leitung), öffnet den
// Dienstplan als diese Leitung und sieht nach, ob die Dienste da sind.
//
// Gegenprobe: dieselbe Lage mit der Vorlage, die keine Dienstzeiten
// mitbringt. Dort MUSS der Hinweis stehen — sonst bewiese sein Fehlen beim
// Kita-Paket nur, dass der Hinweis kaputt ist. Und er darf in keine
// Einrichtung mehr schicken.
//
// Sie spricht Prisma direkt an (Standort und Leitung anlegen, wegräumen).

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const BASIS = 'http://localhost:3000'
let ok = 0, fail = 0
const check = (name, wahr, info = '') => {
  console.log(`  ${wahr ? '✓ PASS' : '✗ FAIL'}  ${name}${info ? `\n           ${info}` : ''}`)
  wahr ? ok++ : fail++
}

const prisma = new PrismaClient()
const MARKE = Date.now().toString(36)
const KUNDE = 'seed-kunde-reha'
const angelegt = { standorte: [], konten: [] }

async function standortMitLeitung(name, rulePackId) {
  const mail = `leitung-${name.toLowerCase()}-${MARKE}@pruefung.test`
  const konto = await prisma.user.create({
    data: {
      email: mail, passwordHash: await bcrypt.hash('Test1234!', 10), name: `Leitung ${name}`,
      role: 'admin', customerId: KUNDE,
    },
  })
  const standort = await prisma.location.create({
    data: {
      customerId: KUNDE, name: `§201 ${name} ${MARKE}`, address: 'Prüfweg 1', city: 'Köln', state: 'NW',
      adminId: konto.id, rulePackId, dienstplanungFrei: true,
    },
  })
  await prisma.user.update({ where: { id: konto.id }, data: { locationId: standort.id } })
  angelegt.standorte.push(standort.id); angelegt.konten.push(konto.id)
  return { standort, mail }
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })

async function anmelden(email) {
  const ctx = await browser.newContext()
  await ctx.addInitScript(() => {
    for (const r of ['employee', 'admin', 'company', 'okun']) localStorage.setItem(`okun_tour_done_v6:${r}`, '1')
  })
  const seite = await ctx.newPage()
  await seite.goto(`${BASIS}/login`)
  await seite.fill('input[type="email"]', email)
  await seite.fill('input[type="password"]', 'Test1234!')
  await seite.click('button[type="submit"]')
  await seite.waitForTimeout(5000)
  return { ctx, seite }
}

try {
  console.log('=== Paket vor §201 zugewiesen, keine Dienstzeiten ===')
  const kita = await standortMitLeitung('Kita', 'kita_zwei_etagen')
  check('Ausgangslage: keine Dienstzeiten', await prisma.shift.count({ where: { locationId: kita.standort.id } }) === 0)
  const { ctx, seite } = await anmelden(kita.mail)
  await seite.goto(`${BASIS}/admin/schedule`)
  await seite.waitForLoadState('networkidle')
  await seite.waitForTimeout(2500)
  const dienste = await prisma.shift.count({ where: { locationId: kita.standort.id } })
  check('Beim Öffnen des Dienstplans sind die Dienstzeiten da', dienste === 12, `${dienste} Dienstzeiten`)
  const einheiten = await prisma.planningUnit.count({ where: { locationId: kita.standort.id } })
  check('Etagen und Gruppen sind da', einheiten === 10, `${einheiten} Einheiten`)
  check('Kein Hinweis „keine Dienstzeiten"', await seite.locator('[data-test="keine-dienstzeiten"]').count() === 0)
  check('Der Knopf zum Planen ist da', await seite.getByText('KI-Dienstplan erstellen').count() > 0)

  console.log('\n=== Was der Standort nicht mehr selbst einrichtet ===')
  check('Kein „Regeln"-Knopf mehr im Dienstplan',
    await seite.getByRole('button', { name: 'Regeln', exact: true }).count() === 0)
  await seite.getByRole('button', { name: 'Gruppen', exact: true }).click()
  const gruppen = seite.locator('[data-test="gruppen-im-alltag"]')
  await gruppen.waitFor()
  check('Stattdessen „Gruppen": Eingewöhnung und unterwegs', /Eingewöhnung/.test(await gruppen.innerText())
    && /Unterwegs/.test(await gruppen.innerText()) && /Gruppe 1/.test(await gruppen.innerText()))
  const erste = gruppen.locator('input[type="date"]').first()
  await Promise.all([
    seite.waitForResponse(r => r.url().endsWith('/api/planning-units') && r.request().method() === 'PUT'),
    erste.fill('2026-12-01'),
  ])
  await seite.waitForTimeout(400)
  const g1 = await prisma.planningUnit.findFirst({ where: { locationId: kita.standort.id, name: 'Gruppe 1' } })
  check('Die Eingewöhnung wird gespeichert', g1?.abgabeGesperrtBis === '2026-12-01', g1?.abgabeGesperrtBis ?? 'leer')
  await seite.keyboard.press('Escape')

  for (const alt of ['/admin/setup', '/admin/model', '/admin/onboarding']) {
    await seite.goto(`${BASIS}${alt}`)
    await seite.waitForLoadState('networkidle')
    check(`${alt} leitet in den Dienstplan`, new URL(seite.url()).pathname === '/admin/schedule', seite.url())
  }
  await seite.getByRole('button', { name: 'Einstellungen' }).first().click()
  await seite.locator('[data-megapanel]').waitFor({ state: 'attached' })
  const menue = seite.locator('[data-megapanel]')
  check('Gegenprobe: das Einstellungsmenü ist offen', await menue.locator('a[href="/admin/nachweise"]').count() === 1)
  check('„Einrichtung" steht nicht mehr darin', await menue.locator('a[href="/admin/setup"]').count() === 0)
  check('„Regeln & Wartung" auch nicht', await menue.locator('a[href="/admin/model"]').count() === 0)
  await ctx.close()

  console.log('\n=== Gegenprobe: ein Paket ohne Dienstzeiten ===')
  const vorlage = await standortMitLeitung('Vorlage', 'muster_pflege')
  const { ctx: c2, seite: s2 } = await anmelden(vorlage.mail)
  await s2.goto(`${BASIS}/admin/schedule`)
  await s2.waitForLoadState('networkidle')
  await s2.waitForTimeout(2500)
  const hinweis = s2.locator('[data-test="keine-dienstzeiten"]')
  check('Hier steht der Hinweis', await hinweis.count() === 1)
  const text = await hinweis.innerText().catch(() => '')
  check('Er nennt Regelpaket und OKUN', /Regelpaket/.test(text) && /OKUN/.test(text), text.slice(0, 120))
  check('…und schickt in keine Einrichtung', !/Onboarding|Zu den Dienstzeiten/.test(text))
  await c2.close()
} finally {
  await browser.close()
  for (const id of angelegt.standorte) {
    await prisma.shift.deleteMany({ where: { locationId: id } })
    await prisma.planningUnit.deleteMany({ where: { locationId: id } })
    await prisma.locationRuleModelRecord.deleteMany({ where: { locationId: id } })
    await prisma.locationPlanningRules.deleteMany({ where: { locationId: id } })
    await prisma.location.delete({ where: { id } }).catch(() => {})
  }
  for (const id of angelegt.konten) await prisma.user.delete({ where: { id } }).catch(() => {})
  await prisma.$disconnect()
}

console.log(`\n${ok} bestanden, ${fail} fehlgeschlagen`)
process.exit(fail > 0 ? 1 : 0)
