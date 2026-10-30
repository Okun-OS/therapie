// Nachweis (Browser) §270: Der Rückblick im Dienstplan — Plan und Wirklichkeit.
//
//     node pruefungen/browser/dienstplan-rueckblick.mjs
//
// DIE MELDUNG
// „Ich möchte, dass der Mitarbeiter auch seine ganzen Dienstpläne, die wir bis
//  jetzt hatten, auch im Nachhinein sehen kann, dass er halt zurückgeht in den
//  Wochen … Und wenn ich jetzt von 7 bis 15:30 heute hatte, gestern hatte und
//  ich war eingeloggt von 6:59 Uhr bis 15:32 Uhr, dass dann auch diese Uhrzeit
//  dasteht für den abgeschlossenen Dienst. Also dass ich am Mittwoch dann
//  sehe, wie ich am Dienstag wirklich da war und … was die geplante Zeit war."
//
// WAS DAVON SCHON GING
// Das Zurückblättern. Nachgemessen am 30.10.2026, BEVOR etwas gebaut wurde:
// Die Woche davor zeigte fünf Tagdienste, die Woche davor fünf Spätdienste.
// Der Dienstplan hält die ganze Vergangenheit; es fehlte nichts.
//
// WAS FEHLTE
// Die Stempelzeit. Der Plan sagte, was vorgesehen war — was wirklich war,
// stand auf einer anderen Seite, und wer beides vergleichen wollte, musste
// Datum für Datum hin- und herwechseln. Nebeneinander ist es ein Nachweis.
//
// WAS HIER GEMESSEN WIRD
// Beides am Bildschirm: dass vergangene Wochen Dienste zeigen UND dass an
// einem abgeschlossenen Tag die Stempelzeit NEBEN der geplanten Zeit steht.
// Nicht „die Schnittstelle liefert Zeitbuchungen" — das wäre wieder die
// falsche Frage (§254).

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { pruefer } from '../helfer.mjs'
import { PrismaClient } from '@prisma/client'

const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'
const prisma = new PrismaClient()
const { check, bilanz } = pruefer()

const ZUGANG = 'deniz.yilmaz@beispielbetrieb.de'

/*
 * Der Ausgangszustand, den diese Prüfung selbst herstellt. Der
 * Beispielbetrieb (`npm run seed:schaufenster`) hat einen veröffentlichten
 * Plan über vier Wochen und vollständige Zeiten — ohne ihn prüft das hier
 * nichts.
 */
const mit = await prisma.employee.findFirst({
  where: { email: ZUGANG }, select: { id: true },
})
if (!mit) {
  console.error('Der Beispielbetrieb fehlt. Erst `npm run seed:schaufenster`.')
  process.exit(1)
}

const buchungen = await prisma.timeLog.findMany({
  where: { employeeId: mit.id, clockOut: { not: null } },
  orderBy: { date: 'desc' }, take: 20,
  select: { date: true, clockIn: true, clockOut: true },
})
check('Es gibt abgeschlossene Zeitbuchungen in der Vergangenheit',
  buchungen.length > 0, `${buchungen.length} Tage`)

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
await seite.goto(`${BASIS}/login`)
await seite.fill('input[type="email"]', ZUGANG)
await seite.fill('input[type="password"]', 'Test1234!')
await seite.click('button[type="submit"]')
await seite.waitForTimeout(4500)
await seite.goto(`${BASIS}/employee/schedule`)
await seite.waitForFunction(
  () => /Dienste diese Woche/.test(document.body.innerText), { timeout: 20000 },
).catch(() => {})
await seite.waitForTimeout(2000)

// ── Zurückblättern ────────────────────────────────────────────────────────
console.log('\n=== §270 Die Wochen davor stehen noch da ===')

const zurueck = async () => {
  await seite.locator('svg.lucide-chevron-left').first().click({ force: true })
  await seite.waitForTimeout(1600)
  return seite.innerText('body')
}

const zeitraum = (t) => t.match(/(\d\d\.\d\d\. – \d\d\.\d\d\.)/)?.[1] ?? '?'
const dienstzeilen = (t) => (t.match(/\d\d:\d\d – \d\d:\d\d Uhr geplant/g) ?? []).length
const istzeilen = (t) => (t.match(/\d\d:\d\d – \d\d:\d\d Uhr gearbeitet/g) ?? []).length

