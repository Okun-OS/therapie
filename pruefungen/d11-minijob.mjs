// Nachweis D11: Minijob, kurzfristige Beschäftigung, Übergangsbereich.
import { BASIS, pruefer, login, hole, sende, zuruecksetzen, pruefMonate, lohnPerson } from './helfer.mjs'

const { check, bilanz } = pruefer()

const gf = await login('gf@rheinblick-reha.de')
const anna = await login('anna.fischer@rheinblick-reha.de')
const locationId = (await hole(anna, '/api/auth/me')).body.user.locationId
// §134 Eine eigene Person ohne Zeiterfassung — sonst rechnen Zuschläge mit,
// die sich mit jedem Tag ändern, und die Prüfung misst den Kalender.
const personId = await lohnPerson(gf, locationId)

const jetzt = new Date()
const jahr = jetzt.getFullYear(), monat = jetzt.getMonth() + 1
const mm = String(monat).padStart(2, '0')
console.log(`Abrechnungszeitraum ${mm}.${jahr}\n`)

// §123 Ausgangszustand herstellen — sonst besteht die Prüfung nur einzeln
await zuruecksetzen(gf, pruefMonate(jahr, monat))

// Geringfügigkeitsgrenze 2026 = Mindestlohn 13,90 × 130 / 3, aufgerundet = 603
const GRENZE = 603

async function stammdaten(zusatz) {
  return sende(gf, `/api/employees/${personId}/payroll-profile`, 'PUT', {
    personalnummer: '9011', steuerId: '20000000011', eintrittsdatum: '2024-03-01',
    steuerklasse: 1, kinderfreibetraege: 0, konfession: 'keine',
    bundesland: 'Nordrhein-Westfalen', versicherungsart: 'GKV', zusatzbeitrag: 1.7,
    iban: 'DE02120300000000202051', kontoinhaber: 'Lohnpruefung Nachweis',
    elstamStand: `${jahr}-${mm}-01`,
    lohnart: 'monat',
    ...zusatz,
  })
}

async function rechnen() {
  const e = (await hole(gf, `/api/payroll?year=${jahr}&month=${monat}`))
    .body.entries?.find(x => x.employeeId === personId)
  if (e && e.status !== 'draft') {
    await sende(gf, '/api/payroll', 'PATCH', { id: e.id, status: 'draft' })
  }
  await sende(gf, '/api/payroll/vorbereiten', 'POST', { year: jahr, month: monat })
  return (await hole(gf, `/api/payroll?year=${jahr}&month=${monat}`))
    .body.entries.find(x => x.employeeId === personId)
}

// Alte Einmalzahlungen weg, damit sie die Beträge nicht verfälschen
for (const z of (await hole(gf, `/api/payroll/einmalzahlung?jahr=${jahr}&monat=${monat}`)).body.zahlungen ?? []) {
  await fetch(`${BASIS}/api/payroll/einmalzahlung?id=${z.id}`, { method: 'DELETE', headers: { cookie: gf } })
}

// ── Minijob ────────────────────────────────────────────────────────────────
console.log('=== Minijob mit Pauschsteuer ===')
const s1 = await stammdaten({ monatsgehalt: 500, beschaeftigungsart: 'minijob', pauschalsteuer: true })
check('Beschäftigungsart lässt sich hinterlegen',
  s1.status === 200 && s1.body.profil?.beschaeftigungsart === 'minijob',
  s1.body.error ?? 'minijob')

const mini = await rechnen()
check('Die Abrechnung erkennt den Minijob', mini.beschaeftigungsart === 'minijob',
  mini.beschaeftigungsart)
check('Der Arbeitnehmer zahlt nur seinen Rentenanteil von 3,6 %',
  Math.abs(mini.rvAN - 18) < 0.02 && mini.kvAN === 0 && mini.pvAN === 0 && mini.avAN === 0,
  `RV ${mini.rvAN}, KV ${mini.kvAN}, PV ${mini.pvAN}, AV ${mini.avAN}`)
check('Der Arbeitgeber trägt die Pauschalen: 15 % Rente, 13 % Kranken',
  Math.abs(mini.rvAG - 75) < 0.02 && Math.abs(mini.kvAG - 65) < 0.02,
  `RV ${mini.rvAG}, KV ${mini.kvAG}`)
check('Bei Pauschsteuer wird keine Lohnsteuer einbehalten',
  mini.lohnsteuer === 0 && mini.soli === 0)
check('Die Pauschsteuer von 2 % trägt der Arbeitgeber',
  Math.abs(mini.pauschsteuerAG - 10) < 0.02, `${mini.pauschsteuerAG} EUR`)
check('Vom Minijob bleiben 482 EUR', Math.abs(mini.netto - 482) < 0.02,
  `${mini.netto} EUR`)
check('Den Arbeitgeber kostet er 650 EUR',
  Math.abs(mini.totalAgCost - 650) < 0.02, `${mini.totalAgCost} EUR`)

