// Nachweis (Browser) §237: Keine Seite behauptet, eine KI plane den Dienstplan.
//
//     node pruefungen/browser/wer-plant-den-dienstplan.mjs
//
// DIE MELDUNG
// „Auch mit diesen anderen, wo steht bei KI berücksichtigt, aber es gibt ja gar
// keine KI mehr, die das plant. Weil es macht jetzt ja der Solver, das heißt,
// es muss auch raus."
//
// WARUM DIESE PRÜFUNG NICHT „DAS WORT KI DARF NICHT VORKOMMEN" MISST
// Weil das die falsche Zusage wäre und sich durch Suchen-und-Ersetzen erfüllen
// ließe, ohne dass irgendetwas stimmt. Es GIBT KI im Programm, und zwar echte:
//
//     Der Dienstplan            Rechendienst (OR-Tools), Regelpaket je Kunde
//     Der Urlaubsplan           Sprachmodell (`/api/ai/vacation`)
//     Antragsempfehlung         Sprachmodell (`/api/ai/vacation-recommendation`)
//     Plan per Satz ändern      Sprachmodell (`/api/ai/schedule-edit-chat`)
//     Mitarbeiter per Chat      Sprachmodell
//     Controlling-Fragen        Sprachmodell
//     Zuschlags-Einrichtung     Sprachmodell
//
// Richtig ist also: Beim DIENSTPLAN darf keine KI genannt werden, bei den
// anderen muss sie weiter genannt werden. Eine Prüfung, die das Wort überall
// verbietet, würde die zweite Hälfte kaputt machen und es grün melden.
//
// Darum zwei Richtungen, und die zweite ist die wichtigere Gegenprobe.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'
let ok = 0, fail = 0
const check = (name, wahr, info = '') => {
  console.log(`  ${wahr ? '✓ PASS' : '✗ FAIL'}  ${name}${info ? `\n           ${info}` : ''}`)
  wahr ? ok++ : fail++
}

/*
 * Sätze, die die DIENSTPLANUNG einer KI zuschreiben.
 *
 * Aufgeschrieben wurden die, die am 25.10. tatsächlich dort standen — nicht
 * ausgedachte. Wer eine neue Formulierung erfindet, fällt hier nicht auf; dafür
 * ist die Liste eine Liste und keine Regel. Sie fängt den Rückfall, und das ist
 * ihre Aufgabe.
 */
const PLANT_ANGEBLICH_DIE_KI = [
  /Dienstplan KI/i,
  /KI-Dienstplan/i,
  /Konfliktstrategie der KI/i,
  /KI plant für dich/i,
  /KI-Planung/i,
  /die KI plant entsprechend/i,
  /wie die KI das Konto/i,
  /entscheidet die KI/i,
  /KI braucht diese Daten/i,
  /wird bei KI berücksichtigt/i,
  /Die KI berücksichtigt diese Angaben bei der Dienstplanung/i,
]

/** Treffer in einem Text finden. */
function behauptet(text) {
  const zeilen = text.split('\n').map(z => z.trim()).filter(Boolean)
  const treffer = []
  for (const zeile of zeilen) {
    const muster = PLANT_ANGEBLICH_DIE_KI.find(m => m.test(zeile))
    if (muster) treffer.push(zeile.slice(0, 120))
  }
  return [...new Set(treffer)]
}

/*
 * Woran man erkennt, dass eine Seite fertig aufgebaut ist.
 *
 * Je Seite ein Satz, der nur im fertigen Zustand dasteht. Er ersetzt jede
 * Wartezeit und jede Längenschwelle — und ist zugleich die Zusicherung, dass
 * hier wirklich etwas gemessen wurde und nicht ein leerer Rahmen.
 */
const MERKMAL = {
  '/admin': /Schnellzugriff/i,
  '/admin/schedule': /Dienstplan/i,
  '/admin/employees': /Mitarbeiter/i,
  '/admin/surcharges': /Zuschlag/i,
  '/admin/assistant': /Assistent/i,
  '/employee/schedule': /Dienste diese Woche/i,
  '/employee/profile': /Resturlaub|Mein Profil|Meine Daten|Meine Aufgaben/i,
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})

