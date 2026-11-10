// Nachweis (Browser) §284–§286: Geplante Stunden ohne Pause, eine Dienstzeile
// ohne Überlagerung, und eine Uhr, die nicht rückwärts läuft.
//
//     node pruefungen/browser/stunden-und-uhr.mjs
//
// WIE DAS GEFUNDEN WURDE
// Drei Bilder vom Telefon des Eigentümers.
//
//   §284  „4 Dienste diese Woche — 42h 30min Stunden geplant." Fünf Dienste
//         von 07:00 bis 15:30 sind 42,5 Stunden ANWESENHEIT und 40 Stunden
//         ARBEIT. Die Leitungsansicht zog die Pause ab, die Ansicht des
//         Mitarbeiters nicht — zwei Zahlen für dieselbe Woche, und die
//         falsche stand dort, wo jemand seine eigene Arbeitszeit nachliest.
//
//   §285  „07:00 – 15:30 Uhr gepla✓t" — die Status-Plakette lag mitten im
//         Wort. Nicht zu wenig Platz, sondern eine fehlende Regel: Ein Text
//         mit `whitespace-nowrap` und ohne Begrenzung wird über seine
//         Nachbarn gezeichnet.
//
//   §286  Direkt nach dem Einstempeln stand „-1:-1" in der Uhr. Die Uhr des
//         Telefons ging zwei Sekunden hinter der des Servers; aus −2000
//         Millisekunden machte die alte Formatierung „-1:-1".
//
// WAS HIER GEPRÜFT WIRD
// Dass die drei Befunde auf dem BILDSCHIRM verschwunden sind. Die Rechnungen
// dahinter prüfen `dienstzeit.test.ts` und `laufzeit.test.ts`; hier geht es
// darum, dass sie auch ankommen.
//
// Jede Prüfung stellt ihren Ausgangszustand selbst her, und zu jeder Fähigkeit
// gehört die Gegenprobe: Eine Woche ohne Dienste wäre sonst grün, ohne etwas
// gezeigt zu haben, und eine Uhr, die immer „0:00" sagt, ebenfalls.

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { pruefer } from '../helfer.mjs'
import { PrismaClient } from '@prisma/client'

const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'
const prisma = new PrismaClient()
const { check, bilanz } = pruefer()

const EMAIL = 'deniz.yilmaz@beispielbetrieb.de'

/* ──────────────────────────────────────────────────────────────────────
 * Ausgangszustand
 * ────────────────────────────────────────────────────────────────────── */

const mit = await prisma.employee.findFirst({
  where: { email: EMAIL },
  select: { id: true, locationId: true },
})
if (!mit) {
  console.error('Der Beispielbetrieb fehlt. Erst `npm run seed:schaufenster`.')
  process.exit(1)
}

/** Dieselbe Rechnung wie in `src/lib/dienstzeit.ts` — hier noch einmal von
 *  Hand, damit die Prüfung nicht dieselbe Funktion prüft, die sie beweisen
 *  soll. Eine Prüfung, die den Prüfling aufruft, bestätigt nur sich selbst. */
function spanneMinuten(von, bis) {
  const [sh, sm] = von.split(':').map(Number)
  const [eh, em] = bis.split(':').map(Number)
  let m = (eh * 60 + em) - (sh * 60 + sm)
  if (m <= 0) m += 1440
  return m
}

const regeln = await prisma.locationPlanningRules.findUnique({
  where: { locationId: mit.locationId },
  select: { breakThresholdMinutes: true, breakDeductionMinutes: true },
})
const schwelle = regeln?.breakThresholdMinutes ?? 360
const abzug = regeln?.breakDeductionMinutes ?? 30

// Die Woche, die die Seite beim Öffnen zeigt: Montag bis Sonntag um heute.
const heute = new Date()
const montag = new Date(heute)
montag.setDate(heute.getDate() - ((heute.getDay() + 6) % 7))
const tage = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(montag)
  d.setDate(montag.getDate() + i)
  return d.toISOString().slice(0, 10)
})

