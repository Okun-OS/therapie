// Nachweis D22: Bescheinigungen (§312 SGB III, §23c SGB IV, §20 MuSchG).
//
// Eine Bescheinigung ist keine Gefälligkeit. Wer sie falsch ausstellt, kostet
// einen Menschen Geld: ein zu niedriges Regelentgelt heißt ein zu niedriges
// Krankengeld für bis zu 78 Wochen, ein falscher Beendigungsgrund eine
// Sperrzeit von bis zu zwölf Wochen.
//
// Geprüft wird deshalb dreierlei:
//   dass die Zahlen aus den abgerechneten Monaten stammen und stimmen,
//   dass das, was niemand aus Daten ableiten kann, offen bleibt statt geraten
//   zu werden,
//   und dass nur die sie sehen, die sie ausstellen — und der Mensch selbst.
//
// Die Rechenwege sind in src/lib/__tests__/bescheinigungen.test.ts
// nachgerechnet.

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
const GEHALT = 3000

const personId = await lohnPerson(gf, locationId, `D22 Bescheinigung ${MARKE}`)
await sende(gf, `/api/employees/${personId}/payroll-profile`, 'PUT', {
  personalnummer: `D22-${MARKE}`.slice(0, 12), steuerId: '20000000013',
  steuerklasse: 1, kinderfreibetraege: 0, konfession: 'keine',
  bundesland: 'Nordrhein-Westfalen', versicherungsart: 'GKV', zusatzbeitrag: 1.7,
  krankenkasse: 'AOK Rheinland', sozialversicherungsnummer: '65170839J003',
  iban: 'DE02120300000000202051', kontoinhaber: `D22 ${MARKE}`,
  lohnart: 'monat', monatsgehalt: GEHALT, beschaeftigungsart: 'regulaer',
  eintrittsdatum: '2024-03-01', austrittsdatum: '',
})
await monatFreigeben(leitung, personId, JAHR, MONAT, `D22 Bescheinigung ${MARKE}`)
await sende(gf, '/api/payroll/vorbereiten', 'POST', { year: JAHR, month: MONAT })

// ── D22.1 Wer eine Bescheinigung anfordern darf ────────────────────────────
console.log('=== D22.1 Wer sie sehen darf ===')

const ohneAnmeldung = await fetch(`${BASIS}/api/payroll/bescheinigung?art=arbeit`)
check('Ohne Anmeldung gar nichts', ohneAnmeldung.status === 401,
  `HTTP ${ohneAnmeldung.status}`)

const ohneArt = await hole(gf, `/api/payroll/bescheinigung?employeeId=${personId}`)
check('Ohne Angabe der Art wird abgelehnt', ohneArt.status === 400,
  ohneArt.body.error)
check('Und es wird gesagt, welche es gibt',
  /arbeit.*krankengeld.*mutterschaft/.test(ohneArt.body.error ?? ''),
  ohneArt.body.error)

const fremd = await hole(anna,
  `/api/payroll/bescheinigung?art=arbeit&employeeId=${personId}`)
check('Ein Mitarbeiter bekommt keine Bescheinigung über jemand anderen',
  fremd.status === 200
    ? (fremd.body.person?.id !== personId)
    : fremd.status === 403,
  `HTTP ${fremd.status}, Person ${fremd.body.person?.id}`)

const durchLeitung = await hole(leitung,
  `/api/payroll/bescheinigung?art=arbeit&employeeId=${personId}`)
check('Die Standortleitung bekommt sie für ihre Leute',
  durchLeitung.status === 200, `HTTP ${durchLeitung.status}`)

// ── D22.2 Die Arbeitsbescheinigung ─────────────────────────────────────────
console.log('\n=== D22.2 Arbeitsbescheinigung (§312 SGB III) ===')

const arbeit = await hole(gf,
  `/api/payroll/bescheinigung?art=arbeit&employeeId=${personId}`)
const ab = arbeit.body.arbeitsbescheinigung ?? {}

check('Sie enthält den abgerechneten Monat',
  (ab.monate ?? []).some(m => m.jahr === JAHR && m.monat === MONAT),
  `${(ab.monate ?? []).length} Monate`)
check('Das Entgelt stammt aus der Abrechnung',
  Math.abs((ab.entgeltGesamt ?? 0) - GEHALT) < 0.02, `${ab.entgeltGesamt} €`)
check('Das Bemessungsentgelt wird je Kalendertag ausgewiesen',
  Math.abs((ab.bemessungsentgeltJeTag ?? 0) - GEHALT / 30) < 0.02,
  `${ab.bemessungsentgeltJeTag} €`)
check('Die Sozialversicherungsnummer steht im Kopf',
  arbeit.body.sozialversicherungsnummer === '65170839J003',
  arbeit.body.sozialversicherungsnummer)

check('Der Beendigungsgrund bleibt ausdrücklich offen',
  /Grund der Beendigung/.test(JSON.stringify(ab.offeneAngaben ?? [])),
  JSON.stringify(ab.offeneAngaben ?? []).slice(0, 200))
check('Mit dem Grund, warum das zählt — der Sperrzeit',
  /§159 SGB III/.test(JSON.stringify(ab.offeneAngaben ?? [])))
check('Die Kündigungsfrist wird ebenfalls erfragt',
  /§158 SGB III/.test(JSON.stringify(ab.offeneAngaben ?? [])))
check('Es wird gesagt, dass die Übermittlung über BEA läuft',
  /BEA/.test(arbeit.body.uebermittlung ?? ''), arbeit.body.uebermittlung)
check('Und dass sie über den Steuerberater geht, nicht hier',
  /Steuerberater/.test(arbeit.body.uebermittlung ?? ''))

