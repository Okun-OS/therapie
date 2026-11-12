// Nachweis D19: Kurzarbeitergeld (§§95 ff. SGB III).
//
// Zwei Fehler kosten hier Geld, und zwar in entgegengesetzte Richtungen:
//
//   ZU VIEL: Wer in einem Monat mit Kurzarbeit das volle Gehalt abrechnet und
//   obendrein Kurzarbeitergeld auszahlt, zahlt zweimal — und bekommt das
//   zweite nicht erstattet.
//
//   ZU WENIG WIEDER HEREIN: Wer 60 % der BRUTTOdifferenz auszahlt statt 60 %
//   der pauschalierten NETTOdifferenz, zahlt deutlich mehr aus, als die
//   Agentur erstattet. Die Differenz trägt der Betrieb.
//
// Dazu kommt, was fast immer vergessen wird: Auf das fiktive Entgelt fallen
// Sozialversicherungsbeiträge an, und die trägt der Arbeitgeber ALLEIN.
//
// Die Rechenwege sind in src/lib/__tests__/kurzarbeit.test.ts nachgerechnet.

import {
  pruefer, login, hole, sende, BASIS, lohnPerson, monatFreigeben,
} from './helfer.mjs'

const { check, bilanz } = pruefer()

const gf = await login('gf@rheinblick-reha.de')
const leitung = await login('leitung@rheinblick-reha.de')
const anna = await login('anna.fischer@rheinblick-reha.de')

const locationId = (await hole(leitung, '/api/auth/me')).body.user.locationId
const MARKE = Date.now().toString(36)

const heute = new Date()
const JAHR = heute.getFullYear()
const MONAT = heute.getMonth() + 1

const GEHALT = 4000
const IST = 2000

const stammdaten = async (id, name, kinder) => {
  await sende(gf, `/api/employees/${id}/payroll-profile`, 'PUT', {
    personalnummer: `${name}`.slice(0, 12), steuerId: '20000000013',
    steuerklasse: 1, kinderfreibetraege: kinder, konfession: 'keine',
    bundesland: 'Nordrhein-Westfalen', versicherungsart: 'GKV', zusatzbeitrag: 1.7,
    iban: 'DE02120300000000202051', kontoinhaber: name,
    lohnart: 'monat', monatsgehalt: GEHALT, beschaeftigungsart: 'regulaer',
    eintrittsdatum: '2024-03-01', austrittsdatum: '',
  })
}

const personId = await lohnPerson(gf, locationId, `D19 Kug ${MARKE}`)
await stammdaten(personId, `D19-${MARKE}`, 0)
await monatFreigeben(leitung, personId, JAHR, MONAT, `D19 Kug ${MARKE}`)

const kindId = await lohnPerson(gf, locationId, `D19 Kind ${MARKE}`)
await stammdaten(kindId, `D19K-${MARKE}`, 1)
await monatFreigeben(leitung, kindId, JAHR, MONAT, `D19 Kind ${MARKE}`)

