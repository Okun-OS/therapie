// Nachweis F10: Was das Programm sagt, wenn Dienstzeiten fehlen.
//
// §198
//
// WORUM ES GEHT
// Ohne Dienstzeiten kann kein Plan entstehen — daran ist nichts zu rütteln:
// Ein Regelpaket sagt, WIE Dienste besetzt werden („kein Dienstende zwischen
// 15:30 und 17:00"), nicht WELCHE es gibt. Ohne Dienste hat der Rechendienst
// nichts zu verteilen.
//
// Die Sperre ist also richtig. Falsch war die AUSKUNFT: „Schließe das
// Standort-Onboarding ab" stand auch dann da, wenn OKUN für den Standort ein
// Regelpaket gebaut hat — und dann gibt es dieses Onboarding als Weg gar
// nicht. Der Kunde hätte einen Fragebogen durchgeklickt, der ihm Dienstzeiten
// vorschlägt, die sein Regelpaket gar nicht meint.
//
// Eine Meldung, die in die falsche Richtung schickt, kostet mehr Zeit als
// keine Meldung: Man glaubt ihr und sucht am falschen Ort.

import { pruefer, login, hole, sende, BASIS } from './helfer.mjs'

const { check, bilanz } = pruefer()

const okun = await login('okun@okun.de')
// Planen darf nur die Leitung des Mandanten, nicht OKUN. Die Standorte
// entstehen deshalb unter dieser Geschäftsführung — nur das Regelpaket
// ordnet OKUN zu, und das ist auch im Betrieb so.
const gf = await login('gf@rheinblick-reha.de')

/** Alle Standorte mit ihren Dienstzeiten und ihrem Regelpaket. */
async function standorte(cookie = gf) {
  const r = await fetch(`${BASIS}/api/locations`, { headers: { cookie } })
  const { locations } = await r.json()
  return locations ?? []
}

/*
 * §198 Die Prüfung stellt ihren Ausgangszustand selbst her.
 *
 * Erster Versuch: unter den vorhandenen Standorten einen ohne Dienstzeiten
 * suchen. Es gab keinen — alle aus den Testdaten haben welche. Die Prüfung
 * sagte das ehrlich und blieb rot, und eine rote Prüfung, die nichts
 * bedeutet, wird nach zwei Wochen ignoriert.
 *
 * Also legt sie zwei eigene Standorte an, einen mit Regelpaket und einen
 * ohne, beide ohne Dienstzeiten — und räumt sie hinterher weg.
 * (Regel 1 der Nachweis-README.)
 */
const MARKE = `F10 ${Date.now().toString(36)}`

async function standortAnlegen(name) {
  const r = await sende(gf, '/api/locations', 'POST', {
    name, city: 'Berlin', street: 'Teststraße', houseNumber: '1', zip: '10785',
    state: 'Berlin', bundesland: 'Berlin', country: 'Deutschland',
  })
  return r.body?.location ?? r.body
}

const alle = await standorte()
check('Die Standortliste nennt das Regelpaket',
  alle.length > 0 && alle.every(l => 'rulePackId' in l),
  `Felder: ${Object.keys(alle[0] ?? {}).join(', ')}`)

const ohne = await standortAnlegen(`${MARKE} ohne Paket`)
const mit = await standortAnlegen(`${MARKE} mit Paket`)
check('Zwei frische Standorte ohne Dienstzeiten angelegt',
  Boolean(ohne?.id && mit?.id), `${ohne?.id} · ${mit?.id}`)

/*
 * §201 Weggeräumt wird auch dann, wenn die Prüfung vorher abbricht.
 *
 * Das Aufräumen stand nur am Ende. Bricht irgendetwas dazwischen ab — beim
 * ersten Mal, weil der Rechendienst nicht lief —, blieben die beiden
 * Standorte stehen. Gefunden wurden sie Wochen später auf einem
 * Bildschirmfoto der Unternehmensübersicht: vier Balken mit Namen wie
 * „F10 mvf7fum5 ohne Paket" zwischen den echten Standorten, und die Kachel
 * daneben zählte sie als aktiv mit.
 *
 * Eine Prüfung, die bei Erfolg aufräumt und bei Misserfolg nicht, räumt
 * genau dann nicht auf, wenn etwas schiefgegangen ist.
 */
