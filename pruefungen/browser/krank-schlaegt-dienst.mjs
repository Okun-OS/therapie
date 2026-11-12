// Nachweis (Browser) §287/§288: Eine Krankmeldung schlägt den Dienst — und
// die Gerätesperre ist weg.
//
//     node pruefungen/browser/krank-schlaegt-dienst.mjs
//
// WIE DAS GEFUNDEN WURDE
// Gemeldet vom Telefon: „Er hat sich krank gemeldet vom 11. bis zum 15. und
// hatte am 11., 12. und 13. einen Dienst. Am 14., 15. hatte er frei. An den
// Tagen, wo er frei hatte, wird krank eingetragen. Und am 11., 12. und 13.,
// wo er jeden Tag einen Tagdienst hatte, bleiben seine Dienste ganz normal
// bestehen. Da wechselt er nicht auf krank."
//
// Nachgestellt und wörtlich bestätigt. Die Ursache war eine Zeile im eigenen
// Dienstplan des Mitarbeiters:
//
//     const ausfall = entry ? null : ausfallAmTag(dateStr)
//
// „Steht ein Dienst da, frag gar nicht erst nach der Krankmeldung." Damit
// konnte die Krankmeldung nur an den Tagen erscheinen, an denen ohnehin
// nichts geplant war. In der Leitungsansicht stimmte es seit §227.
//
// WAS HIER GEPRÜFT WIRD
// Dass an einem Tag MIT Dienst die Krankmeldung dasteht — und dass der
// Dienst dabei nicht verschwindet, sondern als „entfällt" benannt wird. Dazu
// die Gegenprobe: Ohne Krankmeldung steht an denselben Tagen wieder der
// Dienst. Ohne sie bewiese die Prüfung nur, dass irgendwo „krank" steht.
//
// Die Entscheidung selbst prüft `src/lib/__tests__/fehltag.test.ts`. Hier
// geht es darum, dass sie auf dem Bildschirm ankommt — genau das war der
// Unterschied: richtig gerechnet, falsch angezeigt.

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { pruefer } from '../helfer.mjs'
import { PrismaClient } from '@prisma/client'

const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'
const prisma = new PrismaClient()
const { check, bilanz } = pruefer()

const EMAIL = 'marin.berg@kita-regenbogen.de'
const MIT_DIENST = ['2026-11-11', '2026-11-12', '2026-11-13']
const OHNE_DIENST = ['2026-11-14', '2026-11-15']
const VON = MIT_DIENST[0]
const BIS = OHNE_DIENST[OHNE_DIENST.length - 1]

/* ──────────────────────────────────────────────────────────────────────
 * Den Ausgangszustand stellt diese Prüfung selbst her — und räumt ihn weg.
 * ────────────────────────────────────────────────────────────────────── */

const mit = await prisma.employee.findFirst({
  where: { email: EMAIL }, select: { id: true, name: true, locationId: true },
})
if (!mit) {
  console.error('Die Kita-Demo fehlt. Erst `npm run seed:kita`.')
  process.exit(1)
}

const dienst = await prisma.shift.findFirst({
  where: { locationId: mit.locationId, type: 'early' },
  select: { id: true, name: true, startTime: true, endTime: true },
})
if (!dienst) {
  console.error('Kein Dienst am Standort — Ausgangszustand nicht herstellbar.')
  process.exit(1)
}

async function aufraeumen() {
  await prisma.scheduleEntry.deleteMany({
    where: { employeeId: mit.id, date: { in: [...MIT_DIENST, ...OHNE_DIENST] } },
  })
  await prisma.absence.deleteMany({
    where: { employeeId: mit.id, startDate: VON, endDate: BIS },
  })
}

async function dienstePflanzen() {
  for (const tag of MIT_DIENST) {
    await prisma.scheduleEntry.create({
      data: {
        employeeId: mit.id, locationId: mit.locationId,
        shiftId: dienst.id, date: tag, status: 'confirmed',
      },
    })
  }
}

