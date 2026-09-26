// Nachweis D17: Lohnpfändung (§§850 ff. ZPO).
//
// Bei jedem anderen Rechenfehler merkt es irgendwann jemand. Hier nicht:
// Zu viel einbehalten heißt, dass jemandem das Existenzminimum fehlt; zu wenig
// heißt, dass der Arbeitgeber dem Gläubiger persönlich haftet (§840 ZPO).
//
// Drei Fragen entscheiden:
//
//   WER DARF DAS ÜBERHAUPT SEHEN? Nur die Unternehmensebene. Eine Pfändung
//   sagt etwas über die wirtschaftliche Lage eines Menschen — in einer
//   Einrichtung mit zwölf Leuten weiß die Leitung sonst, wer Schulden hat.
//
//   WIRD DER BETRAG RICHTIG ABGEZOGEN? Er mindert den Auszahlungsbetrag, nicht
//   das Netto. Steuerlich ist das Geld verdient, es geht nur woandershin.
//
//   BLEIBT DIE SPUR? Ohne die Zeile je Monat und Gläubiger lässt sich die
//   Drittschuldnererklärung nach §840 ZPO nicht erstellen.
//
// Die Rechenwege sind in src/lib/__tests__/pfaendung.test.ts nachgerechnet.

import {
  pruefer, login, hole, sende, BASIS, lohnPerson, monatFreigeben,
} from './helfer.mjs'

const { check, bilanz } = pruefer()

const gf = await login('gf@rheinblick-reha.de')
const leitung = await login('leitung@rheinblick-reha.de')
const anna = await login('anna.fischer@rheinblick-reha.de')

const locationId = (await hole(leitung, '/api/auth/me')).body.user.locationId
const MARKE = Date.now().toString(36)

// Eine eigene Person, damit der Lauf nicht an fremden Zeiten hängt.
const personId = await lohnPerson(gf, locationId, `D17 Pfaendung ${MARKE}`)

// §102 Ohne Lohn-Stammdaten überspringt der Lauf die Person. Das Gehalt ist
// bewusst deutlich über dem Freibetrag — sonst wäre nichts pfändbar und die
// Prüfung würde nichts prüfen.
await sende(gf, `/api/employees/${personId}/payroll-profile`, 'PUT', {
  personalnummer: `D17-${MARKE}`.slice(0, 12), steuerId: '20000000013',
  steuerklasse: 1, kinderfreibetraege: 0, konfession: 'keine',
  bundesland: 'Nordrhein-Westfalen', versicherungsart: 'GKV', zusatzbeitrag: 1.7,
  iban: 'DE02120300000000202051', kontoinhaber: `D17 Pfaendung ${MARKE}`,
  lohnart: 'monat', monatsgehalt: 4200, beschaeftigungsart: 'regulaer',
  eintrittsdatum: '2024-03-01', austrittsdatum: '',
})

