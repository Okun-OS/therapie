// Nachweis D10: Einmalzahlungen (Weihnachtsgeld, Prämie, Abfindung).
import { BASIS, pruefer, login, hole, sende, zuruecksetzen, pruefMonate } from './helfer.mjs'

const { check, bilanz } = pruefer()

const gf = await login('gf@rheinblick-reha.de')
const kita = await login('leitung@kita-sonnenschein.de')
const anna = await login('anna.fischer@rheinblick-reha.de')
const annaId = (await hole(anna, '/api/auth/me')).body.user.employeeId

const jetzt = new Date()
const jahr = jetzt.getFullYear(), monat = jetzt.getMonth() + 1
console.log(`Abrechnungszeitraum ${String(monat).padStart(2, '0')}.${jahr}\n`)

// §123 Ausgangszustand herstellen — sonst besteht die Prüfung nur einzeln
await zuruecksetzen(gf, pruefMonate(jahr, monat))

// ── Ausgangszustand ────────────────────────────────────────────────────────
console.log('=== Vorbereitung ===')
const stamm = await sende(gf, `/api/employees/${annaId}/payroll-profile`, 'PUT', {
  personalnummer: '1042', steuerId: '12345678901', eintrittsdatum: '2024-03-01',
  steuerklasse: 1, kinderfreibetraege: 0, konfession: 'keine',
  bundesland: 'Nordrhein-Westfalen', versicherungsart: 'GKV', zusatzbeitrag: 1.7,
  lohnart: 'monat', monatsgehalt: 3400,
  iban: 'DE02120300000000202051', kontoinhaber: 'Anna Fischer',
  elstamStand: `${jahr}-${String(monat).padStart(2, '0')}-01`,
})
check('Stammdaten gesetzt', stamm.status === 200, stamm.body.error ?? 'ok')

// Monat muss Entwurf sein, alte Zahlungen weg
await sende(gf, '/api/payroll/vorbereiten', 'POST', { year: jahr, month: monat })
const eintrag = (await hole(gf, `/api/payroll?year=${jahr}&month=${monat}`))
  .body.entries?.find(e => e.employeeId === annaId)
if (eintrag && eintrag.status !== 'draft') {
  await sende(gf, '/api/payroll', 'PATCH', { id: eintrag.id, status: 'draft' })
}
for (const z of (await hole(gf, `/api/payroll/einmalzahlung?jahr=${jahr}&monat=${monat}`)).body.zahlungen ?? []) {
  await fetch(`${BASIS}/api/payroll/einmalzahlung?id=${z.id}`, { method: 'DELETE', headers: { cookie: gf } })
}
await sende(gf, '/api/payroll/vorbereiten', 'POST', { year: jahr, month: monat })
const ohne = (await hole(gf, `/api/payroll?year=${jahr}&month=${monat}`))
  .body.entries.find(e => e.employeeId === annaId)
check('Ausgangslage ohne Einmalzahlung', ohne.sonstigeBezuege === 0,
  `${ohne.brutto} EUR brutto, ${ohne.netto} EUR netto`)

// ── Erfassen ───────────────────────────────────────────────────────────────
console.log('\n=== Weihnachtsgeld erfassen ===')
const ohneBetrag = await sende(gf, '/api/payroll/einmalzahlung', 'POST',
  { employeeId: annaId, jahr, monat, art: 'weihnachtsgeld', betrag: 0 })
check('Ein Betrag von null wird abgelehnt', ohneBetrag.status === 400, ohneBetrag.body.error)

const erfasst = await sende(gf, '/api/payroll/einmalzahlung', 'POST',
  { employeeId: annaId, jahr, monat, art: 'weihnachtsgeld', betrag: 3400 })
check('Das Weihnachtsgeld wird erfasst', erfasst.status === 200, erfasst.body.hinweis ?? erfasst.body.error)
check('Es heißt automatisch richtig', erfasst.body.zahlung?.bezeichnung === 'Weihnachtsgeld')
check('Es ist beitragspflichtig', erfasst.body.zahlung?.beitragsfrei === false)

