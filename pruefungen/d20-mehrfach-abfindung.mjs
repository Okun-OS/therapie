// Nachweis D20: Mehrfachbeschäftigung (§22 Abs. 2 SGB IV) und Abfindung.
//
// Zwei Fälle, die in der Pflege häufig sind und fast überall falsch gerechnet
// werden:
//
//   ZWEI ARBEITGEBER. Die Beitragsbemessungsgrenze gehört der Person, nicht
//   dem Arbeitgeber. Wer sie zweimal voll anwendet, lässt die Person auf
//   denselben Euro doppelt Beiträge zahlen.
//
//   DIE ABFINDUNG. Bis 2024 durfte der Arbeitgeber die Fünftelregelung im
//   Lohnsteuerabzug anwenden; seit 2025 nicht mehr (§39b Abs. 3 Satz 9 EStG
//   ist entfallen). Wer das nicht mitbekommen hat, behält zu wenig Lohnsteuer
//   ein — und die Person bekommt einen Bescheid, mit dem sie nicht rechnet.
//
// Die Rechenwege sind in src/lib/__tests__/mehrfachbeschaeftigung.test.ts
// nachgerechnet.

import {
  pruefer, login, hole, sende, BASIS, lohnPerson, monatFreigeben,
} from './helfer.mjs'

const { check, bilanz } = pruefer()

const gf = await login('gf@rheinblick-reha.de')
const leitung = await login('leitung@rheinblick-reha.de')

const locationId = (await hole(leitung, '/api/auth/me')).body.user.locationId
const MARKE = Date.now().toString(36)

const heute = new Date()
const JAHR = heute.getFullYear()
const MONAT = heute.getMonth() + 1

// Ein Gehalt über der Beitragsbemessungsgrenze. Bewusst so hoch: Dann ist der
// Einzelfall schon gedeckelt, und bei zwei gleich hohen Entgelten muss genau
// die Hälfte herauskommen — eine Aussage, die ohne Kenntnis der Grenze prüfbar
// ist.
const GEHALT = 12000

const anlegen = async (name, extra) => {
  const id = await lohnPerson(gf, locationId, name)
  await sende(gf, `/api/employees/${id}/payroll-profile`, 'PUT', {
    personalnummer: name.replace(/[^A-Za-z0-9]/g, '').slice(0, 12),
    steuerId: '20000000013', steuerklasse: 1, kinderfreibetraege: 0,
    konfession: 'keine', bundesland: 'Nordrhein-Westfalen',
    versicherungsart: 'GKV', zusatzbeitrag: 1.7,
    iban: 'DE02120300000000202051', kontoinhaber: name,
    lohnart: 'monat', monatsgehalt: GEHALT, beschaeftigungsart: 'regulaer',
    eintrittsdatum: '2024-03-01', austrittsdatum: '',
    ...extra,
  })
  await monatFreigeben(leitung, id, JAHR, MONAT, name)
  return id
}

const holeAbrechnung = async id => {
  const alle = (await hole(gf, `/api/payroll?year=${JAHR}&month=${MONAT}`))
    .body.entries ?? []
  return alle.find(a => a.employeeId === id)
}

const alleinId = await anlegen(`D20 allein ${MARKE}`, {})
const doppeltId = await anlegen(`D20 doppelt ${MARKE}`, {
  weiteresEntgelt: GEHALT, weitererArbeitgeber: 'Pflegedienst Nachbar',
})
const abfindungId = await anlegen(`D20 abfindung ${MARKE}`, {})

// ── D20.1 Das zweite Entgelt am Lohnprofil ─────────────────────────────────
console.log('=== D20.1 Das zweite Entgelt wird gespeichert ===')

const profil = await hole(gf, `/api/employees/${doppeltId}/payroll-profile`)
const p = profil.body.profil ?? profil.body
check('Das weitere Entgelt steht am Lohnprofil',
  (p.weiteresEntgelt ?? p.profile?.weiteresEntgelt) === GEHALT,
  JSON.stringify({ w: p.weiteresEntgelt }))