async function krankmelden() {
  await prisma.absence.create({
    data: {
      employeeId: mit.id, employeeName: mit.name, locationId: mit.locationId,
      type: 'krankheit', startDate: VON, endDate: BIS,
      days: MIT_DIENST.length, verificationStatus: 'offen',
      submittedAt: new Date().toISOString(),
    },
  })
}

await aufraeumen()
await dienstePflanzen()

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ ...devices['iPhone 13'] })
await ctx.addInitScript(() => {
  localStorage.setItem('okun_whats_new_v2_location_model', '1')
  localStorage.setItem('okun_visited_pages_v1', JSON.stringify(['/employee/schedule']))
  for (const r of ['employee', 'admin', 'company', 'okun']) {
    localStorage.setItem(`okun_tour_done_v6:${r}`, '1')
  }
  // §288 Der Schlüssel der alten Gerätesperre, absichtlich gesetzt: Die
  // Anwendung muss ihn räumen und darf auf keinen Fall darauf reagieren.
  localStorage.setItem('okun_geraetesperre', '1')
})

const seite = await ctx.newPage()
await seite.goto(`${BASIS}/login`, { waitUntil: 'domcontentloaded' })
await seite.fill('input[type="email"]', EMAIL)
await seite.fill('input[type="password"]', 'Test1234!')
await seite.click('button[type="submit"]', { force: true })
await seite.waitForTimeout(4500)

/** Die Woche 09.–15.11. aufschlagen und ihren Text zurückgeben. */
async function wocheLesen() {
  await seite.goto(`${BASIS}/employee/schedule`, { waitUntil: 'domcontentloaded' })
  await seite.waitForFunction(
    () => /Dienste diese Woche/.test(document.body.innerText), { timeout: 25000 },
  ).catch(() => {})
  await seite.waitForTimeout(1800)
  for (let i = 0; i < 8; i++) {
    const t = await seite.innerText('body')
    if (/09\.11\. – 15\.11\./.test(t)) return t
    await seite.locator('svg.lucide-chevron-left').first().click({ force: true })
    await seite.waitForTimeout(1200)
  }
  return seite.innerText('body')
}

/** Den Block einer einzelnen Zeile — vom Wochentag bis zum nächsten. */
function zeile(text, kuerzel, tag) {
  const zeilen = text.split('\n').map(z => z.trim()).filter(Boolean)
  const i = zeilen.findIndex((z, n) => z === kuerzel && zeilen[n + 1] === String(tag))
  if (i < 0) return ''
  const rest = zeilen.slice(i + 2)
  const ende = rest.findIndex(z => /^(Mo|Di|Mi|Do|Fr|Sa|So)$/.test(z))
  return (ende < 0 ? rest : rest.slice(0, ende)).join(' | ')
}

