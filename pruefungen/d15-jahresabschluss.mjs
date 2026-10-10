// Nachweis D15: Jahresabschluss — Werte für den Steuerberater, Übersicht für
// den Mitarbeiter.
//
// Der teuerste Fehler hier: pauschal versteuerten Arbeitslohn zu bescheinigen.
// Das Finanzamt besteuert ihn dann ein zweites Mal, beim Mitarbeiter, der
// nichts davon ahnt.
import { BASIS, pruefer, login, hole, sende, zuruecksetzen, pruefMonate, lohnPerson } from './helfer.mjs'
import zlib from 'node:zlib'

const { check, bilanz } = pruefer()

function pdfText(buf) {
  const roh = buf.toString('latin1')
  let inhalt = ''
  const re = /stream\r?\n/g
  let m
  while ((m = re.exec(roh))) {
    const start = m.index + m[0].length
    const ende = roh.indexOf('endstream', start)
    if (ende < 0) continue
    try {
      inhalt += zlib.inflateSync(Buffer.from(roh.slice(start, ende), 'latin1')).toString('latin1')
    } catch { /* nicht jeder Strom ist ein Inhaltsstrom */ }
  }
  return [...inhalt.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)]
    .map(t => Buffer.from(t[1], 'hex').toString('latin1'))
    .join('\n')
}

const gf = await login('gf@rheinblick-reha.de')
const kita = await login('leitung@kita-sonnenschein.de')
const anna = await login('anna.fischer@rheinblick-reha.de')
const locationId = (await hole(anna, '/api/auth/me')).body.user.locationId
// §134 Eine eigene Person ohne Zeiterfassung — sonst rechnen Zuschläge mit,
// die sich mit jedem Tag ändern, und die Prüfung misst den Kalender.
const personId = await lohnPerson(gf, locationId)

const jetzt = new Date()
const jahr = jetzt.getFullYear(), monat = jetzt.getMonth() + 1
const mm = String(monat).padStart(2, '0')
console.log(`Jahresabschluss ${jahr}\n`)

await zuruecksetzen(gf, pruefMonate(jahr, monat))

