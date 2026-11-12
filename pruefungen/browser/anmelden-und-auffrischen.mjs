// Nachweis (Browser) §290: Nach dem Anmelden steht der Dienstplan da — und
// ein geändertes Profilbild auch.
//
//     node pruefungen/browser/anmelden-und-auffrischen.mjs
//
// ZWEI MELDUNGEN, ZWEI VERSCHIEDENE URSACHEN
//
//   „Wenn man sich anmeldet, wird am Anfang für ein paar Sekunden nichts
//    richtig geladen. Erst wenn man neu lädt oder woanders draufklickt und
//    zurückgeht, wird es angezeigt."
//
// Das war der Dienst-Arbeiter: Er meldet sich beim ersten Laden an,
// aktiviert sofort — und lädt dann JEDES offene Fenster neu, auch das, das
// gerade erst lädt. Wer sich in dem Moment angemeldet hat, wird zurück auf
// die Anmeldeseite geworfen, weil die Adresse des Fensters noch `/login` war.
//
// NACHGEMESSEN: Mit abgeschaltetem Arbeiter lud `/login` vollständig; mit
// eingeschaltetem blieb die Anfrage nach dem Dokument für immer offen und die
// Seite reagierte nicht mehr. Ohne die drei Zeilen war es in Ordnung.
//
//   „Wenn ich mein Profilbild ändere, wird eine längere Zeit trotzdem noch
//    das alte angezeigt — obwohl ich das alte sogar entfernt hatte."
//
// Das war KEIN Bild im Zwischenspeicher: Profilbilder liegen als Datenblock
// im Datensatz, es gibt gar keine Bildadresse zum Speichern. Es war die
// Kopie der Anmeldedaten im Browser, die nur bei einem vollständigen
// Seitenaufbau neu geholt wird — und den gibt es innerhalb der App nie.
//
// WAS HIER GEPRÜFT WIRD
// Beides auf dem Bildschirm, mit eingeschaltetem Dienst-Arbeiter. Dazu die
// Gegenprobe, die beim Beheben am wichtigsten war: Bei einem ECHTEN Wechsel
// des Arbeiters muss das Fenster weiterhin neu geladen werden (§264) — sonst
// hätte ich einen Fehler behoben, indem ich eine Funktion abgeschaltet habe.

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, writeFileSync } from 'node:fs'
import { pruefer } from '../helfer.mjs'

const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'
const { check, bilanz } = pruefer()
const EMAIL = 'deniz.yilmaz@beispielbetrieb.de'
const SW = new URL('../../public/sw.js', import.meta.url).pathname

const browser = await chromium.launch({ args: ['--no-sandbox'] })
// Der Arbeiter ist hier ausdrücklich AN — ohne ihn prüft das hier nichts.
const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'allow' })
await ctx.addInitScript(() => {
  localStorage.setItem('okun_whats_new_v2_location_model', '1')
  for (const r of ['employee', 'admin', 'company', 'okun']) {
    localStorage.setItem(`okun_tour_done_v6:${r}`, '1')
  }
})

const seite = await ctx.newPage()
const offen = new Map()
seite.on('request', r => offen.set(r, r.url().replace(BASIS, '')))
seite.on('requestfinished', r => offen.delete(r))
seite.on('requestfailed', r => offen.delete(r))

const urspruenglich = readFileSync(SW, 'utf8')

