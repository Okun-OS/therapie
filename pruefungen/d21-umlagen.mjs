// Nachweis D21: Die Umlagen U1, U2 und Insolvenzgeld.
//
// Sie waren eine Lücke: Jeder Arbeitgeber zahlt sie, jeden Monat, auf jedes
// Entgelt — und sie standen nirgends. Eine Abrechnung ohne Umlagen zeigt die
// Arbeitgeberkosten zu niedrig, und bei der Betriebsprüfung fehlt Geld, das
// nie abgeführt wurde.
//
// Drei Umlagen, drei verschiedene Regeln:
//   U1 nur für Betriebe bis 30 Arbeitnehmer (§1 Abs. 1 AAG),
//   U2 für ALLE, ohne Größengrenze (§1 Abs. 2 AAG),
//   Insolvenzgeld für alle außer der öffentlichen Hand (§358 SGB III).
//
// Und: Die Sätze für U1 und U2 stehen nicht im Gesetz, sondern in der Satzung
// jeder einzelnen Kasse. Was nicht hinterlegt ist, wird NICHT geraten.
//
// Die Rechenwege sind in src/lib/__tests__/umlagen.test.ts nachgerechnet.

import {
  pruefer, login, hole, sende, BASIS, lohnPerson, monatFreigeben,
} from './helfer.mjs'

const { check, bilanz } = pruefer()

const gf = await login('gf@rheinblick-reha.de')
const leitung = await login('leitung@rheinblick-reha.de')
const anna = await login('anna.fischer@rheinblick-reha.de')

const locationId = (await hole(leitung, '/api/auth/me')).body.user.locationId
const MARKE = Date.now().toString(36)
const KASSE = `Pruefkasse ${MARKE}`

const heute = new Date()
const JAHR = heute.getFullYear()
const MONAT = heute.getMonth() + 1
const GEHALT = 3000