const eintraege = await prisma.scheduleEntry.findMany({
  where: { employeeId: mit.id, date: { in: tage } },
  select: { date: true, shiftId: true, startTime: true, endTime: true },
})
const dienste = await prisma.shift.findMany({
  where: { id: { in: [...new Set(eintraege.map(e => e.shiftId))] } },
  select: { id: true, startTime: true, endTime: true },
})

let brutto = 0
let netto = 0
for (const e of eintraege) {
  const d = dienste.find(s => s.id === e.shiftId)
  if (!d) continue
  const m = spanneMinuten(e.startTime ?? d.startTime, e.endTime ?? d.endTime)
  brutto += m
  netto += m >= schwelle ? Math.max(0, m - abzug) : m
}

check('Die angezeigte Woche enthält Dienste — sonst prüft das hier nichts',
  eintraege.length > 0, `${eintraege.length} Dienste, ${tage[0]} bis ${tage[6]}`)

/*
 * DIE GEGENPROBE ZU §284. Ohne sie wäre „die Zahl stimmt" auch dann grün,
 * wenn gar keine Pause abzuziehen wäre — dann sind Brutto und Netto gleich,
 * und die Prüfung bewiese nichts.
 */
check('Und sie sind lang genug, dass eine Pause abzuziehen ist',
  netto < brutto, `${(brutto / 60).toFixed(1)} h Anwesenheit, ${(netto / 60).toFixed(1)} h Arbeit`)

if (eintraege.length === 0 || netto >= brutto) {
  console.error('Ausgangszustand nicht herstellbar — Prüfung abgebrochen.')
  await prisma.$disconnect()
  process.exit(1)
}

/* ──────────────────────────────────────────────────────────────────────
 * Der Browser
 * ────────────────────────────────────────────────────────────────────── */

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ ...devices['iPhone 13'] })
await ctx.addInitScript(() => {
  localStorage.setItem('okun_whats_new_v2_location_model', '1')
  localStorage.setItem('okun_visited_pages_v1', JSON.stringify(['/employee/schedule']))
  for (const r of ['employee', 'admin', 'company', 'okun']) {
    localStorage.setItem(`okun_tour_done_v6:${r}`, '1')
  }
})

const seite = await ctx.newPage()
await seite.goto(`${BASIS}/login`, { waitUntil: 'domcontentloaded' })
await seite.fill('input[type="email"]', EMAIL)
await seite.fill('input[type="password"]', 'Test1234!')
await seite.click('button[type="submit"]', { force: true })
await seite.waitForTimeout(4500)

await seite.goto(`${BASIS}/employee/schedule`, { waitUntil: 'domcontentloaded' })
await seite.waitForFunction(
  () => /Dienste diese Woche/.test(document.body.innerText), { timeout: 25000 },
).catch(() => {})
await seite.waitForTimeout(2000)

const text = await seite.innerText('body')

/* ── §284 Die Stundenzahl ───────────────────────────────────────────── */

const treffer = text.match(/(-?\d+)h(?:\s*(\d+)min)?\s*\n?\s*Stunden geplant/)
check('Über dem Plan steht eine Stundenzahl', Boolean(treffer),
  treffer?.[0]?.replace(/\n/g, ' ') ?? text.slice(0, 120).replace(/\n+/g, ' '))

if (treffer) {
  const gezeigt = Number(treffer[1]) * 60 + Number(treffer[2] ?? 0)
  check('Sie ist die Arbeitszeit — die Pause ist heraus',
    gezeigt === netto, `Bildschirm ${gezeigt} min, erwartet ${netto} min`)
  /*
   * Und ausdrücklich NICHT die Anwesenheit. Das ist der gemeldete Fehler:
   * Dort standen 42h 30min statt 40h.
   */
  check('Und nicht die Anwesenheitsspanne',
    gezeigt !== brutto, `Anwesenheit wären ${brutto} min`)
  check('Dass die Pause nicht mitzählt, steht dabei',
    /ohne Pausen/.test(text), /ohne Pausen/.test(text) ? 'gefunden' : 'fehlt')
}

/* ── §285 Nichts überlagert sich ────────────────────────────────────── */

