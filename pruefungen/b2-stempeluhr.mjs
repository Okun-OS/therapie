// Nachweis B7: Die Stempeluhr.
//
// Auf der Startseite der Mitarbeiter-App stand ein Knopf „Einstempeln", der
// NICHTS getan hat — er hat nur die Anzeige umgeschaltet. Wer darauf gedrückt
// hat und weggegangen ist, war nicht eingestempelt. In einem System, in dem
// die gestempelte Zeit direkt Geld wird, ist das der schlimmste Fehler von
// allen: Er sieht aus wie Erfolg.
//
// Geprüft wird deshalb vor allem: Was der Server sagt, ist der Zustand — und
// die Reihenfolge der Handgriffe lässt sich nicht umgehen.

import { BASIS, pruefer, login, hole, sende } from './helfer.mjs'

const { check, bilanz } = pruefer()

const person = await login('maria.schneider@rheinblick-reha.de')
const gf = await login('gf@rheinblick-reha.de')
const mPerson = (await hole(person, '/api/auth/me')).body.user

const stempeln = (cookie, aktion, zeitpunkt) =>
  sende(cookie, '/api/time-tracking/stempeln', 'POST',
    zeitpunkt === undefined ? { aktion } : { aktion, zeitpunkt })

const zustand = async cookie =>
  (await hole(cookie, '/api/time-tracking/stempeln')).body.zustand

// Ausgangszustand: nicht eingestempelt. Sonst prüft der Rest ins Leere.
if ((await zustand(person))?.laeuft) await stempeln(person, 'gehen')

console.log(`Person ${String(mPerson.employeeId).slice(0, 8)}\n`)

// ── B7 Der Zustand kommt vom Server ────────────────────────────────────────
console.log('=== B7 Einstempeln ===')

const vorher = await zustand(person)
check('Zu Beginn läuft nichts', vorher?.laeuft === false, JSON.stringify(vorher))

const ohneVorgang = await stempeln(person, 'gehen')
check('Ausstempeln ohne Einstempeln wird abgelehnt', ohneVorgang.status === 409,
  `HTTP ${ohneVorgang.status} · ${ohneVorgang.body.error}`)

const pauseOhne = await stempeln(person, 'pause-start')
check('Pause ohne Einstempeln wird abgelehnt', pauseOhne.status === 409,
  pauseOhne.body.error)

const ein = await stempeln(person, 'kommen')
check('Einstempeln geht', ein.status === 200 && ein.body.zustand?.laeuft === true,
  ein.body.error)
check('Und wird wirklich gespeichert — nicht nur angezeigt',
  (await zustand(person))?.laeuft === true)
check('Die Zeitbuchung entsteht dabei', !!ein.body.log?.id && !!ein.body.log?.clockIn,
  `${ein.body.log?.date} ${ein.body.log?.clockIn}`)
check('Sie ist als in der App gestempelt gekennzeichnet', ein.body.log?.quelle === 'app',
  ein.body.log?.quelle)

const doppelt = await stempeln(person, 'kommen')
check('Zweimal einstempeln wird abgelehnt', doppelt.status === 409,
  doppelt.body.error)
check('Und die Ablehnung sagt, wie es weitergeht',
  /stemple erst aus/i.test(doppelt.body.error ?? ''), doppelt.body.error)
check('Sie schickt den echten Zustand mit — nach einem Funkloch ist er oft anders',
  doppelt.body.zustand?.laeuft === true)

// ── B7 Pause ───────────────────────────────────────────────────────────────
console.log('\n=== B7 Pause ===')

const pauseAn = await stempeln(person, 'pause-start')
check('Pause beginnen geht', pauseAn.body.zustand?.pause === true)

const pauseDoppelt = await stempeln(person, 'pause-start')
check('Eine zweite Pause in der Pause wird abgelehnt', pauseDoppelt.status === 409)

const pauseAus = await stempeln(person, 'pause-ende')
check('Pause beenden geht', pauseAus.body.zustand?.pause === false)
check('Aber die Erfassung läuft weiter', pauseAus.body.zustand?.laeuft === true)

const pauseNochmal = await stempeln(person, 'pause-ende')
check('Eine Pause, die nicht läuft, lässt sich nicht beenden', pauseNochmal.status === 409)

// ── B7 Der Zeitpunkt aus dem Funkloch ──────────────────────────────────────
console.log('\n=== B7 Zeitpunkt vom Gerät ===')

await stempeln(person, 'gehen')

const vorZweiStunden = new Date(Date.now() - 2 * 3600_000).toISOString()
const nachgereicht = await stempeln(person, 'kommen', vorZweiStunden)
check('Ein Zeitpunkt aus dem Funkloch wird übernommen',
  nachgereicht.body.log?.clockIn === vorZweiStunden.slice(11, 16)
  || nachgereicht.body.quelle === 'offline',
  `${nachgereicht.body.log?.clockIn} · Quelle ${nachgereicht.body.quelle}`)
