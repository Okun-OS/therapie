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

// §175 Derselbe Stichtag wie gleich darauf — sonst entstehen ZWEI Staende,
// und der spaetere (der Vertipper) gilt weiter. Genau das ist hier beim
// Umbau passiert: Die Rechnung kam auf 630 statt 63 Euro, weil der
// verworfene 21-Prozent-Satz noch am laufenden Monat hing. Fachlich richtig
// gerechnet, nur mit dem falschen Stand — und deshalb gibt es jetzt in der
// Maske die Liste aller Staende zum Aufraeumen.
const unueblich = await sende(gf, '/api/payroll/umlagen', 'PUT', {
  kasse: KASSE, u1Satz: 21, u2Satz: 0.65, u1Erstattung: 80,
  gueltigAb: `${JAHR}-01-01`,
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

// ── §175 Der Katalog und die Erstattungsstufe ──────────────────────────────
//
// Was die TK fuer eine 80-Prozent-Erstattung verlangt, ist fuer jeden
// Arbeitgeber dieselbe Zahl. Sie steht deshalb einmal im Katalog, und der
// Betrieb waehlt nur noch seine Stufe. Der eigene Eintrag bleibt fuer Kassen,
// die (noch) nicht im Katalog stehen.
console.log('\n=== §175 Katalog und Erstattungsstufe ===')

const mitKatalog = await hole(gf, '/api/payroll/umlagen')
const katalog = mitKatalog.body.katalog ?? []
check('Der Katalog der Kassen wird mitgeliefert', katalog.length > 0,
  `${katalog.length} Kassen`)

const tk = katalog.find(k => /Techniker/i.test(k.kasse))
check('Die Techniker Krankenkasse steht drin', !!tk,
  katalog.map(k => k.kasse).slice(0, 5).join(', '))
check('Mit mehreren Erstattungsstufen zur Wahl', (tk?.stufen?.length ?? 0) >= 2,
  JSON.stringify(tk?.stufen ?? []))
// §176 Uebernommen ist nicht geprueft — und die Oberflaeche muss es
// unterscheiden koennen. Bei den Pfaendungstabellen waren zwei von acht
// falsch; aufgefallen ist es nur, weil es dieses Feld gab.
const alleStufen = katalog.flatMap(k => k.stufen ?? [])
check('Jeder Katalogeintrag sagt, ob er geprueft ist',
  alleStufen.length > 0 && alleStufen.every(s => typeof s.geprueft === 'boolean'),
  `${alleStufen.length} Stufen`)
check('Der Erstbestand ist vollstaendig geprueft',
  alleStufen.every(s => s.geprueft),
  `${alleStufen.filter(s => !s.geprueft).length} ungeprueft: `
  + katalog.filter(k => (k.stufen ?? []).some(s => !s.geprueft))
    .map(k => k.kasse).join(', '))

check('Und je Stufe einem eigenen U1-Satz',
  new Set((tk?.stufen ?? []).map(s => s.satz)).size === (tk?.stufen ?? []).length,
  JSON.stringify(tk?.stufen ?? []))

// Eine Stufe, die es bei dieser Kasse nicht gibt, darf nicht still
// durchgehen — sonst rechnet der Lohnlauf mit einem Satz, den niemand
// vereinbart hat.
const falscheStufe = await sende(gf, '/api/payroll/umlagen', 'PUT', {
  kasse: tk?.kasse ?? 'Techniker Krankenkasse', u1Erstattung: 55,
})
check('Eine Stufe, die es bei dieser Kasse nicht gibt, wird abgelehnt',
  falscheStufe.status === 400, `HTTP ${falscheStufe.status} ${falscheStufe.body.error ?? ''}`)
check('Und die moeglichen Stufen werden genannt',
  /zur Wahl stehen/i.test(falscheStufe.body.error ?? ''), falscheStufe.body.error)

const echteStufe = (tk?.stufen ?? [])[0]
const gewaehlt = await sende(gf, '/api/payroll/umlagen', 'PUT', {
  kasse: tk?.kasse, u1Erstattung: Math.round((echteStufe?.erstattung ?? 0) * 100),
})
check('Eine vorhandene Stufe laesst sich waehlen', gewaehlt.status === 200,
  gewaehlt.body.error)

const nachWahl = await hole(gf, '/api/payroll/umlagen')
const tkSatz = (nachWahl.body.saetze ?? []).find(s => s.kasse === tk?.kasse)
check('Der Satz kommt danach aus dem Katalog, nicht aus einem Eingabefeld',
  tkSatz?.quelle === 'katalog', JSON.stringify(tkSatz))
check('Und stimmt mit der gewaehlten Stufe ueberein',
  Math.abs((tkSatz?.u1Satz ?? 0) - (echteStufe?.satz ?? -1)) < 1e-9,
  `${tkSatz?.u1Satz} statt ${echteStufe?.satz}`)
check('Der U2-Satz kommt gleich mit — man waehlt ihn nicht',
  (tkSatz?.u2Satz ?? null) !== null, `${tkSatz?.u2Satz}`)

// Gegenprobe: Der eigene Eintrag schlaegt den Katalog. Ein Betrieb mit einer
// Sondervereinbarung darf nicht vom Katalog ueberstimmt werden.
const eigenerEintrag = await sende(gf, '/api/payroll/umlagen', 'PUT', {
  kasse: tk?.kasse, u1Satz: 2.5, u2Satz: 0.5, u1Erstattung: 50,
})
check('Ein eigener Eintrag wird angenommen', eigenerEintrag.status === 200,
  eigenerEintrag.body.error)
check('Und es wird gesagt, dass er den Katalog schlaegt',
  /schlaegt den Katalog|schlägt den Katalog/.test(JSON.stringify(eigenerEintrag.body.hinweise ?? [])),
  JSON.stringify(eigenerEintrag.body.hinweise ?? []).slice(0, 220))

const nachEigen = await hole(gf, '/api/payroll/umlagen')
const tkEigen = (nachEigen.body.saetze ?? []).find(s => s.kasse === tk?.kasse)
check('Der eigene Satz gilt jetzt', tkEigen?.quelle === 'eigen'
  && Math.abs((tkEigen?.u1Satz ?? 0) - 0.025) < 1e-9, JSON.stringify(tkEigen))

for (const s of (nachEigen.body.saetze ?? []).filter(x => x.kasse === tk?.kasse)) {
  await loeschen(gf, `/api/payroll/umlagen?id=${s.id}`)
}
const nachAufraeumen = await hole(gf, '/api/payroll/umlagen')
check('Die Katalogpruefung hinterlaesst keine Wahl',
  !(nachAufraeumen.body.saetze ?? []).some(s => s.kasse === tk?.kasse),
  JSON.stringify((nachAufraeumen.body.saetze ?? []).map(s => s.kasse)))

// §175 Zwei Staende derselben Kasse
//
// Kassen aendern ihre Saetze unterjaehrig, und ein Betrieb kann zum
// Jahreswechsel die Stufe wechseln. Beides braucht zwei Zeilen mit
// verschiedenem Stichtag — vorher ueberschrieb die zweite die erste, und der
// Dezember liess sich nicht mehr nachrechnen.
console.log('\n=== §175 Zwei Staende derselben Kasse ===')

// Eine eigene Kasse fuer diesen Block: Die Schritte davor haben fuer KASSE
// schon Staende angelegt, und eine Pruefung, die auf deren Zahl aufbaut,
// bestuende nur in dieser Reihenfolge.
const ZWEISTAND = `Pruefkasse Zweistand ${MARKE}`
const frueher = await sende(gf, '/api/payroll/umlagen', 'PUT', {
  kasse: ZWEISTAND, u1Satz: 1.5, u2Satz: 0.4, u1Erstattung: 50,
  gueltigAb: `${JAHR}-01-01`,
})
const spaeter = await sende(gf, '/api/payroll/umlagen', 'PUT', {
  kasse: ZWEISTAND, u1Satz: 3.0, u2Satz: 0.4, u1Erstattung: 80,
  gueltigAb: `${JAHR}-07-01`,
})
check('Ein zweiter Stand mit spaeterem Stichtag wird angelegt',
  frueher.status === 200 && spaeter.status === 200
  && frueher.body.satz?.id !== spaeter.body.satz?.id,
  `${frueher.body.satz?.id} / ${spaeter.body.satz?.id}`)

const mitZweien = await hole(gf, '/api/payroll/umlagen')
const dieKasse = (mitZweien.body.saetze ?? []).find(x => x.kasse === ZWEISTAND)
check('Die Liste zeigt die Kasse trotzdem nur einmal',
  (mitZweien.body.saetze ?? []).filter(x => x.kasse === ZWEISTAND).length === 1,
  `${(mitZweien.body.saetze ?? []).filter(x => x.kasse === ZWEISTAND).length} Zeilen`)
check('Und sagt, dass es mehrere Staende gibt', (dieKasse?.staende ?? 0) === 2,
  `${dieKasse?.staende}`)

// §175 Jeder Stand einzeln sichtbar und einzeln wegraeumbar. Ohne das
// bliebe ein alter Vertipper mit spaeterem Stichtag fuer immer der
// geltende Satz — gerechnet wird richtig, nur mit der falschen Zahl.
check('Jeder Stand ist einzeln aufgefuehrt',
  (dieKasse?.alleStaende ?? []).length === 2,
  JSON.stringify(dieKasse?.alleStaende ?? []))
check('Jeder hat eine eigene Kennung zum Wegraeumen',
  new Set((dieKasse?.alleStaende ?? []).map(x => x.id)).size === 2,
  JSON.stringify((dieKasse?.alleStaende ?? []).map(x => x.id)))
check('Genau einer ist als der geltende gekennzeichnet',
  (dieKasse?.alleStaende ?? []).filter(x => x.gilt).length === 1,
  JSON.stringify((dieKasse?.alleStaende ?? []).map(x => [x.gueltigAb, x.gilt])))
check('Und es ist der, den auch die Zeile oben zeigt',
  (dieKasse?.alleStaende ?? []).find(x => x.gilt)?.gueltigAb === dieKasse?.gueltigAb,
  `${(dieKasse?.alleStaende ?? []).find(x => x.gilt)?.gueltigAb} / ${dieKasse?.gueltigAb}`)

// Der laufende Monat ist September — der Juli-Stand gilt, nicht der Januar.
const heutigerMonat = mitZweien.body.monat?.monat
const erwartet = heutigerMonat >= 7 ? 0.03 : 0.015
check('Es gilt der Stand, der zu diesem Monat passt',
  Math.abs((dieKasse?.u1Satz ?? 0) - erwartet) < 1e-9,
  `Monat ${heutigerMonat}: ${dieKasse?.u1Satz} statt ${erwartet}`)

// ── Aufraeumen ─────────────────────────────────────────────────────────────
// §175 Alle Staende, nicht nur einen: Seit die Wahl einen Zeitverlauf hat,
// kann es je Kasse mehrere Zeilen geben. Eine Pruefung, die nur die erste
// wegraeumt, hinterlaesst Zustand — Regel 1 der README.
const alleStaende = await hole(gf, '/api/payroll/umlagen')
const idsDerKasse = (alleStaende.body.saetze ?? [])
  .filter(x => x.kasse === KASSE || x.kasse === ZWEISTAND).map(x => x.id)
let weg = { status: 0, body: {} }
for (const id of idsDerKasse) {
  weg = await loeschen(gf, `/api/payroll/umlagen?id=${id}`)
}
check('Der Satz lässt sich löschen', weg.status === 200,
  JSON.stringify(weg.body).slice(0, 200))
check('Und es wird gesagt, was das bedeutet',
  /keine Umlage mehr/.test(weg.body.hinweis ?? ''), weg.body.hinweis)

// Die Liste fasst je Kasse zusammen — nach dem ersten Loeschen kann noch ein
// Stand uebrig sein. Deshalb so lange, bis wirklich keiner mehr da ist.
for (let runde = 0; runde < 5; runde++) {
  const rest = await hole(gf, '/api/payroll/umlagen')
  const offen = (rest.body.saetze ?? [])
    .filter(x => x.kasse === KASSE || x.kasse === ZWEISTAND)
  if (offen.length === 0) break
  for (const s of offen) await loeschen(gf, `/api/payroll/umlagen?id=${s.id}`)
}

const okun = await login('okun@okun.de').catch(() => null)
if (okun) {
  await fetch(`${BASIS}/api/employees/${personId}`, {
    method: 'DELETE', headers: { cookie: okun },
  })
}
const uebrig = await hole(gf, '/api/payroll/umlagen')
check('Die Prüfung hinterlässt keinen Satz',
  !(uebrig.body.saetze ?? []).some(s => s.kasse === KASSE || s.kasse === ZWEISTAND),
  `${(uebrig.body.saetze ?? []).filter(s => s.kasse === KASSE || s.kasse === ZWEISTAND).length} übrig`)

process.exit(bilanz() ? 1 : 0)
