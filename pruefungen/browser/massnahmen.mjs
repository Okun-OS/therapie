// Nachweis (Browser): Maßnahmen entscheiden — im echten Dienstplan.
//
// WARUM DIESE PRÜFUNG NICHT IM GESAMTLAUF STECKT
// Sie braucht einen echten Browser, einen laufenden Rechendienst und den
// Demo-Mandanten `npm run seed:kita`. Playwright ist keine Abhängigkeit des
// Projekts. Eine Prüfung, die in der Ablaufkette aus Umgebungsgründen rot
// wird, bringt niemandem etwas und wird nach zwei Wochen ignoriert. Deshalb
// liegt sie hier im Unterordner: `readdirSync` in `lauf.mjs` steigt nicht hinab.
//
//     npm run seed:kita
//     node pruefungen/browser/massnahmen.mjs
//
// WAS SIE PRÜFT, WAS EINE HTTP-PRÜFUNG NICHT KANN
// `f6-massnahmen.mjs` prüft die Schnittstelle: entscheiden, umentscheiden,
// wiederfinden, und wer nicht darf. Es sagt nichts darüber, ob eine Leitung
// die Maßnahme im Dienstplan überhaupt zu sehen bekommt. Genau dort lag beim
// letzten Mal der Fehler, den die HTTP-Prüfungen nicht finden konnten:
// „undefined" stand in der Pfändungsliste auf dem Bildschirm.
//
// Der Weg ist der echte: anmelden, in die künftige Woche blättern, Plan
// rechnen lassen, die Lücke sehen, genehmigen, eine Notiz schreiben, die
// Seite neu laden — und prüfen, dass die Entscheidung noch da steht.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { PrismaClient } from '@prisma/client'

const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'
const STANDORT = 'demo-standort-kita2'
const prisma = new PrismaClient()

let ok = 0, fail = 0
const check = (name, wahr, info = '') => {
  console.log(`  ${wahr ? '✓ PASS' : '✗ FAIL'}  ${name}${info ? `\n           ${info}` : ''}`)
  wahr ? ok++ : fail++
}

// ── Der Zeitraum, den die Maske rechnen wird ───────────────────────────────
// Die Dienstplanmaske startet in der laufenden Woche (Montag bis Sonntag) und
// blättert mit dem Pfeil weiter. Die Prüfung blättert einmal nach rechts und
// rechnet dieselbe Woche aus — sonst läge die Notlage im falschen Zeitraum
// und der Plan ginge auf.
function montagDieserWoche(d = new Date()) {
  const tag = d.getDay()
  const m = new Date(d)
  m.setDate(d.getDate() - tag + (tag === 0 ? -6 : 1))
  m.setHours(12, 0, 0, 0)
  return m
}
const iso = d => d.toISOString().slice(0, 10)
const plusTage = (d, n) => { const x = new Date(d); x.setDate(d.getDate() + n); return x }

const MONTAG = plusTage(montagDieserWoche(), 7)   // die Woche, in die geblättert wird
const WOCHE = Array.from({ length: 5 }, (_, i) => iso(plusTage(MONTAG, i)))
const VON = WOCHE[0], BIS = iso(plusTage(MONTAG, 6))

console.log(`Zeitraum ${VON} bis ${BIS}\n`)

// ── Ausgangszustand herstellen (Regel 1 der README) ────────────────────────
//
// Die Notlage aus der Abnahme: Auf der oberen Etage fallen beide Katrins,
// Heike und Corinna ganz aus, Daniel und Stephanie teilweise, die Springerin
// ist weg — und die untere Etage gibt niemanden ab, weil dort Eingewöhnung
// ist. Damit stehen zeitweise drei Kräfte für vier Gruppen, und der
// Rechendienst muss etwas vorschlagen statt etwas Komisches zu planen.
const mail = n => n.toLowerCase().replace(/ /g, '.')
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  + '@kita-regenbogen.de'

async function notlageHerstellen() {
  const standort = await prisma.location.findUnique({ where: { id: STANDORT } })
  if (!standort) {
    console.error('Der Demo-Mandant fehlt. Bitte zuerst: npm run seed:kita')
    process.exit(1)
  }

  await prisma.planungsMassnahme.deleteMany({ where: { locationId: STANDORT } })
  await prisma.absence.deleteMany({
    where: { locationId: STANDORT, note: 'Nachweis Maßnahmen' },
  })

  const wegDamit = async (name, tage) => {
    const e = await prisma.employee.findUnique({ where: { email: mail(name) } })
    if (!e) throw new Error(`Der Demo-Mandant kennt „${name}" nicht`)
    for (const [von, bis] of tage) {
      await prisma.absence.create({
        data: {
          locationId: STANDORT, employeeId: e.id, employeeName: e.name,
          type: 'sick', startDate: von, endDate: bis,
          days: Math.round((Date.parse(bis) - Date.parse(von)) / 86_400_000) + 1,
          note: 'Nachweis Maßnahmen', submittedAt: iso(new Date()),
        },
      })
    }
  }
  for (const name of ['Katrin K Nolte', 'Katrin Ulrich', 'Heike Stein', 'Corinna Vogel', 'Nicole Sprung']) {
    await wegDamit(name, [[VON, BIS]])
  }
  await wegDamit('Daniel Fuchs', [[WOCHE[3], WOCHE[4]]])
  await wegDamit('Stephanie Lang', [[WOCHE[4], WOCHE[4]]])

  await prisma.planningUnit.updateMany({
    where: { id: { in: ['demo-g1', 'demo-g2', 'demo-g3', 'demo-g4'] } },
    data: { abgabeGesperrtBis: BIS, abgabeGrund: 'Eingewöhnung' },
  })
}