/*
 * Gesucht wird nicht „zu breit", sondern „zu breit UND nicht begrenzt".
 *
 * Der Unterschied ist der ganze Fund: Ein Text mit `overflow: hidden`
 * (Tailwind `truncate`) ist zu breit und wird abgeschnitten — unschön,
 * aber er bleibt in seinem Kasten. Ein Text mit `overflow: visible` wird
 * über die Nachbarn gezeichnet, und das war das Häkchen im Wort.
 */
const zeilen = await seite.evaluate(() => {
  const mitUhrzeit = [...document.querySelectorAll('p')]
    .filter(p => /\d\d:\d\d\s*[–-]\s*\d\d:\d\d/.test(p.innerText))
  return {
    anzahl: mitUhrzeit.length,
    ueberlauf: mitUhrzeit
      .filter(p => p.scrollWidth > p.clientWidth + 1
        && getComputedStyle(p).overflowX === 'visible')
      .map(p => ({
        text: p.innerText.replace(/\s+/g, ' ').slice(0, 50),
        braucht: p.scrollWidth, hat: p.clientWidth,
      })),
  }
})

/* Die Gegenprobe: Ohne Dienstzeilen wäre „nichts läuft über" trivial grün. */
check('Es stehen Dienstzeilen mit Uhrzeiten auf dem Bildschirm',
  zeilen.anzahl > 0, `${zeilen.anzahl} Zeilen`)
check('Keine davon läuft über ihren Kasten hinaus',
  zeilen.ueberlauf.length === 0,
  zeilen.ueberlauf.length === 0 ? 'keine' : JSON.stringify(zeilen.ueberlauf))

/*
 * DIE ZWEITE GEGENPROBE: Merkt dieser Melder überhaupt einen Überlauf?
 *
 * Eine Messung, die nie ausschlägt, ist keine Prüfung. Also wird einer
 * echten Dienstzeile für einen Augenblick genau die Regel aufgezwungen, die
 * den gemeldeten Fehler erzeugt hat — `whitespace-nowrap` mit einem Text,
 * der nicht hineinpasst. Schlägt der Melder dann nicht aus, ist er blind.
 */
const melderTaugt = await seite.evaluate(() => {
  const p = [...document.querySelectorAll('p')]
    .find(el => /\d\d:\d\d\s*[–-]\s*\d\d:\d\d/.test(el.innerText))
  if (!p) return null
  const vorher = { ws: p.style.whiteSpace, text: p.innerHTML }
  p.style.whiteSpace = 'nowrap'
  p.innerHTML = 'XX:XX – XX:XX Uhr geplant und noch viel mehr Text hinterher'
  const schlaegtAus = p.scrollWidth > p.clientWidth + 1
  p.style.whiteSpace = vorher.ws
  p.innerHTML = vorher.text
  return schlaegtAus
})
check('Der Melder schlägt aus, wenn ein Text doch einmal überläuft',
  melderTaugt === true, melderTaugt === null ? 'keine Zeile gefunden' : String(melderTaugt))

/*
 * UND AUF DEM KLEINSTEN TELEFON. Breiter Platz heilt den Fehler nur
 * zufällig; die Zeile muss auch dort halten, wo sie wirklich eng wird.
 * 320 Pixel sind ein iPhone SE der ersten Bauart.
 */
const eng = await ctx.newPage()
await eng.setViewportSize({ width: 320, height: 700 })
await eng.goto(`${BASIS}/employee/schedule`, { waitUntil: 'domcontentloaded' })
await eng.waitForFunction(
  () => /Dienste diese Woche/.test(document.body.innerText), { timeout: 25000 },
).catch(() => {})
await eng.waitForTimeout(1500)
const engUeberlauf = await eng.evaluate(() => [...document.querySelectorAll('p, span')]
  .filter(el => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1
    && getComputedStyle(el).overflowX === 'visible')
  .map(el => `${el.innerText.replace(/\s+/g, ' ').slice(0, 30)} (${el.clientWidth}/${el.scrollWidth})`))
check('Auch auf 320 Pixeln läuft nichts über',
  engUeberlauf.length === 0,
  engUeberlauf.length === 0 ? 'keine' : JSON.stringify(engUeberlauf))
await eng.close()

/* Der Status steht als Wort da — vorher war es eine Plakette im Textfeld. */
check('Der Status des Dienstes ist zu lesen',
  /geplant|bestätigt/.test(text), 'geplant/bestätigt gefunden')

