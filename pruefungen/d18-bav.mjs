// Nachweis D18: Betriebliche Altersvorsorge (§1a BetrAVG, §3 Nr. 63 EStG).
//
// Der Fehler, den fast jede selbstgebaute Abrechnung macht, ist hier der
// Prüfgegenstand: „acht Prozent sind frei". Das ist zur Hälfte richtig —
// steuerfrei bis 8 % der Beitragsbemessungsgrenze, BEITRAGSFREI nur bis 4 %.
// Wer mit einer Grenze rechnet, zieht im Bereich dazwischen zu wenig
// Sozialversicherung ab. Das fällt erst bei der Betriebsprüfung auf, dann für
// vier Jahre rückwirkend und mit Säumniszuschlägen.
//
// Geprüft wird deshalb vor allem eines: dass Steuerbrutto und Beitragsbrutto
// UNTERSCHIEDLICH sinken.
//
// Die Rechenwege sind in src/lib/__tests__/bav.test.ts nachgerechnet.

import {
  pruefer, login, hole, sende, BASIS, lohnPerson, monatFreigeben,
} from './helfer.mjs'

const { check, bilanz } = pruefer()

const gf = await login('gf@rheinblick-reha.de')
const leitung = await login('leitung@rheinblick-reha.de')
const anna = await login('anna.fischer@rheinblick-reha.de')

const locationId = (await hole(leitung, '/api/auth/me')).body.user.locationId
const MARKE = Date.now().toString(36)

const personId = await lohnPerson(gf, locationId, `D18 bAV ${MARKE}`)
await sende(gf, `/api/employees/${personId}/payroll-profile`, 'PUT', {
  personalnummer: `D18-${MARKE}`.slice(0, 12), steuerId: '20000000013',
  steuerklasse: 1, kinderfreibetraege: 0, konfession: 'keine',
  bundesland: 'Nordrhein-Westfalen', versicherungsart: 'GKV', zusatzbeitrag: 1.7,
  iban: 'DE02120300000000202051', kontoinhaber: `D18 bAV ${MARKE}`,
  lohnart: 'monat', monatsgehalt: 5000, beschaeftigungsart: 'regulaer',
  eintrittsdatum: '2024-03-01', austrittsdatum: '',
})

const heute = new Date()
const JAHR = heute.getFullYear()
const MONAT = heute.getMonth() + 1

