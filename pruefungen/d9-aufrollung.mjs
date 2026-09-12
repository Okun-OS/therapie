// Nachweis D9: rückwirkende Aufrollung — und die Abschottung von /api/payroll.
import { BASIS, pruefer, login, hole, sende, zuruecksetzen, pruefMonate, monatFreigeben } from './helfer.mjs'

const { check, bilanz } = pruefer()

const gf = await login('gf@rheinblick-reha.de')
const kita = await login('leitung@kita-sonnenschein.de')
const anna = await login('anna.fischer@rheinblick-reha.de')
const annaId = (await hole(anna, '/api/auth/me')).body.user.employeeId

const jetzt = new Date()
const jahr = jetzt.getFullYear()
const monat = jetzt.getMonth() + 1
// Der Vormonat wird freigegeben und danach rückwirkend geändert
const vorMonat = monat === 1 ? 12 : monat - 1
const vorJahr = monat === 1 ? jahr - 1 : jahr
console.log(`Aufzurollen: ${String(vorMonat).padStart(2, '0')}.${vorJahr} · Ausgleich in ${String(monat).padStart(2, '0')}.${jahr}\n`)

// §123 Ausgangszustand herstellen — sonst besteht die Prüfung nur einzeln
await zuruecksetzen(gf, pruefMonate(jahr, monat))

// ── Abschottung von /api/payroll ───────────────────────────────────────────
console.log('=== Abschottung der Lohn-Schnittstelle ===')
const stamm = await sende(gf, `/api/employees/${annaId}/payroll-profile`, 'PUT', {
  personalnummer: '1042', steuerId: '12345678901',
  steuerklasse: 1, kinderfreibetraege: 0, konfession: 'keine',
  bundesland: 'Nordrhein-Westfalen', versicherungsart: 'GKV', zusatzbeitrag: 1.7,
  lohnart: 'monat', monatsgehalt: 3400,
  iban: 'DE02120300000000202051', kontoinhaber: 'Anna Fischer',
  elstamStand: `${vorJahr}-${String(vorMonat).padStart(2, '0')}-01`,
})
check('Stammdaten gesetzt (Steuerklasse 1)', stamm.status === 200, stamm.body.error ?? 'ok')

// Ausgangszustand herstellen: offene Korrekturen aus früheren Läufen verwerfen,
// sonst blockieren sie den Nachweis.
for (const m of [monat, monat === 12 ? 1 : monat + 1]) {
  const j = m === 1 && monat === 12 ? jahr + 1 : jahr
  const alte = (await hole(gf, `/api/payroll/aufrollen?jahr=${j}&monat=${m}`)).body.korrekturen ?? []
  for (const k of alte.filter(x => x.status === 'offen')) {
    await sende(gf, '/api/payroll/aufrollen', 'PATCH', { id: k.id, status: 'verworfen' })
  }
}

// Beide Monate müssen als Entwurf starten — der Vormonat wird hier erst
// freigegeben, der laufende muss offen sein, damit ausgeglichen werden kann.
for (const [j, m] of [[vorJahr, vorMonat], [jahr, monat]]) {
  await sende(gf, '/api/payroll/vorbereiten', 'POST', { year: j, month: m })
  const e = (await hole(gf, `/api/payroll?year=${j}&month=${m}`))
    .body.entries?.find(x => x.employeeId === annaId)
  if (e && e.status !== 'draft') {
    await sende(gf, '/api/payroll', 'PATCH', { id: e.id, status: 'draft', notes: '' })
  }
}

await sende(gf, '/api/payroll/vorbereiten', 'POST', { year: vorJahr, month: vorMonat })
const vorher = (await hole(gf, `/api/payroll?year=${vorJahr}&month=${vorMonat}`))
  .body.entries?.find(e => e.employeeId === annaId)
check('Vormonat ist gerechnet', vorher?.netto > 0, `${vorher?.netto} EUR netto`)

const fremdPatch = await sende(kita, '/api/payroll', 'PATCH',
  { id: vorher.id, status: 'approved', notes: 'FREMDZUGRIFF' })