/* ── §286 Die Uhr ───────────────────────────────────────────────────── */

/*
 * Der Ausgangszustand wird hier mit Absicht KRUMM hergestellt: ein
 * Einstempelzeitpunkt zwei Sekunden in der Zukunft. Genau das entsteht, wenn
 * die Uhr des Servers der des Telefons ein wenig vorausgeht — und genau
 * daraus wurde „-1:-1".
 */
const offene = await prisma.timeLog.findMany({
  where: { employeeId: mit.id, clockOut: null }, select: { id: true },
})
const vorhandene = offene.map(o => o.id)

const gleich = new Date(Date.now() + 2000)
const kuenstlich = await prisma.timeLog.create({
  data: {
    employeeId: mit.id,
    locationId: mit.locationId,
    date: gleich.toISOString().slice(0, 10),
    clockIn: gleich.toTimeString().slice(0, 5),
    clockInAt: gleich,
    quelle: 'app',
  },
})

try {
  await seite.goto(`${BASIS}/employee`, { waitUntil: 'domcontentloaded' })
  await seite.waitForFunction(
    () => /Ausstempeln/.test(document.body.innerText), { timeout: 25000 },
  ).catch(() => {})
  await seite.waitForTimeout(1500)

  const heim = await seite.innerText('body')
  check('Die Uhr läuft — die Seite zeigt „Ausstempeln"',
    /Ausstempeln/.test(heim), /Ausstempeln/.test(heim) ? 'ja' : heim.slice(0, 120))

  const uhr = heim.match(/\n(-?\d+:-?\d+)\n/)
  check('In der Uhr steht eine Dauer', Boolean(uhr), uhr?.[1] ?? 'nicht gefunden')
  /* DER GEMELDETE FALL. */
  check('Und zwar „0:00" und nicht „-1:-1"',
    uhr?.[1] === '0:00', uhr?.[1] ?? '—')
  check('Nirgends auf der Seite steht eine negative Dauer',
    !/-\d+:-?\d+/.test(heim), heim.match(/-\d+:-?\d+/)?.[0] ?? 'keine')

  /*
   * DIE GEGENPROBE: Eine Uhr, die immer „0:00" sagt, bestünde alles oben.
   * Also derselbe Eintrag neunzig Minuten früher — dort muss „1:30" stehen.
   */
  const frueher = new Date(Date.now() - 90 * 60 * 1000)
  await prisma.timeLog.update({
    where: { id: kuenstlich.id },
    data: {
      clockInAt: frueher,
      clockIn: frueher.toTimeString().slice(0, 5),
      date: frueher.toISOString().slice(0, 10),
    },
  })
  await seite.goto(`${BASIS}/employee`, { waitUntil: 'domcontentloaded' })
  await seite.waitForFunction(
    () => /Ausstempeln/.test(document.body.innerText), { timeout: 25000 },
  ).catch(() => {})
  await seite.waitForTimeout(1500)
  const spaeter = await seite.innerText('body')
  const uhr2 = spaeter.match(/\n(-?\d+:-?\d+)\n/)
  check('Neunzig Minuten später zeigt dieselbe Uhr 1:30 — sie steht nicht still',
    uhr2?.[1] === '1:30', uhr2?.[1] ?? '—')
} finally {
  // Was diese Prüfung angelegt hat, räumt sie weg. Ein Stempel, der liegen
  // bleibt, verfälscht jede spätere Prüfung und jeden Monatsabschluss.
  await prisma.timeLog.deleteMany({
    where: { id: kuenstlich.id, NOT: { id: { in: vorhandene } } },
  })
}

/* ── §284 Die zweite Stelle: Mehrarbeit in den Zeitnachweisen ───────── */

