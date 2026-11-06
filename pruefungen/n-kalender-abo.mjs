// Nachweis §228: Das Kalender-Abo — feste Adresse, und nur die eigene.
//
//     node pruefungen/n-kalender-abo.mjs
//
// DIE MELDUNG
// „Dann hier bei dem Google Sync steht noch die alte Domain. Das muss geändert
// werden."
//
// WARUM DAS MEHR IST ALS DAS FALSCHE LOGO
// Die Maske baute die Abo-Adresse aus `window.location.origin` — aus dem
// Fenster, in dem die Person gerade stand. Wer über
// `therapie-production.up.railway.app` angemeldet war, bekam ein Abo auf diesen
// Namen. Ein Kalender-Abo liegt JAHRE im Telefon: Es wird einmal eingerichtet
// und nie wieder angesehen. Fällt der alte Name weg, hört der Dienstplan auf,
// sich zu aktualisieren — ohne Fehlermeldung, bis eine Schicht verpasst wird.
//
// DER ZWEITE BEFUND, GEFUNDEN BEIM BEHEBEN DES ERSTEN
// Die Route hatte keine Zugriffsprüfung. `requireRole(req)` ohne Rollenliste
// lässt jede angemeldete Person herein, und danach wurde die Kennung aus dem
// Abfrageteil ungeprüft benutzt. Der Token ist der SCHLÜSSEL zum Dienstplan:
// Wer ihn hat, liest ohne Anmeldung, wer wann wo arbeitet. Jede angemeldete
// Person konnte ihn für jede andere abrufen — und deren Abo ein- und
// ausschalten.
//
// WAS DIESE PRÜFUNG MISST
// Dass die Adresse NICHT vom Namen des Fensters abhängt, dass der Kalender
// unter ihr wirklich liegt, und dass eine Kollegin nicht an das Abo kommt.

import { pruefer, login, hole, sende } from './helfer.mjs'

const { check, bilanz } = pruefer()

const leitung = await login('leitung@rheinblick-reha.de')
const anna = await login('anna.fischer@rheinblick-reha.de')
const kita = await login('leitung@kita-sonnenschein.de')

const meAnna = (await hole(anna, '/api/auth/me')).body.user
const meLeitung = (await hole(leitung, '/api/auth/me')).body.user
const annaId = meAnna.employeeId
const leitungId = meLeitung.employeeId

const kollege = ((await hole(leitung, '/api/employees')).body.employees ?? [])
  .find(e => e.id !== annaId && e.locationId === meLeitung.locationId)

console.log(`Anna ${annaId?.slice(0, 8)} · Kollege ${kollege?.name}\n`)

// ── §228 Die Adresse ──────────────────────────────────────────────────────
console.log('=== §228 Die Abo-Adresse ===')

const ein = await sende(anna, '/api/calendar-sync', 'PATCH',
  { employeeId: annaId, enabled: true })
check('Anna kann ihr Kalender-Abo einschalten', ein.status === 200,
  ein.body.error ?? `enabled=${ein.body.enabled}`)
check('Die Antwort nennt die vollständige Adresse',
  typeof ein.body.feedUrl === 'string' && ein.body.feedUrl.startsWith('http'),
  ein.body.feedUrl ?? '—')

/*
 * Der Kern: Die Adresse darf nicht vom Namen abhängen, über den man
 * hereinkommt. Gefragt wird deshalb zweimal — einmal normal und einmal mit
 * einem erfundenen `Host`-Kopf, wie ihn ein zweiter Domainname mitschickt.
 */
const nochmal = await hole(anna, `/api/calendar-sync?employeeId=${annaId}`)
check('Die Adresse ist beim zweiten Abruf dieselbe',
  nochmal.body.feedUrl === ein.body.feedUrl,
  `${nochmal.body.feedUrl}`)

const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'
const mitFremdemNamen = await fetch(
  `${BASIS}/api/calendar-sync?employeeId=${annaId}`,
  { headers: { cookie: anna, host: 'therapie-production.up.railway.app' } },
).then(r => r.json()).catch(() => ({}))
check('Sie ändert sich NICHT, wenn die Anfrage einen anderen Namen trägt',
  mitFremdemNamen.feedUrl === ein.body.feedUrl,
  `mit fremdem Host: ${mitFremdemNamen.feedUrl}`)
check('Und sie trägt nicht die alte Railway-Adresse',
  !/railway\.app/.test(ein.body.feedUrl ?? ''), ein.body.feedUrl ?? '—')

check('Der rohe Schlüssel steht nicht eigens in der Antwort',
  ein.body.token === undefined && nochmal.body.token === undefined,
  Object.keys(nochmal.body).join(', '))

// ── §228 Der Kalender liegt wirklich dort ─────────────────────────────────
console.log('\n=== §228 Unter der Adresse liegt der Dienstplan ===')

const pfad = (ein.body.feedUrl ?? '').replace(/^https?:\/\/[^/]+/, '')
const kalender = await fetch(`${BASIS}${pfad}`).then(async r => ({
  status: r.status, text: await r.text(),
})).catch(() => ({ status: 0, text: '' }))
check('Der Kalender ist ohne Anmeldung abrufbar — so funktioniert ein Abo',
  kalender.status === 200, `HTTP ${kalender.status}`)
check('Und er ist eine Kalenderdatei', /BEGIN:VCALENDAR/.test(kalender.text),
  kalender.text.slice(0, 40))

// ── §228 Nur das eigene Abo ───────────────────────────────────────────────
console.log('\n=== §228 Das Abo einer Kollegin bleibt verschlossen ===')

const fremdLesen = await hole(anna, `/api/calendar-sync?employeeId=${kollege.id}`)
check('Anna kommt NICHT an das Abo einer Kollegin', fremdLesen.status === 403,
  `HTTP ${fremdLesen.status}${fremdLesen.body.feedUrl ? ` — ${fremdLesen.body.feedUrl}` : ''}`)

const fremdSchalten = await sende(anna, '/api/calendar-sync', 'PATCH',
  { employeeId: kollege.id, enabled: true })
check('Und kann es auch nicht für sie einschalten', fremdSchalten.status === 403,
  `HTTP ${fremdSchalten.status}`)

const fremdeLeitung = await hole(kita, `/api/calendar-sync?employeeId=${annaId}`)
check('Eine fremde Leitung kommt ebenfalls nicht heran',
  fremdeLeitung.status === 403 || fremdeLeitung.status === 404,
  `HTTP ${fremdeLeitung.status}`)

/*
 * Die Gegenprobe: Die EIGENE Leitung muss es dürfen. Ohne sie wäre „403 für
 * alle" grün — und das Abo für niemanden einrichtbar, der Hilfe braucht.
 */
const eigeneLeitung = await hole(leitung, `/api/calendar-sync?employeeId=${annaId}`)
check('Die eigene Leitung darf es sehen', eigeneLeitung.status === 200,
  `HTTP ${eigeneLeitung.status}`)

// ── Aufräumen ─────────────────────────────────────────────────────────────
await sende(anna, '/api/calendar-sync', 'PATCH', { employeeId: annaId, enabled: false })
void leitungId

bilanz()
