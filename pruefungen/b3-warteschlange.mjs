// Nachweis B8: Was aus dem Funkloch nachkommt.
//
// Die Warteschlange selbst liegt im Telefon — ihre Regeln sind in
// src/lib/__tests__/warteschlange.test.ts nachgerechnet. Hier geht es um die
// andere Hälfte: Nimmt der Server überhaupt an, was ein Telefon Minuten oder
// Stunden später nachreicht?
//
// Das ist keine Formsache. Wenn der Server einen nachgereichten Stempel mit
// der Uhrzeit der Übertragung verbucht statt mit der des Stempelns, verschiebt
// sich Arbeitszeit — und damit Geld. Und wenn er eine Wiederholung stumm ein
// zweites Mal annimmt, steht sie doppelt in der Zeiterfassung.
//
// Geprüft wird deshalb genau das, worauf sich die Warteschlange verlässt:
//
//   1. Eine ganze Kette in der richtigen Reihenfolge geht durch.
//   2. Dieselbe Meldung ein zweites Mal wird abgelehnt (409) — die Schlange
//      macht daraus „verworfen, mit Hinweis", nicht „noch mal probieren".
//   3. Die falsche Reihenfolge wird abgelehnt — deshalb hält die Schlange beim
//      ersten Vorgang an, der nicht durchgeht.
//   4. Ohne Anmeldung kommt 401 — die Schlange behält den Vorgang dann.
//   5. Krankmeldung, Urlaubsantrag und Nachricht lassen sich nachreichen.

import { pruefer, login, hole, sende, BASIS } from './helfer.mjs'

const { check, bilanz } = pruefer()

const person = await login('maria.schneider@rheinblick-reha.de')
const kollege = await login('thomas.weber@rheinblick-reha.de')
const leitung = await login('leitung@rheinblick-reha.de')

const mPerson = (await hole(person, '/api/auth/me')).body.user
const mKollege = (await hole(kollege, '/api/auth/me')).body.user

const stempeln = (aktion, zeitpunkt) =>
  sende(person, '/api/time-tracking/stempeln', 'POST',
    zeitpunkt === undefined ? { aktion } : { aktion, zeitpunkt })

const zustand = async () =>
  (await hole(person, '/api/time-tracking/stempeln')).body.zustand

const vorMinuten = m => new Date(Date.now() - m * 60_000).toISOString()

// Ausgangszustand: nicht eingestempelt. Sonst prüft der Rest ins Leere.
if ((await zustand())?.laeuft) await stempeln('gehen')

console.log(`Person ${String(mPerson.employeeId).slice(0, 8)}\n`)

// ── B8 Eine ganze Kette wird nachgereicht ──────────────────────────────────
//
// So sieht ein Vormittag im Keller aus: eingestempelt um 6, Pause um 9, zurück
// um 9:30, ausgestempelt um 14 — und erst danach wieder Empfang. Alle vier
// Handgriffe kommen auf einmal an, jeder mit SEINER Uhrzeit.
console.log('=== B8 Die Kette aus dem Funkloch ===')

const kette = [
  ['kommen', vorMinuten(240)],
  ['pause-start', vorMinuten(120)],
  ['pause-ende', vorMinuten(90)],
  ['gehen', vorMinuten(20)],
]

const antworten = []
for (const [aktion, zeitpunkt] of kette) {
  antworten.push([aktion, await stempeln(aktion, zeitpunkt)])
}

check('Jeder Handgriff der Kette wird angenommen',
  antworten.every(([, a]) => a.status === 200),
  antworten.map(([k, a]) => `${k}:${a.status}`).join(' '))
check('Am Ende läuft nichts mehr — die Kette ist vollständig verbucht',
  (await zustand())?.laeuft === false)

const buchung = antworten[0][1].body.log
check('Der Beginn zählt mit der Uhrzeit des Stempelns, nicht der Übertragung',
  buchung?.clockIn === kette[0][1].slice(11, 16),
  `gebucht ${buchung?.clockIn}, gestempelt ${kette[0][1].slice(11, 16)}`)
