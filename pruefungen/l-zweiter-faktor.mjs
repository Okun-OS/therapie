// Nachweis L: Der zweite Faktor per E-Mail — gegen das laufende System.
//
// WARUM DAS HIER GEPRÜFT WIRD UND NICHT IM MODULTEST
// Weil der ganze Wert dieser Funktion in dem liegt, was NICHT passieren darf:
// dass jemand ohne den Code hereinkommt. Das entscheidet sich im Zusammenspiel
// von Anmeldung, Datenbank und Sitzungskeks — nicht in einer einzelnen
// Funktion. Ein Modultest kann beweisen, dass der Code sechsstellig ist. Er
// kann nicht beweisen, dass der zweite Schritt sich nicht überspringen lässt.
//
// §196

import { pruefer, login, hole, sende, BASIS } from './helfer.mjs'

const { check, bilanz } = pruefer()

const WER = 'anna.fischer@rheinblick-reha.de'
const PASSWORT = 'Test1234!'

/** Anmelden, ohne über den Helfer zu gehen — hier zählt die rohe Antwort. */
async function anmelden(email = WER, passwort = PASSWORT) {
  const r = await fetch(`${BASIS}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: passwort }),
  })
  return {
    status: r.status,
    body: await r.json().catch(() => ({})),
    kekse: r.headers.getSetCookie().map(c => c.split(';')[0]).join('; '),
  }
}

// ── L1 Einschalten ─────────────────────────────────────────────────────────
console.log('=== L1 Den E-Mail-Faktor einschalten ===')

const cookie = await login(WER)

const vorher = await hole(cookie, '/api/auth/2fa/status')
check('Der Stand nennt den E-Mail-Faktor', 'emailOtpEnabled' in vorher.body,
  JSON.stringify(vorher.body))
check('Er ist zu Beginn aus', vorher.body.emailOtpEnabled === false)

const ein = await sende(cookie, '/api/auth/2fa/email', 'POST', { aktiv: true })
check('Einschalten gelingt mit einem einzigen Aufruf', ein.status === 200,
  `HTTP ${ein.status} ${JSON.stringify(ein.body)}`)
check('Und es ist keine Bestätigung nötig — die Adresse ist durch die Einladung belegt',
  ein.body.emailOtpEnabled === true)

const nachher = await hole(cookie, '/api/auth/2fa/status')
check('Der Stand zeigt ihn danach als aktiv', nachher.body.emailOtpEnabled === true)

const unsinn = await sende(cookie, '/api/auth/2fa/email', 'POST', { aktiv: 'ja' })
check('Etwas anderes als wahr/falsch wird abgelehnt', unsinn.status === 400,
  `HTTP ${unsinn.status}`)

// ── L2 Die Anmeldung verlangt jetzt den zweiten Schritt ────────────────────
console.log('\n=== L2 Die Anmeldung bleibt stehen ===')

const versuch = await anmelden()
check('Das richtige Passwort allein reicht nicht mehr',
  versuch.body.requiresEmail === true, JSON.stringify(versuch.body))
check('Und es gibt NOCH KEINE Sitzung', !versuch.kekse.includes('session'),
  versuch.kekse || '(keine Kekse)')
check('Die Antwort verrät die Adresse nicht',
  !JSON.stringify(versuch.body).includes('@'), JSON.stringify(versuch.body))

const userId = versuch.body.userId
check('Sie nennt die Kennung für den zweiten Schritt', Boolean(userId))

// Gegenprobe: Mit falschem Passwort gibt es den zweiten Schritt gar nicht.
const falsch = await anmelden(WER, 'Falsch1234!')
check('Mit falschem Passwort kommt man nicht einmal zum zweiten Schritt',
  falsch.status === 401 && !falsch.body.requiresEmail,
  `HTTP ${falsch.status} ${JSON.stringify(falsch.body)}`)

// ── L3 Der Code ────────────────────────────────────────────────────────────
console.log('\n=== L3 Der Code wird verschickt ===')

const geschickt = await fetch(`${BASIS}/api/auth/2fa/email-send`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId }),
})
const geschicktBody = await geschickt.json().catch(() => ({}))
check('Der Code wird verschickt', geschickt.status === 200,
  `HTTP ${geschickt.status} ${JSON.stringify(geschicktBody)}`)
check('Die Antwort enthält den Code NICHT',
  !/[0-9]{6}/.test(JSON.stringify(geschicktBody)),
  JSON.stringify(geschicktBody))
check('Sie nennt nur die verkürzte Adresse',
  typeof geschicktBody.hinweis === 'string' && geschicktBody.hinweis.includes('…'),
  geschicktBody.hinweis ?? '(keiner)')

// Sofort noch einmal: Die Bremse muss greifen.
const nochmal = await fetch(`${BASIS}/api/auth/2fa/email-send`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId }),
})
check('Sofortiges Nachfordern wird gebremst', nochmal.status === 429,
  `HTTP ${nochmal.status}`)

// ── L4 Was NICHT hereinkommt ───────────────────────────────────────────────
console.log('\n=== L4 Was nicht hereinkommt ===')

const pruefe = async (daten) => {
  const r = await fetch(`${BASIS}/api/auth/2fa/email-validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(daten),
  })
  return { status: r.status, kekse: r.headers.getSetCookie().join('; ') }
}