/*
 * Hier hing Geld dran, und zwar unsichtbar.
 *
 * In der Liste der Zeitnachweise wurde die GEARBEITETE Zeit (Pause schon
 * heraus) gegen die SPANNE des geplanten Dienstes gehalten. Wer eine
 * Viertelstunde länger blieb, stand damit immer noch unter der Spanne — die
 * Mehrarbeit tauchte nirgends auf. Der Fehler ging ausschließlich zu Lasten
 * des Mitarbeiters und fiel niemandem auf, weil beide Zahlen für sich
 * plausibel aussehen.
 *
 * Geprüft wird mit einem Tag, an dem 75 Minuten Mehrarbeit stehen: Unter der
 * alten Rechnung (480 + 75 = 555 gegen 570 Spanne) wäre das NICHT auffällig
 * gewesen, unter der neuen (555 gegen 480) ist es das.
 */
const letzter = await prisma.scheduleEntry.findFirst({
  where: { employeeId: mit.id, date: { lt: new Date().toISOString().slice(0, 10) } },
  orderBy: { date: 'desc' },
  select: { date: true, shiftId: true, startTime: true, endTime: true },
})
const dienstDazu = letzter
  ? await prisma.shift.findUnique({
    where: { id: letzter.shiftId }, select: { startTime: true, endTime: true },
  })
  : null
const buchung = letzter
  ? await prisma.timeLog.findFirst({
    where: { employeeId: mit.id, date: letzter.date },
    select: { id: true, totalMinutes: true },
  })
  : null

check('Es gibt einen vergangenen Dienst mit Buchung — sonst prüft das hier nichts',
  Boolean(letzter && dienstDazu && buchung), letzter?.date ?? 'keiner')

if (letzter && dienstDazu && buchung) {
  const spanne = spanneMinuten(
    letzter.startTime ?? dienstDazu.startTime,
    letzter.endTime ?? dienstDazu.endTime,
  )
  const planNetto = spanne >= schwelle ? Math.max(0, spanne - abzug) : spanne
  const vorher = buchung.totalMinutes

  /*
   * Die Gegenprobe zur Gegenprobe: Der Tag muss lang genug sein, dass die
   * Pause überhaupt abgezogen wird — sonst sind Spanne und Arbeitszeit
   * gleich, und der ganze Unterschied, um den es geht, existiert nicht.
   */
  check('Der Dienst ist lang genug, dass sich Spanne und Arbeitszeit unterscheiden',
    planNetto < spanne, `${spanne} min Spanne, ${planNetto} min Arbeitszeit`)

  try {
    await prisma.timeLog.update({
      where: { id: buchung.id }, data: { totalMinutes: planNetto + 75 },
    })
    await seite.goto(`${BASIS}/employee/time-tracking`, { waitUntil: 'domcontentloaded' })
    await seite.waitForFunction(
      () => /Zeitnachweise/.test(document.body.innerText), { timeout: 25000 },
    ).catch(() => {})
    await seite.waitForTimeout(2000)
    const nachweise = await seite.innerText('body')
    check('75 Minuten Mehrarbeit stehen als Mehrarbeit da',
      /\+\s*1h 15min/.test(nachweise),
      nachweise.match(/\+\s*\d+h[^\n]*/)?.[0] ?? 'kein „+" gefunden')

    /*
     * UND DIE GEGENPROBE: Genau nach Plan gearbeitet heißt KEINE Mehrarbeit.
     * Ohne sie wäre „zeigt ein Plus" auch dann grün, wenn an jedem Tag eines
     * stünde — was die umgekehrte Lüge wäre.
     */
    await prisma.timeLog.update({
      where: { id: buchung.id }, data: { totalMinutes: planNetto },
    })
    await seite.goto(`${BASIS}/employee/time-tracking`, { waitUntil: 'domcontentloaded' })
    await seite.waitForFunction(
      () => /Zeitnachweise/.test(document.body.innerText), { timeout: 25000 },
    ).catch(() => {})
    await seite.waitForTimeout(2000)
    const genau = await seite.innerText('body')
    const zeileGenau = genau.split('\n')
      .findIndex(z => z.includes('1h 15min'))
    check('Genau nach Plan gearbeitet ist keine Mehrarbeit',
      zeileGenau === -1, zeileGenau === -1 ? 'kein Plus' : 'es steht trotzdem ein Plus da')
  } finally {
    await prisma.timeLog.update({
      where: { id: buchung.id }, data: { totalMinutes: vorher },
    })
  }
}

await browser.close()
await prisma.$disconnect()
const fails = bilanz()
process.exit(fails > 0 ? 1 : 0)