await notlageHerstellen()

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})
const ctx = await browser.newContext()
await ctx.addInitScript(() => {
  localStorage.setItem('okun_whats_new_v2_location_model', '1')
  for (const r of ['employee', 'admin', 'company', 'okun']) {
    localStorage.setItem(`okun_tour_done_v6:${r}`, '1')
  }
})
const seite = await ctx.newPage()

console.log('=== Anmelden und planen ===')
await seite.goto(`${BASIS}/login`)
await seite.fill('input[type="email"]', 'leitung@kita-regenbogen.de')
await seite.fill('input[type="password"]', 'Test1234!')
await seite.click('button[type="submit"]')
await seite.waitForTimeout(5000)

await seite.goto(`${BASIS}/admin/schedule`)
await seite.waitForLoadState('networkidle')
await seite.waitForTimeout(2000)

// Eine Woche weiter — dorthin, wo die Notlage liegt.
await seite.locator('[data-test="woche-vor"]').click()
await seite.waitForTimeout(1200)

check('Die Dienstplanmaske ist erreichbar',
  await seite.locator('button', { hasText: 'Plan erstellen' }).count() > 0)

await seite.locator('button', { hasText: 'Plan erstellen' }).first().click()
await seite.waitForTimeout(1500)
// Der Stundenkonto-Check vor dem Lauf — bestätigen und rechnen lassen.
await seite.locator('[data-test="planung-starten"]').click()

// Der Rechendienst braucht für zwei Etagen und acht Gruppen ein paar Sekunden.
await seite.waitForSelector('[data-test="massnahmen-panel"]', { timeout: 180_000 })
  .catch(() => {})

await seite.waitForFunction(() => {
  const el = document.querySelector('[data-test="massnahmen-panel"]')
  return el !== null && !el.innerText.includes('Lade bisherige Entscheidungen')
}, { timeout: 20_000 }).catch(() => {})

console.log('\n=== Die Maßnahmen stehen auf dem Bildschirm ===')
const panel = seite.locator('[data-test="massnahmen-panel"]')
check('Das Maßnahmen-Feld erscheint', await panel.count() === 1,
  'Ohne das Feld hat der Vorschlag die Oberfläche nicht erreicht')

if (await panel.count() !== 1) {
  console.log('\nOhne Vorschlag ist der Rest sinnlos — Abbruch.')
  await browser.close(); await prisma.$disconnect()
  process.exit(1)
}

const text = await panel.innerText()
check('Es steht da, worum es geht', /aufteilen/i.test(text), text.slice(0, 200))
check('Und dass es nachgerechnet wurde',
  /nachgerechnet|beste erreichbare/i.test(text),
  text.split('\n').slice(0, 4).join(' | '))
check('Kein „undefined" auf dem Bildschirm', !/undefined/.test(text),
  text.match(/.{0,40}undefined.{0,40}/)?.[0] ?? '')

const karten = panel.locator('[data-test^="massnahme-aufteilen-"]')
const anzahl = await karten.count()
check('Zu jeder unbesetzten Gruppe steht eine Karte', anzahl > 0, `${anzahl} Karten`)

const ersteId = await karten.first().getAttribute('data-test')
const schluessel = ersteId.replace('massnahme-', '')

console.log('\n=== Ablehnen, zurücknehmen, genehmigen ===')
await panel.locator(`[data-test="massnahme-ablehnen-${schluessel}"]`).click()
await seite.waitForTimeout(1500)
const statusFeld = panel.locator(`[data-test="massnahme-status-${schluessel}"]`)
check('Eine Maßnahme lässt sich ablehnen',
  /abgelehnt/i.test(await statusFeld.innerText()), await statusFeld.innerText())

await panel.locator(`[data-test="massnahme-zuruecknehmen-${schluessel}"]`).click()
await seite.waitForTimeout(1500)
check('Und wieder zurücknehmen',
  /offen/i.test(await statusFeld.innerText()), await statusFeld.innerText())

await panel.locator(`[data-test="massnahme-genehmigen-${schluessel}"]`).click()
await seite.waitForTimeout(1500)
check('Die Karte steht danach auf „Genehmigt"',
  /genehmigt/i.test(await statusFeld.innerText()), await statusFeld.innerText())
check('Der Zähler oben zählt mit',
  /1\/\d+ entschieden/.test(await panel.innerText()),
  (await panel.innerText()).match(/\d+\/\d+ entschieden/)?.[0] ?? '')