check('Fremde Leitung kann eine fremde Abrechnung NICHT freigeben',
  fremdPatch.status === 404, `HTTP ${fremdPatch.status}`)

const nachFremd = (await hole(gf, `/api/payroll?year=${vorJahr}&month=${vorMonat}`))
  .body.entries.find(e => e.id === vorher.id)
check('Und hat auch nichts verändert',
  nachFremd.status === 'draft' && !nachFremd.notes,
  `Status ${nachFremd.status}, Notiz ${JSON.stringify(nachFremd.notes)}`)

const erfunden = await sende(gf, '/api/payroll', 'POST', {
  employeeId: annaId, year: vorJahr, month: vorMonat,
  monthlyWage: 3400, regularHours: 160, taxClass: 1,
  brutto: 999999, netto: 999999, lohnsteuer: 0,
})
check('Der Browser kann Brutto und Netto NICHT selbst bestimmen',
  erfunden.status === 200 && erfunden.body.entry.netto !== 999999,
  `netto ${erfunden.body.entry?.netto} statt 999999`)

const mitarbeiterLiest = await hole(anna, `/api/payroll?year=${vorJahr}&month=${vorMonat}`)
check('Ein Mitarbeiter kommt an die Lohnliste nicht heran',
  mitarbeiterLiest.status === 403, `HTTP ${mitarbeiterLiest.status}`)

// ── Freigeben ──────────────────────────────────────────────────────────────
console.log('\n=== Vormonat freigeben ===')
const freigabe = await sende(gf, '/api/payroll', 'PATCH', { id: vorher.id, status: 'approved' })
check('Der Vormonat wird freigegeben', freigabe.status === 200 && freigabe.body.entry.status === 'approved')
check('Wer freigegeben hat, steht fest', !!freigabe.body.entry.approvedBy,
  freigabe.body.entry.approvedBy)

const freigegebenNetto = freigabe.body.entry.netto
const ueberschreiben = await sende(gf, '/api/payroll', 'POST', {
  employeeId: annaId, year: vorJahr, month: vorMonat,
  monthlyWage: 5000, regularHours: 160, taxClass: 1,
})
check('Ein freigegebener Monat lässt sich nicht mehr überschreiben',
  ueberschreiben.status === 409, `HTTP ${ueberschreiben.status}`)

// ── Rückwirkende Änderung ──────────────────────────────────────────────────
console.log('\n=== Rückwirkende Änderung: Steuerklasse III ===')
const geaendert = await sende(gf, `/api/employees/${annaId}/payroll-profile`, 'PUT', {
  personalnummer: '1042', steuerId: '12345678901',
  steuerklasse: 3, kinderfreibetraege: 1, konfession: 'keine',
  bundesland: 'Nordrhein-Westfalen', versicherungsart: 'GKV', zusatzbeitrag: 1.7,
  lohnart: 'monat', monatsgehalt: 3400,
  iban: 'DE02120300000000202051', kontoinhaber: 'Anna Fischer',
  hatKinder: true, kinderUnter25: 1,
  elstamStand: `${jahr}-${String(monat).padStart(2, '0')}-01`,
})
check('Die Steuerklasse wird rückwirkend geändert', geaendert.status === 200)

const unveraendert = (await hole(gf, `/api/payroll?year=${vorJahr}&month=${vorMonat}`))
  .body.entries.find(e => e.id === vorher.id)
check('Die freigegebene Abrechnung bleibt dabei unverändert',
  unveraendert.netto === freigegebenNetto && unveraendert.taxClass === 1,
  `netto ${unveraendert.netto}, Steuerklasse ${unveraendert.taxClass}`)

// ── Aufrollen: Vorschau ────────────────────────────────────────────────────
console.log('\n=== Aufrollen (Vorschau) ===')
const vorschau = await sende(gf, '/api/payroll/aufrollen', 'POST', { jahr: vorJahr })
check('Die Prüfung läuft', vorschau.status === 200, vorschau.body.hinweis ?? vorschau.body.error)
const abw = (vorschau.body.abweichungen ?? []).find(a => a.employeeId === annaId && a.monat === vorMonat)
check('Die Abweichung wird gefunden', !!abw,
  abw ? `${abw.differenz.netto} EUR netto` : 'keine gefunden')