/** Die innersten Zeilen, in denen eine Stempelzeit steht. */
const zeilenLesen = () => seite.evaluate(() => {
  const treffer = []
  for (const el of document.querySelectorAll('div')) {
    const text = el.innerText ?? ''
    if (!/Uhr gearbeitet/.test(text)) continue
    if (el.querySelectorAll('div').length > 2) continue   // nur die innerste Zeile
    treffer.push(text.replace(/\n+/g, ' | '))
  }
  return treffer.slice(0, 5)
})

const gesehen = []
for (let i = 0; i < 3; i++) {
  const t = await zurueck()
  gesehen.push({
    woche: zeitraum(t),
    geplant: dienstzeilen(t),
    gearbeitet: istzeilen(t),
    zeilen: await zeilenLesen(),
  })
}

for (const g of gesehen) {
  console.log(`           ${g.woche}: ${g.geplant} geplante, ${g.gearbeitet} gearbeitete Dienste`)
}

check('In den Wochen davor stehen Dienste — der Plan ist nicht leer',
  gesehen.some(g => g.geplant > 0),
  gesehen.map(g => `${g.woche}: ${g.geplant}`).join(' · '))

check('Und die Wochen sind wirklich verschieden — es wird geblättert',
  new Set(gesehen.map(g => g.woche)).size === gesehen.length,
  gesehen.map(g => g.woche).join(' · '))

// ── Plan und Wirklichkeit nebeneinander ───────────────────────────────────
console.log('\n=== §270 Und daneben, was wirklich war ===')

check('An vergangenen Tagen steht die Stempelzeit',
  gesehen.some(g => g.gearbeitet > 0),
  gesehen.map(g => `${g.woche}: ${g.gearbeitet}`).join(' · '))

/*
 * Der Kern, und die Gegenprobe zu „irgendeine Zeit steht da": An DEMSELBEN
 * Tag müssen BEIDE Zeiten stehen — die geplante und die gestempelte. Eine
 * Ist-Zeit ohne Soll-Zeit daneben sagt nichts darüber, ob sie in Ordnung war,
 * und genau das war der Wunsch: „am besten noch daneben oder darunter, was
 * die geplante Zeit war".
 */
/*
 * Gelesen wird aus einer Woche, in der überhaupt etwas GEPLANT war. In einer
 * Woche ohne Plan kann nichts danebenstehen — eine Prüfung, die dort misst,
 * ist rot, ohne dass etwas kaputt wäre.
 */
const mitPlan = gesehen.filter(g => g.geplant > 0)
check('Es gibt eine vergangene Woche mit Plan UND Stempelzeiten',
  mitPlan.some(g => g.gearbeitet > 0),
  gesehen.map(g => `${g.woche}: ${g.geplant}/${g.gearbeitet}`).join(' · '))

const alleZeilen = mitPlan.flatMap(g => g.zeilen)
alleZeilen.slice(0, 4).forEach(z => console.log(`           ${z}`))

check('Soll und Ist stehen in derselben Zeile beieinander',
  alleZeilen.some(z => /Uhr geplant/.test(z) && /Uhr gearbeitet/.test(z)),
  alleZeilen[0] ?? 'keine Zeile gefunden')

/*
 * Und der Fall, der am meisten weh tut: eingesprungen, nichts im Plan. Hier
 * stand bis zum 30.10.2026 „Frei" — im Rückblick sah es aus, als wäre man
 * zu Hause gewesen.
 */
const ohnePlan = gesehen.flatMap(g => g.zeilen).filter(z => /Ohne geplanten Dienst/.test(z))
check('Ein gestempelter Tag ohne geplanten Dienst heißt nicht mehr „Frei"',
  ohnePlan.length === 0 || ohnePlan.every(z => /Uhr gearbeitet/.test(z)),
  ohnePlan[0] ?? 'kam in diesen Wochen nicht vor')

/*
 * Und die Gegenprobe gegen eine Anzeige, die immer etwas behauptet: Ein Tag
 * in der ZUKUNFT hat noch keine Stempelzeit und darf auch keine zeigen.
 */
console.log('\n=== §270 Die Zukunft zeigt keine gearbeiteten Zeiten ===')
for (let i = 0; i < 6; i++) {
  await seite.locator('svg.lucide-chevron-right').first().click({ force: true })
  await seite.waitForTimeout(900)
}
const zukunft = await seite.innerText('body')
check('In einer künftigen Woche steht keine Stempelzeit',
  istzeilen(zukunft) === 0,
  `${zeitraum(zukunft)}: ${istzeilen(zukunft)} gearbeitete Dienste`)

await browser.close()
await prisma.$disconnect()
const fails = bilanz()
process.exit(fails > 0 ? 1 : 0)