console.log('\n=== Die Notiz ===')
const SATZ = 'Frau Berger kommt aus dem Urlaub zurück und übernimmt.'
await panel.locator(`[data-test="massnahme-notiz-${schluessel}"]`).click()
await seite.waitForTimeout(400)
await panel.locator(`[data-test="massnahme-kommentar-${schluessel}"]`).fill(SATZ)
await panel.locator('button', { hasText: 'Notiz speichern' }).first().click()
await seite.waitForTimeout(1500)
check('Die Notiz steht unter der Maßnahme',
  (await panel.innerText()).includes('Frau Berger'),
  (await panel.innerText()).slice(0, 300))
check('Und wer sie geschrieben hat',
  /Franke Leitner|leitung@kita-regenbogen\.de/.test(await panel.innerText()),
  (await panel.innerText()).slice(0, 300))

console.log('\n=== Was in der Datenbank steht ===')
const gespeichert = await prisma.planungsMassnahme.findMany({ where: { locationId: STANDORT } })
const genehmigt = gespeichert.filter(m => m.status === 'genehmigt')
check('Genau eine Maßnahme ist genehmigt', genehmigt.length === 1,
  gespeichert.map(m => `${m.tag}:${m.status}`).join(', '))
check('Der Satz steht im Klartext dabei',
  genehmigt[0]?.kommentar === SATZ, genehmigt[0]?.kommentar)
check('Die Gruppe steht mit Namen dabei, nicht nur mit Kennung',
  /Gruppe \d/.test(genehmigt[0]?.zielName ?? ''), genehmigt[0]?.zielName)
check('Die Kennung des entscheidenden Kontos ist festgehalten',
  !!genehmigt[0]?.entschiedenVonId, genehmigt[0]?.entschiedenVonId)
const GENEHMIGTER_TAG = genehmigt[0]?.tag

console.log('\n=== Die Entscheidung überlebt den nächsten Lauf ===')
//
// Der eigentliche Punkt. Nach einer Krankmeldung wird neu gerechnet — und
// zwar mit der genehmigten Aufteilung. Der Rechendienst schlägt sie dann
// NICHT mehr vor, weil die Lücke zu ist. Genau daran ist beim ersten
// Durchlauf aufgefallen, dass die eigene Entscheidung aus dem Blick
// verschwand: Die Maske zeigte nur, was der aktuelle Lauf vorschlägt.
await seite.reload()
await seite.waitForLoadState('networkidle')
await seite.waitForTimeout(1500)
await seite.locator('[data-test="woche-vor"]').click()
await seite.waitForTimeout(1000)
await seite.locator('button', { hasText: 'Plan erstellen' }).first().click()
await seite.waitForTimeout(1500)
await seite.locator('[data-test="planung-starten"]').click()
await seite.waitForSelector('[data-test="massnahmen-panel"]', { timeout: 180_000 }).catch(() => {})

const panel2 = seite.locator('[data-test="massnahmen-panel"]')
check('Das Maßnahmen-Feld ist auch im zweiten Lauf da', await panel2.count() === 1)
// Die gespeicherten Entscheidungen werden nachgeladen — erst danach messen.
await seite.waitForFunction(() => {
  const el = document.querySelector('[data-test="massnahmen-panel"]')
  return el !== null && !el.innerText.includes('Lade bisherige Entscheidungen')
}, { timeout: 20_000 }).catch(() => {})
const nachher = await panel2.innerText()
check('Die genehmigte Maßnahme steht weiter auf dem Bildschirm',
  nachher.includes(GENEHMIGTER_TAG), `gesucht: ${GENEHMIGTER_TAG}\n${nachher.slice(0, 400)}`)
const alteKarte = panel2.locator(`[data-test="massnahme-status-aufteilen-${GENEHMIGTER_TAG}"]`)
check('Sie ist noch genehmigt',
  await alteKarte.count() === 1 && /genehmigt/i.test(await alteKarte.innerText()),
  await alteKarte.count() === 1 ? await alteKarte.innerText() : 'Karte fehlt')
check('Es steht dabei, dass der Plan sie nicht mehr vorschlägt',
  /Früher entschieden/.test(nachher), nachher.slice(0, 400))
check('Und die Notiz steht noch da', nachher.includes('Frau Berger'),
  nachher.slice(0, 400))

// Die Genehmigung hat gewirkt: Für den genehmigten Tag darf keine offene
// Lücke mehr gemeldet werden. Sonst hätte das Häkchen nichts bewirkt.
const zweiterLauf = await prisma.planningSession.findFirst({
  where: { locationId: STANDORT }, orderBy: { createdAt: 'desc' },
})
const harte = (zweiterLauf?.finalPlan?.regelpaket?.verletzungen ?? [])
  .filter(v => v.art === 'hart')
check('Für den genehmigten Tag meldet der Plan keine Lücke mehr',
  !harte.some(v => (v.text ?? '').includes(GENEHMIGTER_TAG)),
  harte.map(v => v.text?.slice(0, 80)).join(' | '))

await browser.close()
await prisma.$disconnect()

console.log(`\n${ok}/${ok + fail} Checks bestanden`)
process.exit(fail > 0 ? 1 : 0)