check('Und ist als nachgereicht gekennzeichnet',
  buchung?.quelle === 'offline', buchung?.quelle)

const tag = kette[0][1].slice(0, 10)
const logs = (await hole(person, `/api/time-logs?employeeId=${mPerson.employeeId}`))
  .body.logs ?? []
const heutige = logs.find(l => l.date === tag && l.clockIn === kette[0][1].slice(11, 16))
check('Die Pause aus der Kette steht in der Buchung',
  (heutige?.breakMinutes ?? 0) >= 25 && (heutige?.breakMinutes ?? 0) <= 35,
  `${heutige?.breakMinutes} Minuten Pause`)
check('Und die Dauer rechnet sie heraus',
  typeof heutige?.totalMinutes === 'number'
  && heutige.totalMinutes < 240,
  `${heutige?.totalMinutes} Minuten bei knapp vier Stunden Anwesenheit`)

// ── B8 Wiederholung und falsche Reihenfolge ────────────────────────────────
//
// Beides passiert wirklich: Die Antwort auf einen Stempel geht unterwegs
// verloren, das Telefon schickt ihn noch einmal. Oder zwei Vorgänge tauschen
// die Plätze. Der Server muss beides erkennen — sonst steht die Zeit doppelt
// oder gar nicht in der Erfassung.
console.log('\n=== B8 Wiederholung und Reihenfolge ===')

const nochmalGehen = await stempeln('gehen', vorMinuten(20))
check('Ein zweites Mal „gehen" wird abgelehnt', nochmalGehen.status === 409,
  `HTTP ${nochmalGehen.status} · ${nochmalGehen.body.error}`)
check('Die Ablehnung sagt, was los ist — daraus wird die Meldung im Telefon',
  (nochmalGehen.body.error ?? '').length > 10, nochmalGehen.body.error)
check('Sie schickt den wirklichen Zustand mit',
  nochmalGehen.body.zustand?.laeuft === false)

await stempeln('kommen')
const pauseVorKommen = await stempeln('kommen', vorMinuten(5))
check('Ein zweites „kommen" wird abgelehnt — sonst stünde die Zeit doppelt',
  pauseVorKommen.status === 409, `HTTP ${pauseVorKommen.status}`)
await stempeln('gehen')

const pauseOhneDienst = await stempeln('pause-ende', vorMinuten(5))
check('Ein Vorgang in der falschen Reihenfolge wird abgelehnt',
  pauseOhneDienst.status === 409, `HTTP ${pauseOhneDienst.status}`)

// ── B8 Ohne Anmeldung wird nichts weggeworfen ──────────────────────────────
//
// Die Sitzung läuft im Funkloch ab. Käme dann etwas anderes als 401 zurück,
// würde die Warteschlange den Stempel als endgültig abgelehnt verwerfen — und
// die Arbeitszeit wäre weg.
console.log('\n=== B8 Abgelaufene Anmeldung ===')

const ohneAnmeldung = await fetch(`${BASIS}/api/time-tracking/stempeln`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ aktion: 'kommen', zeitpunkt: vorMinuten(30) }),
})
check('Ohne Anmeldung antwortet der Server mit 401, nicht mit 400',
  ohneAnmeldung.status === 401, `HTTP ${ohneAnmeldung.status}`)

// ── B8 Krankmeldung nachreichen ────────────────────────────────────────────
console.log('\n=== B8 Krankmeldung aus dem Funkloch ===')

const gestern = new Date(Date.now() - 24 * 3600_000).toISOString().slice(0, 10)
const krank = await sende(person, '/api/absences', 'POST', {
  employeeId: mPerson.employeeId,
  employeeName: mPerson.name,
  locationId: mPerson.locationId,
  type: 'krankheit',
  startDate: gestern,
  endDate: gestern,
  days: 1,
  note: 'Nachweis B8 — nachgereicht',
})
check('Eine Krankmeldung von gestern wird angenommen', krank.status === 200,
  `HTTP ${krank.status} · ${krank.body.error}`)
check('Mit dem gemeldeten Zeitraum, nicht mit dem der Übertragung',
  krank.body.absence?.startDate?.slice(0, 10) === gestern,
  krank.body.absence?.startDate)

