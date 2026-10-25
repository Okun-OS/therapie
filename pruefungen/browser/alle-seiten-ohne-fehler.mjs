// Nachweis (Browser) §234: Jede Seite öffnet ohne Fehlermeldung.
//
//     node pruefungen/browser/alle-seiten-ohne-fehler.mjs
//
// WARUM ES DIESE PRÜFUNG GIBT
// Gefragt wurde: „Und die anderen ganzen Fehlermeldungen hast du auch gemacht,
// was ich dir geschickt habe mit den ganzen Bildern?"
//
// Die Bilder liegen nicht mehr vor. Statt zu raten, welche Meldung auf welchem
// Bild stand, sucht diese Prüfung sie selbst — auf jeder Seite, in jeder Rolle.
// Danach ist die Frage beantwortbar, ohne die Bilder zu haben: Entweder es gibt
// irgendwo eine Fehlermeldung, oder es gibt keine.
//
// WAS ALS FEHLER GILT
//   1. Die Fehlerseite des Gerüsts („Etwas ist schiefgelaufen", `error.tsx`).
//   2. Sichtbarer Text, der nach Panne klingt — „Fehler", „fehlgeschlagen",
//      „konnte nicht", „ist schiefgelaufen", „Unexpected", „undefined".
//   3. Eine Ausnahme im Browser (`pageerror`).
//   4. Eine Anfrage an die eigene Schnittstelle mit 5xx.
//
// WAS AUSDRÜCKLICH NICHT ALS FEHLER GILT
// Leere Listen, „noch keine Daten", fehlende Berechtigung. Eine Seite ohne
// Inhalt ist kein Fehler, und eine 403 auf eine fremde Kennung ist der
// gewünschte Zustand. Ohne diese Unterscheidung wäre die Prüfung ein
// Rauschmelder und würde nach dem dritten Fehlalarm nicht mehr gelesen.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'
let ok = 0, fail = 0
const check = (name, wahr, info = '') => {
  console.log(`  ${wahr ? '✓ PASS' : '✗ FAIL'}  ${name}${info ? `\n           ${info}` : ''}`)
  wahr ? ok++ : fail++
}

/** Was auf einer Seite stehen darf, obwohl es nach Fehler klingt. */
const HARMLOS = [
  // Erklärtexte und Hilfen sprechen über Fehler, ohne einer zu sein.
  /Fehler melden/i, /Fehlerkreislauf/i, /Fehlzeit/i, /Fehltage/i, /Fehlerquote/i,
  /bei Fehlern/i, /Fehler gefunden/i, /keine Fehler/i, /Fehlermeldung/i,
  // Die Wörter kommen in Feldbeschreibungen vor.
  /fehlende Angaben/i, /fehlt noch/i, /fehlen noch/i,
]

const VERDÄCHTIG = [
  /Etwas ist schiefgelaufen/i,
  /ist schiefgelaufen/i,
  /Ein Fehler ist aufgetreten/i,
  /konnte nicht geladen werden/i,
  /konnte nicht gespeichert werden/i,
  /fehlgeschlagen/i,
  /Unexpected token/i,
  /Application error/i,
  /\bundefined\b/,
  /\[object Object\]/,
  /NaN/,
]

const ROLLEN = [
  {
    name: 'Standortleitung', email: 'leitung@rheinblick-reha.de',
    seiten: [
      '/admin', '/admin/schedule', '/admin/employees', '/admin/time-tracking',
      '/admin/urlaub', '/admin/substitutions', '/admin/tasks', '/admin/calendar',
      '/admin/nachrichten', '/admin/nachweise', '/admin/reports',
      '/admin/auswertungen', '/admin/workforce-score', '/admin/recruiting',
      '/admin/assistant', '/admin/settings', '/admin/surcharges', '/admin/payroll',
    ],
  },
  {
    name: 'Unternehmen', email: 'gf@rheinblick-reha.de',
    seiten: [
      '/company', '/company/employees', '/company/locations', '/company/bereiche',
      '/company/payroll', '/company/lohnverwaltung', '/company/surcharges',
      '/company/reports', '/company/nachrichten', '/company/nachweise',
      '/company/datenschutz', '/company/settings', '/company/support',
      '/company/recruiting', '/company/schedule', '/company/substitutions',
      '/company/vacation-plan',
    ],
  },
  {
    name: 'Mitarbeiter', email: 'anna.fischer@rheinblick-reha.de',
    seiten: [
      '/employee', '/employee/schedule', '/employee/time-tracking',
      '/employee/vacation', '/employee/krank', '/employee/nachrichten',
      '/employee/lohn', '/employee/profile', '/employee/ich', '/employee/daten',
      '/employee/nachweise', '/employee/substitutions', '/employee/workforce-score',
    ],
  },
  {
    name: 'OKUN', email: 'okun@okun.de',
    seiten: [
      '/okun', '/okun/customers', '/okun/dienstplanung', '/okun/invitations',
      '/okun/support', '/okun/test-accounts', '/okun/bugs',
    ],
  },
]

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})

/** Den auffälligen Text einer Seite finden — ohne die harmlosen Treffer. */
function auffaellig(text) {
  const zeilen = text.split('\n').map(z => z.trim()).filter(Boolean)
  const treffer = []
  for (const zeile of zeilen) {
    if (HARMLOS.some(h => h.test(zeile))) continue
    const muster = VERDÄCHTIG.find(v => v.test(zeile))
    if (muster) treffer.push(zeile.slice(0, 120))
  }
  return [...new Set(treffer)]
}

const befunde = []