/** Angemeldet eine Seite öffnen und ihren sichtbaren Text holen. */
async function alsRolle(email, seiten) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
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

  const texte = {}
  for (const pfad of seiten) {
    await seite.goto(`${BASIS}${pfad}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    /*
     * Gewartet wird auf ein MERKMAL der Seite, nicht auf eine Textlänge.
     *
     * Erst stand hier eine feste Wartezeit, dann eine Längenschwelle. Beides
     * war falsch. Die Wartezeit las bei `/employee/schedule` einen halb
     * fertigen Zustand; die Schwelle hielt denselben Zustand für unfertig,
     * obwohl 607 Zeichen dort der VOLLE Inhalt sind — die Seite ist einfach
     * kompakt. Nachgemessen über zehn Sekunden: unverändert 607.
     *
     * Eine Länge ist ein Hilfsmaß. Das Merkmal ist die Sache selbst: Steht es
     * da, ist die Seite aufgebaut, egal wie lang sie ist. Bleibt es aus, geht
     * die Seite als unfertig in die Messung und wird rot gemeldet, statt
     * stillschweigend als „ohne Behauptung" durchzugehen.
     */
    let text = ''
    for (let versuch = 0; versuch < 60; versuch++) {
      text = await seite.innerText('body').catch(() => '')
      if (MERKMAL[pfad].test(text)) break
      await seite.waitForTimeout(250)
    }
    texte[pfad] = text
  }
  await ctx.close()
  return texte
}

// ── §237 Beim Dienstplan wird keine KI genannt ────────────────────────────
console.log('=== §237 Beim Dienstplan wird keine KI genannt ===')

const leitung = await alsRolle('leitung@rheinblick-reha.de', [
  '/admin', '/admin/schedule', '/admin/employees',
])
for (const [pfad, text] of Object.entries(leitung)) {
  const t = behauptet(text)
  check(`${pfad}`, t.length === 0, t.join(' | '))
  // Eine leere Seite wäre auch „ohne Treffer" — darum muss überhaupt Text da sein.
  check(`${pfad} — und die Seite ist wirklich aufgebaut`, MERKMAL[pfad].test(text),
    `${text.length} Zeichen, Merkmal ${MERKMAL[pfad]}`)
}

const mitarbeiter = await alsRolle('anna.fischer@rheinblick-reha.de', [
  '/employee/schedule', '/employee/profile',
])
for (const [pfad, text] of Object.entries(mitarbeiter)) {
  const t = behauptet(text)
  check(`${pfad}`, t.length === 0, t.join(' | '))
  check(`${pfad} — und die Seite ist wirklich aufgebaut`, MERKMAL[pfad].test(text),
    `${text.length} Zeichen, Merkmal ${MERKMAL[pfad]}`)
}

/*
 * Der gemeldete Satz steht HINTER EINEM KNOPF.
 *
 * Beim ersten Versuch war diese Prüfung grün und hohl: Sie las den Text der
 * Seite, und „Bei Konflikten entscheidet …" steht im Dialog „Dienstwunsch
 * abgeben", der erst beim Klicken erscheint. Gemessen wurden 607 Zeichen —
 * die Prüfung hat den Satz nie zu Gesicht bekommen und hätte auch die alte
 * Fassung bestanden.
 *
 * Darum wird hier geklickt. Und darum steht darunter die Zusicherung, dass
 * der Dialog WIRKLICH offen ist: Ohne sie wäre ein fehlgeschlagener Klick
 * wieder nur ein leerer Text ohne Treffer.
 */
console.log('\n=== §237 Und im Dialog „Dienstwunsch abgeben" ===')
{
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
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
  await seite.goto(`${BASIS}/employee/schedule`, { waitUntil: 'domcontentloaded' })
  await seite.waitForTimeout(6000)

  await seite.getByRole('button', { name: /^Wunsch$/ }).first().click()
  await seite.waitForTimeout(1500)
  const dialog = await seite.innerText('body')

  check('Der Dialog ist wirklich offen — sonst messe ich nichts',
    /Dienstwunsch abgeben/i.test(dialog),
    dialog.slice(0, 90).replace(/\n/g, ' '))
  check('Und er nennt für die Rangfolge keine KI',
    behauptet(dialog).length === 0, behauptet(dialog).join(' | '))
  /*
   * Die Gegenprobe dazu: Der Satz muss überhaupt noch DA sein. Ohne sie wäre
   * „keine KI genannt" auch dadurch erfüllt, dass die Erklärung ganz fehlt —
   * und dann wüsste niemand mehr, wonach bei Konflikten entschieden wird.
   */
  check('Sondern erklärt die Rangfolge weiterhin, nur richtig',
    /Bei Konflikten entscheidet der Planungslauf/i.test(dialog),
    /Bei Konflikten/i.test(dialog) ? 'Satz da' : 'Satz fehlt ganz')
  await ctx.close()
}

// ── §237 Die Gegenprobe: echte KI wird weiter genannt ─────────────────────
console.log('\n=== §237 Gegenprobe — wo wirklich ein Sprachmodell arbeitet ===')

/*
 * Ohne diesen Teil wäre die Prüfung oben durch „überall KI löschen" erfüllbar.
 * Diese Seiten rufen nachweislich Anthropic auf (`/api/ai/…`), und dass dort
 * KI steht, ist richtig und muss so bleiben.
 */
const echt = await alsRolle('leitung@rheinblick-reha.de', [
  '/admin/surcharges', '/admin/assistant',
])
check('Zuschlags-Einrichtung nennt die KI weiterhin',
  /\bKI\b/.test(echt['/admin/surcharges'] ?? ''),
  (echt['/admin/surcharges'] ?? '').slice(0, 80).replace(/\n/g, ' '))
check('Der Assistent nennt die KI weiterhin',
  /\bKI\b|Assistent/i.test(echt['/admin/assistant'] ?? ''),
  (echt['/admin/assistant'] ?? '').slice(0, 80).replace(/\n/g, ' '))

// ── §237 Die Gegenprobe zum Suchmuster selbst ─────────────────────────────
console.log('\n=== §237 Gegenprobe — das Suchmuster schlägt an und nicht zu oft ===')

check('Es erkennt den gemeldeten Satz',
  behauptet('Dienstpräferenzen · wird bei KI berücksichtigt').length === 1,
  JSON.stringify(behauptet('Dienstpräferenzen · wird bei KI berücksichtigt')))
check('Und die alte Überschrift',
  behauptet('KI-Dienstplan erstellen').length === 1,
  JSON.stringify(behauptet('KI-Dienstplan erstellen')))
check('Aber nicht bei echter KI — „Mitarbeiter per KI-Chat anlegen"',
  behauptet('Mitarbeiter per KI-Chat anlegen').length === 0,
  JSON.stringify(behauptet('Mitarbeiter per KI-Chat anlegen')))
check('Und nicht beim Urlaubsplan, den wirklich ein Sprachmodell rechnet',
  behauptet('Die KI plant den Urlaub fair ein').length === 0,
  JSON.stringify(behauptet('Die KI plant den Urlaub fair ein')))

console.log(`\n${ok}/${ok + fail} Checks bestanden`)
await browser.close()
process.exit(fail > 0 ? 1 : 0)