async function stammdaten(zusatz) {
  return sende(gf, `/api/employees/${personId}/payroll-profile`, 'PUT', {
    personalnummer: '9015', steuerId: '20000000015',
    steuerklasse: 1, kinderfreibetraege: 0, konfession: 'keine',
    bundesland: 'Nordrhein-Westfalen', versicherungsart: 'GKV', zusatzbeitrag: 1.7,
    iban: 'DE02120300000000202051', kontoinhaber: 'Lohnpruefung Nachweis',
    elstamStand: `${jahr}-${mm}-01`, eintrittsdatum: '2024-03-01', austrittsdatum: '',
    lohnart: 'monat', monatsgehalt: 3400, beschaeftigungsart: 'regulaer',
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
}

// ── Reguläre Beschäftigung ─────────────────────────────────────────────────
console.log('=== Jahreswerte ===')
await stammdaten({})
await rechnen()

const uebersicht = await hole(gf, `/api/payroll/jahresabschluss?jahr=${jahr}`)
check('Die Jahreswerte werden geliefert', uebersicht.status === 200, uebersicht.body.hinweis)
const annaWerte = (uebersicht.body.mitarbeiter ?? []).find(m => m.employeeId === personId)
check('Anna ist dabei', !!annaWerte, annaWerte?.zeitraum)
check('Der Bruttoarbeitslohn ist gesetzt', annaWerte?.werte.bruttoarbeitslohn > 0,
  `${annaWerte?.werte.bruttoarbeitslohn} EUR`)
check('Sie ist bescheinigungspflichtig', annaWerte?.werte.bescheinigungspflichtig === true)
check('Der Zeitraum wird genannt', /\d{4}/.test(annaWerte?.zeitraum ?? ''), annaWerte?.zeitraum)

// ── Export für den Steuerberater ───────────────────────────────────────────
console.log('\n=== Export für den Steuerberater ===')
const csvR = await fetch(`${BASIS}/api/payroll/jahresabschluss?jahr=${jahr}&art=steuerberater`,
  { headers: { cookie: gf } })
const csv = await csvR.text()
check('Die Datei wird geliefert', csvR.status === 200, `HTTP ${csvR.status}`)
check('Sie kommt als CSV zum Herunterladen',
  (csvR.headers.get('content-disposition') ?? '').includes('.csv'))
check('Die Personalnummer steht drin', csv.includes('"9015"'))
check('Die Steuer-ID steht drin', csv.includes('"20000000015"'))
for (const spalte of ['Bruttoarbeitslohn', 'Lohnsteuer', 'RV Arbeitgeber',
  'KV Arbeitnehmer', 'Steuerfreie Zuschläge', 'Zu bescheinigen']) {
  check(`Spalte „${spalte}" ist vorhanden`, csv.includes(spalte))
}
check('Beträge mit Komma statt Punkt', /"\d+,\d{2}"/.test(csv))

// ── Jahresübersicht für den Mitarbeiter ────────────────────────────────────
console.log('\n=== Jahresübersicht für den Mitarbeiter ===')
const vorher = (await hole(gf, `/api/notifications?employeeId=${personId}`)).body.notifications?.[0]?.id ?? null
const beleg = await sende(gf, '/api/payroll/jahresabschluss', 'POST', { jahr, employeeId: personId })
check('Sie wird erzeugt', beleg.status === 200 && beleg.body.erzeugt > 0,
  beleg.body.hinweis ?? beleg.body.error)

const akte = (await hole(gf, `/api/files?ownerType=employee&ownerId=${personId}`)).body.dateien ?? []
const jahresbelege = akte.filter(d => d.dateiname?.startsWith('Jahresuebersicht'))
  .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
check('Sie liegt in den Unterlagen des Mitarbeiters', jahresbelege.length > 0,
  jahresbelege[0]?.dateiname)
check('Und ist für ihn freigegeben', jahresbelege[0]?.sichtbarFuerMitarbeiter === true)

const r = await fetch(`${BASIS}/api/files/${jahresbelege[0].id}`, { headers: { cookie: gf } })
const text = pdfText(Buffer.from(await r.arrayBuffer()))
check('Sie heißt „Jahresübersicht"', text.includes('Jahresübersicht'))
check('Sie sagt ausdrücklich, dass sie KEINE Lohnsteuerbescheinigung ist',
  /KEINE Lohnsteuerbescheinigung/.test(text),
  text.split('\n').find(z => z.includes('KEINE')))
check('Sie sagt, woher die amtliche Bescheinigung kommt',
  /Finanzverwaltung/.test(text))
check('Der Bruttoarbeitslohn steht drauf', text.includes('Bruttoarbeitslohn'))
check('Die Rentenversicherung steht drauf', text.includes('Rentenversicherung'))
check('Der Zeitraum steht drauf', /Bescheinigungszeitraum/.test(text))

const nachher = (await hole(gf, `/api/notifications?employeeId=${personId}`)).body.notifications ?? []
check('Der Mitarbeiter wird benachrichtigt',
  nachher[0]?.id !== vorher && /Jahres/.test(nachher[0]?.title ?? ''),
  nachher[0]?.title)

// ── Pauschal versteuerter Minijob ──────────────────────────────────────────
console.log('\n=== Pauschal versteuerter Minijob wird NICHT bescheinigt ===')
// Gemessen wird die Veränderung, nicht der absolute Wert: Anna hat aus anderen
// Prüfungen weitere Monate im Jahr, die zu Recht bescheinigt werden.
const vorMinijob = ((await hole(gf, `/api/payroll/jahresabschluss?jahr=${jahr}`))
  .body.mitarbeiter ?? []).find(m => m.employeeId === personId).werte

await stammdaten({ monatsgehalt: 500, beschaeftigungsart: 'minijob', pauschalsteuer: true })
await rechnen()

const nachMinijob = await hole(gf, `/api/payroll/jahresabschluss?jahr=${jahr}`)
const minijobWerte = (nachMinijob.body.mitarbeiter ?? []).find(m => m.employeeId === personId).werte

check('Der pauschal versteuerte Lohn ist gesondert ausgewiesen',
  Math.abs(minijobWerte.pauschalVersteuert - 500) < 0.02,
  `${minijobWerte.pauschalVersteuert} EUR`)
check('Er steckt NICHT im Bruttoarbeitslohn — der sinkt um den regulären Monat, '
  + 'ohne dass die 500 EUR hinzukommen',
  Math.abs(minijobWerte.bruttoarbeitslohn - (vorMinijob.bruttoarbeitslohn - 3400)) < 0.02,
  `${vorMinijob.bruttoarbeitslohn} → ${minijobWerte.bruttoarbeitslohn} EUR`)
check('Die Lohnsteuer des Monats fällt mit heraus',
  minijobWerte.lohnsteuer < vorMinijob.lohnsteuer,
  `${vorMinijob.lohnsteuer} → ${minijobWerte.lohnsteuer} EUR`)
check('Und es steht dabei, warum',
  (minijobWerte.hinweise ?? []).some(h => h.includes('40a')),
  minijobWerte.hinweise?.find(h => h.includes('40a')))

// ── Abschottung ────────────────────────────────────────────────────────────
console.log('\n=== Abschottung ===')
const fremd = await hole(kita, `/api/payroll/jahresabschluss?jahr=${jahr}`)
check('Eine fremde Leitung sieht Anna nicht',
  !(fremd.body.mitarbeiter ?? []).some(m => m.employeeId === personId),
  `${fremd.body.mitarbeiter?.length ?? 0} eigene Mitarbeiter`)

const fremdBeleg = await sende(kita, '/api/payroll/jahresabschluss', 'POST',
  { jahr, employeeId: personId })
check('Und kann für sie keine Übersicht erzeugen', fremdBeleg.status === 403,
  `HTTP ${fremdBeleg.status}`)

const mitarbeiterSieht = await hole(anna, `/api/payroll/jahresabschluss?jahr=${jahr}`)
check('Ein Mitarbeiter kommt an die Liste nicht heran', mitarbeiterSieht.status === 403,
  `HTTP ${mitarbeiterSieht.status}`)

// Ausgangszustand
await stammdaten({})
await rechnen()

process.exit(bilanz() ? 1 : 0)