const nochNicht = (await hole(gf, `/api/payroll?year=${jahr}&month=${monat}`))
  .body.entries.find(e => e.employeeId === annaId)
check('Erfassen allein ändert die Abrechnung noch nicht', nochNicht.sonstigeBezuege === 0)

// ── Rechnen ────────────────────────────────────────────────────────────────
console.log('\n=== Abrechnungslauf ===')
await sende(gf, '/api/payroll/vorbereiten', 'POST', { year: jahr, month: monat })
const mit = (await hole(gf, `/api/payroll?year=${jahr}&month=${monat}`))
  .body.entries.find(e => e.employeeId === annaId)

check('Die Einmalzahlung steht in der Abrechnung', mit.sonstigeBezuege === 3400)
check('Das Gesamtbrutto enthält sie',
  Math.abs(mit.brutto - (ohne.brutto + 3400)) < 0.02,
  `${ohne.brutto} + 3400 = ${mit.brutto}`)
check('Das Steuerbrutto des laufenden Lohns bleibt unberührt',
  Math.abs(mit.steuerBrutto - ohne.steuerBrutto) < 0.02,
  `${mit.steuerBrutto} EUR`)
check('Die Steuer darauf wird getrennt ausgewiesen', mit.lohnsteuerSonstige > 0,
  `${mit.lohnsteuerSonstige} EUR`)
check('Die Gesamtsteuer ist die Summe aus beidem',
  Math.abs(mit.lohnsteuer - (ohne.lohnsteuer + mit.lohnsteuerSonstige)) < 0.02,
  `${ohne.lohnsteuer} + ${mit.lohnsteuerSonstige} = ${mit.lohnsteuer}`)
check('Beiträge werden getrennt ausgewiesen', mit.svANSonstige > 0 && mit.svAGSonstige > 0,
  `AN ${mit.svANSonstige}, AG ${mit.svAGSonstige}`)
check('Vom Weihnachtsgeld bleibt etwas übrig, aber nicht alles',
  mit.netto > ohne.netto && (mit.netto - ohne.netto) < 3400,
  `${(mit.netto - ohne.netto).toFixed(2)} EUR mehr netto von 3400 EUR brutto`)
check('Die Arbeitgeberkosten steigen mit',
  mit.totalAgCost > ohne.totalAgCost + 3400)

// ── Wirkung auf Beleg und DATEV ────────────────────────────────────────────
console.log('\n=== Beleg und DATEV ===')
const datevR = await fetch(`${BASIS}/api/payroll/export?art=datev&year=${jahr}&month=${monat}`,
  { headers: { cookie: gf } })
const datev = await datevR.text()
check('DATEV führt die sonstigen Bezüge als eigene Lohnart', datev.includes('Sonstige Bezüge'))
check('Und die Steuer darauf getrennt', datev.includes('Lohnsteuer auf sonstige Bezüge'))
check('Das Grundentgelt enthält sie NICHT',
  datev.includes(`"${(ohne.brutto).toFixed(2).replace('.', ',')}"`),
  `Grundentgelt sollte ${ohne.brutto} sein`)

const beleg = await sende(gf, '/api/payroll/beleg', 'POST',
  { year: jahr, month: monat, employeeId: annaId })
check('Der Beleg wird erzeugt', beleg.status === 200 && beleg.body.erzeugt > 0,
  beleg.body.hinweis ?? beleg.body.error)

// ── Abfindung ──────────────────────────────────────────────────────────────
console.log('\n=== Abfindung ist beitragsfrei ===')
const abfindung = await sende(gf, '/api/payroll/einmalzahlung', 'POST',
  { employeeId: annaId, jahr, monat, art: 'abfindung', betrag: 5000 })