const loeschen = async (cookie, pfad) => {
  const r = await fetch(`${BASIS}${pfad}`, { method: 'DELETE', headers: { cookie } })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

// ── D18.1 Die zwei Grenzen ─────────────────────────────────────────────────
console.log('=== D18.1 Die zwei Grenzen ===')

const uebersicht = await hole(gf, '/api/payroll/bav')
check('Die Grenzen sind abrufbar', !!uebersicht.body.grenzen)

const g = uebersicht.body.grenzen ?? {}
check('Die Steuergrenze ist doppelt so hoch wie die Beitragsgrenze',
  Math.abs(g.steuerfreiJahr - g.svfreiJahr * 2) < 1,
  `steuerfrei ${g.steuerfreiJahr} € / beitragsfrei ${g.svfreiJahr} €`)
check('Der Anspruch aus §1a BetrAVG reicht bis zur Beitragsgrenze',
  Math.abs((uebersicht.body.anspruchJahr ?? 0) - g.svfreiJahr) < 1,
  `${uebersicht.body.anspruchJahr} €`)
check('Der Pflichtzuschuss steht bei 15 %',
  uebersicht.body.pflichtzuschuss === 0.15)

// ── D18.2 Wer einen Vertrag anlegen darf ───────────────────────────────────
console.log('\n=== D18.2 Wer Verträge anlegt ===')

const durchMitarbeiter = await sende(anna, '/api/payroll/bav', 'POST', {
  employeeId: personId, anbieter: 'Test', monatsbetrag: 100, beginn: '2026-01-01',
})
check('Ein Mitarbeiter legt keinen Vertrag an', durchMitarbeiter.status === 403,
  `HTTP ${durchMitarbeiter.status}`)

const durchLeitung = await sende(leitung, '/api/payroll/bav', 'POST', {
  employeeId: personId, anbieter: 'Test', monatsbetrag: 100, beginn: '2026-01-01',
})
check('Eine Standortleitung auch nicht', durchLeitung.status === 403,
  `HTTP ${durchLeitung.status}`)

const ohneBetrag = await sende(gf, '/api/payroll/bav', 'POST', {
  employeeId: personId, anbieter: 'Allianz', beginn: '2026-01-01',
})
check('Ohne Monatsbetrag wird abgelehnt', ohneBetrag.status === 400,
  ohneBetrag.body.error)

const niedrigerZuschuss = await sende(gf, '/api/payroll/bav', 'POST', {
  employeeId: personId, anbieter: `Probe ${MARKE}`, monatsbetrag: 50,
  beginn: '2026-01-01', zuschussSatz: 0.05,
})
check('Ein Zuschuss unter 15 % wird angenommen, aber gemeldet',
  niedrigerZuschuss.status === 200
  && (niedrigerZuschuss.body.hinweise ?? []).length > 0,
  JSON.stringify(niedrigerZuschuss.body.hinweise))
check('Und es wird auf §1a Abs. 1a BetrAVG verwiesen',
  /§1a Abs\. 1a BetrAVG/.test((niedrigerZuschuss.body.hinweise ?? []).join(' ')))
await loeschen(gf, `/api/payroll/bav?id=${niedrigerZuschuss.body.vertrag?.id}`)

// ── D18.3 Ein Beitrag, der ganz frei ist ───────────────────────────────────
console.log('\n=== D18.3 Ein kleiner Beitrag: alles frei ===')

const klein = await sende(gf, '/api/payroll/bav', 'POST', {
  employeeId: personId, weg: 'direktversicherung',
  anbieter: `Allianz ${MARKE}`, vertragsnummer: 'DV-4711',
  monatsbetrag: 200, beginn: '2024-03-01',
})
const vertragId = klein.body.vertrag?.id
check('Der Vertrag wird angelegt', !!vertragId, klein.body.error)

await monatFreigeben(leitung, personId, JAHR, MONAT, `D18 bAV ${MARKE}`)
const lauf1 = await sende(gf, '/api/payroll/vorbereiten', 'POST',
  { year: JAHR, month: MONAT })
check('Der Lohnlauf geht durch', lauf1.status === 200, lauf1.body.error)

const holeAbrechnung = async () => {
  const alle = (await hole(gf, `/api/payroll?year=${JAHR}&month=${MONAT}`))
    .body.entries ?? []
  return alle.find(a => a.employeeId === personId)
}

let a = await holeAbrechnung()
check('Die Umwandlung steht in der Abrechnung', a?.bavUmwandlung === 200,
  `${a?.bavUmwandlung} €`)
check('Steuer- und Beitragsbemessung sinken hier gleich stark',
  a?.bavMinderungSteuer === 200 && a?.bavMinderungSv === 200,
  `Steuer ${a?.bavMinderungSteuer} / SV ${a?.bavMinderungSv}`)
check('Der Zuschuss beträgt 15 % davon', Math.abs((a?.bavZuschussAG ?? 0) - 30) < 0.01,
  `${a?.bavZuschussAG} €`)
check('Das Steuerbrutto liegt unter dem Gesamtbrutto',
  (a?.steuerBrutto ?? 0) < (a?.brutto ?? 0),
  `${a?.steuerBrutto} < ${a?.brutto}`)
check('Das umgewandelte Geld steht nicht mehr zur Auszahlung',
  (a?.netto ?? 0) < (a?.brutto ?? 0) - 200)

// ── D18.4 Der Bereich zwischen 4 % und 8 % ─────────────────────────────────
console.log('\n=== D18.4 Der Bereich, in dem die Grenzen auseinanderlaufen ===')

// Ein Betrag oberhalb der monatlichen Beitragsgrenze, aber unter der
// Steuergrenze. Genau hier rechnen die meisten falsch.
const zwischen = Math.round((g.svfreiMonat + g.steuerfreiMonat) / 2)
await sende(gf, '/api/payroll/bav', 'PATCH', {
  id: vertragId, monatsbetrag: zwischen,
})
await sende(gf, '/api/payroll/vorbereiten', 'POST', { year: JAHR, month: MONAT })
a = await holeAbrechnung()

check(`Bei ${zwischen} € im Monat sinkt die Steuerbemessung um den vollen Betrag`,
  Math.abs((a?.bavMinderungSteuer ?? 0) - zwischen) < 0.02,
  `${a?.bavMinderungSteuer} von ${zwischen}`)
check('Die Beitragsbemessung sinkt aber NUR bis zur 4-%-Grenze',
  (a?.bavMinderungSv ?? 0) < (a?.bavMinderungSteuer ?? 0),
  `SV ${a?.bavMinderungSv} < Steuer ${a?.bavMinderungSteuer}`)
check('Und zwar genau bis zur monatlichen Beitragsgrenze',
  Math.abs((a?.bavMinderungSv ?? 0) - g.svfreiMonat) < 1,
  `${a?.bavMinderungSv} gegen ${g.svfreiMonat}`)
check('Das Beitragsbrutto liegt damit ÜBER dem Steuerbrutto',
  (a?.svBrutto ?? 0) > (a?.steuerBrutto ?? 0),
  `SV ${a?.svBrutto} > Steuer ${a?.steuerBrutto}`)
check('Der Zuschuss geht nur auf den beitragsfreien Teil',
  Math.abs((a?.bavZuschussAG ?? 0) - (a?.bavMinderungSv ?? 0) * 0.15) < 0.02,
  `${a?.bavZuschussAG} auf ${a?.bavMinderungSv}`)

// ── D18.5 Oberhalb der Steuergrenze ────────────────────────────────────────
console.log('\n=== D18.5 Oberhalb der Steuergrenze ===')

// Die Steuergrenze ist eine JAHRESgrenze. Um sie in einem Monat zu reissen,
// braucht es jemanden, der mehr verdient, als sie hoch ist — deshalb eine
// eigene Person mit eigenem Gehalt statt eines gedrehten Rechenbeispiels.
const reichId = await lohnPerson(gf, locationId, `D18 hoch ${MARKE}`)
await sende(gf, `/api/employees/${reichId}/payroll-profile`, 'PUT', {
  personalnummer: `D18H-${MARKE}`.slice(0, 12), steuerId: '20000000013',
  steuerklasse: 1, kinderfreibetraege: 0, konfession: 'keine',
  bundesland: 'Nordrhein-Westfalen', versicherungsart: 'GKV', zusatzbeitrag: 1.7,
  iban: 'DE02120300000000202051', kontoinhaber: `D18 hoch ${MARKE}`,
  lohnart: 'monat', monatsgehalt: 12000, beschaeftigungsart: 'regulaer',
  eintrittsdatum: '2024-03-01', austrittsdatum: '',
})
await monatFreigeben(leitung, reichId, JAHR, MONAT, `D18 hoch ${MARKE}`)

const gross = await sende(gf, '/api/payroll/bav', 'POST', {
  employeeId: reichId, weg: 'direktversicherung', anbieter: `Hoch ${MARKE}`,
  monatsbetrag: Math.round(g.steuerfreiJahr + 300), beginn: '2024-03-01',
})
const grossId = gross.body.vertrag?.id
check('Der Vertrag über der Jahresgrenze wird angelegt', !!grossId, gross.body.error)

const lauf3 = await sende(gf, '/api/payroll/vorbereiten', 'POST',
  { year: JAHR, month: MONAT })
const hochAbrechnung = ((await hole(gf, `/api/payroll?year=${JAHR}&month=${MONAT}`))
  .body.entries ?? []).find(x => x.employeeId === reichId)

check('Über der Steuergrenze steigt die Steuerminderung nicht weiter',
  Math.abs((hochAbrechnung?.bavMinderungSteuer ?? 0) - g.steuerfreiJahr) < 1,
  `${hochAbrechnung?.bavMinderungSteuer} gegen Jahresgrenze ${g.steuerfreiJahr}`)
check('Der Rest ist voll steuer- und beitragspflichtig',
  Math.abs((hochAbrechnung?.bavUmwandlung ?? 0)
    - (hochAbrechnung?.bavMinderungSteuer ?? 0) - 300) < 1,
  `umgewandelt ${hochAbrechnung?.bavUmwandlung}, `
  + `frei ${hochAbrechnung?.bavMinderungSteuer}`)
check('Beitragsfrei bleibt trotzdem nur der Monatsrahmen',
  Math.abs((hochAbrechnung?.bavMinderungSv ?? 0) - g.svfreiMonat) < 1,
  `${hochAbrechnung?.bavMinderungSv} gegen ${g.svfreiMonat}`)

const meineHinweise = (lauf3.body.hinweise ?? [])
  .filter(h => (h.name ?? '').includes(MARKE))
check('Der Lohnlauf sagt, dass ein Teil über der Grenze liegt',
  /§3 Nr\. 63/.test(JSON.stringify(meineHinweise)),
  JSON.stringify(meineHinweise).slice(0, 400))
check('Und dass ein Teil zwar steuerfrei, aber beitragspflichtig ist',
  /SvEV/.test(JSON.stringify(meineHinweise)),
  JSON.stringify(meineHinweise).slice(0, 400))

// ── D18.6 Altverträge werden nicht geraten ─────────────────────────────────
console.log('\n=== D18.6 Altvertrag nach §40b EStG ===')

await sende(gf, '/api/payroll/bav', 'PATCH', {
  id: vertragId, weg: 'altvertrag_40b', monatsbetrag: 150,
})
const lauf4 = await sende(gf, '/api/payroll/vorbereiten', 'POST',
  { year: JAHR, month: MONAT })
a = await holeAbrechnung()

check('Ein Altvertrag mindert die Steuerbemessung NICHT',
  a?.bavMinderungSteuer === 0, `${a?.bavMinderungSteuer}`)
check('Und auch die Beitragsbemessung nicht', a?.bavMinderungSv === 0)
check('Er steht aber trotzdem als Umwandlung in der Abrechnung',
  a?.bavUmwandlung === 150, `${a?.bavUmwandlung} €`)

const altHinweise = (lauf4.body.hinweise ?? [])
  .filter(h => (h.name ?? '').includes(MARKE))
check('Der Lauf sagt, dass er von Hand zu erfassen ist',
  /§40b/.test(JSON.stringify(altHinweise)),
  JSON.stringify(altHinweise).slice(0, 400))

// ── D18.7 Wer was sieht ────────────────────────────────────────────────────
console.log('\n=== D18.7 Wer den Vertrag sieht ===')

const beiPerson = await hole(anna, '/api/payroll/bav')
check('Ein Mitarbeiter sieht nur seine eigenen Verträge',
  (beiPerson.body.vertraege ?? []).every(v => v.employeeId === undefined
    || v.id !== vertragId))

const beiLeitung = await hole(leitung, '/api/payroll/bav')
check('Die Leitung sieht die ihres Standorts',
  (beiLeitung.body.vertraege ?? []).some(v => v.id === vertragId))

const geloescht = await loeschen(gf, `/api/payroll/bav?id=${vertragId}`)
check('Ein abgerechneter Vertrag lässt sich nicht löschen',
  geloescht.status === 409, geloescht.body.error)
check('Weil sonst ein Beleg auf einen Vertrag zeigt, den es nicht gibt',
  /nicht mehr gibt/.test(geloescht.body.error ?? ''), geloescht.body.error)

// ── Aufräumen ──────────────────────────────────────────────────────────────
console.log('\n=== Aufräumen ===')

const okun = await login('okun@okun.de').catch(() => null)
if (okun) {
  for (const id of [personId, reichId]) {
    await fetch(`${BASIS}/api/employees/${id}`, {
      method: 'DELETE', headers: { cookie: okun },
    })
  }
}
const uebrig = await hole(gf, `/api/payroll/bav?employeeId=${personId}`)
const uebrigHoch = await hole(gf, `/api/payroll/bav?employeeId=${reichId}`)
check('Die Prüfung hinterlässt keinen Vertrag',
  (uebrig.body.vertraege ?? []).length === 0
  && (uebrigHoch.body.vertraege ?? []).length === 0,
  `${(uebrig.body.vertraege ?? []).length + (uebrigHoch.body.vertraege ?? []).length} übrig`)

process.exit(bilanz() ? 1 : 0)