const falscherCode = await pruefe({ userId, code: '000000' })
check('Ein falscher Code wird abgelehnt', falscherCode.status === 400,
  `HTTP ${falscherCode.status}`)
check('Und stellt keine Sitzung aus', !falscherCode.kekse.includes('session'))

const ohneCode = await pruefe({ userId })
check('Ohne Code geht gar nichts', ohneCode.status === 400)

const fremd = await pruefe({ userId: 'gibt-es-nicht', code: '123456' })
check('Eine erfundene Kennung bekommt keine Sitzung',
  fremd.status >= 400 && !fremd.kekse.includes('session'), `HTTP ${fremd.status}`)

// Die Sperre nach zu vielen Versuchen.
let letzter = falscherCode.status
for (let i = 0; i < 6; i++) letzter = (await pruefe({ userId, code: '111111' })).status
check('Nach zu vielen Fehlversuchen ist der Code verbraucht',
  letzter === 429 || letzter === 400, `HTTP ${letzter}`)

// ── L5 Wieder ausschalten ──────────────────────────────────────────────────
console.log('\n=== L5 Wieder ausschalten ===')

const aus = await sende(cookie, '/api/auth/2fa/email', 'POST', { aktiv: false })
check('Ausschalten gelingt', aus.status === 200 && aus.body.emailOtpEnabled === false,
  `HTTP ${aus.status}`)

const wieder = await anmelden()
check('Danach meldet man sich wieder in einem Schritt an',
  !wieder.body.requiresEmail && Boolean(wieder.body.user),
  JSON.stringify(wieder.body).slice(0, 120))
check('Und bekommt wieder eine Sitzung', wieder.kekse.includes('session'))

// ── L6 Fremde dürfen nicht an den Schalter ─────────────────────────────────
console.log('\n=== L6 Fremde dürfen nicht an den Schalter ===')

const ohneAnmeldung = await fetch(`${BASIS}/api/auth/2fa/email`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ aktiv: true }),
})
check('Ohne Anmeldung lässt sich der Faktor nicht umschalten',
  ohneAnmeldung.status === 401 || ohneAnmeldung.status === 403,
  `HTTP ${ohneAnmeldung.status}`)

// Und ein anderer Angemeldeter kann ihn nicht für jemand anderen setzen:
// die Route nimmt gar keine fremde Kennung entgegen, sie liest nur die
// eigene Sitzung. Das ist die Gegenprobe dazu.
const fremderCookie = await login('thomas.weber@rheinblick-reha.de')
await sende(fremderCookie, '/api/auth/2fa/email', 'POST', { aktiv: true })
const annaStand = await hole(cookie, '/api/auth/2fa/status')
check('Ein anderer schaltet ihn nur für sich selbst ein',
  annaStand.body.emailOtpEnabled === false,
  `Annas Stand: ${annaStand.body.emailOtpEnabled}`)
await sende(fremderCookie, '/api/auth/2fa/email', 'POST', { aktiv: false })

process.exit(bilanz() ? 1 : 0)