for (const rolle of ROLLEN) {
  console.log(`\n=== §234 ${rolle.name} ===`)

  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
  await ctx.addInitScript(() => {
    localStorage.setItem('okun_whats_new_v2_location_model', '1')
    for (const r of ['employee', 'admin', 'company', 'okun']) {
      localStorage.setItem(`okun_tour_done_v6:${r}`, '1')
    }
  })
  const seite = await ctx.newPage()

  // Ausnahmen und 5xx mitschreiben — eine Seite kann heil aussehen und
  // trotzdem im Hintergrund kaputt sein.
  const ausnahmen = []
  const serverfehler = []
  /*
   * „Failed to fetch" wird NICHT gezählt.
   *
   * Beim Weiterblättern bricht der Browser die noch laufenden Anfragen der
   * verlassenen Seite ab, und jede davon wirft diesen Satz. Nachgemessen
   * wanderte er zwischen den Läufen von `/admin/time-tracking` zu
   * `/admin/urlaub` — er gehört also zur Prüfung, nicht zur Anwendung.
   *
   * Ein echter Netzwerkfehler bliebe trotzdem nicht unbemerkt: Was der Server
   * ablehnt, fängt die 5xx-Erfassung darunter, und was die Seite kaputt
   * macht, steht als Fehlerseite im Text. Diesen einen Satz mitzuzählen hätte
   * die Prüfung dagegen zum Rauschmelder gemacht — und das verbietet ihr
   * eigener Kopf.
   */
  seite.on('pageerror', e => {
    const text = String(e.message)
    if (/Failed to fetch|NetworkError|The operation was aborted/i.test(text)) return
    ausnahmen.push(text.slice(0, 160))
  })
  seite.on('response', r => {
    if (r.status() >= 500 && r.url().includes('/api/')) {
      serverfehler.push(`${r.status()} ${r.url().replace(BASIS, '')}`.slice(0, 160))
    }
  })

  await seite.goto(`${BASIS}/login`)
  await seite.fill('input[type="email"]', rolle.email)
  await seite.fill('input[type="password"]', 'Test1234!')
  await seite.click('button[type="submit"]')
  await seite.waitForTimeout(5000)

  for (const pfad of rolle.seiten) {
    ausnahmen.length = 0
    serverfehler.length = 0
    let text = ''
    try {
      await seite.goto(`${BASIS}${pfad}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await seite.waitForTimeout(2600)
      text = await seite.innerText('body')
    } catch (err) {
      befunde.push({ rolle: rolle.name, pfad, art: 'Seite lud nicht', info: String(err).slice(0, 120) })
      check(`${pfad}`, false, `lud nicht: ${String(err).slice(0, 90)}`)
      continue
    }

    const imText = auffaellig(text)
    const alles = [
      ...imText.map(t => `Text: ${t}`),
      ...ausnahmen.map(t => `Ausnahme: ${t}`),
      ...serverfehler.map(t => `Server: ${t}`),
    ]
    if (alles.length > 0) {
      befunde.push({ rolle: rolle.name, pfad, art: 'Fehler', info: alles.join(' | ') })
    }
    check(`${pfad}`, alles.length === 0, alles.slice(0, 3).join('\n           '))
  }

  await ctx.close()
}

/*
 * Die Gegenprobe: Die Prüfung muss einen Fehler überhaupt FINDEN können.
 *
 * Ohne sie bewiese ein grüner Lauf nur, dass sie nichts sucht. Aufgerufen wird
 * eine Seite, die es nicht gibt — dort steht die Fehlerseite des Gerüsts.
 */
console.log('\n=== §234 Gegenprobe: ein echter Fehler wird erkannt ===')
const ctx = await browser.newContext()
const seite = await ctx.newPage()
await seite.goto(`${BASIS}/admin/diese-seite-gibt-es-nicht`, { waitUntil: 'domcontentloaded' })
await seite.waitForTimeout(1500)
const text404 = await seite.innerText('body').catch(() => '')
check('Eine Seite, die es nicht gibt, sagt das',
  /Diese Seite gibt es nicht/i.test(text404),
  text404.slice(0, 110).replace(/\n/g, ' '))
/*
 * §234 Und zwar auf Deutsch. Genau das hat diese Gegenprobe gefunden: Ohne
 * eigene `not-found.tsx` zeigte Next.js seine Vorlage — „404 — This page could
 * not be found.", englisch, ohne Logo und ohne Weg zurück. Mitten in einem
 * Programm, das sonst durchgehend Deutsch spricht.
 */
check('Auf Deutsch, nicht in der Vorlage des Gerüsts',
  !/This page could not be found/i.test(text404),
  /This page could not be found/i.test(text404) ? 'englische Vorlage' : 'eigene Seite')
check('Mit einem Weg zurück',
  /Zur Startseite/i.test(text404), text404.slice(0, 110).replace(/\n/g, ' '))

const kunst = 'Die Abrechnung konnte nicht gespeichert werden.'
check('Und das Suchmuster erkennt eine echte Fehlermeldung',
  auffaellig(kunst).length === 1, JSON.stringify(auffaellig(kunst)))
check('Ohne bei einem harmlosen Satz anzuschlagen',
  auffaellig('3 Fehltage im Monat. Fehler melden.').length === 0,
  JSON.stringify(auffaellig('3 Fehltage im Monat. Fehler melden.')))

await ctx.close()

if (befunde.length > 0) {
  console.log('\n── Befunde ──────────────────────────────────────────────')
  for (const b of befunde) console.log(`  ${b.rolle} · ${b.pfad}\n    ${b.info}`)
}

console.log(`\n${ok}/${ok + fail} Checks bestanden`)
await browser.close()
process.exit(fail > 0 ? 1 : 0)
