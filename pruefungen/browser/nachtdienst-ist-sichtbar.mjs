// Nachweis (Browser) §266: Ein Nachtdienst steht im Plan — und zählt richtig.
//
//     node pruefungen/browser/nachtdienst-ist-sichtbar.mjs
//
// WIE DAS GEFUNDEN WURDE
// Nicht durch eine Meldung, sondern beim Erzeugen der Bildschirmfotos für den
// App Store. Auf dem Bild stand im Dienstplan einer Pflegekraft:
//
//     4 Dienste diese Woche          −58h Stunden geplant
//
// Darunter siebenmal „Frei".
//
// ZWEI FEHLER, EINE KRANKHEIT
//
//   1. Ein Nachtdienst geht von 21:00 bis 06:30. `Ende − Anfang` ergibt −870
//      Minuten. Mal vier Dienste sind das die −58 Stunden. Diese Rechnung
//      stand an SECHS Stellen im Programm; vier hatten die Zeile „wenn
//      negativ, plus 24 Stunden", zwei nicht — der Dienstplan des
//      Mitarbeiters und seine Zeiterfassung.
//
//   2. Die Zeile, die einen Dienst zeichnet, verlangte Eintrag UND Dienstzeit
//      UND Symbol. Die Symbolkarte stand an VIER Stellen, drei davon kannten
//      `night` nicht. Ohne Symbol fiel der Dienst in den Zweig „Frei".
//
// Beide Male dasselbe: eine Vorschrift, mehrfach abgeschrieben, und die
// Abschriften sind auseinandergelaufen. Und beide Male hat es ausgerechnet
// die Ansicht getroffen, die der Mensch sieht, um den es geht — in der
// Leitungsansicht stimmte alles.
//
// WAS HIER GEPRÜFT WIRD
// Dass eine Pflegekraft im Nachtdienst ihren Dienst SIEHT und dass die Summe
// darüber positiv ist. Die Rechnung selbst prüft `dienstzeit.test.ts`; hier
// geht es darum, dass sie auch auf dem Bildschirm ankommt.

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { pruefer } from '../helfer.mjs'
import { PrismaClient } from '@prisma/client'

const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'
const prisma = new PrismaClient()
const { check, bilanz } = pruefer()

/*
 * Der Ausgangszustand, den diese Prüfung selbst herstellt: Der
 * Beispielbetrieb aus `npm run seed:schaufenster` hat einen Nachtdienst von
 * 21:00 bis 06:30 und eine Pflegekraft, die ihn fährt. Ohne ihn wäre die
 * Prüfung grün, ohne etwas gezeigt zu haben.
 */
const nacht = await prisma.shift.findFirst({
  where: { id: 'sf-nacht' },
  select: { startTime: true, endTime: true, type: true },
})
if (!nacht) {
  console.error('Der Beispielbetrieb fehlt. Erst `npm run seed:schaufenster`.')
  process.exit(1)
}
check('Es gibt einen Dienst über Mitternacht', nacht.startTime > nacht.endTime,
  `${nacht.startTime}–${nacht.endTime}, Art „${nacht.type}"`)

const mit = await prisma.employee.findFirst({
  where: { email: 'deniz.yilmaz@beispielbetrieb.de' }, select: { id: true },
})
const eintraege = await prisma.scheduleEntry.findMany({
  where: { employeeId: mit.id, shiftId: 'sf-nacht' },
  orderBy: { date: 'asc' },
  select: { date: true },
})
check('Und die Pflegekraft ist dafür eingeteilt', eintraege.length > 0,
  `${eintraege.length} Nachtdienste`)

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
await seite.fill('input[type="email"]', 'deniz.yilmaz@beispielbetrieb.de')
await seite.fill('input[type="password"]', 'Test1234!')
await seite.click('button[type="submit"]')
await seite.waitForTimeout(4500)

await seite.goto(`${BASIS}/employee/schedule`)
await seite.waitForTimeout(3500)

/*
 * §266 Nicht blättern, sondern warten.
 *
 * Ein erster Entwurf dieser Prüfung klickte sich durch die Wochen — und
 * scheiterte, weil er schon klickte, bevor die Daten da waren. Danach stand
 * er in einer leeren Woche und meldete „nicht gefunden". Das wäre ein
 * Fehlalarm gewesen, und ein Fehlalarm ist schlimmer als keine Prüfung: Beim
 * nächsten Mal glaubt man ihm nicht mehr.
 *
 * Der Dienstplan des Beispielbetriebs liegt bewusst um den heutigen Tag
 * herum. Es genügt also zu warten, bis die Woche geladen ist.
 */
await seite.waitForFunction(
  () => /Dienste diese Woche/.test(document.body.innerText),
  { timeout: 20000 },
).catch(() => {})
await seite.waitForTimeout(2000)

const text = await seite.innerText('body')


const dienste = text.match(/(\d+)\s*\n?\s*Dienste diese Woche/)
check('Die Woche enthält Dienste — sonst prüft das hier nichts',
  Number(dienste?.[1] ?? 0) > 0, dienste?.[0]?.replace(/\n/g, ' ') ?? 'keine Angabe')

/*
 * Der Kern. Vor dem Umbau stand hier „Frei", obwohl oben vier Dienste
 * gezählt wurden — der Dienst war da, nur ohne Symbol und damit unsichtbar.
 */
check('Der Nachtdienst steht im Plan und nicht „Frei"', /Nachtdienst/.test(text),
  /Nachtdienst/.test(text) ? 'gefunden' : text.slice(0, 160).replace(/\n+/g, ' '))

/*
 * Der zweite Fehler: die Summe. Gelesen wird, was auf dem Bildschirm steht —
 * nicht, was die Funktion zurückgibt. Genau dieser Unterschied hat §254
 * fünfzehn Runden gekostet.
 */
const stunden = text.match(/(-?\d+)h(?:\s*(\d+)min)?\s*\n?\s*Stunden geplant/)
check('Über dem Plan steht eine Stundenzahl', Boolean(stunden), stunden?.[0] ?? text.slice(0, 80))
if (stunden) {
  const wert = Number(stunden[1])
  check('Und sie ist NICHT negativ', wert > 0, `${stunden[0].replace(/\n/g, ' ')}`)
  /*
   * Die Gegenprobe gegen „irgendeine positive Zahl": Ein Nachtdienst ist
   * neuneinhalb Stunden. Bei mindestens einem Dienst in der Woche muss die
   * Summe also mindestens neun betragen.
   */
  check('Und sie passt zur Länge eines Nachtdienstes', wert >= 9, `${wert}h`)
}

await browser.close()
await prisma.$disconnect()
const fails = bilanz()
process.exit(fails > 0 ? 1 : 0)
