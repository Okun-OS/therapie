// Nachweis (Browser) §235: Beide Kacheln zeigen denselben Resturlaub.
//
//     node pruefungen/browser/urlaubstage-stimmen-ueberein.mjs
//
// DIE MELDUNG
// „Bei Bild 1 und 2 stimmen die Urlaubstage nicht überein. Bei dem einen steht
// die eine Zahl, bei dem anderen die andere. Das ist sehr schlecht."
//
// Nachgemessen bei Juliane Saul:
//
//     Urlaubsseite  „Resturlaub 2026: 12 von 30 Tagen"
//     Profilseite   „16 Resturlaub"
//
// Beide rechneten für sich richtig. Die Urlaubsseite zog die offenen Anträge
// ab (30 − 14 − 4 = 12), das Profil nicht (30 − 14 = 16). Dieselbe
// Überschrift, zwei Zahlen, und der Unterschied waren genau die vier Tage,
// über die noch niemand entschieden hatte.
//
// WAS DIESE PRÜFUNG MISST
// Nicht, ob eine der Zahlen „richtig" ist — das war keine von beiden allein.
// Sie liest BEIDE Kacheln und vergleicht sie. Mit Gegenprobe: Ein offener
// Antrag muss die Zahl überhaupt bewegen, sonst wäre „gleich" auch dann grün,
// wenn beide Seiten dieselbe falsche Zahl zeigten.

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { login, hole, sende } from '../helfer.mjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'
let ok = 0, fail = 0
const check = (name, wahr, info = '') => {
  console.log(`  ${wahr ? '✓ PASS' : '✗ FAIL'}  ${name}${info ? `\n           ${info}` : ''}`)
  wahr ? ok++ : fail++
}

// ── Der Ausgangszustand, den diese Prüfung selbst herstellt ────────────────
const anna = await login('anna.fischer@rheinblick-reha.de')
const leitung = await login('leitung@rheinblick-reha.de')
const me = (await hole(anna, '/api/auth/me')).body.user
const annaId = me.employeeId
const locationId = (await hole(leitung, '/api/auth/me')).body.user.locationId

const jahr = new Date().getFullYear() + 3   // weit weg von allen anderen Prüfungen
const von = `${jahr}-08-03`, bis = `${jahr}-08-07`

/*
 * Ohne eigenen Anspruch wäre die Rechnung nicht nachvollziehbar: 30 Tage,
 * 14 genommen — genau der gemeldete Fall.
 */
const vorher = await prisma.employee.findUnique({
  where: { id: annaId }, select: { vacationDaysTotal: true, vacationDaysUsed: true },
})
await prisma.employee.update({
  where: { id: annaId }, data: { vacationDaysTotal: 30, vacationDaysUsed: 14 },
})
await prisma.vacationRequest.deleteMany({
  where: { employeeId: annaId, startDate: { gte: `${jahr}-01-01` } },
})

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

/** Die große Zahl auf der Urlaubsseite. */
async function aufDerUrlaubsseite() {
  await seite.goto(`${BASIS}/employee/vacation`)
  await seite.waitForTimeout(3000)
  return seite.evaluate(() => {
    const text = document.body.innerText
    const treffer = text.match(/Resturlaub\s*\d{4}\s*(\d+)\s*von\s*(\d+)\s*Tagen/)
    return treffer ? { rest: Number(treffer[1]), gesamt: Number(treffer[2]) } : null
  })
}