check('Weniger Lohnsteuer in Klasse III → Nachzahlung',
  abw?.differenz.lohnsteuer < 0 && abw?.differenz.netto > 0,
  `Lohnsteuer ${abw?.differenz.lohnsteuer}, Netto ${abw?.differenz.netto}`)
check('Das Brutto ändert sich nicht', abw?.differenz.brutto === 0)
check('Die einzelnen Posten werden benannt',
  abw?.differenz.posten?.some(p => p.feld === 'lohnsteuer' && p.alt !== p.neu),
  abw?.differenz.posten?.map(p => p.bezeichnung).join(', '))
check('Der Ausgleichsmonat ist genannt',
  abw?.ausgleichJahr === jahr && abw?.ausgleichMonat === monat,
  `${abw?.ausgleichMonat}.${abw?.ausgleichJahr}`)

const nochUnveraendert = (await hole(gf, `/api/payroll?year=${vorJahr}&month=${vorMonat}`))
  .body.entries.find(e => e.id === vorher.id)
check('Die Vorschau ändert nichts', nochUnveraendert.netto === freigegebenNetto)

// ── Aufrollen: Übernahme ───────────────────────────────────────────────────
console.log('\n=== Korrektur anlegen ===')
const ohneAuswahl = await sende(gf, '/api/payroll/aufrollen?uebernehmen=1', 'POST',
  { jahr: vorJahr, fuer: [] })
check('Ohne Auswahl wird nichts angelegt', ohneAuswahl.status === 400, ohneAuswahl.body.error)

const uebernahme = await sende(gf, '/api/payroll/aufrollen?uebernehmen=1', 'POST', {
  jahr: vorJahr, grund: 'Heirat rückwirkend gemeldet',
  fuer: [`${annaId}|${vorMonat}`],
})
check('Die Korrektur wird angelegt', uebernahme.status === 200 && uebernahme.body.angelegt?.length === 1,
  uebernahme.body.hinweis ?? uebernahme.body.error)

const nochmal = await sende(gf, '/api/payroll/aufrollen', 'POST', { jahr: vorJahr })
const wieder = (nochmal.body.abweichungen ?? []).find(a => a.employeeId === annaId && a.monat === vorMonat)
check('Ein zweiter Lauf legt sie NICHT doppelt an', wieder?.bereitsOffen === true)

const offene = await hole(gf, `/api/payroll/aufrollen?jahr=${jahr}&monat=${monat}`)
const k = (offene.body.korrekturen ?? []).find(x => x.employeeId === annaId)
check('Die Korrektur steht im Ausgleichsmonat bereit', !!k, k?.text)
check('Der Ursprungsmonat bleibt festgehalten — die Beiträge gehören dorthin',
  k?.jahr === vorJahr && k?.monat === vorMonat,
  `Ursprung ${k?.monat}.${k?.jahr}, Ausgleich ${k?.ausgleichMonat}.${k?.ausgleichJahr}`)
check('Der Grund ist festgehalten', k?.grund === 'Heirat rückwirkend gemeldet')
check('Es steht fest, wer sie angelegt hat', !!k?.erstelltVon, k?.erstelltVon)

// ── Auszahlung im Folgemonat ───────────────────────────────────────────────
console.log('\n=== Ausgleich im laufenden Monat ===')

// §136 Anna hat erfasste Zeiten — ohne freigegebenen Monatsabschluss wird sie
// zu Recht nicht abgerechnet. Im Betrieb macht das die Standortleitung; hier
// gehoert es zur Prueffolge, sonst prueft die Pruefung an der Wirklichkeit
// vorbei.
const monatsfreigabe = await monatFreigeben(gf, annaId, jahr, monat, 'Anna Fischer')
check('Der Monat lässt sich freigeben', monatsfreigabe.ok, `HTTP ${monatsfreigabe.status}`)