let aufgeraeumt = false
async function wegraeumen() {
  if (aufgeraeumt) return
  aufgeraeumt = true
  for (const s of [mit, ohne]) {
    // Löschen darf nur OKUN — deshalb hier der andere Zugang.
    if (s?.id) {
      await fetch(`${BASIS}/api/locations/${s.id}`, {
        method: 'DELETE', headers: { cookie: okun },
      }).catch(() => undefined)
    }
  }
}
for (const grund of ['uncaughtException', 'unhandledRejection']) {
  process.once(grund, async (fehler) => {
    console.error(`\n  ⚠ Abbruch (${grund}) — räume die eigenen Standorte weg.`)
    await wegraeumen()
    console.error(fehler)
    process.exit(1)
  })
}

// Das Paket zuordnen — welches, verrät der Rechendienst selbst.
const pakete = await hole(okun, '/api/okun/dienstplanung')
const paketId = (pakete.body?.pakete ?? [])[0]?.id
check('Der Rechendienst nennt mindestens ein Regelpaket', Boolean(paketId),
  Boolean(paketId)
    ? paketId
    : 'Leer — läuft der Rechendienst? Ohne ihn lässt sich kein Paket zuordnen, '
      + 'und der halbe Nachweis hier wäre wertlos.')

const zugeordnet = await sende(okun, '/api/okun/dienstplanung', 'PATCH', {
  locationId: mit.id, rulePackId: paketId, dienstplanungFrei: true,
})
check('Das Regelpaket lässt sich zuordnen',
  zugeordnet.status === 200 && zugeordnet.body?.standort?.rulePackId === paketId,
  `HTTP ${zugeordnet.status} → rulePackId=${zugeordnet.body?.standort?.rulePackId}`)

await sende(okun, '/api/okun/dienstplanung', 'PATCH', {
  locationId: ohne.id, dienstplanungFrei: true,
})

// ── Die Auskunft bei fehlenden Dienstzeiten ────────────────────────────────
console.log('\n=== Die Auskunft hängt davon ab, wer die Dienstzeiten anlegt ===')

async function planen(locationId) {
  // §198 `von`/`bis`, nicht `startDate`/`endDate` — mein erster Versuch
  // benutzte die falschen Feldnamen und bekam darum nie die Meldung zu
  // sehen, um die es hier geht.
  return sende(gf, '/api/ai/solve-schedule', 'POST', {
    locationId, von: '2026-11-02', bis: '2026-11-08',
  })
}

const mitPaketAntwort = await planen(mit.id)
const mitText = mitPaketAntwort.body?.error ?? ''
check('MIT Regelpaket: die Meldung nennt das Regelpaket',
  /Regelpaket/i.test(mitText), mitText || `HTTP ${mitPaketAntwort.status}`)
check('MIT Regelpaket: sie schickt NICHT ins Standort-Onboarding',
  !/Standort-Onboarding/i.test(mitText), mitText)

const ohnePaketAntwort = await planen(ohne.id)
const ohneText = ohnePaketAntwort.body?.error ?? ''
check('OHNE Regelpaket: die Meldung schickt ins Standort-Onboarding',
  /Standort-Onboarding/i.test(ohneText), ohneText || `HTTP ${ohnePaketAntwort.status}`)
check('OHNE Regelpaket: sie spricht NICHT von einem Regelpaket',
  !/Regelpaket/i.test(ohneText), ohneText)

// ── Die Sperre selbst bleibt ───────────────────────────────────────────────
console.log('\n=== Die Sperre bleibt, egal wie die Meldung lautet ===')

for (const [name, antwort] of [['mit Paket', mitPaketAntwort], ['ohne Paket', ohnePaketAntwort]]) {
  check(`Ohne Dienstzeiten entsteht kein Plan (${name})`, antwort.status === 422,
    `HTTP ${antwort.status}`)
  check(`Und die Antwort trägt eine Kennung zum Auswerten (${name})`,
    antwort.body?.code === 'NO_SHIFTS',
    JSON.stringify(antwort.body).slice(0, 140))
}

// ── Aufräumen ──────────────────────────────────────────────────────────────
await wegraeumen()
const danach = await standorte()
check('Die Prüfung lässt keine Standorte zurück',
  !danach.some(l => l.name?.includes(MARKE)),
  danach.filter(l => l.name?.includes(MARKE)).map(l => l.name).join(', ') || 'keine')

process.exit(bilanz() ? 1 : 0)