/** Die Kachel „Resturlaub" im Profil. */
async function imProfil() {
  await seite.goto(`${BASIS}/employee/profile`)
  await seite.waitForTimeout(3000)
  // `textContent` ist eine Eigenschaft, kein Attribut — `getAttribute` gibt
  // dafür null zurück, und der Vergleich wäre still gescheitert.
  /*
   * Gewartet wird, bis die Kachel eine ZAHL zeigt.
   *
   * Sie steht auf einem Strich, solange die Anträge noch unterwegs sind —
   * absichtlich, damit niemand eine Zahl sieht, die sich gleich ändert
   * (§235). Ohne dieses Warten misst die Prüfung den Zwischenzustand: Auf
   * warmem Cache ging es gut, auf kaltem las sie „–" und meldete einen
   * Fehler, den es nicht gab.
   */
  const treffer = seite.locator('[data-test="resturlaub"]')
  for (let versuch = 0; versuch < 40; versuch++) {
    if (await treffer.count() > 0) {
      const wert = (await treffer.first().textContent())?.trim()
      if (wert && /^\d+$/.test(wert)) return Number(wert)
    }
    await seite.waitForTimeout(250)
  }
  return null
}

// ── §235 Ohne offenen Antrag ──────────────────────────────────────────────
console.log('\n=== §235 Ohne offenen Antrag ===')

const u1 = await aufDerUrlaubsseite()
const p1 = await imProfil()
check('Die Urlaubsseite nennt eine Zahl', u1 !== null, JSON.stringify(u1))
check('Das Profil auch', p1 !== null, `${p1}`)
check('Und beide sind gleich', u1?.rest === p1, `Urlaubsseite ${u1?.rest} · Profil ${p1}`)
check('Nämlich Anspruch minus genommen', u1?.rest === 16, `${u1?.rest} (30 − 14)`)

// ── §235 Mit offenem Antrag — der gemeldete Fall ──────────────────────────
console.log('\n=== §235 Mit offenem Antrag — der gemeldete Fall ===')

const antrag = await sende(anna, '/api/vacation-requests', 'POST', {
  employeeId: annaId, employeeName: me.name, locationId,
  startDate: von, endDate: bis, days: 4, reason: 'Nachweis §235',
})
check('Ein Antrag lässt sich stellen',
  antrag.status === 200 || antrag.status === 201,
  antrag.body.error ?? `${antrag.body.request?.days} Tage`)
/*
 * Wie viele Arbeitstage der Zeitraum hat, rechnet der Server — Wochenenden
 * und Feiertage zählen nicht mit. Die Prüfung nimmt diese Zahl und rechnet
 * nicht selbst nach: Sonst prüfte sie ihre eigene Annahme über den Kalender
 * und nicht die beiden Kacheln.
 */
const beantragt = antrag.body.request?.days ?? 0
check('Und der Server nennt die Zahl der Arbeitstage', beantragt > 0, `${beantragt} Tage`)

const u2 = await aufDerUrlaubsseite()
const p2 = await imProfil()

/*
 * Die Gegenprobe zuerst: Der Antrag MUSS die Zahl bewegen. Sonst wäre
 * „beide gleich" auch dann grün, wenn beide Seiten stur dieselbe falsche Zahl
 * zeigten — und genau so sah der Fehler vorher aus, nur andersherum.
 */
check('Der offene Antrag bewegt die Zahl', u2?.rest === (u1?.rest ?? 0) - beantragt,
  `${u1?.rest} → ${u2?.rest} bei ${beantragt} beantragten Tagen`)
check('Und beide Kacheln zeigen weiterhin dasselbe', u2?.rest === p2,
  `Urlaubsseite ${u2?.rest} · Profil ${p2}`)
check('Der Unterschied zu vorher sind genau die beantragten Tage',
  (u1?.rest ?? 0) - (u2?.rest ?? 0) === beantragt,
  `${(u1?.rest ?? 0) - (u2?.rest ?? 0)} von ${beantragt} Tagen`)

// ── Aufräumen ─────────────────────────────────────────────────────────────
await prisma.vacationRequest.deleteMany({
  where: { employeeId: annaId, startDate: { gte: `${jahr}-01-01` } },
})
await prisma.employee.update({
  where: { id: annaId },
  data: {
    vacationDaysTotal: vorher?.vacationDaysTotal ?? 30,
    vacationDaysUsed: vorher?.vacationDaysUsed ?? 0,
  },
})
await prisma.$disconnect()

console.log(`\n${ok}/${ok + fail} Checks bestanden`)
await browser.close()
process.exit(fail > 0 ? 1 : 0)
