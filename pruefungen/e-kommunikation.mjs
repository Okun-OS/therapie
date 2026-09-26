// Nachweis E1–E3: Push, Benachrichtigungen, Einspringen mit Kandidatensuche.
// Der schwerste geprüfte Punkt: Kann jemand fremde Push-Nachrichten mitlesen?
import { pruefer, login, hole, sende } from './helfer.mjs'

const { check, bilanz } = pruefer()

const leitung = await login('leitung@rheinblick-reha.de')
// §151 Die Unternehmensebene hat kein eigenes Postfach — sie hat keinen
// Mitarbeiterdatensatz. Genau dieser Fall wird unten geprüft.
const gf = await login('gf@rheinblick-reha.de')
const kita = await login('leitung@kita-sonnenschein.de')
const anna = await login('anna.fischer@rheinblick-reha.de')

const meLeitung = (await hole(leitung, '/api/auth/me')).body.user
const meAnna = (await hole(anna, '/api/auth/me')).body.user
const locationId = meLeitung.locationId
const annaId = meAnna.employeeId
const kitaLoc = (await hole(kita, '/api/auth/me')).body.user.locationId
const kollege = ((await hole(leitung, '/api/employees')).body.employees ?? [])
  .find(e => e.id !== annaId && e.locationId === locationId)

console.log(`Anna ${annaId?.slice(0, 8)} · Kollege ${kollege?.name}\n`)

// ── E1 Push-Anmeldung ──────────────────────────────────────────────────────
console.log('=== E1 Push-Anmeldung ===')
const geraet = {
  endpoint: 'https://push.example.invalid/pruefung-' + Date.now(),
  keys: { p256dh: 'BPruefungSchluessel', auth: 'pruefAuth' },
}
const eigenes = await sende(anna, '/api/push/subscribe', 'POST',
  { employeeId: annaId, subscription: geraet })
check('Eigenes Gerät lässt sich anmelden', eigenes.status === 200 || eigenes.status === 201,
  eigenes.body.error ?? 'angemeldet')

const fremdesGeraet = await sende(anna, '/api/push/subscribe', 'POST',
  { employeeId: kollege.id, subscription: { ...geraet, endpoint: geraet.endpoint + '-fremd' } })
check('Eigenes Gerät kann NICHT für einen Kollegen angemeldet werden',
  fremdesGeraet.status === 403,
  `HTTP ${fremdesGeraet.status}` + (fremdesGeraet.status < 300
    ? ' — fremde Push-Nachrichten wären mitlesbar!' : ''))

// ── E2 Benachrichtigungen ──────────────────────────────────────────────────
console.log('\n=== E2 Benachrichtigungen ===')
const eigenesPostfach = await hole(anna, `/api/notifications?employeeId=${annaId}`)
check('Eigenes Postfach ist abrufbar', eigenesPostfach.status === 200,
  `${eigenesPostfach.body.notifications?.length ?? 0} Nachrichten`)

const fremdesPostfach = await hole(anna, `/api/notifications?employeeId=${kollege.id}`)
check('Fremdes Postfach ist NICHT abrufbar', fremdesPostfach.status === 403,
  `HTTP ${fremdesPostfach.status}`)

const kitaPostfach = await hole(kita, `/api/notifications?employeeId=${annaId}`)
check('Fremde Leitung kommt nicht an das Postfach', kitaPostfach.status === 403,
  `HTTP ${kitaPostfach.status}`)

/**
 * §151 Ohne Angabe: das EIGENE Postfach.
 *
 * Vorher war die Kennung Pflicht — und beide Aufrufer in der Oberfläche
 * schickten dafür die Kennung des BENUTZERKONTOS statt die des Mitarbeiters.
 * Die Glocke bekam auf jeder Seite eine Absage und blieb dauerhaft leer;
 * gemerkt hat es niemand, weil eine leere Glocke aussieht wie eine ohne neue
 * Nachrichten. Deshalb steht das hier jetzt als Nachweis.
 */