check('Und der andere Arbeitgeber dazu',
  /Nachbar/.test(p.weitererArbeitgeber ?? ''), p.weitererArbeitgeber)

// ── D20.2 Die geteilte Grenze ──────────────────────────────────────────────
console.log('\n=== D20.2 Die Grenze gehört der Person ===')

const lauf = await sende(gf, '/api/payroll/vorbereiten', 'POST',
  { year: JAHR, month: MONAT })
check('Der Lohnlauf geht durch', lauf.status === 200, lauf.body.error)

const allein = await holeAbrechnung(alleinId)
const doppelt = await holeAbrechnung(doppeltId)

check('Beide verdienen dasselbe',
  allein?.brutto === doppelt?.brutto, `${allein?.brutto} / ${doppelt?.brutto}`)
check('Aber bei zwei Arbeitgebern fällt weniger Rentenversicherung an',
  (doppelt?.rvAN ?? 0) < (allein?.rvAN ?? 0),
  `${doppelt?.rvAN} gegen ${allein?.rvAN}`)
check('Und weniger Krankenversicherung',
  (doppelt?.kvAN ?? 0) < (allein?.kvAN ?? 0),
  `${doppelt?.kvAN} gegen ${allein?.kvAN}`)
check('Genau die Hälfte, weil beide Entgelte gleich hoch sind',
  Math.abs((doppelt?.rvAN ?? 0) - (allein?.rvAN ?? 0) / 2) < 1,
  `${doppelt?.rvAN} gegen ${(allein?.rvAN ?? 0) / 2}`)
check('Auch in der Krankenversicherung genau die Hälfte',
  Math.abs((doppelt?.kvAN ?? 0) - (allein?.kvAN ?? 0) / 2) < 1,
  `${doppelt?.kvAN} gegen ${(allein?.kvAN ?? 0) / 2}`)
check('Weniger Beiträge heißt mehr Netto, nicht weniger',
  (doppelt?.netto ?? 0) > (allein?.netto ?? 0),
  `${doppelt?.netto} gegen ${allein?.netto}`)

const meine = (lauf.body.hinweise ?? []).filter(h => (h.name ?? '').includes(MARKE))
check('Der Lauf sagt, dass geteilt wurde',
  /§22 Abs\. 2 SGB IV/.test(JSON.stringify(meine)),
  JSON.stringify(meine).slice(0, 300))
check('Und dass die Krankenkasse das Gesamtentgelt feststellt',
  /Mehrfachbeschäftigung/.test(JSON.stringify(meine)),
  JSON.stringify(meine).slice(0, 300))

// ── D20.3 Steuerklasse VI im zweiten Verhältnis ────────────────────────────
console.log('\n=== D20.3 Das zweite Dienstverhältnis ===')

await sende(gf, `/api/employees/${doppeltId}/payroll-profile`, 'PUT', {
  personalnummer: `D20d${MARKE}`.slice(0, 12), steuerId: '20000000013',
  steuerklasse: 1, kinderfreibetraege: 0, konfession: 'keine',
  bundesland: 'Nordrhein-Westfalen', versicherungsart: 'GKV', zusatzbeitrag: 1.7,
  iban: 'DE02120300000000202051', kontoinhaber: `D20 doppelt ${MARKE}`,
  lohnart: 'monat', monatsgehalt: GEHALT, beschaeftigungsart: 'regulaer',
  eintrittsdatum: '2024-03-01', austrittsdatum: '',
  weiteresEntgelt: GEHALT, weitererArbeitgeber: 'Pflegedienst Nachbar',
  nebenbeschaeftigung: true,
})
const lauf2 = await sende(gf, '/api/payroll/vorbereiten', 'POST',
  { year: JAHR, month: MONAT })
const meine2 = (lauf2.body.hinweise ?? []).filter(h => (h.name ?? '').includes(MARKE))
check('Eine Nebenbeschäftigung ohne Steuerklasse VI wird gemeldet',
  /Steuerklasse VI/.test(JSON.stringify(meine2)),
  JSON.stringify(meine2).slice(0, 300))
