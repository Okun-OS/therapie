// Nachweis (Browser) §231: Die Jahresplanung arbeitet mit den Anträgen.
//
//     node pruefungen/browser/urlaub-aus-antraegen.mjs
//
// DIE FRAGE UND DIE ENTSCHEIDUNG
// „Bei der Urlaubsplanung kann man angeben, in welchem Monat man gerne Urlaub
// haben möchte, aber nicht an welchem Tag. Ist es doppelt gemoppelt, wenn wir
// Urlaubsanträge haben und dann Wünsche für den Urlaub?" — und dann: „Ganz
// weg, denn dafür hat man ja die Anträge. Man könnte es so machen, dass
// anhand der Anträge der Urlaubsplan erstellt wird; man kann ja als Leitung
// eine Frist setzen zum Einreichen."
//
// WARUM DIE MONATE NICHT GENÜGTEN
// Sagen drei Leute „Juli", weiß die Leitung nicht, ob sie kollidieren — und
// genau das zu sehen ist der Zweck dieser Seite. Aus zwei Monatsangaben folgt
// keine Überschneidung, nur ein Verdacht. Aus zwei Datumsbereichen folgt eine
// Zahl. Dazu bewertete jede Person ihre eigenen Wünsche selbst; als Rangfolge
// bei Streit taugt das nicht.
//
// WAS DIESE PRÜFUNG MISST
// Dass die Anträge auf der Seite stehen, dass die Frist sich setzen und wieder
// lesen lässt, und dass eine echte Überschneidung als Engstelle erkannt wird —
// mit der Zahl, die sie ausmacht. Mit Gegenprobe: Ohne Überschneidung darf
// keine Engstelle dastehen.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
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
const leitung = await login('leitung@rheinblick-reha.de')
const me = (await hole(leitung, '/api/auth/me')).body.user
const locationId = me.locationId
const belegschaft = ((await hole(leitung, '/api/employees')).body.employees ?? [])
  .filter(e => e.locationId === locationId && e.role === 'employee')

/*
 * Drei Menschen, ein Zeitraum — die Engstelle, die sich mit Monatsangaben
 * nicht ausrechnen liess. `maxConcurrent` steht auf 2, drei gleichzeitig sind
 * also einer zu viel.
 */
const drei = belegschaft.slice(0, 3)
if (drei.length < 3) {
  console.error('Weniger als drei Mitarbeiter am Standort — Demo-Daten neu einlesen.')
  process.exit(1)
}

const jahr = new Date().getFullYear() + 2       // weit weg von allen anderen Prüfungen
const planVon = `${jahr}-07-01`, planBis = `${jahr}-07-31`
const frist = `${jahr - 1}-11-30`

// Alte Anträge in diesem Fenster wegräumen, sonst zählt die Engstelle anders.
await prisma.vacationRequest.deleteMany({
  where: { locationId, startDate: { gte: planVon }, endDate: { lte: planBis } },
})

const regeln = {
  facilityDescription: 'Nachweis §231 — zwei dürfen gleichzeitig weg.',
  maxConcurrent: 2,
  customRules: [],
  schoolHolidayPriorityMode: 'slight',
  antragsfrist: frist,
  antragsfristJahr: jahr - 1,
}
await sende(leitung, '/api/vacation-rules', 'PUT', { locationId, rules: regeln })

console.log(`Standort ${locationId} · Zeitraum ${planVon} bis ${planBis}`)
console.log(`Frist ${frist} · höchstens 2 gleichzeitig`)
console.log(`Beteiligt: ${drei.map(e => e.name).join(', ')}\n`)

