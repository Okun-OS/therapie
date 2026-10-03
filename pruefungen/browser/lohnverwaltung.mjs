// Nachweis (Browser): Die Masken für Pfändung, bAV, Kurzarbeit und Umlagen.
//
// WARUM DIESE PRÜFUNG NICHT IM GESAMTLAUF STECKT
// Sie braucht einen echten Browser. Playwright ist keine Abhängigkeit des
// Projekts — es liegt nur auf der Entwicklungsmaschine. Eine Prüfung, die in
// der Ablaufkette aus Umgebungsgründen rot wird, bringt niemandem etwas und
// wird nach zwei Wochen ignoriert. Deshalb liegt sie hier im Unterordner:
// `readdirSync` in `lauf.mjs` steigt nicht hinab.
//
//     node pruefungen/browser/lohnverwaltung.mjs
//
// WAS SIE PRÜFT, WAS EINE HTTP-PRÜFUNG NICHT KANN
// Ob die Sätze, die vor einem Fehler bewahren, auch wirklich AUF DEM BILDSCHIRM
// stehen: die beiden bAV-Grenzen vor dem Eintragen, die Warnung oberhalb der
// Beitragsgrenze noch während des Tippens, die Ausschlussfrist der Kurzarbeit
// ungefragt, das Pflichtfeld bei einer Unterhaltspfändung. Und dass die
// Standortleitung die Seite gar nicht erst zu sehen bekommt.
//
// Beim Bauen hat sie einen echten Fehler gefunden: In der Pfändungsliste stand
// „undefined" statt der Art. Der Rückfall wurde auf dem gedefaulteten Wert
// geprüft, übernommen aber der rohe. Gegenprüfungen dazu stehen jetzt in
// d17-pfaendung.mjs und d18-bav.mjs.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASIS = 'http://localhost:3000'
let ok = 0, fail = 0
const check = (name, wahr, info = '') => {
  console.log(`  ${wahr ? '✓ PASS' : '✗ FAIL'}  ${name}${info ? `\n           ${info}` : ''}`)
  wahr ? ok++ : fail++
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

const MARKE = Date.now().toString(36)

console.log('=== Die Seite als Unternehmen ===')
const { ctx: c1, seite } = await anmelden('gf@rheinblick-reha.de')
await seite.goto(`${BASIS}/company/lohnverwaltung`)
await seite.waitForLoadState('networkidle')
await seite.waitForTimeout(1200)

for (const bereich of ['umlagen', 'bav', 'pfaendung', 'kurzarbeit']) {
  check(`Der Bereich „${bereich}" ist da`,
    await seite.locator(`[data-test="${bereich}"]`).count() === 1)
}

const umlagen = seite.locator('[data-test="umlagen"]')
check('Die Betriebsgröße nennt die Zählweise nach §3 AAG',
  /§3 AAG/.test(await umlagen.innerText()),
  (await umlagen.innerText()).match(/Gewichtet[^.]*\./)?.[0] ?? '')

const bav = seite.locator('[data-test="bav"]')
const bavText = await bav.innerText()
check('Die bAV nennt beide Grenzen, bevor etwas eingetragen ist',
  /Steuerfrei \(§3 Nr\. 63 EStG\)/.test(bavText) && /Beitragsfrei \(SvEV\)/.test(bavText))
check('Und zwar die eine im Jahr, die andere im Monat',
  /im Jahr/.test(bavText) && /im Monat/.test(bavText))

const pf = seite.locator('[data-test="pfaendung"]')
check('Die Pfändung sagt, dass die Standortleitung sie nicht sieht',
  /Standortleitung sieht sie nicht/.test(await pf.innerText()))

const kug = seite.locator('[data-test="kurzarbeit"]')
check('Die Kurzarbeit nennt die Ausschlussfrist ungefragt',
  /§109 Abs\. 1 SGB III/.test(await kug.innerText()),
  (await kug.innerText()).match(/Leistungsantrag[^(]*/)?.[0] ?? '')

// ── Umlagesatz eintragen ───────────────────────────────────────────────────
console.log('\n=== Umlagesatz eintragen ===')
const KASSE = `UITest ${MARKE}`
await umlagen.locator('input[placeholder="Krankenkasse"]').fill(KASSE)
await umlagen.locator('input[placeholder="U1 %"]').fill('2,1')
await umlagen.locator('input[placeholder="Erstattung %"]').fill('80')
await umlagen.locator('input[placeholder="U2 %"]').fill('0,65')
await umlagen.getByRole('button', { name: /Speichern/ }).click()
await seite.waitForTimeout(1800)
const liste = await seite.locator('[data-test="umlagen-liste"]').innerText()
check('Der Satz steht in der Liste', liste.includes(KASSE))
check('Prozent bleiben Prozent — nicht durch hundert geteilt',
  /U1 2,1 %/.test(liste),
  liste.split('\n').find(z => z.includes('2,1')) ?? liste.slice(0, 120))
check('Die Erstattungsstufe steht dabei', /Erstattung 80 %/.test(liste))

// ── bAV ────────────────────────────────────────────────────────────────────
console.log('\n=== Entgeltumwandlung anlegen ===')
await bav.locator('input[placeholder="€ / Monat"]').fill('600')
await seite.waitForTimeout(500)
check('Die Maske warnt VOR dem Speichern über der Beitragsgrenze',
  /über der monatlichen Beitragsgrenze/.test(await bav.innerText()),
  (await bav.innerText()).match(/[^\n]*Beitragsgrenze[^\n]*/)?.[0] ?? '')

await bav.locator('select').first().selectOption({ index: 1 })
await bav.locator('input[placeholder="Anbieter"]').fill(`Allianz ${MARKE}`)
await bav.locator('input[placeholder="€ / Monat"]').fill('200')
await seite.waitForTimeout(300)
check('Bei 200 € meldet sie stattdessen, dass alles frei bleibt',
  /bleiben ganz frei/.test(await bav.innerText()))
await bav.getByRole('button', { name: /Anlegen/ }).click()
await seite.waitForTimeout(2000)
const bavListe = await seite.locator('[data-test="bav-liste"]').innerText().catch(() => '')
check('Der Vertrag steht in der Liste', bavListe.includes(`Allianz ${MARKE}`),
  bavListe.split('\n').find(z => z.includes(MARKE)) ?? bavListe.slice(0, 150))
check('Mit dem Durchführungsweg, nicht mit „undefined"',
  /Direktversicherung/.test(bavListe))

// ── Pfändung ───────────────────────────────────────────────────────────────
console.log('\n=== Pfändung erfassen ===')
await pf.locator('select').first().selectOption({ index: 1 })
await pf.locator('input[placeholder="Gläubiger"]').fill(`Stadtkasse ${MARKE}`)
await pf.locator('input[placeholder="Aktenzeichen"]').fill(`AZ-${MARKE}`)
await pf.locator('input[placeholder="€ (leer bei Unterhalt)"]').fill('3000')
await pf.getByRole('button', { name: /Erfassen/ }).click()
await seite.waitForTimeout(2000)
const pfListe = await seite.locator('[data-test="pfaendung-liste"]').innerText().catch(() => '')
check('Die Pfändung steht in der Liste', pfListe.includes(`Stadtkasse ${MARKE}`))
check('Der Tag der Zustellung steht dabei — er bestimmt den Rang',
  /zugestellt am \d{2}\.\d{2}\.\d{4}/.test(pfListe))

await pf.locator('select').nth(1).selectOption('unterhalt')
await seite.waitForTimeout(400)
const unterhalt = await pf.innerText()
check('Bei Unterhalt erscheint das Pflichtfeld aus dem Beschluss',
  /Notwendiger Unterhalt lt\. Beschluss/i.test(unterhalt))
check('Mit dem Hinweis, dass ohne ihn nichts einbehalten wird',
  /Fehlt er, wird nichts einbehalten/.test(unterhalt))

// ── Kurzarbeit ─────────────────────────────────────────────────────────────
console.log('\n=== Kurzarbeit anzeigen ===')
await kug.getByRole('button', { name: /Neue Anzeige/ }).click()
await seite.waitForTimeout(400)
await kug.locator('input[placeholder="Betriebsteil, z. B. Wohnbereich 2"]').fill(`WB ${MARKE}`)
await kug.locator('input[placeholder="Kug-Aktenzeichen"]').fill(`KUG-${MARKE}`)
await kug.getByRole('button', { name: /Anlegen/ }).click()
await seite.waitForTimeout(2000)
const kugListe = await seite.locator('[data-test="kug-anzeigen"]').innerText().catch(() => '')
check('Die Anzeige steht in der Liste', kugListe.includes(`WB ${MARKE}`),
  kugListe.split('\n').find(z => z.includes(MARKE)) ?? kugListe.slice(0, 150))
check('Die Monatsfelder erscheinen erst mit einer Anzeige',
  await kug.locator('input[placeholder="Sollentgelt €"]').count() === 1)

// ── Abschottung ────────────────────────────────────────────────────────────
console.log('\n=== Abschottung ===')
const { ctx: c2, seite: leitung } = await anmelden('leitung@rheinblick-reha.de')
await leitung.goto(`${BASIS}/company/lohnverwaltung`)
await leitung.waitForTimeout(3000)
check('Die Standortleitung bekommt die Seite nicht zu sehen',
  await leitung.locator('[data-test="pfaendung"]').count() === 0,
  leitung.url())
check('Und keinen Gläubigernamen',
  !(await leitung.locator('body').innerText()).includes(`Stadtkasse ${MARKE}`))

await c1.close(); await c2.close(); await browser.close()
console.log(`\n${ok}/${ok + fail} Checks bestanden`)
process.exit(fail ? 1 : 0)
