// Nachweis (Browser) §227: Eine Krankmeldung steht im Dienstplan — mit Stunden.
//
//     node pruefungen/browser/krank-im-plan.mjs
//
// DIE MELDUNG
// „Dann habe ich mal Juliane krank gemeldet. Da steht auch nicht krank, und
// dadurch hat sie halt nur 16 von 35 Stunden. Bei ihr steht dann drin frei und
// nicht krank."
//
// WAS SCHULD WAR
// Die Fehlzeiten waren im Dienstplan geladen (`ABSENCES`), und die eine Zeile,
// die sie in eine Liste umrechnete (`reportedAbsences`), wurde nirgends
// benutzt — nachgemessen mit einer einzigen Fundstelle im ganzen Modul, ihrer
// eigenen Zuweisung. Die Zelle fragte nur nach einem Dienst und zeichnete
// sonst den Knopf zum Zuweisen. Eine krankgemeldete Person sah damit aus wie
// eine, für die noch niemand geplant hat.
//
// WARUM EINE WOCHE OHNE PLAN GEWÄHLT WIRD
// Steht für einen Tag ein Dienst, gewinnt dessen Länge — so soll es sein. Für
// die Prüfung wäre das aber ein Vorhang: Sie würde den Dienst messen und nicht
// die Gutschrift. Deshalb wird in eine Woche gesprungen, für die noch niemand
// geplant hat. Dort ist jede Zelle leer, und was danach dasteht, kommt von der
// Krankmeldung.
//
// WAS DIESE PRÜFUNG MISST
// Die Beschwerde, übersetzt in zwei Zahlen: Steht in der Zelle „Krank", und
// zählt die Stundenspalte 35 von 35 statt 0. Mit Gegenprobe — ohne
// Krankmeldung muss beides wieder verschwinden, sonst bewiese ein grüner Lauf
// nur, dass die Seite irgendetwas anzeigt.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { login, hole, sende } from '../helfer.mjs'

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
const belegschaft = (await hole(leitung, '/api/employees')).body.employees ?? []

/*
 * Julia Neumann ist der gemeldete Fall, bis auf den Namen: 35 Stunden auf fünf
 * Tage. Genau hier stand „16 von 35".
 */
const tim = belegschaft.find(e => e.locationId === locationId && e.name === 'Julia Neumann')
if (!tim) {
  console.error('Julia Neumann fehlt in der Belegschaft — Demo-Daten neu einlesen.')
  process.exit(1)
}

// Acht Wochen voraus: weit genug, dass dort kein Plan steht.
const WOCHEN_VOR = 8
const heute = new Date()
const montagDieserWoche = new Date(heute)
montagDieserWoche.setDate(heute.getDate() - ((heute.getDay() + 6) % 7))
const montag = new Date(montagDieserWoche)
montag.setDate(montagDieserWoche.getDate() + WOCHEN_VOR * 7)
const iso = d => d.toISOString().slice(0, 10)
const freitag = new Date(montag); freitag.setDate(montag.getDate() + 4)

console.log(`${tim.name} · ${tim.weeklyHours} Std. auf ${tim.workDaysPerWeek} Tage`)
console.log(`Krankwoche ${iso(montag)} bis ${iso(freitag)} (${WOCHEN_VOR} Wochen voraus)\n`)