const loeschen = async (cookie, pfad) => {
  const r = await fetch(`${BASIS}${pfad}`, { method: 'DELETE', headers: { cookie } })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

// ── D17.1 Wer das sehen darf ───────────────────────────────────────────────
console.log('=== D17.1 Wer Pfändungen sieht ===')

const ohneAnmeldung = await fetch(`${BASIS}/api/payroll/pfaendung`)
check('Ohne Anmeldung gar nichts', ohneAnmeldung.status === 401,
  `HTTP ${ohneAnmeldung.status}`)

const alsMitarbeiter = await hole(anna, '/api/payroll/pfaendung')
check('Ein Mitarbeiter sieht die Liste nicht', alsMitarbeiter.status === 403,
  `HTTP ${alsMitarbeiter.status}`)

const alsLeitung = await hole(leitung, '/api/payroll/pfaendung')
check('Eine Standortleitung auch nicht — sie sieht sonst, wer Schulden hat',
  alsLeitung.status === 403, `HTTP ${alsLeitung.status}`)

const leitungLegtAn = await sende(leitung, '/api/payroll/pfaendung', 'POST', {
  employeeId: personId, glaeubiger: 'Test', zugestelltAm: '2025-01-01',
})
check('Und legt erst recht keine an', leitungLegtAn.status === 403,
  `HTTP ${leitungLegtAn.status}`)

// ── D17.2 Was beim Anlegen verlangt wird ───────────────────────────────────
console.log('\n=== D17.2 Was eine Pfändung braucht ===')

const ohneGlaeubiger = await sende(gf, '/api/payroll/pfaendung', 'POST', {
  employeeId: personId, zugestelltAm: '2025-01-15',
})
check('Ohne Gläubiger wird abgelehnt', ohneGlaeubiger.status === 400,
  ohneGlaeubiger.body.error)

const ohneZustellung = await sende(gf, '/api/payroll/pfaendung', 'POST', {
  employeeId: personId, glaeubiger: 'Stadtkasse Köln',
})
check('Ohne Zustellungstag wird abgelehnt', ohneZustellung.status === 400,
  ohneZustellung.body.error)
check('Und es wird gesagt, warum der Tag zählt',
  /§804 Abs\. 3|Rang/.test(ohneZustellung.body.error ?? ''),
  ohneZustellung.body.error)

const unterhaltOhneBetrag = await sende(gf, '/api/payroll/pfaendung', 'POST', {
  employeeId: personId, art: 'unterhalt', glaeubiger: 'Jugendamt',
  zugestelltAm: '2025-02-01',
})
check('Eine Unterhaltspfändung ohne notwendigen Unterhalt wird abgelehnt',
  unterhaltOhneBetrag.status === 400, unterhaltOhneBetrag.body.error)
check('Weil das Gericht den Betrag festsetzt, nicht das Programm',
  /Gericht setzt ihn fest|§850d/.test(unterhaltOhneBetrag.body.error ?? ''),
  unterhaltOhneBetrag.body.error)

const angelegt = await sende(gf, '/api/payroll/pfaendung', 'POST', {
  employeeId: personId,
  glaeubiger: `Stadtkasse ${MARKE}`,
  aktenzeichen: '12 M 3456/25',
  zugestelltAm: '2025-03-10',
  forderung: 4000,
  unterhaltspflichten: 0,
})
const pfId = angelegt.body.pfaendung?.id
check('Die Unternehmensebene legt eine Pfändung an', !!pfId, angelegt.body.error)
check('Sie ist sofort aktiv', angelegt.body.pfaendung?.aktiv === true)
check('Und noch nichts getilgt', angelegt.body.pfaendung?.getilgt === 0)

// ── D17.3 Der Abzug in der Abrechnung ──────────────────────────────────────
console.log('\n=== D17.3 Was tatsächlich einbehalten wird ===')

// Der laufende Monat: Die Testperson ist erst seit heute beschäftigt, für
// frühere Monate gäbe es gar keine Abrechnung.
const heute = new Date()
const JAHR = heute.getFullYear()
const MONAT = heute.getMonth() + 1

// §136 Kein Lohn ohne freigegebenen Monatsabschluss — erst abnehmen, dann
// rechnen. Genau so läuft es im Betrieb auch.
const freigabe = await monatFreigeben(
  leitung, personId, JAHR, MONAT, `D17 Pfaendung ${MARKE}`)
check('Der Monat lässt sich freigeben', freigabe.ok !== false,
  freigabe.fehler ?? 'freigegeben')

const lauf = await sende(gf, '/api/payroll/vorbereiten', 'POST',
  { year: JAHR, month: MONAT })
check('Der Lohnlauf geht durch', lauf.status === 200, lauf.body.error)

const abrechnungen = (await hole(gf, `/api/payroll?year=${JAHR}&month=${MONAT}`))
  .body.entries ?? []
const meine = abrechnungen.find(a => a.employeeId === personId)
check('Für die Person gibt es eine Abrechnung', !!meine)

check('Es wurde etwas einbehalten', (meine?.pfaendungBetrag ?? 0) > 0,
  `${meine?.pfaendungBetrag} €`)
check('Der Auszahlungsbetrag ist um genau diesen Betrag kleiner als das Netto',
  Math.abs((meine?.netto ?? 0) - (meine?.pfaendungBetrag ?? 0)
    - (meine?.auszahlungsbetrag ?? 0)) < 0.02,
  `Netto ${meine?.netto} − Pfändung ${meine?.pfaendungBetrag} `
  + `= ${meine?.auszahlungsbetrag}?`)
check('Das Netto selbst bleibt unberührt — das Geld ist verdient',
  (meine?.netto ?? 0) > (meine?.auszahlungsbetrag ?? 0))

const stand = await hole(gf, `/api/payroll/pfaendung?employeeId=${personId}`)
const jetzt = (stand.body.pfaendungen ?? []).find(p => p.id === pfId)
check('Der Tilgungsstand wird nachgeführt', (jetzt?.getilgt ?? 0) > 0,
  `${jetzt?.getilgt} von ${jetzt?.forderung} €`)
check('Es gibt eine Zeile für den Monat', (jetzt?.abzuege ?? []).length > 0,
  `${(jetzt?.abzuege ?? []).length} Abzüge`)
check('Die Zeile nennt Jahr, Monat und Betrag',
  (jetzt?.abzuege ?? []).some(a => a.jahr === JAHR && a.monat === MONAT && a.betrag > 0))

// Der Fall, der sonst still schiefgeht: Wird der Monat noch einmal gerechnet,
// darf der Abzug sich nicht verdoppeln.
const vorher = jetzt?.getilgt ?? 0
await sende(gf, '/api/payroll/vorbereiten', 'POST', { year: JAHR, month: MONAT })
const nochmal = await hole(gf, `/api/payroll/pfaendung?employeeId=${personId}`)
const danach = (nochmal.body.pfaendungen ?? []).find(p => p.id === pfId)
check('Ein zweiter Lauf verdoppelt den Abzug NICHT',
  Math.abs((danach?.getilgt ?? 0) - vorher) < 0.02,
  `vorher ${vorher} €, nachher ${danach?.getilgt} €`)
check('Und es bleibt bei einer Zeile je Monat',
  (danach?.abzuege ?? []).filter(a => a.jahr === JAHR && a.monat === MONAT).length === 1)

// ── D17.4 Was sich nicht mehr ändern lässt ─────────────────────────────────
console.log('\n=== D17.4 Was festgeschrieben ist ===')

const rangAendern = await sende(gf, '/api/payroll/pfaendung', 'PATCH', {
  id: pfId, zugestelltAm: '2020-01-01',
})
check('Der Zustellungstag lässt sich nach einem Abzug nicht mehr ändern',
  rangAendern.status === 409, rangAendern.body.error)
check('Weil er den Rang gegenüber anderen Gläubigern bestimmt',
  /Rang|zuordnen/.test(rangAendern.body.error ?? ''), rangAendern.body.error)

const loeschversuch = await loeschen(gf, `/api/payroll/pfaendung?id=${pfId}`)
check('Eine Pfändung mit Abzügen lässt sich nicht löschen',
  loeschversuch.status === 409, loeschversuch.body.error)
check('Weil die Abzüge der Nachweis nach §840 ZPO sind',
  /§840/.test(loeschversuch.body.error ?? ''), loeschversuch.body.error)

const glaeubigerAendern = await sende(gf, '/api/payroll/pfaendung', 'PATCH', {
  id: pfId, notiz: 'Rückfrage beim Gericht läuft',
})
check('Eine Notiz lässt sich weiter ändern', glaeubigerAendern.status === 200,
  glaeubigerAendern.body.error)

// ── D17.5 Die Person sieht ihren Abzug ─────────────────────────────────────
console.log('\n=== D17.5 Was die Person erfährt ===')

const auskunft = await hole(gf, `/api/dsgvo/auskunft?employeeId=${personId}`)
const bloecke = auskunft.body.bloecke ?? []
const pfBlock = bloecke.find(b => b.id === 'pfaendung')
check('Die Pfändung steht in der Auskunft nach Art. 15 DSGVO', !!pfBlock,
  bloecke.map(b => b.id).join(', '))
check('Mit den Abzügen, die sie betrifft', (pfBlock?.anzahl ?? 0) > 0,
  `${pfBlock?.anzahl} Einträge`)

// ── Aufräumen ──────────────────────────────────────────────────────────────
//
// Die Testperson samt Pfändung und Abzügen wieder weg. Eine Pfändung, die aus
// einem Prüflauf stehen bleibt, würde bei jedem weiteren Lohnlauf Geld
// einbehalten — von einer Person, die es gar nicht gibt.
console.log('\n=== Aufräumen ===')

const okun = await login('okun@okun.de').catch(() => null)
if (okun) {
  await fetch(`${BASIS}/api/employees/${personId}`, {
    method: 'DELETE', headers: { cookie: okun },
  })
}

const uebrig = await hole(gf, `/api/payroll/pfaendung?employeeId=${personId}`)
check('Die Prüfung hinterlässt keine laufende Pfändung',
  (uebrig.body.pfaendungen ?? []).filter(p => p.aktiv).length === 0,
  `${(uebrig.body.pfaendungen ?? []).length} übrig`)

process.exit(bilanz() ? 1 : 0)