check('Mit Verweis auf §38b EStG',
  /§38b/.test(JSON.stringify(meine2)), JSON.stringify(meine2).slice(0, 300))

// ── D20.4 Die Abfindung ────────────────────────────────────────────────────
console.log('\n=== D20.4 Die Abfindung und die entfallene Fünftelregelung ===')

const abfindung = await sende(gf, '/api/payroll/einmalzahlung', 'POST', {
  employeeId: abfindungId, jahr: JAHR, monat: MONAT,
  art: 'abfindung', bezeichnung: `Abfindung ${MARKE}`, betrag: 30000,
})
check('Die Abfindung wird erfasst', abfindung.status === 200, abfindung.body.error)

const h = JSON.stringify(abfindung.body.hinweise ?? [])
check('Beim Erfassen wird gesagt, dass die Fünftelregelung entfallen ist',
  /NICHT mehr an/.test(h), h.slice(0, 400))
check('Mit der Vorschrift, die entfallen ist',
  /§39b Abs\. 3 Satz 9 EStG/.test(h), h.slice(0, 400))
check('Und dem Weg, wie die Ermäßigung trotzdem kommt',
  /Einkommensteuererklärung/.test(h), h.slice(0, 400))
check('Die Beitragsfreiheit wird begründet',
  /§14 SGB IV/.test(h), h.slice(0, 400))
check('Die Zusammenballung nach §34 EStG wird abgeschätzt',
  /§34 Abs\. 1 EStG|Zusammenballung/.test(h), h.slice(0, 500))

const lauf3 = await sende(gf, '/api/payroll/vorbereiten', 'POST',
  { year: JAHR, month: MONAT })
const ab = await holeAbrechnung(abfindungId)

check('Die Abfindung steht im Brutto',
  (ab?.brutto ?? 0) >= GEHALT + 30000 - 0.02, `${ab?.brutto}`)
check('Sie erhöht das Beitragsbrutto NICHT',
  Math.abs((ab?.svBrutto ?? 0) - GEHALT) < 0.02, `SV-Brutto ${ab?.svBrutto}`)
check('Es wird Steuer darauf einbehalten',
  (ab?.lohnsteuerSonstige ?? 0) > 0, `${ab?.lohnsteuerSonstige} €`)

const meine3 = (lauf3.body.hinweise ?? []).filter(h2 => (h2.name ?? '').includes(MARKE))
check('Auch der Lohnlauf nennt die entfallene Fünftelregelung',
  /§39b Abs\. 3 Satz 9 EStG/.test(JSON.stringify(meine3)),
  JSON.stringify(meine3).slice(0, 300))

// ── D20.5 Der Beleg ────────────────────────────────────────────────────────
console.log('\n=== D20.5 Der Beleg ===')

const beleg = await sende(gf, '/api/payroll/beleg', 'POST',
  { year: JAHR, month: MONAT, employeeId: abfindungId })
check('Der Beleg mit der Abfindung lässt sich erzeugen',
  beleg.status === 200, JSON.stringify(beleg.body).slice(0, 200))

// ── Aufräumen ──────────────────────────────────────────────────────────────
console.log('\n=== Aufräumen ===')

const okun = await login('okun@okun.de').catch(() => null)
if (okun) {
  for (const id of [alleinId, doppeltId, abfindungId]) {
    await fetch(`${BASIS}/api/employees/${id}`, {
      method: 'DELETE', headers: { cookie: okun },
    })
  }
}
const uebrig = (await hole(gf, `/api/payroll?year=${JAHR}&month=${MONAT}`))
  .body.entries ?? []
check('Die Prüfung hinterlässt keine Abrechnung',
  !uebrig.some(e => [alleinId, doppeltId, abfindungId].includes(e.employeeId)),
  `${uebrig.filter(e => [alleinId, doppeltId, abfindungId].includes(e.employeeId)).length} übrig`)

process.exit(bilanz() ? 1 : 0)