const loeschen = async (cookie, pfad) => {
  const r = await fetch(`${BASIS}${pfad}`, { method: 'DELETE', headers: { cookie } })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

const holeAbrechnung = async id => {
  const alle = (await hole(gf, `/api/payroll?year=${JAHR}&month=${MONAT}`))
    .body.entries ?? []
  return alle.find(a => a.employeeId === id)
}

// ── D19.1 Die Anzeige ──────────────────────────────────────────────────────
console.log('=== D19.1 Ohne Anzeige kein Kurzarbeitergeld ===')

const ohneAnmeldung = await fetch(`${BASIS}/api/payroll/kurzarbeit`)
check('Ohne Anmeldung gar nichts', ohneAnmeldung.status === 401,
  `HTTP ${ohneAnmeldung.status}`)

const durchMitarbeiter = await sende(anna, '/api/payroll/kurzarbeit', 'POST', {
  bezeichnung: 'Test', angezeigtAm: `${JAHR}-01-05`, von: `${JAHR}-01-01`,
})
check('Ein Mitarbeiter zeigt keine Kurzarbeit an', durchMitarbeiter.status === 403,
  `HTTP ${durchMitarbeiter.status}`)

const durchLeitung = await sende(leitung, '/api/payroll/kurzarbeit', 'POST', {
  bezeichnung: 'Test', angezeigtAm: `${JAHR}-01-05`, von: `${JAHR}-01-01`,
})
check('Eine Standortleitung auch nicht', durchLeitung.status === 403,
  `HTTP ${durchLeitung.status}`)

const ohneDatum = await sende(gf, '/api/payroll/kurzarbeit', 'POST', {
  bezeichnung: `D19 ${MARKE}`, von: `${JAHR}-01-01`,
})
check('Ohne Eingangsdatum der Anzeige wird abgelehnt', ohneDatum.status === 400,
  ohneDatum.body.error)
check('Und es wird gesagt, warum das Datum zählt',
  /§99 Abs\. 2 SGB III/.test(ohneDatum.body.error ?? ''), ohneDatum.body.error)

// Ein Monatswert ohne Anzeige: Ohne sie besteht kein Anspruch.
const waise = await sende(gf, '/api/payroll/kurzarbeit', 'POST', {
  was: 'monat', kurzarbeitId: 'gibtesnicht', employeeId: personId,
  jahr: JAHR, monat: MONAT, sollEntgelt: GEHALT, istEntgelt: IST,
})
check('Ein Monat ohne Anzeige wird abgelehnt', waise.status === 400,
  waise.body.error)
check('Mit Verweis auf §99 SGB III',
  /§99 SGB III/.test(waise.body.error ?? ''), waise.body.error)

const anzeige = await sende(gf, '/api/payroll/kurzarbeit', 'POST', {
  bezeichnung: `D19 Wohnbereich ${MARKE}`, grund: 'wirtschaftlich',
  angezeigtAm: `${JAHR}-01-05`, aktenzeichen: `KUG-${MARKE}`,
  von: `${JAHR}-01-01`, locationId,
})
const anzeigeId = anzeige.body.anzeige?.id
check('Die Unternehmensebene zeigt Kurzarbeit an', !!anzeigeId, anzeige.body.error)
check('Und wird auf die Ausschlussfrist hingewiesen',
  /§109 Abs\. 1 SGB III/.test(JSON.stringify(anzeige.body.hinweise ?? [])),
  JSON.stringify(anzeige.body.hinweise ?? []).slice(0, 200))

// ── D19.2 Der Monatswert ───────────────────────────────────────────────────
console.log('\n=== D19.2 Soll- und Istentgelt ===')

const ohneSoll = await sende(gf, '/api/payroll/kurzarbeit', 'POST', {
  was: 'monat', kurzarbeitId: anzeigeId, employeeId: personId,
  jahr: JAHR, monat: MONAT, istEntgelt: IST,
})
check('Ohne Sollentgelt wird abgelehnt', ohneSoll.status === 400,
  ohneSoll.body.error)
check('Und erklärt, was das Sollentgelt ist',
  /ohne Mehrarbeit|§106 Abs\. 1 SGB III/.test(ohneSoll.body.error ?? ''),
  ohneSoll.body.error)

const m1 = await sende(gf, '/api/payroll/kurzarbeit', 'POST', {
  was: 'monat', kurzarbeitId: anzeigeId, employeeId: personId,
  jahr: JAHR, monat: MONAT, sollStunden: 160, istStunden: 80,
  sollEntgelt: GEHALT, istEntgelt: IST,
})
check('Der Monatswert wird angelegt', m1.status === 200, m1.body.error)

const m2 = await sende(gf, '/api/payroll/kurzarbeit', 'POST', {
  was: 'monat', kurzarbeitId: anzeigeId, employeeId: kindId,
  jahr: JAHR, monat: MONAT, sollStunden: 160, istStunden: 80,
  sollEntgelt: GEHALT, istEntgelt: IST,
})
check('Auch für die Person mit Kind', m2.status === 200, m2.body.error)

const gleich = await sende(gf, '/api/payroll/kurzarbeit', 'POST', {
  was: 'monat', kurzarbeitId: anzeigeId, employeeId: personId,
  jahr: JAHR, monat: MONAT, sollEntgelt: GEHALT, istEntgelt: GEHALT,
})
check('Ohne Ausfall wird darauf hingewiesen',
  /kein Kurzarbeitergeld/.test(JSON.stringify(gleich.body.hinweise ?? [])),
  JSON.stringify(gleich.body.hinweise ?? []).slice(0, 200))

// Zurück auf den echten Wert
await sende(gf, '/api/payroll/kurzarbeit', 'POST', {
  was: 'monat', kurzarbeitId: anzeigeId, employeeId: personId,
  jahr: JAHR, monat: MONAT, sollStunden: 160, istStunden: 80,
  sollEntgelt: GEHALT, istEntgelt: IST,
})

// ── D19.3 Der Lohnlauf ─────────────────────────────────────────────────────
console.log('\n=== D19.3 Was auf der Abrechnung steht ===')

const lauf = await sende(gf, '/api/payroll/vorbereiten', 'POST',
  { year: JAHR, month: MONAT })
check('Der Lohnlauf geht durch', lauf.status === 200, lauf.body.error)

const a = await holeAbrechnung(personId)

check('Abgerechnet wird das Istentgelt, nicht das vertragliche Gehalt',
  a?.brutto === IST, `${a?.brutto} statt ${GEHALT}`)
check('Es gibt Kurzarbeitergeld', (a?.kugBetrag ?? 0) > 0, `${a?.kugBetrag} €`)

// Der Fehler, um den es geht: 60 % der BRUTTOdifferenz wären 1200 €.
check('Es sind NICHT 60 % der Bruttodifferenz',
  (a?.kugBetrag ?? 0) < (GEHALT - IST) * 0.6 - 50,
  `${a?.kugBetrag} € gegen ${(GEHALT - IST) * 0.6} € (falsch gerechnet)`)
check('Sondern spürbar weniger — die Nettodifferenz ist kleiner',
  (a?.kugBetrag ?? 0) > 0 && (a?.kugBetrag ?? 0) < (GEHALT - IST) * 0.6,
  `${a?.kugBetrag} €`)

check('Das Kurzarbeitergeld steht nicht im Steuerbrutto',
  Math.abs((a?.steuerBrutto ?? 0) - IST) < 0.02,
  `Steuerbrutto ${a?.steuerBrutto}`)
check('Und nicht im Beitragsbrutto',
  Math.abs((a?.svBrutto ?? 0) - IST) < 0.02, `SV-Brutto ${a?.svBrutto}`)
check('Und auch nicht im Netto', (a?.netto ?? 0) < IST,
  `Netto ${a?.netto}`)
check('Es kommt zur Auszahlung hinzu',
  Math.abs((a?.auszahlungsbetrag ?? 0) - ((a?.netto ?? 0) + (a?.kugBetrag ?? 0)))
    < 0.02,
  `${a?.auszahlungsbetrag} = ${a?.netto} + ${a?.kugBetrag}`)

// ── D19.4 Das fiktive Entgelt ──────────────────────────────────────────────
console.log('\n=== D19.4 Die Beiträge, die der Betrieb allein trägt ===')

check('Das fiktive Entgelt beträgt 80 % des Ausfalls',
  Math.abs((a?.kugFiktivEntgelt ?? 0) - (GEHALT - IST) * 0.8) < 0.02,
  `${a?.kugFiktivEntgelt} von ${(GEHALT - IST) * 0.8}`)
check('Darauf fallen Beiträge an', (a?.kugSvAG ?? 0) > 0, `${a?.kugSvAG} €`)
check('Sie stehen in den Arbeitgeberkosten',
  (a?.totalAgCost ?? 0) > (a?.brutto ?? 0) + (a?.kugSvAG ?? 0) - 0.02,
  `Kosten ${a?.totalAgCost}, davon fiktiv ${a?.kugSvAG}`)

const meineHinweise = (lauf.body.hinweise ?? [])
  .filter(h => (h.name ?? '').includes(MARKE))
check('Der Lauf nennt den Progressionsvorbehalt',
  /§32b/.test(JSON.stringify(meineHinweise)),
  JSON.stringify(meineHinweise).slice(0, 300))
check('Und sagt, dass der Arbeitgeber die Beiträge allein trägt',
  /Arbeitgeber allein/.test(JSON.stringify(meineHinweise)),
  JSON.stringify(meineHinweise).slice(0, 300))

// ── D19.5 67 statt 60 Prozent ──────────────────────────────────────────────
console.log('\n=== D19.5 Mit Kind mehr ===')

const k = await holeAbrechnung(kindId)
check('Mit Kind gibt es mehr Kurzarbeitergeld',
  (k?.kugBetrag ?? 0) > (a?.kugBetrag ?? 0),
  `mit Kind ${k?.kugBetrag} gegen ${a?.kugBetrag}`)
check('Und zwar im Verhältnis 67 zu 60',
  Math.abs((k?.kugBetrag ?? 0) / (a?.kugBetrag ?? 1) - 67 / 60) < 0.02,
  `${((k?.kugBetrag ?? 0) / (a?.kugBetrag ?? 1)).toFixed(4)}`)

// ── D19.6 Die Abrechnungsliste für die Agentur ─────────────────────────────
console.log('\n=== D19.6 Die Abrechnungsliste ===')

const listeDurchLeitung = await hole(leitung,
  `/api/payroll/kurzarbeit?liste=1&jahr=${JAHR}&monat=${MONAT}`)
check('Die Standortleitung stellt keinen Leistungsantrag',
  listeDurchLeitung.status === 403, `HTTP ${listeDurchLeitung.status}`)

const liste = await hole(gf,
  `/api/payroll/kurzarbeit?liste=1&jahr=${JAHR}&monat=${MONAT}&kurzarbeitId=${anzeigeId}`)
check('Die Liste enthält beide Personen',
  (liste.body.zeilen ?? []).length === 2,
  `${(liste.body.zeilen ?? []).length} Zeilen`)
check('Die Summe stimmt mit den Abrechnungen überein',
  Math.abs((liste.body.summeKug ?? 0)
    - ((a?.kugBetrag ?? 0) + (k?.kugBetrag ?? 0))) < 0.02,
  `${liste.body.summeKug} gegen ${(a?.kugBetrag ?? 0) + (k?.kugBetrag ?? 0)}`)
check('Die Beiträge auf das fiktive Entgelt stehen dabei',
  (liste.body.summeSvAgFiktiv ?? 0) > 0, `${liste.body.summeSvAgFiktiv} €`)
check('Die Ausschlussfrist wird genannt',
  /^\d{4}-\d{2}-\d{2}$/.test(liste.body.frist ?? ''), liste.body.frist)
check('Der Entgeltausfall steht je Person',
  (liste.body.zeilen ?? []).every(z => Math.abs(z.ausfallProzent - 50) < 0.1),
  JSON.stringify((liste.body.zeilen ?? []).map(z => z.ausfallProzent)))
check('Die Betriebsschwelle wird ausgewiesen',
  typeof liste.body.schwelle?.erreicht === 'boolean',
  JSON.stringify(liste.body.schwelle))

// ── D19.7 Wer was sieht ────────────────────────────────────────────────────
console.log('\n=== D19.7 Sichtbarkeit und Löschschutz ===')

const beiPerson = await hole(anna, `/api/payroll/kurzarbeit?jahr=${JAHR}&monat=${MONAT}`)
check('Ein Mitarbeiter sieht nur seine eigenen Monate',
  (beiPerson.body.monate ?? []).every(m => m.employeeId !== personId))

const beiLeitung = await hole(leitung, `/api/payroll/kurzarbeit?jahr=${JAHR}&monat=${MONAT}`)
check('Die Leitung sieht die ihres Standorts',
  (beiLeitung.body.monate ?? []).some(m => m.employeeId === personId))

const monatId = (await hole(gf, `/api/payroll/kurzarbeit?jahr=${JAHR}&monat=${MONAT}`))
  .body.monate?.find(m => m.employeeId === personId)?.id
const monatWeg = await loeschen(gf, `/api/payroll/kurzarbeit?monatId=${monatId}`)
check('Ein abgerechneter Monat lässt sich nicht löschen',
  monatWeg.status === 409, monatWeg.body.error)

const anzeigeWeg = await loeschen(gf, `/api/payroll/kurzarbeit?id=${anzeigeId}`)
check('Und die Anzeige dahinter auch nicht',
  anzeigeWeg.status === 409, anzeigeWeg.body.error)
check('Weil sonst Abrechnungen ohne Anzeige dastünden',
  /keine Anzeige mehr gibt/.test(anzeigeWeg.body.error ?? ''),
  anzeigeWeg.body.error)

// ── Aufräumen ──────────────────────────────────────────────────────────────
console.log('\n=== Aufräumen ===')

const okun = await login('okun@okun.de').catch(() => null)
if (okun) {
  for (const id of [personId, kindId]) {
    await fetch(`${BASIS}/api/employees/${id}`, {
      method: 'DELETE', headers: { cookie: okun },
    })
  }
}
// Ohne abgerechnete Monate lässt sich die Anzeige jetzt entfernen.
const endgueltig = await loeschen(gf, `/api/payroll/kurzarbeit?id=${anzeigeId}`)
check('Nach dem Löschen der Personen geht die Anzeige weg',
  endgueltig.status === 200, JSON.stringify(endgueltig.body))

const uebrig = await hole(gf, `/api/payroll/kurzarbeit?jahr=${JAHR}&monat=${MONAT}`)
check('Die Prüfung hinterlässt keine Anzeige',
  !(uebrig.body.anzeigen ?? []).some(x => x.id === anzeigeId))
check('Und keinen Monatswert',
  !(uebrig.body.monate ?? []).some(m => m.employeeId === personId
    || m.employeeId === kindId))

process.exit(bilanz() ? 1 : 0)