const loeschen = async (cookie, pfad) => {
  const r = await fetch(`${BASIS}${pfad}`, { method: 'DELETE', headers: { cookie } })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

const personId = await lohnPerson(gf, locationId, `D21 Umlage ${MARKE}`)
await sende(gf, `/api/employees/${personId}/payroll-profile`, 'PUT', {
  personalnummer: `D21-${MARKE}`.slice(0, 12), steuerId: '20000000013',
  steuerklasse: 1, kinderfreibetraege: 0, konfession: 'keine',
  bundesland: 'Nordrhein-Westfalen', versicherungsart: 'GKV', zusatzbeitrag: 1.7,
  krankenkasse: KASSE,
  iban: 'DE02120300000000202051', kontoinhaber: `D21 Umlage ${MARKE}`,
  lohnart: 'monat', monatsgehalt: GEHALT, beschaeftigungsart: 'regulaer',
  eintrittsdatum: '2024-03-01', austrittsdatum: '',
})
await monatFreigeben(leitung, personId, JAHR, MONAT, `D21 Umlage ${MARKE}`)

const holeAbrechnung = async () => {
  const alle = (await hole(gf, `/api/payroll?year=${JAHR}&month=${MONAT}`))
    .body.entries ?? []
  return alle.find(a => a.employeeId === personId)
}

// ── D21.1 Was fehlt, wird nicht geraten ────────────────────────────────────
console.log('=== D21.1 Ohne Satz keine Umlage ===')

const ohneAnmeldung = await fetch(`${BASIS}/api/payroll/umlagen`)
check('Ohne Anmeldung gar nichts', ohneAnmeldung.status === 401,
  `HTTP ${ohneAnmeldung.status}`)

const durchMitarbeiter = await hole(anna, '/api/payroll/umlagen')
check('Ein Mitarbeiter sieht die Umlagesätze nicht',
  durchMitarbeiter.status === 403, `HTTP ${durchMitarbeiter.status}`)

const uebersicht = await hole(gf, '/api/payroll/umlagen')
check('Die Unternehmensebene sieht sie', uebersicht.status === 200)
check('Die Prüfkasse steht als fehlend in der Liste',
  (uebersicht.body.fehlend ?? []).includes(KASSE),
  JSON.stringify(uebersicht.body.fehlend ?? []).slice(0, 200))
check('Die Betriebsgröße wird gewichtet ausgewiesen',
  typeof uebersicht.body.betriebsgroesse?.zahl === 'number',
  JSON.stringify(uebersicht.body.betriebsgroesse))
check('Der Satz der Insolvenzgeldumlage wird genannt',
  (uebersicht.body.insolvenzgeld?.satz ?? 0) > 0,
  JSON.stringify(uebersicht.body.insolvenzgeld))

const lauf1 = await sende(gf, '/api/payroll/vorbereiten', 'POST',
  { year: JAHR, month: MONAT })
check('Der Lohnlauf geht durch', lauf1.status === 200, lauf1.body.error)

let a = await holeAbrechnung()
check('Ohne hinterlegten Satz wird keine U1 gerechnet',
  a?.umlageU1 === 0, `${a?.umlageU1}`)
check('Und keine U2', a?.umlageU2 === 0, `${a?.umlageU2}`)
check('Die Insolvenzgeldumlage fällt trotzdem an — sie steht im Gesetz',
  (a?.insolvenzgeldUmlage ?? 0) > 0, `${a?.insolvenzgeldUmlage} €`)

const fehlendeSaetze = (lauf1.body.hinweise ?? [])
  .filter(h => /U1-Satz|U2-Satz/.test(h.text ?? ''))
check('Der Lauf sagt, welcher Satz fehlt', fehlendeSaetze.length > 0,
  JSON.stringify(fehlendeSaetze).slice(0, 250))
check('Er sagt es dem Unternehmen, nicht jeder Person einzeln',
  fehlendeSaetze.every(h => h.name === 'Unternehmen'),
  JSON.stringify(fehlendeSaetze.map(h => h.name)))
check('Und nennt dabei die betroffene Kasse',
  fehlendeSaetze.some(h => (h.text ?? '').includes(KASSE)),
  JSON.stringify(fehlendeSaetze).slice(0, 250))

// ── D21.2 Die Sätze hinterlegen ────────────────────────────────────────────
console.log('\n=== D21.2 Die Sätze der Kasse ===')

const durchLeitung = await sende(leitung, '/api/payroll/umlagen', 'PUT', {
  kasse: KASSE, u1Satz: 2.1, u2Satz: 0.65,
})
check('Eine Standortleitung pflegt keine Umlagesätze',
  durchLeitung.status === 403, `HTTP ${durchLeitung.status}`)

const ohneKasse = await sende(gf, '/api/payroll/umlagen', 'PUT', { u1Satz: 2.1 })
check('Ohne Kassennamen wird abgelehnt', ohneKasse.status === 400,
  ohneKasse.body.error)

const unueblich = await sende(gf, '/api/payroll/umlagen', 'PUT', {
  kasse: KASSE, u1Satz: 21, u2Satz: 0.65, u1Erstattung: 80,
})
check('Ein unüblicher Satz wird angenommen, aber gemeldet',
  unueblich.status === 200
  && /unüblich/.test(JSON.stringify(unueblich.body.hinweise ?? [])),
  JSON.stringify(unueblich.body.hinweise ?? []).slice(0, 200))

const gesetzt = await sende(gf, '/api/payroll/umlagen', 'PUT', {
  kasse: KASSE, u1Satz: 2.1, u2Satz: 0.65, u1Erstattung: 80,
  gueltigAb: `${JAHR}-01-01`,
})
check('Die Sätze werden gespeichert', gesetzt.status === 200, gesetzt.body.error)
check('Prozent werden als Anteil abgelegt, nicht als Prozentzahl',
  Math.abs((gesetzt.body.satz?.u1Satz ?? 0) - 0.021) < 1e-9,
  `${gesetzt.body.satz?.u1Satz}`)
check('Die Erstattungsstufe auch',
  Math.abs((gesetzt.body.satz?.u1Erstattung ?? 0) - 0.8) < 1e-9,
  `${gesetzt.body.satz?.u1Erstattung}`)

// ── D21.3 Jetzt wird gerechnet ─────────────────────────────────────────────
console.log('\n=== D21.3 Mit Satz wird gerechnet ===')

const vorher = await holeAbrechnung()
const lauf2 = await sende(gf, '/api/payroll/vorbereiten', 'POST',
  { year: JAHR, month: MONAT })
a = await holeAbrechnung()

// Die U1 gibt es nur für Betriebe bis 30 Arbeitnehmer (§1 Abs. 1 AAG).
// Welcher Fall hier vorliegt, sagt die Übersicht — geprüft wird, dass
// Rechnung und Feststellung zusammenpassen, statt einen Fall anzunehmen.
const u1Pflichtig = uebersicht.body.betriebsgroesse?.u1Pflichtig === true
if (u1Pflichtig) {
  check('Die U1 wird auf das Entgelt gerechnet',
    Math.abs((a?.umlageU1 ?? 0) - GEHALT * 0.021) < 0.02,
    `${a?.umlageU1} von ${GEHALT * 0.021}`)
} else {
  check('Für einen Betrieb über 30 Arbeitnehmern fällt keine U1 an',
    (a?.umlageU1 ?? 0) === 0,
    `${a?.umlageU1} bei ${uebersicht.body.betriebsgroesse?.zahl} Arbeitnehmern`)
  check('Und die Übersicht begründet das mit §1 Abs. 1 AAG',
    /§1 Abs\. 1 AAG/.test(uebersicht.body.betriebsgroesse?.hinweis ?? ''),
    uebersicht.body.betriebsgroesse?.hinweis)
}
check('Die U2 gilt unabhängig von der Betriebsgröße',
  (a?.umlageU2 ?? 0) > 0, `${a?.umlageU2} €`)
check('Die U2 auch',
  Math.abs((a?.umlageU2 ?? 0) - GEHALT * 0.0065) < 0.02,
  `${a?.umlageU2} von ${GEHALT * 0.0065}`)
check('Die Arbeitgeberkosten steigen genau um die Umlagen',
  Math.abs((a?.totalAgCost ?? 0) - (vorher?.totalAgCost ?? 0)
    - (a?.umlageU1 ?? 0) - (a?.umlageU2 ?? 0)) < 0.02,
  `${a?.totalAgCost} gegen ${vorher?.totalAgCost}`)
check('Das Netto des Mitarbeiters bleibt gleich',
  Math.abs((a?.netto ?? 0) - (vorher?.netto ?? 0)) < 0.01,
  `${a?.netto} gegen ${vorher?.netto}`)
check('Und seine Beiträge auch',
  Math.abs((a?.rvAN ?? 0) - (vorher?.rvAN ?? 0)) < 0.01)

const hinweise2 = (lauf2.body.hinweise ?? [])
  .filter(h => (h.text ?? '').includes(KASSE))
check('Der Lauf beschwert sich nicht mehr über diese Kasse',
  hinweise2.length === 0, JSON.stringify(hinweise2).slice(0, 250))

// ── D21.4 Aufräumen und Rückweg ────────────────────────────────────────────
console.log('\n=== D21.4 Der Satz lässt sich wieder entfernen ===')

const satzId = gesetzt.body.satz?.id
const weg = await loeschen(gf, `/api/payroll/umlagen?id=${satzId}`)
check('Der Satz lässt sich löschen', weg.status === 200,
  JSON.stringify(weg.body).slice(0, 200))
check('Und es wird gesagt, was das bedeutet',
  /keine Umlage mehr/.test(weg.body.hinweis ?? ''), weg.body.hinweis)

const okun = await login('okun@okun.de').catch(() => null)
if (okun) {
  await fetch(`${BASIS}/api/employees/${personId}`, {
    method: 'DELETE', headers: { cookie: okun },
  })
}
const uebrig = await hole(gf, '/api/payroll/umlagen')
check('Die Prüfung hinterlässt keinen Satz',
  !(uebrig.body.saetze ?? []).some(s => s.kasse === KASSE),
  `${(uebrig.body.saetze ?? []).filter(s => s.kasse === KASSE).length} übrig`)

process.exit(bilanz() ? 1 : 0)