try {
  /* ── Erst OHNE Krankmeldung: Stehen die Dienste überhaupt da? ───────── */
  const ohne = await wocheLesen()
  check('Die Woche ist aufgeschlagen', /09\.11\. – 15\.11\./.test(ohne),
    ohne.match(/\d\d\.\d\d\. – \d\d\.\d\d\./)?.[0] ?? 'nicht gefunden')

  const mittwochOhne = zeile(ohne, 'Mi', 11)
  check('Ohne Krankmeldung steht am Mittwoch der Dienst',
    mittwochOhne.includes(dienst.name), mittwochOhne || 'leer')
  check('Und das Wort „krank" kommt in der Woche nicht vor',
    !/[Kk]rank/.test(ohne.replace(/Krankmelden/g, '')), 'sauber')

  /* ── Jetzt krankmelden ──────────────────────────────────────────────── */
  await krankmelden()
  const mitKrank = await wocheLesen()

  /*
   * DER GEMELDETE FALL: die drei Tage MIT Dienst. Vorher stand hier der
   * Dienst, als fände er statt.
   */
  for (const [kuerzel, tag] of [['Mi', 11], ['Do', 12], ['Fr', 13]]) {
    const z = zeile(mitKrank, kuerzel, tag)
    check(`${kuerzel} ${tag}. (mit Dienst): Krankgemeldet steht da`,
      z.includes('Krankgemeldet'), z || 'leer')
    check(`${kuerzel} ${tag}.: und der Dienst ist als „entfällt" benannt`,
      z.includes(dienst.name) && z.includes('entfällt'), z || 'leer')
  }

  /* Die Tage OHNE Dienst — dort stimmte es schon vorher, und es muss bleiben. */
  for (const [kuerzel, tag] of [['Sa', 14], ['So', 15]]) {
    const z = zeile(mitKrank, kuerzel, tag)
    check(`${kuerzel} ${tag}. (ohne Dienst): Krankgemeldet steht weiterhin da`,
      z.includes('Krankgemeldet'), z || 'leer')
    check(`${kuerzel} ${tag}.: und es wird kein Dienst erfunden`,
      !z.includes('entfällt'), z || 'leer')
  }

  /*
   * Die gutgeschriebenen Stunden an einem Tag mit Dienst — das ist die
   * Zahl, an der der Lohn hängt (§227, Lohnausfallprinzip).
   */
  check('An einem Tag mit Dienst stehen die gutgeschriebenen Stunden dabei',
    /Std\. gutgeschrieben/.test(zeile(mitKrank, 'Mi', 11)), zeile(mitKrank, 'Mi', 11))

  /* ── Die Startseite ─────────────────────────────────────────────────── */
  await seite.goto(`${BASIS}/employee`, { waitUntil: 'domcontentloaded' })
  await seite.waitForTimeout(3000)
  const start = await seite.innerText('body')
  check('Die Startseite sagt, dass eine Krankmeldung läuft',
    /Krankgemeldet/.test(start),
    start.split('\n').filter(Boolean).slice(0, 8).join(' | '))
  /*
   * Und sie behauptet nicht mehr, heute stünde ein Dienst an. Genau das
   * stand dort: „Heute Frühdienst 8 · 06:00–14:30" plus „Einstempeln".
   */
  check('Und die Uhr behauptet keinen laufenden Dienst mehr',
    /Kein Dienst geplant/.test(start),
    /Kein Dienst geplant/.test(start) ? 'ja' : start.slice(0, 160).replace(/\n/g, ' '))

  /* ── §288 Was von der Gerätesperre im Browser prüfbar ist ───────────── */
  /*
   * WAS HIER NICHT GEHT, und das gehört dazugesagt: Die Sperre lag hinter
   * der nativen Brücke (`istApp()` plus ein Capacitor-Zusatzpaket). In einem
   * Browser wäre sie auch VOR dieser Änderung nie erschienen — eine Prüfung
   * „kein Sperrbildschirm" wäre hier also grün gewesen, ohne irgendetwas zu
   * zeigen. Dass der Quelltext sie nicht mehr enthält, prüft deshalb
   * `pruefungen/x-geraetesperre-ist-weg.mjs`.
   *
   * Prüfbar ist genau eine Sache, und es ist die, an der der ausgesperrte
   * Mensch hängt: Der Schlüssel auf seinem Gerät wird geräumt. Er wurde oben
   * absichtlich auf „1" gesetzt — so sieht sein Telefon aus.
   */
  const schluessel = await seite.evaluate(
    () => window.localStorage.getItem('okun_geraetesperre'))
  check('§288 Der Schlüssel der alten Gerätesperre wird geräumt',
    schluessel === null, `localStorage: ${String(schluessel)}`)

  /* ── Die Gegenprobe: Krankmeldung weg, Dienst wieder da ─────────────── */
  await prisma.absence.deleteMany({
    where: { employeeId: mit.id, startDate: VON, endDate: BIS },
  })
  const danach = await wocheLesen()
  const mittwochDanach = zeile(danach, 'Mi', 11)
  check('Ohne Krankmeldung steht am Mittwoch wieder der Dienst',
    mittwochDanach.includes(dienst.name) && !mittwochDanach.includes('Krankgemeldet'),
    mittwochDanach || 'leer')
} finally {
  await aufraeumen()
  await browser.close()
  await prisma.$disconnect()
}

const fails = bilanz()
process.exit(fails > 0 ? 1 : 0)