// ── D22.3 Krankengeld ──────────────────────────────────────────────────────
console.log('\n=== D22.3 Entgeltbescheinigung Krankengeld (§47 SGB V) ===')

const krank = await hole(gf,
  `/api/payroll/bescheinigung?art=krankengeld&employeeId=${personId}`)
const kg = krank.body.krankengeld ?? {}

check('Das Regelentgelt ist das Monatsentgelt durch dreißig',
  Math.abs((kg.regelentgeltJeTag ?? 0) - GEHALT / 30) < 0.02,
  `${kg.regelentgeltJeTag} €`)
check('Das Krankengeld ist höchstens 70 % des Regelentgelts',
  (kg.krankengeldJeTag ?? 0) <= (kg.siebzigProzent ?? 0) + 0.01,
  `${kg.krankengeldJeTag} gegen ${kg.siebzigProzent}`)
check('Und höchstens 90 % des Nettoentgelts',
  (kg.krankengeldJeTag ?? 0) <= (kg.neunzigProzent ?? 0) + 0.01,
  `${kg.krankengeldJeTag} gegen ${kg.neunzigProzent}`)
check('Es wird gesagt, dass die Kasse rechnet und das hier eine Vorschau ist',
  /Vorschau/.test(JSON.stringify(kg.hinweise ?? [])),
  JSON.stringify(kg.hinweise ?? []).slice(0, 250))
check('Die Übermittlung läuft über EEL',
  /EEL/.test(krank.body.uebermittlung ?? ''), krank.body.uebermittlung)

// Ein Weihnachtsgeld muss das Regelentgelt erhöhen — der häufigste Fehler.
await sende(gf, '/api/payroll/einmalzahlung', 'POST', {
  employeeId: personId, jahr: JAHR, monat: MONAT,
  art: 'weihnachtsgeld', bezeichnung: `Weihnachtsgeld ${MARKE}`, betrag: 3600,
})
await sende(gf, '/api/payroll/vorbereiten', 'POST', { year: JAHR, month: MONAT })
const krank2 = await hole(gf,
  `/api/payroll/bescheinigung?art=krankengeld&employeeId=${personId}`)
const kg2 = krank2.body.krankengeld ?? {}

check('Eine Einmalzahlung erhöht das Regelentgelt',
  (kg2.regelentgeltJeTag ?? 0) > (kg.regelentgeltJeTag ?? 0),
  `${kg2.regelentgeltJeTag} gegen ${kg.regelentgeltJeTag}`)
check('Und zwar um ein Dreihundertsechzigstel je Jahr',
  Math.abs((kg2.einmalJeTag ?? 0) - 10) < 0.02, `${kg2.einmalJeTag} €`)
check('Mit Verweis auf §47 Abs. 2 Satz 6 SGB V',
  /§47 Abs\. 2 Satz 6 SGB V/.test(JSON.stringify(kg2.hinweise ?? [])),
  JSON.stringify(kg2.hinweise ?? []).slice(0, 250))

// ── D22.4 Mutterschaft ─────────────────────────────────────────────────────
console.log('\n=== D22.4 Zuschuss zum Mutterschaftsgeld (§20 MuSchG) ===')

const mutter = await hole(gf,
  `/api/payroll/bescheinigung?art=mutterschaft&employeeId=${personId}&tage=98`)
const mu = mutter.body.mutterschaft ?? {}

check('Das Mutterschaftsgeld der Kasse ist gedeckelt',
  mutter.body.kasseHoechstbetrag === 13, `${mutter.body.kasseHoechstbetrag} €`)
check('Der Zuschuss ist die Differenz zum Nettoentgelt',
  Math.abs((mu.zuschussJeTag ?? 0)
    - Math.max(0, (mu.nettoJeTag ?? 0) - 13)) < 0.02,
  `${mu.zuschussJeTag} bei Netto ${mu.nettoJeTag}`)
check('Für den ganzen Zeitraum gerechnet',
  Math.abs((mu.zuschussGesamt ?? 0) - (mu.zuschussJeTag ?? 0) * 98) < 0.02,
  `${mu.zuschussGesamt} €`)
check('Es wird auf die Erstattung über U2 hingewiesen',
  /U2 zu 100 %/.test(JSON.stringify(mu.hinweise ?? [])),
  JSON.stringify(mu.hinweise ?? []).slice(0, 250))
check('Und darauf, dass er dem Progressionsvorbehalt unterliegt',
  /Progressionsvorbehalt/.test(JSON.stringify(mu.hinweise ?? [])))

// ── D22.5 Der Mensch sieht seine eigene ────────────────────────────────────
console.log('\n=== D22.5 Die eigene Bescheinigung ===')

const eigene = await hole(anna, '/api/payroll/bescheinigung?art=krankengeld')
check('Ein Mitarbeiter bekommt seine eigenen Zahlen',
  eigene.status === 200, `HTTP ${eigene.status}`)
check('Und zwar die zu seiner Person',
  eigene.body.person?.id !== personId,
  `${eigene.body.person?.name}`)

// ── Aufräumen ──────────────────────────────────────────────────────────────
console.log('\n=== Aufräumen ===')

const okun = await login('okun@okun.de').catch(() => null)
if (okun) {
  await fetch(`${BASIS}/api/employees/${personId}`, {
    method: 'DELETE', headers: { cookie: okun },
  })
}
const nachher = await hole(gf,
  `/api/payroll/bescheinigung?art=arbeit&employeeId=${personId}`)
check('Nach dem Löschen gibt es keine Bescheinigung mehr',
  nachher.status === 404, `HTTP ${nachher.status}`)

process.exit(bilanz() ? 1 : 0)