check('Und als nachgereicht gekennzeichnet — der Zeitpunkt entscheidet über Lohn',
  nachgereicht.body.log?.quelle === 'offline', nachgereicht.body.log?.quelle)

await stempeln(person, 'gehen')

const zukunft = new Date(Date.now() + 3 * 3600_000).toISOString()
const ausDerZukunft = await stempeln(person, 'kommen', zukunft)
check('Ein Zeitpunkt aus der Zukunft wird verworfen',
  ausDerZukunft.body.quelle === 'app',
  ausDerZukunft.body.hinweis)
check('Und es wird gesagt, warum',
  /Zukunft/.test(ausDerZukunft.body.hinweis ?? ''), ausDerZukunft.body.hinweis)

await stempeln(person, 'gehen')

const vorgestern = new Date(Date.now() - 48 * 3600_000).toISOString()
const zuAlt = await stempeln(person, 'kommen', vorgestern)
check('Was zu lange zurückliegt, wird nicht angenommen',
  zuAlt.body.quelle === 'app', zuAlt.body.hinweis)
check('Mit dem Hinweis, dass so etwas die Leitung nachträgt',
  /Standortleitung/.test(zuAlt.body.hinweis ?? ''), zuAlt.body.hinweis)

// ── B7 Man stempelt für sich selbst ────────────────────────────────────────
console.log('\n=== B7 Für wen gestempelt wird ===')

const ohneMitarbeiter = await stempeln(gf, 'kommen')
check('Ein Zugang ohne Mitarbeiterdatensatz kann nicht stempeln',
  ohneMitarbeiter.status === 403, `HTTP ${ohneMitarbeiter.status}`)

// Die Person steckt in der Sitzung, nicht in der Anfrage — eine fremde
// Kennung mitzuschicken aendert daran nichts.
const fremdeKennung = await sende(person, '/api/time-tracking/stempeln', 'POST', {
  aktion: 'pause-start', employeeId: 'jemand-anderes',
})
check('Eine mitgeschickte fremde Kennung wird ignoriert',
  fremdeKennung.status === 200 || fremdeKennung.status === 409,
  `HTTP ${fremdeKennung.status}`)

const unbekannt = await stempeln(person, 'tanzen')
check('Ein unbekannter Handgriff wird abgelehnt', unbekannt.status === 400)

// ── B7 Die Zeit landet in der Zeiterfassung ────────────────────────────────
console.log('\n=== B7 Die Zeit kommt an ===')

const raus = await stempeln(person, 'gehen')
check('Ausstempeln schließt die Buchung', raus.status === 200
  && raus.body.zustand?.laeuft === false)

const heute = new Date()
const tag = `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, '0')}`
  + `-${String(heute.getDate()).padStart(2, '0')}`
const buchungen = (await hole(person, `/api/time-logs?employeeId=${mPerson.employeeId}`))
  .body.logs ?? []
const heutige = buchungen.filter(l => l.date === tag && l.clockOut)
check('Die abgeschlossene Buchung steht in der Zeiterfassung', heutige.length > 0,
  `${heutige.length} abgeschlossene Buchungen heute`)
check('Mit Kommen und Gehen', !!heutige[0]?.clockIn && !!heutige[0]?.clockOut,
  `${heutige[0]?.clockIn}–${heutige[0]?.clockOut}`)
check('Und einer Dauer', typeof heutige[0]?.totalMinutes === 'number',
  `${heutige[0]?.totalMinutes} Minuten`)

// §136 Was gestempelt wurde, macht den Monat nachweispflichtig — sonst
// flösse eine spätere Nachtragung ungeprüft in den Lohn.
//
// Dafür braucht die Person Lohn-Stammdaten: Wer keine hat, wird schon vorher
// aussortiert, und die Freigabe käme gar nicht erst zum Zug.
await sende(gf, `/api/employees/${mPerson.employeeId}/payroll-profile`, 'PUT', {
  personalnummer: '9007', steuerId: '20000000007', eintrittsdatum: '2024-03-01',
  steuerklasse: 1, kinderfreibetraege: 0, konfession: 'keine',
  bundesland: 'Nordrhein-Westfalen', versicherungsart: 'GKV', zusatzbeitrag: 1.7,
  elstamStand: `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, '0')}-01`,
  lohnart: 'monat', monatsgehalt: 3000,
})
const lauf = await sende(gf, '/api/payroll/vorbereiten', 'POST',
  { year: heute.getFullYear(), month: heute.getMonth() + 1 })
check('Der Monat braucht jetzt eine Freigabe, bevor abgerechnet wird',
  (lauf.body.ohneFreigabe ?? []).some(x => x.name === mPerson.name),
  (lauf.body.ohneFreigabe ?? []).map(x => x.name).slice(0, 3).join(', '))

// Aufräumen: niemand bleibt eingestempelt zurück.
if ((await zustand(person))?.laeuft) await stempeln(person, 'gehen')

process.exit(bilanz() > 0 ? 1 : 0)