check('Eine Abfindung wird als beitragsfrei erkannt',
  abfindung.body.zahlung?.beitragsfrei === true)

await sende(gf, '/api/payroll/vorbereiten', 'POST', { year: jahr, month: monat })
const mitAbfindung = (await hole(gf, `/api/payroll?year=${jahr}&month=${monat}`))
  .body.entries.find(e => e.employeeId === annaId)
check('Sie erhöht das Brutto', mitAbfindung.sonstigeBezuege === 8400)
check('Aber NICHT die Beiträge',
  Math.abs(mitAbfindung.svANSonstige - mit.svANSonstige) < 0.02,
  `${mit.svANSonstige} → ${mitAbfindung.svANSonstige}`)
check('Versteuert wird sie trotzdem', mitAbfindung.lohnsteuerSonstige > mit.lohnsteuerSonstige,
  `${mit.lohnsteuerSonstige} → ${mitAbfindung.lohnsteuerSonstige}`)

// ── Freigegebener Monat ────────────────────────────────────────────────────
console.log('\n=== Ein freigegebener Monat ist gesperrt ===')
await sende(gf, '/api/payroll', 'PATCH', { id: mitAbfindung.id, status: 'approved' })
const nachFreigabe = await sende(gf, '/api/payroll/einmalzahlung', 'POST',
  { employeeId: annaId, jahr, monat, art: 'praemie', betrag: 500 })
check('Danach lässt sich nichts mehr nachtragen', nachFreigabe.status === 409,
  nachFreigabe.body.error)

const alle = (await hole(gf, `/api/payroll/einmalzahlung?jahr=${jahr}&monat=${monat}`)).body.zahlungen ?? []
if (alle.length > 0) {
  const loeschen = await fetch(`${BASIS}/api/payroll/einmalzahlung?id=${alle[0].id}`,
    { method: 'DELETE', headers: { cookie: gf } })
  check('Und nichts mehr löschen', loeschen.status === 409, `HTTP ${loeschen.status}`)
} else {
  check('Und nichts mehr löschen', false, 'keine Zahlung zum Löschen vorhanden')
}
await sende(gf, '/api/payroll', 'PATCH', { id: mitAbfindung.id, status: 'draft' })

// ── Abschottung ────────────────────────────────────────────────────────────
console.log('\n=== Abschottung ===')
const fremdErfasst = await sende(kita, '/api/payroll/einmalzahlung', 'POST',
  { employeeId: annaId, jahr, monat, art: 'praemie', betrag: 9999 })
check('Eine fremde Leitung kann keine Zahlung für fremde Mitarbeiter erfassen',
  fremdErfasst.status === 403, `HTTP ${fremdErfasst.status}`)

const fremdSieht = await hole(kita, `/api/payroll/einmalzahlung?jahr=${jahr}&monat=${monat}`)
check('Und sieht die fremden Zahlungen nicht',
  !(fremdSieht.body.zahlungen ?? []).some(z => z.employeeId === annaId))

const fremdLoescht = await fetch(`${BASIS}/api/payroll/einmalzahlung?id=${alle[0]?.id ?? 'x'}`,
  { method: 'DELETE', headers: { cookie: kita } })
check('Und kann sie nicht löschen', fremdLoescht.status === 404, `HTTP ${fremdLoescht.status}`)

const mitarbeiterSieht = await hole(anna, `/api/payroll/einmalzahlung?jahr=${jahr}&monat=${monat}`)
check('Ein Mitarbeiter kommt gar nicht heran', mitarbeiterSieht.status === 403,
  `HTTP ${mitarbeiterSieht.status}`)

// Aufräumen
for (const z of alle) {
  await fetch(`${BASIS}/api/payroll/einmalzahlung?id=${z.id}`, { method: 'DELETE', headers: { cookie: gf } })
}
await sende(gf, '/api/payroll/vorbereiten', 'POST', { year: jahr, month: monat })

process.exit(bilanz() ? 1 : 0)