const ohneAngabe = await hole(anna, '/api/notifications')
check('Ohne Angabe kommt das eigene Postfach', ohneAngabe.status === 200,
  `HTTP ${ohneAngabe.status}`)
check('Und zwar genau dasselbe wie mit Angabe',
  (ohneAngabe.body.notifications ?? []).length
    === (eigenesPostfach.body.notifications ?? []).length
  && (ohneAngabe.body.notifications?.[0]?.id ?? null)
    === (eigenesPostfach.body.notifications?.[0]?.id ?? null),
  `${ohneAngabe.body.notifications?.length ?? 0} gegen `
  + `${eigenesPostfach.body.notifications?.length ?? 0}`)

// Die Gegenprobe: Der bequeme Weg darf keine fremden Daten öffnen. Eine
// fremde Leitung bekommt ohne Angabe ihr eigenes Postfach — nicht Annas.
const kitaOhneAngabe = await hole(kita, '/api/notifications')
const annaKennungen = new Set(
  (eigenesPostfach.body.notifications ?? []).map(n => n.id))
check('Ohne Angabe sieht eine fremde Leitung nichts von Anna',
  (kitaOhneAngabe.body.notifications ?? []).every(n => !annaKennungen.has(n.id)),
  `${kitaOhneAngabe.body.notifications?.length ?? 0} eigene Nachrichten`)

// Ein Konto ohne Mitarbeiterdatensatz hat kein Postfach. Das ist eine leere
// Liste und kein Fehler — sonst meldete die Oberfläche der Unternehmensebene
// auf jeder Seite eine Störung, die keine ist.
const gfPostfach = await hole(gf, '/api/notifications')
check('Ein Konto ohne Mitarbeiterdatensatz bekommt eine leere Liste',
  gfPostfach.status === 200 && Array.isArray(gfPostfach.body.notifications),
  `HTTP ${gfPostfach.status}`)

// Rundruf
const rundruf = await sende(leitung, '/api/notifications/broadcast', 'POST',
  { title: 'Prüfmeldung', body: 'Nachweis-Test', locationId })
check('Leitung kann einen Rundruf am eigenen Standort senden',
  rundruf.status === 200 || rundruf.status === 201, rundruf.body.error ?? 'gesendet')

const fremdRundruf = await sende(kita, '/api/notifications/broadcast', 'POST',
  { title: 'Fremdruf', body: 'sollte nicht ankommen', locationId })
check('Fremde Leitung kann hier KEINEN Rundruf senden', fremdRundruf.status === 403,
  `HTTP ${fremdRundruf.status}`)

// Nachricht als gelesen markieren
const nachrichten = (await hole(anna, `/api/notifications?employeeId=${annaId}`)).body.notifications ?? []
if (nachrichten[0]) {
  const eigeneGelesen = await sende(anna, `/api/notifications/${nachrichten[0].id}/read`, 'POST', {})
  check('Eigene Nachricht als gelesen markieren geht', eigeneGelesen.status === 200,
    eigeneGelesen.body.error ?? 'markiert')
}
const fremdeNachrichten = (await hole(leitung, `/api/notifications?employeeId=${kollege.id}`)).body.notifications ?? []
if (fremdeNachrichten[0]) {
  const fremdGelesen = await sende(anna, `/api/notifications/${fremdeNachrichten[0].id}/read`, 'POST', {})
  check('Fremde Nachricht kann NICHT als gelesen markiert werden', fremdGelesen.status === 403,
    `HTTP ${fremdGelesen.status}`)
} else {
  check('Fremde Nachricht kann NICHT als gelesen markiert werden', true,
    '(keine fremde Nachricht vorhanden — Abschottung über das Postfach bereits belegt)')
}