console.log('\n=== Minijob mit Befreiung von der Rentenversicherung ===')
await stammdaten({ monatsgehalt: 500, beschaeftigungsart: 'minijob', pauschalsteuer: true, rvBefreiung: true })
const befreit = await rechnen()
check('Dann wird gar nichts abgezogen', befreit.rvAN === 0 && befreit.netto === 500,
  `${befreit.netto} EUR netto`)
check('Der Arbeitgeber zahlt seine Pauschale trotzdem',
  Math.abs(befreit.rvAG - 75) < 0.02, `${befreit.rvAG} EUR`)

// ── Kurzfristige Beschäftigung ─────────────────────────────────────────────
console.log('\n=== Kurzfristige Beschäftigung ===')
await stammdaten({ monatsgehalt: 2000, beschaeftigungsart: 'kurzfristig' })
const kurz = await rechnen()
check('Sie ist beitragsfrei in allen Zweigen',
  kurz.rvAN + kurz.kvAN + kurz.pvAN + kurz.avAN === 0
  && kurz.rvAG + kurz.kvAG + kurz.pvAG + kurz.avAG === 0,
  `AN ${kurz.rvAN + kurz.kvAN + kurz.pvAN + kurz.avAN}, AG ${kurz.rvAG + kurz.kvAG + kurz.pvAG + kurz.avAG}`)
check('Versteuert wird sie trotzdem', kurz.lohnsteuer > 0, `${kurz.lohnsteuer} EUR`)
check('Der Arbeitgeber zahlt nur das Brutto',
  Math.abs(kurz.totalAgCost - 2000) < 0.02, `${kurz.totalAgCost} EUR`)

// ── Übergangsbereich ───────────────────────────────────────────────────────
console.log('\n=== Übergangsbereich (Gesetz, keine Wahl) ===')
await stammdaten({ monatsgehalt: 1200, beschaeftigungsart: 'regulaer' })
const uebergang = await rechnen()
check('Ein reguläres Gehalt im Bereich wird von selbst so gerechnet',
  uebergang.beschaeftigungsart === 'uebergangsbereich', uebergang.beschaeftigungsart)

const svAN = uebergang.rvAN + uebergang.kvAN + uebergang.pvAN + uebergang.avAN
const regulaerWaere = 1200 * (0.093 + 0.0815 + 0.018 + 0.013)
check('Der Arbeitnehmer zahlt weniger als bei regulärer Rechnung',
  svAN < regulaerWaere,
  `${svAN.toFixed(2)} statt ${regulaerWaere.toFixed(2)} EUR`)
check('Der Arbeitgeber trägt dafür mehr',
  (uebergang.rvAG + uebergang.kvAG + uebergang.pvAG + uebergang.avAG) > svAN,
  `AG ${(uebergang.rvAG + uebergang.kvAG + uebergang.pvAG + uebergang.avAG).toFixed(2)} EUR`)

console.log('\n=== Die Grenze selbst ===')
await stammdaten({ monatsgehalt: GRENZE, beschaeftigungsart: 'minijob', pauschalsteuer: true })
const anDerGrenze = await rechnen()
check(`Genau auf der Grenze (${GRENZE} EUR) ist es noch ein Minijob`,
  anDerGrenze.beschaeftigungsart === 'minijob', anDerGrenze.beschaeftigungsart)

await stammdaten({ monatsgehalt: GRENZE + 1, beschaeftigungsart: 'minijob', pauschalsteuer: true })
const drueber = await rechnen()
check('Einen Euro darüber ist es keiner mehr',
  drueber.beschaeftigungsart === 'uebergangsbereich', drueber.beschaeftigungsart)
check('Es gibt keinen Sprung nach unten beim Netto',
  drueber.netto >= anDerGrenze.netto - 1,
  `${anDerGrenze.netto} → ${drueber.netto} EUR`)

// ── Reguläre Beschäftigung bleibt unverändert ──────────────────────────────
console.log('\n=== Regulär bleibt regulär ===')
await stammdaten({ monatsgehalt: 3400, beschaeftigungsart: 'regulaer' })
const regulaer = await rechnen()
check('Ein normales Gehalt wird normal gerechnet',
  regulaer.beschaeftigungsart === 'regulaer' && regulaer.pauschsteuerAG === 0)
check('Die Rentenversicherung sind wieder 9,3 %',
  Math.abs(regulaer.rvAN - 3400 * 0.093) < 0.02, `${regulaer.rvAN} EUR`)
check('Die Lohnsteuer ist wieder da', regulaer.lohnsteuer > 0, `${regulaer.lohnsteuer} EUR`)

// Ausgangszustand wiederherstellen
await stammdaten({ monatsgehalt: 3400, beschaeftigungsart: 'regulaer' })
await rechnen()

process.exit(bilanz() ? 1 : 0)