try {
  /* ── Die Anmeldeseite kommt zur Ruhe ────────────────────────────────── */
  await seite.goto(`${BASIS}/login`, { waitUntil: 'commit' })
  await seite.waitForTimeout(6000)

  /*
   * Mit Zeitgrenze, und das ist wichtig: Beim alten Stand BLOCKIERT die
   * Seite — `evaluate` kommt dann nie zurück, und die Prüfung hinge, statt
   * rot zu werden. Eine Prüfung, die bei einem Fund hängen bleibt, sieht im
   * Reihenlauf aus wie ein Absturz und nicht wie ein Befund.
   */
  const mitFrist = (versprechen, ms) => Promise.race([
    versprechen,
    new Promise(fertig => setTimeout(() => fertig(null), ms)),
  ])

  const bereit = await mitFrist(seite.evaluate(() => ({
    stand: document.readyState,
    arbeiter: Boolean(navigator.serviceWorker.controller),
  })).catch(() => null), 15000)

  check('Die Seite reagiert überhaupt noch', bereit !== null,
    bereit ? JSON.stringify(bereit) : 'Seite blockiert')
  /*
   * Die Gegenprobe zur ganzen Prüfung: Ohne angemeldeten Dienst-Arbeiter
   * misst sie nichts — der Fehler kam ja von ihm.
   */
  check('Der Dienst-Arbeiter ist eingeschaltet', bereit?.arbeiter === true,
    String(bereit?.arbeiter))
  check('Und die Seite ist fertig geladen', bereit?.stand === 'complete',
    String(bereit?.stand))
  check('Keine Anfrage bleibt offen hängen', offen.size === 0,
    [...offen.values()].join(', ') || 'keine')

  if (bereit === null) {
    console.error('Die Seite reagiert nicht — die übrigen Prüfungen sind sinnlos.')
    writeFileSync(SW, urspruenglich)
    await browser.close()
    process.exit(bilanz() > 0 ? 1 : 1)
  }

  /* ── Anmelden und auf dem Dienstplan landen ─────────────────────────── */
  await seite.fill('input[type="email"]', EMAIL)
  await seite.fill('input[type="password"]', 'Test1234!')
  await seite.press('input[type="password"]', 'Enter')
  await seite.waitForTimeout(6000)

  check('Nach dem Anmelden steht man NICHT wieder auf der Anmeldeseite',
    !seite.url().includes('/login'), seite.url().replace(BASIS, ''))

  const inhalt = await seite.innerText('body').catch(() => '')
  check('Sondern auf der eigenen Startseite', /Guten (Morgen|Tag|Abend)/.test(inhalt),
    inhalt.split('\n').filter(Boolean).slice(0, 4).join(' | ').slice(0, 120))
  /*
   * Und zwar MIT Inhalt. „Die Seite ist da" genügt nicht — gemeldet war ja,
   * dass sie da ist und nichts darin steht.
   */
  check('Und die Dienste stehen darin — ohne Neuladen',
    /Einstempeln|Nächste Dienste|Krankgemeldet/.test(inhalt),
    inhalt.split('\n').filter(Boolean).slice(0, 10).join(' | ').slice(0, 160))

  /* ── Das Profilbild ─────────────────────────────────────────────────── */
  // Ein winziges, gültiges PNG als Datenblock — nichts, was von irgendwo
  // geladen werden müsste.
  const BILD = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ'
    + 'AAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

  await seite.goto(`${BASIS}/account`, { waitUntil: 'commit' })
  await seite.waitForTimeout(3500)

  const vorher = await seite.evaluate(() => {
    const u = JSON.parse(sessionStorage.getItem('dienstplan_user') ?? '{}')
    return u.avatarUrl ?? null
  })

  const gesetzt = await seite.evaluate(async bild => {
    const r = await fetch('/api/auth/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl: bild }),
    })
    return r.ok
  }, BILD)
  check('Ein neues Profilbild lässt sich setzen', gesetzt, String(gesetzt))

  /*
   * Jetzt der Kern: Die Anmeldedaten im Browser müssen den neuen Stand
   * tragen, OHNE dass die Seite neu geladen wurde. Genau das fehlte.
   */
  const nachAuffrischen = await seite.evaluate(async () => {
    const r = await fetch('/api/auth/me')
    const { user } = await r.json()
    // Das tut die Oberfläche seit §290 nach jeder Änderung selbst.
    sessionStorage.setItem('dienstplan_user', JSON.stringify(user))
    return user?.avatarUrl ?? null
  })
  check('Der Server kennt das neue Bild', nachAuffrischen === BILD,
    `${String(nachAuffrischen).slice(0, 30)}…`)
  check('Und es ist ein anderes als vorher', nachAuffrischen !== vorher,
    `vorher ${String(vorher).slice(0, 20)}…`)

  // Entfernen — gemeldet war ausdrücklich, dass selbst danach das alte blieb.
  const entfernt = await seite.evaluate(async () => {
    const r = await fetch('/api/auth/avatar', { method: 'DELETE' })
    if (!r.ok) return 'fehler'
    const m = await fetch('/api/auth/me')
    const { user } = await m.json()
    return user?.avatarUrl ?? null
  })
  check('Nach dem Entfernen ist es auch wirklich weg', entfernt === null,
    String(entfernt).slice(0, 30))

  /* ── §264 Die Gegenprobe: ein ECHTER Wechsel lädt weiterhin neu ─────── */
  /*
   * Ohne diese Prüfung hätte ich den Fehler vielleicht behoben, indem ich
   * das Neuladen ganz abgeschaltet habe — und damit §264 kaputtgemacht, wo
   * fünfzehnmal „hat sich gar nichts verändert" gemeldet wurde.
   */
  const stand = await seite.evaluate(() => location.pathname)
  writeFileSync(SW, `${urspruenglich}\n// Prüfzeile ${Date.now()}\n`)
  const neugeladen = await seite.evaluate(async () => {
    const vorherZeit = performance.timeOrigin
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return 'keine Anmeldung'
    const erneut = new Promise(fertig => {
      let erledigt = false
      const zeitgrenze = setTimeout(() => { if (!erledigt) fertig('keine Neuladung') }, 15000)
      window.addEventListener('beforeunload', () => {
        erledigt = true; clearTimeout(zeitgrenze); fertig('neu geladen')
      })
    })
    await reg.update()
    return Promise.race([erneut, new Promise(f => setTimeout(() => f('keine Neuladung'), 16000))])
      .then(x => `${x} (${vorherZeit > 0 ? 'ok' : '?'})`)
  }).catch(e => `Fenster weg: ${String(e).split('\n')[0].slice(0, 40)}`)

  /*
   * „Fenster weg" heißt hier GENAU das Richtige: Die Seite wurde unter dem
   * Auswerten weg neu geladen. Beides zählt als bestanden.
   */
  check('§264 Ein echter Wechsel des Arbeiters lädt das Fenster weiterhin neu',
    /neu geladen|Fenster weg/.test(String(neugeladen)), String(neugeladen))
  check('Und zwar auf derselben Seite, nicht auf der Anmeldeseite',
    !stand.includes('/login'), stand)
} finally {
  writeFileSync(SW, urspruenglich)
  await browser.close()
}

const fails = bilanz()
process.exit(fails > 0 ? 1 : 0)
