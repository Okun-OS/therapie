// Nachweis (Browser) §200: Adresse tauschen auf beiden Ebenen, und das
// Planungsprofil ohne die Felder, die nie in einen Plan geflossen sind.
//
//     node pruefungen/browser/zugang-und-planungsprofil.mjs
//
// Die Schnittstelle ist in `pruefungen/a5-zugang.mjs` nachgewiesen. Hier geht
// es darum, ob die Bedienung auf dem Bildschirm steht — bei der
// Standortleitung UND bei der Geschäftsführung — und ob ein Klick wirklich
// dorthin führt.
//
// Gegenprobe beim Planungsprofil: Die Planstunden und die Schichtvorliebe
// müssen noch da sein. Sonst wäre „die alten Felder fehlen" auch dann grün,
// wenn sich der Abschnitt gar nicht geöffnet hätte.

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
const mail = (teil) => `${teil}-${MARKE}@pruefung.test`

async function adresseTauschen(seite, neu) {
  const zugang = seite.locator('[data-test="zugang"]')
  await zugang.getByRole('button', { name: /Adresse ändern/ }).click()
  await zugang.locator('[data-test="zugang-neue-email"]').fill(neu)
  check('Vor dem Absenden steht da, was passiert',
    /Einladungslink wird ungültig|Anmeldung wechselt/.test(await zugang.innerText()))
  await Promise.all([
    seite.waitForResponse(r => r.url().includes('/invite') && r.request().method() === 'POST'),
    zugang.getByRole('button', { name: /Ändern und einladen/ }).click(),
  ])
  await seite.waitForTimeout(500)
  return zugang
}