if (krank.body.absence?.id) {
  const sichtbar = (await hole(leitung, '/api/absences')).body.absences ?? []
  check('Die Standortleitung sieht sie',
    sichtbar.some(a => a.id === krank.body.absence.id))
  // Aufräumen: Der Nachweis hinterlässt keine Fehlzeit. Sonst verschiebt er
  // die Zahlen der Abwesenheits- und Lohnnachweise beim nächsten Lauf.
  await sende(leitung, `/api/absences/${krank.body.absence.id}`, 'DELETE')
  const danach = (await hole(leitung, '/api/absences')).body.absences ?? []
  check('Und der Nachweis räumt sie wieder weg',
    !danach.some(a => a.id === krank.body.absence.id))
}

// ── B8 Urlaubsantrag nachreichen ───────────────────────────────────────────
console.log('\n=== B8 Urlaubsantrag aus dem Funkloch ===')

const inZweiJahren = new Date(Date.now() + 700 * 24 * 3600_000).toISOString().slice(0, 10)
const urlaub = await sende(person, '/api/vacation-requests', 'POST', {
  employeeId: mPerson.employeeId,
  employeeName: mPerson.name,
  locationId: mPerson.locationId,
  locationName: '',
  startDate: inZweiJahren,
  endDate: inZweiJahren,
  reason: 'Nachweis B8 — nachgereicht',
})
check('Ein nachgereichter Urlaubsantrag wird angenommen', urlaub.status === 200,
  `HTTP ${urlaub.status} · ${urlaub.body.error}`)
check('Er steht danach offen bei der Leitung',
  urlaub.body.request?.status === 'pending', urlaub.body.request?.status)

if (urlaub.body.request?.id) {
  // Aufräumen: Ein offener Antrag würde den Resturlaub der Person dauerhaft
  // mindern und andere Nachweise verschieben.
  await sende(leitung, `/api/vacation-requests/${urlaub.body.request.id}`, 'PATCH',
    { status: 'denied', respondedBy: 'Nachweis B8' })
  const meine = (await hole(person,
    `/api/vacation-requests?employeeId=${mPerson.employeeId}`)).body.requests ?? []
  const wieder = meine.find(r => r.id === urlaub.body.request.id)
  check('Und der Nachweis schließt ihn wieder', wieder?.status === 'denied',
    wieder?.status)
}

// ── B8 Nachricht nachreichen ───────────────────────────────────────────────
console.log('\n=== B8 Nachricht aus dem Funkloch ===')

const raum = await sende(person, '/api/chat', 'POST',
  { art: 'direkt', userId: mKollege.id })
check('Das Gespräch steht', raum.status === 200 && !!raum.body.raum?.id,
  raum.body.error)

if (raum.body.raum?.id) {
  const text = `Nachweis B8 ${Date.now()}`
  const nachricht = await sende(person, `/api/chat/${raum.body.raum.id}`, 'POST', { text })
  check('Eine nachgereichte Nachricht wird angenommen', nachricht.status === 200,
    `HTTP ${nachricht.status} · ${nachricht.body.error}`)

  const beimKollegen = (await hole(kollege, `/api/chat/${raum.body.raum.id}`))
    .body.nachrichten ?? []
  check('Und kommt beim Empfänger an',
    beimKollegen.some(n => n.text === text))

  // Aufräumen: Eine ungelesene Nachricht bliebe im Zähler des Kollegen stehen
  // und verschöbe den Nachweis E5, der genau diesen Zähler prüft.
  await sende(kollege, `/api/chat/${raum.body.raum.id}`, 'PATCH', { gelesen: true })
  const zaehler = (await hole(kollege, '/api/chat/ungelesen')).body.ungelesen
  check('Und der Nachweis lässt keinen ungelesenen Rest zurück', zaehler === 0,
    `${zaehler} ungelesen`)
}

// Aufräumen: niemand bleibt eingestempelt zurück.
if ((await zustand())?.laeuft) await stempeln('gehen')

process.exit(bilanz() > 0 ? 1 : 0)