/** Einen Antrag anlegen — direkt, weil die Prüfung ihren Zustand selbst setzt. */
async function antrag(emp, von, bis, tage, eingereichtAm) {
  return prisma.vacationRequest.create({
    data: {
      employeeId: emp.id, employeeName: emp.name, locationId,
      locationName: 'Rheinblick Reha', startDate: von, endDate: bis, days: tage,
      status: 'pending', submittedAt: eingereichtAm, reason: 'Nachweis §231',
    },
  })
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 } })
await ctx.addInitScript(() => {
  localStorage.setItem('okun_whats_new_v2_location_model', '1')
  for (const r of ['employee', 'admin', 'company', 'okun']) {
    localStorage.setItem(`okun_tour_done_v6:${r}`, '1')
  }
})
const seite = await ctx.newPage()
await seite.goto(`${BASIS}/login`)
await seite.fill('input[type="email"]', 'leitung@rheinblick-reha.de')
await seite.fill('input[type="password"]', 'Test1234!')
await seite.click('button[type="submit"]')
await seite.waitForTimeout(5000)

/** Die Jahresplanung öffnen, den Zeitraum setzen und auslesen. */
async function planungLesen() {
  await seite.goto(`${BASIS}/admin/urlaub`)
  await seite.waitForTimeout(3500)

  // Zur Jahresplanung, falls die Seite mit Registern arbeitet.
  const reiter = seite.getByRole('button', { name: /Jahresplanung/ }).first()
  if (await reiter.count() > 0) {
    await reiter.click().catch(() => undefined)
    await seite.waitForTimeout(2000)
  }

  // Den Planungszeitraum auf unser Fenster stellen.
  const datumsfelder = seite.locator('input[type="date"]')
  const anzahl = await datumsfelder.count()
  for (let i = 0; i < anzahl; i++) {
    const feld = datumsfelder.nth(i)
    const kennung = await feld.getAttribute('data-test')
    if (kennung === 'antragsfrist') continue
    const wert = await feld.inputValue()
    if (/^\d{4}-\d{2}-\d{2}$/.test(wert)) {
      await feld.fill(wert < '2026-07-01' || i === 0 ? planVon : planBis)
    }
  }
  await seite.waitForTimeout(2000)

  return seite.evaluate(() => {
    const liste = document.querySelector('[data-test="antragsliste"]')
    const engstellen = document.querySelector('[data-test="engstellen"]')
    const fristFeld = document.querySelector('[data-test="antragsfrist"]')
    return {
      zeilen: liste ? liste.children.length : 0,
      namen: liste ? [...liste.children].map(z => z.textContent?.trim() ?? '') : [],
      engstellen: engstellen ? engstellen.children.length : 0,
      engstellenText: engstellen?.textContent?.trim() ?? '',
      frist: fristFeld?.getAttribute('value') ?? fristFeld?.value ?? null,
      // §231 Die alte Maske darf nicht mehr dastehen.
      monatsknoepfe: [...document.querySelectorAll('button')]
        .filter(b => /^(Jan|Feb|Mär|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez)$/.test(
          b.textContent?.trim() ?? '')).length,
      sagtWuensche: /Wünsche der Mitarbeiter/.test(document.body.innerText),
    }
  })
}

// ── §231 Die alte Maske ist weg ───────────────────────────────────────────
console.log('=== §231 Ohne Anträge ===')

const leer = await planungLesen()
check('Die Monatsknöpfe sind weg', leer.monatsknoepfe === 0,
  `${leer.monatsknoepfe} Monatsknöpfe`)
check('Und die Überschrift „Wünsche der Mitarbeiter" auch', !leer.sagtWuensche)
check('Die Frist steht in der Maske', leer.frist === frist, `${leer.frist}`)
/*
 * Die Gegenprobe zur Engstelle: Ohne Anträge gibt es keine. Ohne diese Zeile
 * wäre „Engstelle erkannt" auch dann grün, wenn die Seite immer eine zeigte.
 */
check('Ohne Anträge steht keine Engstelle da', leer.engstellen === 0,
  `${leer.engstellen} Engstellen`)