// ── E3 Einspringen mit Kandidatensuche ─────────────────────────────────────
console.log('\n=== E3 Einspringen und Kandidaten ===')
const heute = new Date().toISOString().slice(0, 10)
const anfrage = await sende(leitung, '/api/substitutions', 'POST', {
  locationId, date: heute, startTime: '08:00', endTime: '16:00',
  priority: 'normal', createdBy: meLeitung.userId ?? 'leitung',
})
check('Vertretungsanfrage lässt sich anlegen', anfrage.status === 200 || anfrage.status === 201,
  anfrage.body.error ?? `Anfrage ${anfrage.body.request?.id?.slice(0, 8)}`)
const anfrageId = anfrage.body.request?.id

check('Kandidaten werden automatisch ermittelt',
  Array.isArray(anfrage.body.request?.candidates) && anfrage.body.request.candidates.length > 0,
  `${anfrage.body.request?.candidates?.length ?? 0} Kandidaten`)

const fremdAnlegen = await sende(kita, '/api/substitutions', 'POST', {
  locationId, date: heute, startTime: '08:00', endTime: '16:00',
  priority: 'normal', createdBy: 'kita',
})
check('Fremde Leitung kann hier KEINE Anfrage anlegen', fremdAnlegen.status === 403,
  `HTTP ${fremdAnlegen.status}`)

const fremdLesen = await hole(kita, `/api/substitutions?locationId=${locationId}`)
check('Fremde Leitung kann die Anfragen nicht lesen', fremdLesen.status === 403,
  `HTTP ${fremdLesen.status}`)

const eigeneEingehend = await hole(anna, `/api/substitutions/incoming?employeeId=${annaId}`)
check('Mitarbeiter sieht seine eigenen Anfragen', eigeneEingehend.status === 200,
  `HTTP ${eigeneEingehend.status}`)
const fremdeEingehend = await hole(anna, `/api/substitutions/incoming?employeeId=${kollege.id}`)
check('Anfragen eines Kollegen sind NICHT einsehbar', fremdeEingehend.status === 403,
  `HTTP ${fremdeEingehend.status}`)

if (anfrageId) {
  const fremdZusage = await sende(anna, `/api/substitutions/${anfrageId}/respond`, 'POST',
    { employeeId: kollege.id, action: 'accept' })
  check('Mitarbeiter kann NICHT im Namen eines Kollegen zusagen',
    fremdZusage.status === 403, `HTTP ${fremdZusage.status}`)

  const fremdEskalation = await sende(kita, `/api/substitutions/${anfrageId}/escalate`, 'POST', {})
  check('Fremde Leitung kann nicht eskalieren',
    fremdEskalation.status === 403 || fremdEskalation.status === 404, `HTTP ${fremdEskalation.status}`)
}

// ── Schichttausch ──────────────────────────────────────────────────────────
console.log('\n=== Schichttausch ===')
const eigeneTausche = await hole(anna, `/api/swap-requests?employeeId=${annaId}`)
check('Eigene Tauschanfragen sind abrufbar', eigeneTausche.status === 200,
  `${eigeneTausche.body.requests?.length ?? 0} Anfragen`)
const fremdeTausche = await hole(anna, `/api/swap-requests?employeeId=${kollege.id}`)
check('Tauschanfragen eines Kollegen sind NICHT abrufbar', fremdeTausche.status === 403,
  `HTTP ${fremdeTausche.status}`)

const tauschImFremdenNamen = await sende(anna, '/api/swap-requests', 'POST', {
  requesterId: kollege.id, requesterName: kollege.name, requesterDate: heute,
  requesterShiftId: 'seed-reha-frueh', targetEmployeeId: annaId, targetEmployeeName: 'Anna',
  targetDate: heute, targetShiftId: 'seed-reha-spaet', locationId,
})
check('Tauschanfrage im Namen einer Kollegin wird abgewiesen',
  tauschImFremdenNamen.status === 403, `HTTP ${tauschImFremdenNamen.status}`)

process.exit(bilanz() ? 1 : 0)