try {
  console.log('=== Standortleitung ===')
  const { ctx, seite } = await anmelden('leitung@rheinblick-reha.de')
  const me = await (await seite.request.get(`${BASIS}/api/auth/me`)).json()
  const name = `Zugang Browser ${MARKE}`
  const angelegt = await (await seite.request.post(`${BASIS}/api/employees`, {
    data: { name, email: mail('vorher'), position: 'Pflegefachkraft', weeklyHours: 20, locationId: me.user.locationId },
  })).json()
  const id = angelegt.employee?.id

  await seite.goto(`${BASIS}/admin/employees`)
  await seite.waitForLoadState('networkidle')
  await seite.getByText(name, { exact: true }).first().click()
  const zugang = seite.locator('[data-test="zugang"]')
  await zugang.waitFor()
  check('In den Details steht der Zugang mit der Adresse',
    (await zugang.locator('[data-test="zugang-email"]').innerText()) === mail('vorher'))
  check('…und ob die Einladung angenommen ist',
    /noch nicht angenommen/.test(await zugang.locator('[data-test="zugang-stand"]').innerText()),
    await zugang.locator('[data-test="zugang-stand"]').innerText())

  await adresseTauschen(seite, mail('standort'))
  check('Nach dem Tausch steht die neue Adresse da',
    (await zugang.locator('[data-test="zugang-email"]').innerText()) === mail('standort'))
  check('Und eine Einladung an sie ist offen',
    /noch nicht angenommen/.test(await zugang.locator('[data-test="zugang-stand"]').innerText()))

  console.log('\n=== Planungsprofil ===')
  await seite.getByRole('button', { name: /Planungsprofil/ }).click()
  await seite.locator('[data-test="planstunden"]').waitFor()
  const dialog = await seite.locator('[role="dialog"]').last().innerText().catch(async () =>
    seite.locator('body').innerText())
  check('Gegenprobe: die Planstunden sind da', await seite.locator('[data-test="planstunden"]').count() === 1)
  check('Gegenprobe: die Schicht-Präferenz ist da — das Kita-Paket liest sie', /Schicht-Präferenz/.test(dialog))
  check('Gegenprobe: die Zuschlagsregelung ist da', /Zuschlagsregelung/.test(dialog))
  for (const weg of ['Kinder-Abholzeiten', 'Wochenend-Vereinbarung', 'Max. aufeinanderfolgende Tage', 'Dauerhafte Planungsnotiz']) {
    check(`„${weg}" ist entfernt`, !dialog.includes(weg))
  }

  /*
   * §225 Das Tagesmuster — bis hierher gab es dafür kein Eingabefeld.
   *
   * Das Feld stand in der Datenbank, die Prüfung in `tagesmuster.ts`, der
   * Rechendienst las es — nur konnte es niemand ausfüllen. Das Regelpaket
   * der Kita sagt ausdrücklich: „Wer keines hinterlegt hat, wird wie bisher
   * frei verplant." Genau das ist beim Kunden passiert: Eine
   * 35-Stunden-Kraft bekam 7:30–15:00, dann 7:00–15:30, dann 8:00–13:00.
   * Die Woche stimmte, der Plan war unbrauchbar.
   */
  check('Das Tagesmuster lässt sich eintragen', /Tagesmuster/.test(dialog))

  const zeilenVorher = await seite.locator('[data-test="muster-stunden"]').count()
  await seite.getByRole('button', { name: /Dienstlänge/ }).click()
  await seite.waitForTimeout(300)
  check('Eine Dienstlänge lässt sich hinzufügen',
    await seite.locator('[data-test="muster-stunden"]').count() === zeilenVorher + 1)

  // Beliebige Längen, nicht nur eine Handvoll fester Fälle: Eine
  // 30-Stunden-Kraft mit einem Sechsstundentag muss sich genauso eintragen
  // lassen wie „fünfmal sieben".
  const auswahl = await seite.locator('[data-test="muster-stunden"]').last()
    .locator('option').allInnerTexts()
  check('Die Dienstlängen gehen in Viertelstunden',
    auswahl.includes('6 Std.') && auswahl.includes('7,5 Std.') && auswahl.includes('8 Std.'),
    `${auswahl.length} Längen zur Wahl`)

  await seite.locator('[data-test="muster-tage"]').last().selectOption('1')
  await seite.locator('[data-test="muster-stunden"]').last().selectOption('6')
  await seite.waitForTimeout(400)
  const rueckmeldung = await seite.locator('body').innerText()
  check('Die Maske rechnet mit und sagt, was herauskommt',
    /Std\. auf \d+ Tagen|Das Muster ergibt|Das Muster belegt/.test(rueckmeldung),
    (rueckmeldung.match(/Das Muster [^\n]+|[\d,]+ Std\. auf \d+ Tagen/) ?? ['—'])[0].slice(0, 80))

  await seite.request.patch(`${BASIS}/api/employees/${id}`, { data: { active: false } })
  await ctx.close()

  console.log('\n=== Geschäftsführung ===')
  const { ctx: c2, seite: gf } = await anmelden('gf@rheinblick-reha.de')
  await gf.goto(`${BASIS}/company/employees/${id}`)
  await gf.waitForLoadState('networkidle')
  const zugangGf = gf.locator('[data-test="zugang"]')
  await zugangGf.waitFor()
  check('Auch auf Unternehmensebene steht der Zugang',
    (await zugangGf.locator('[data-test="zugang-email"]').innerText()) === mail('standort'))
  await adresseTauschen(gf, mail('unternehmen'))
  check('Die neue Adresse steht im Zugang',
    (await zugangGf.locator('[data-test="zugang-email"]').innerText()) === mail('unternehmen'))
  check('…und oben im Kopf der Seite',
    (await gf.locator('body').innerText()).includes(mail('unternehmen')))
  const fehlerAntwort = await (async () => {
    await zugangGf.getByRole('button', { name: /Adresse ändern/ }).click()
    await zugangGf.locator('[data-test="zugang-neue-email"]').fill('anna.fischer@rheinblick-reha.de')
    await Promise.all([
      gf.waitForResponse(r => r.url().includes('/invite') && r.request().method() === 'POST'),
      zugangGf.getByRole('button', { name: /Ändern und einladen/ }).click(),
    ])
    await gf.waitForTimeout(300)
    return zugangGf.innerText()
  })()
  check('Eine vergebene Adresse: der Grund steht im Feld', /bereits vergeben/.test(fehlerAntwort))
  await c2.close()
} finally {
  await browser.close()
}

console.log(`\n${ok} bestanden, ${fail} fehlgeschlagen`)
process.exit(fail > 0 ? 1 : 0)