const lauf = await sende(gf, '/api/payroll/vorbereiten', 'POST', { year: jahr, month: monat })
check('Nach der Freigabe wird sie abgerechnet',
  !(lauf.body.ohneFreigabe ?? []).some(x => x.name === 'Anna Fischer'),
  (lauf.body.ohneFreigabe ?? []).map(x => x.name).join(', '))
check('Der Abrechnungslauf gleicht die Korrektur aus',
  (lauf.body.ausgeglichen ?? []).some(a => a.name === 'Anna Fischer'),
  lauf.body.hinweis)

const laufend = (await hole(gf, `/api/payroll?year=${jahr}&month=${monat}`))
  .body.entries.find(e => e.employeeId === annaId)
check('Die Korrektur steht an der Abrechnung', laufend?.korrekturNetto > 0,
  `${laufend?.korrekturNetto} EUR`)
check('Der Auszahlungsbetrag ist Netto plus Korrektur',
  Math.abs(laufend.auszahlungsbetrag - (laufend.netto + laufend.korrekturNetto)) < 0.01,
  `${laufend.netto} + ${laufend.korrekturNetto} = ${laufend.auszahlungsbetrag}`)

const nochmalLauf = await sende(gf, '/api/payroll/vorbereiten', 'POST', { year: jahr, month: monat })
const nachZweitem = (await hole(gf, `/api/payroll?year=${jahr}&month=${monat}`))
  .body.entries.find(e => e.employeeId === annaId)
check('Ein zweiter Lauf zahlt sie NICHT ein zweites Mal aus',
  Math.abs(nachZweitem.korrekturNetto - laufend.korrekturNetto) < 0.01,
  `${nachZweitem.korrekturNetto} EUR`)

// ── Wirkung auf SEPA, DATEV und Beleg ──────────────────────────────────────
console.log('\n=== Wirkung auf Datei und Beleg ===')
const sepaR = await fetch(`${BASIS}/api/payroll/export?art=sepa&year=${jahr}&month=${monat}`,
  { headers: { cookie: gf } })
const sepa = await sepaR.text()
const betrag = laufend.auszahlungsbetrag.toFixed(2)
check('Die SEPA-Datei überweist den Auszahlungsbetrag, nicht das Netto',
  sepa.includes(`<InstdAmt Ccy="EUR">${betrag}</InstdAmt>`),
  `erwartet ${betrag}`)

const datevR = await fetch(`${BASIS}/api/payroll/export?art=datev&year=${jahr}&month=${monat}`,
  { headers: { cookie: gf } })
const datev = await datevR.text()
check('DATEV weist die Korrektur als eigene Lohnart aus',
  datev.includes('Nachzahlung aus Aufrollung'))
check('Und den Auszahlungsbetrag statt des Nettos',
  datev.includes(`"${betrag.replace('.', ',')}"`))

const beleg = await sende(gf, '/api/payroll/beleg', 'POST',
  { year: jahr, month: monat, employeeId: annaId })
check('Der Beleg wird erzeugt', beleg.status === 200 && beleg.body.erzeugt > 0,
  beleg.body.hinweis ?? beleg.body.error)

// ── Eine Korrektur zurücknehmen ────────────────────────────────────────────
console.log('\n=== Korrektur verwerfen ===')
const zumVerwerfen = await sende(gf, '/api/payroll/aufrollen?uebernehmen=1', 'POST', {
  jahr: vorJahr, grund: 'Versehentlich angelegt', fuer: [`${annaId}|${vorMonat}`],
})
const offeneJetzt = (await hole(gf, `/api/payroll/aufrollen?jahr=${jahr}&monat=${monat}`))
  .body.korrekturen?.filter(x => x.employeeId === annaId && x.status === 'offen') ?? []