// ── §231 Zwei Anträge: erlaubt ────────────────────────────────────────────
console.log('\n=== §231 Zwei gleichzeitig — erlaubt ===')

await antrag(drei[0], `${jahr}-07-06`, `${jahr}-07-17`, 10, `${jahr - 1}-10-01`)
await antrag(drei[1], `${jahr}-07-06`, `${jahr}-07-17`, 10, `${jahr - 1}-10-02`)

const zwei = await planungLesen()
check('Beide Anträge stehen in der Liste', zwei.zeilen === 2, `${zwei.zeilen} Zeilen`)
check('Mit Namen und Zeitraum',
  zwei.namen.some(z => z.includes(drei[0].name)) && /06\.07\./.test(zwei.namen.join(' ')),
  zwei.namen[0]?.slice(0, 80) ?? '—')
check('Zwei gleichzeitig sind erlaubt — keine Engstelle', zwei.engstellen === 0,
  `${zwei.engstellen} Engstellen`)

// ── §231 Der dritte: die Engstelle ────────────────────────────────────────
console.log('\n=== §231 Drei gleichzeitig — die Engstelle ===')

/*
 * Der dritte Antrag überlappt die beiden nur TEILWEISE: vom 13. bis 24. Juli.
 * Gemeinsam weg sind alle drei damit vom 13. bis 17. — und genau dieser
 * Zeitraum muss dastehen, nicht der ganze Juli.
 */
await antrag(drei[2], `${jahr}-07-13`, `${jahr}-07-24`, 10, `${jahr - 1}-10-03`)

const dreiZ = await planungLesen()
check('Alle drei Anträge stehen in der Liste', dreiZ.zeilen === 3, `${dreiZ.zeilen} Zeilen`)
check('Die Überschneidung wird als Engstelle erkannt', dreiZ.engstellen === 1,
  `${dreiZ.engstellen} Engstellen`)
check('Sie nennt genau die überlappenden Tage, nicht den ganzen Monat',
  /13\.07\./.test(dreiZ.engstellenText) && /17\.07\./.test(dreiZ.engstellenText)
  && !/0?1\.07\./.test(dreiZ.engstellenText),
  dreiZ.engstellenText.slice(0, 140))
check('Und die Zahl, die sie ausmacht',
  /3 gleichzeitig abwesend, erlaubt sind 2/.test(dreiZ.engstellenText),
  dreiZ.engstellenText.slice(0, 140))
check('Mit den Namen der Betroffenen',
  drei.every(e => dreiZ.engstellenText.includes(e.name.split(' ')[0])),
  dreiZ.engstellenText.slice(0, 200))

// ── §231 Ein Antrag nach der Frist ────────────────────────────────────────
console.log('\n=== §231 Nach der Frist eingereicht ===')

await antrag(drei[0], `${jahr}-07-27`, `${jahr}-07-31`, 5, `${jahr}-01-15`)
const spaet = await planungLesen()
check('Auch ein später Antrag steht in der Liste', spaet.zeilen === 4, `${spaet.zeilen} Zeilen`)
check('Und ist als „nach Frist" gekennzeichnet',
  /nach Frist/.test(spaet.namen.join(' ')),
  spaet.namen.find(z => /nach Frist/.test(z))?.slice(0, 90) ?? '—')
check('Ein fristgerechter Antrag trägt die Kennzeichnung NICHT',
  spaet.namen.filter(z => /nach Frist/.test(z)).length === 1,
  `${spaet.namen.filter(z => /nach Frist/.test(z)).length} von 4 gekennzeichnet`)

// ── Aufräumen ─────────────────────────────────────────────────────────────
await prisma.vacationRequest.deleteMany({
  where: { locationId, startDate: { gte: planVon }, endDate: { lte: planBis } },
})
await prisma.$disconnect()

console.log(`\n${ok}/${ok + fail} Checks bestanden`)
await browser.close()
process.exit(fail > 0 ? 1 : 0)