// Alte Meldungen in diesem Fenster wegräumen, sonst zählt die Gutschrift doppelt.
for (const a of (await hole(leitung, `/api/absences?employeeId=${tim.id}`)).body.absences ?? []) {
  if (a.endDate >= iso(montag) && a.startDate <= iso(freitag)) {
    await sende(leitung, `/api/absences/${a.id}`, 'DELETE', {})
  }
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
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

/** In die Prüfwoche springen und die Zeile von Tim auslesen. */
async function zeileLesen() {
  await seite.goto(`${BASIS}/admin/schedule`)
  await seite.waitForTimeout(4000)
  for (let i = 0; i < WOCHEN_VOR; i++) {
    await seite.click('[data-test="woche-vor"]')
    await seite.waitForTimeout(250)
  }
  await seite.waitForTimeout(1500)

  return seite.evaluate(id => {
    const spalte = document.querySelector(`[data-test="plan-stunden"][data-emp="${id}"]`)
    const zeile = spalte?.closest('tr')
    const zellen = [...(zeile?.querySelectorAll('[data-test="plan-ausfall"]') ?? [])]
    return {
      gefunden: !!spalte,
      ist: spalte?.getAttribute('data-ist') ?? null,
      soll: spalte?.getAttribute('data-soll') ?? null,
      ausfallZellen: zellen.length,
      arten: [...new Set(zellen.map(z => z.getAttribute('data-art')))],
      stunden: [...new Set(zellen.map(z => z.getAttribute('data-stunden')))],
      texte: [...new Set(zellen.map(z => z.textContent?.trim() ?? ''))],
      zuweisKnoepfe: zeile
        ? [...zeile.querySelectorAll('button[title="Schicht manuell zuweisen"]')].length
        : 0,
    }
  }, tim.id)
}

// ── Die Gegenprobe zuerst: ohne Krankmeldung ist die Woche leer ───────────
console.log('=== §227 Gegenprobe: ohne Krankmeldung ===')

const vorher = await zeileLesen()
check('Die Zeile im Plan steht da', vorher.gefunden)
check('In einer Woche ohne Plan steht keine Fehlzeit-Zelle',
  vorher.ausfallZellen === 0, `${vorher.ausfallZellen} Zellen`)
check('Dafür Knöpfe zum Zuweisen', vorher.zuweisKnoepfe > 0,
  `${vorher.zuweisKnoepfe} Knöpfe`)
check('Und die Stundenspalte steht bei null',
  Number(vorher.ist) === 0, `${vorher.ist} / ${vorher.soll}`)

// ── Jetzt die Krankmeldung ────────────────────────────────────────────────
console.log('\n=== §227 Nach der Krankmeldung ===')

const gemeldet = await sende(leitung, '/api/absences', 'POST', {
  employeeId: tim.id, employeeName: tim.name, locationId,
  type: 'krankheit', startDate: iso(montag), endDate: iso(freitag), days: 5,
})
check('Die Krankmeldung ist gespeichert', gemeldet.status === 200,
  gemeldet.body.error ?? gemeldet.body.absence?.id?.slice(0, 8))

const nachher = await zeileLesen()
check('Jeder Arbeitstag der Woche zeigt eine Fehlzeit', nachher.ausfallZellen === 5,
  `${nachher.ausfallZellen} von 5 Tagen`)
check('Und zwar als „Krank", nicht als frei',
  nachher.arten.length === 1 && nachher.arten[0] === 'krank',
  nachher.arten.join(', ') || '(keine)')
check('In der Zelle steht das Wort, nicht ein Strich',
  nachher.texte.every(t => t.includes('Krank')), nachher.texte.join(' | '))
check('Es gibt keinen Zuweis-Knopf mehr, wo jemand krank ist',
  nachher.zuweisKnoepfe === 0, `${nachher.zuweisKnoepfe} Knöpfe`)

/*
 * Der Kern: sieben Stunden am Tag, fünfmal, macht 35 von 35.
 *
 * Gemessen wird die EINZELNE Tagesgutschrift und die Summe. Nur die Summe zu
 * prüfen wäre zu wenig — genau das war der Fehler in §225, wo die Woche stimmte
 * und die Tage nicht.
 */
check('Jeder Tag schreibt sieben Stunden gut',
  nachher.stunden.length === 1 && Number(nachher.stunden[0]) === 7,
  nachher.stunden.join(', '))
check('Und die Woche steht bei 35 von 35, nicht bei 16',
  Number(nachher.ist) === 35 && Number(nachher.soll) === 35,
  `${nachher.ist} / ${nachher.soll}`)

// ── Und wieder zurück ─────────────────────────────────────────────────────
console.log('\n=== §227 Gegenprobe: zurückgenommen ===')

for (const a of (await hole(leitung, `/api/absences?employeeId=${tim.id}`)).body.absences ?? []) {
  if (a.endDate >= iso(montag) && a.startDate <= iso(freitag)) {
    await sende(leitung, `/api/absences/${a.id}`, 'DELETE', {})
  }
}
const danach = await zeileLesen()
check('Ohne die Meldung ist die Woche wieder leer',
  danach.ausfallZellen === 0 && Number(danach.ist) === 0,
  `${danach.ausfallZellen} Zellen, ${danach.ist} Std.`)

console.log(`\n${ok}/${ok + fail} Checks bestanden`)
await browser.close()
process.exit(fail > 0 ? 1 : 0)