if (offeneJetzt.length > 0) {
  const verwerfen = await sende(gf, '/api/payroll/aufrollen', 'PATCH',
    { id: offeneJetzt[0].id, status: 'verworfen' })
  check('Eine versehentlich angelegte Korrektur lässt sich verwerfen',
    verwerfen.status === 200, verwerfen.body.hinweis ?? verwerfen.body.error)
  const danach = (await hole(gf, `/api/payroll/aufrollen?jahr=${jahr}&monat=${monat}`))
    .body.korrekturen?.filter(x => x.id === offeneJetzt[0].id) ?? []
  check('Danach steht sie nicht mehr zur Auszahlung an', danach.length === 0)
} else {
  check('Eine versehentlich angelegte Korrektur lässt sich verwerfen', false,
    'keine offene Korrektur zum Verwerfen — ' + (zumVerwerfen.body.hinweis ?? ''))
}

const fremdVerwirft = await sende(kita, '/api/payroll/aufrollen', 'PATCH',
  { id: k?.id ?? 'unbekannt', status: 'verworfen' })
check('Eine fremde Leitung kann keine fremde Korrektur verwerfen',
  fremdVerwirft.status === 404, `HTTP ${fremdVerwirft.status}`)

const schonAusgezahlt = await sende(gf, '/api/payroll/aufrollen', 'PATCH',
  { id: k?.id, status: 'verworfen' })
check('Eine bereits ausgezahlte Korrektur lässt sich nicht mehr verwerfen',
  schonAusgezahlt.status === 409, schonAusgezahlt.body.error ?? `HTTP ${schonAusgezahlt.status}`)

// ── Ausgleichsmonat ist bereits freigegeben ────────────────────────────────
console.log('\n=== Ausgleichsmonat ist schon freigegeben ===')
// Zweite rückwirkende Änderung: Gehaltserhöhung, die für den Vormonat gilt.
await sende(gf, `/api/employees/${annaId}/payroll-profile`, 'PUT', {
  personalnummer: '1042', steuerId: '12345678901',
  steuerklasse: 3, kinderfreibetraege: 1, konfession: 'keine',
  bundesland: 'Nordrhein-Westfalen', versicherungsart: 'GKV', zusatzbeitrag: 1.7,
  lohnart: 'monat', monatsgehalt: 3600,
  iban: 'DE02120300000000202051', kontoinhaber: 'Anna Fischer',
  hatKinder: true, kinderUnter25: 1,
  elstamStand: `${jahr}-${String(monat).padStart(2, '0')}-01`,
})
const zweite = await sende(gf, '/api/payroll/aufrollen?uebernehmen=1', 'POST', {
  jahr: vorJahr, grund: 'Gehaltserhöhung rückwirkend',
  fuer: [`${annaId}|${vorMonat}`],
})
check('Eine zweite Korrektur entsteht aus der Gehaltserhöhung',
  zweite.body.angelegt?.length === 1, zweite.body.hinweis ?? zweite.body.error)

// Jetzt den Ausgleichsmonat freigeben, BEVOR sie ausgezahlt wurde
const jetztLaufend = (await hole(gf, `/api/payroll?year=${jahr}&month=${monat}`))
  .body.entries.find(e => e.employeeId === annaId)
await sende(gf, '/api/payroll', 'PATCH', { id: jetztLaufend.id, status: 'approved' })

const gesperrterLauf = await sende(gf, '/api/payroll/vorbereiten', 'POST', { year: jahr, month: monat })
check('Die Korrektur bleibt nicht liegen, sondern wandert weiter',
  (gesperrterLauf.body.verschoben ?? []).some(v => v.name === 'Anna Fischer'),
  gesperrterLauf.body.verschoben?.[0]?.text)

const folgeMonat = monat === 12 ? 1 : monat + 1
const folgeJahr = monat === 12 ? jahr + 1 : jahr
const imFolgemonat = await hole(gf, `/api/payroll/aufrollen?jahr=${folgeJahr}&monat=${folgeMonat}`)
check('Sie steht jetzt im Folgemonat bereit',
  (imFolgemonat.body.korrekturen ?? []).some(x => x.employeeId === annaId),
  `${imFolgemonat.body.korrekturen?.length ?? 0} Korrekturen in ${folgeMonat}.${folgeJahr}`)

// Aufräumen, damit der nächste Lauf wieder sauber startet
await sende(gf, '/api/payroll', 'PATCH', { id: jetztLaufend.id, status: 'draft' })

process.exit(bilanz() ? 1 : 0)
