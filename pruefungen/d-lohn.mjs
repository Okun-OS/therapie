// Nachweis D3–D6: Lohnbeleg, Zustellung, DATEV-Export, SEPA-Datei.
import { BASIS, pruefer, login, hole, sende, zuruecksetzen, pruefMonate } from './helfer.mjs'
import zlib from 'node:zlib'

// Der sichtbare Text einer PDF-Datei: Inhaltsströme sind komprimiert und die
// Zeichenketten darin hexadezimal codiert. Ohne beides zu lösen prüft man nur,
// ob eine Datei ankommt — nicht, was draufsteht.
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

const { check, bilanz } = pruefer()

const gf = await login('gf@rheinblick-reha.de')
const leitung = await login('leitung@rheinblick-reha.de')
const kita = await login('leitung@kita-sonnenschein.de')
const anna = await login('anna.fischer@rheinblick-reha.de')

const meAnna = (await hole(anna, '/api/auth/me')).body.user
const annaId = meAnna.employeeId
const locationId = (await hole(leitung, '/api/auth/me')).body.user.locationId

const jetzt = new Date()
const jahr = jetzt.getFullYear(), monat = jetzt.getMonth() + 1
console.log(`Abrechnungszeitraum ${String(monat).padStart(2, '0')}.${jahr}\n`)

// §123 Ausgangszustand herstellen — sonst besteht die Prüfung nur einzeln
await zuruecksetzen(gf, pruefMonate(jahr, monat))

// ── Vorbereitung: Arbeitgeberangaben und Lohn-Stammdaten ───────────────────
console.log('=== Vorbereitung ===')
const org = await sende(gf, '/api/org-settings', 'PATCH', {
  organizationName: 'Reha-Zentrum Köln GmbH',
  strasse: 'Bonner Straße 210', plz: '50968', ort: 'Köln',
  betriebsnummer: '12345678', steuernummer: '215/5711/0325',
  iban: 'DE89370400440532013000', bic: 'COBADEFFXXX',
  kontoinhaber: 'Reha-Zentrum Köln GmbH',
  datevBeraternummer: '12345', datevMandantennummer: '678',
})
check('Arbeitgeberangaben lassen sich hinterlegen', org.status === 200,
  org.body.error ?? 'gespeichert')

const stammdaten = await sende(gf, `/api/employees/${annaId}/payroll-profile`, 'PUT', {
  personalnummer: '1042', eintrittsdatum: '2024-03-01',
  strasse: 'Musterweg 3', plz: '50667', ort: 'Köln',
  steuerId: '12345678901', steuerklasse: 3, kinderfreibetraege: 1, konfession: 'ev',
  bundesland: 'Nordrhein-Westfalen', sozialversicherungsnummer: '12030195M123',
  versicherungsart: 'GKV', krankenkasse: 'AOK Rheinland', zusatzbeitrag: 1.7,
  lohnart: 'monat', monatsgehalt: 3400,
  iban: 'DE02120300000000202051', bic: 'BYLADEM1001', kontoinhaber: 'Anna Fischer',
})
check('Lohn-Stammdaten sind vollständig', stammdaten.status === 200,
  stammdaten.body.error ?? 'gespeichert')

const vorbereitet = await sende(gf, '/api/payroll/vorbereiten', 'POST', { year: jahr, month: monat })
check('Abrechnungen werden vorbereitet', vorbereitet.status === 200,
  vorbereitet.body.hinweis ?? vorbereitet.body.error)

// ── Sperre für ungeprüfte Jahre ────────────────────────────────────────────
console.log('\n=== Jahre ohne geprüfte Rechengrößen ===')
const altesJahr = await sende(gf, '/api/payroll/vorbereiten', 'POST', { year: 2019, month: 3 })
check('Ein Jahr ohne hinterlegte Werte wird abgelehnt statt geschätzt',
  altesJahr.status === 400, `HTTP ${altesJahr.status}`)
check('Die Meldung sagt, welches Jahr fehlt und was zu tun ist',
  /2019/.test(altesJahr.body.error ?? '') && /lohnjahre/.test(altesJahr.body.error ?? ''),
  altesJahr.body.error)

// ── D3 Beleg erzeugen ──────────────────────────────────────────────────────
console.log('\n=== D3 Lohnabrechnung als Beleg ===')
const vorherAkte = (await hole(anna, `/api/files?ownerType=employee&ownerId=${annaId}`)).body.dateien ?? []
// Das Postfach ist begrenzt — gezaehlt werden darf deshalb nicht, sonst misst
// der Test die Deckelung statt der Zustellung. Verglichen wird die neueste ID.
const vorherPost = (await hole(anna, `/api/notifications?employeeId=${annaId}`)).body.notifications?.[0]?.id ?? null

const beleg = await sende(gf, '/api/payroll/beleg', 'POST',
  { year: jahr, month: monat, employeeId: annaId })
check('Beleg wird erzeugt', beleg.status === 200 && beleg.body.erzeugt > 0,
  beleg.body.error ?? beleg.body.hinweis)

// ── D4 Zustellung an den Mitarbeiter ───────────────────────────────────────
console.log('\n=== D4 Zustellung an den Mitarbeiter ===')
const akte = (await hole(anna, `/api/files?ownerType=employee&ownerId=${annaId}`)).body.dateien ?? []
const neueBelege = akte.filter(d => d.kategorie === 'lohnabrechnung')
  .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
check('Der Beleg liegt in den Unterlagen des Mitarbeiters',
  neueBelege.length > vorherAkte.filter(d => d.kategorie === 'lohnabrechnung').length,
  neueBelege[0]?.dateiname)
check('Er ist für den Mitarbeiter freigegeben',
  neueBelege[0]?.sichtbarFuerMitarbeiter === true)

const dateiId = neueBelege[0]?.id
if (dateiId) {
  const r = await fetch(`${BASIS}/api/files/${dateiId}`, { headers: { cookie: anna } })
  const buf = Buffer.from(await r.arrayBuffer())
  check('Der Mitarbeiter kann den Beleg öffnen', r.status === 200, `HTTP ${r.status}`)
  check('Es ist eine gültige PDF-Datei',
    buf.subarray(0, 5).toString() === '%PDF-' && buf.length > 1000,
    `${buf.subarray(0, 5).toString()} · ${(buf.length / 1024).toFixed(1)} KB`)

  const inhalt = pdfText(buf)
  for (const [begriff, label] of [
    ['Entgeltabrechnung', 'Überschrift'],
    ['Lohnsteuer', 'Lohnsteuer ausgewiesen'],
    ['Rentenversicherung', 'Rentenversicherung ausgewiesen'],
    ['Auszahlungsbetrag', 'Auszahlungsbetrag ausgewiesen'],
    ['Steuerklasse', 'Steuerklasse ausgewiesen'],
    ['Anna Fischer', 'Name des Mitarbeiters'],
    ['1042', 'Personalnummer'],
    ['Reha-Zentrum', 'Arbeitgeber'],
    ['Programmablaufplan', 'Rechtsgrundlage der Lohnsteuer genannt'],
  ]) check(`§108 GewO: ${label}`, inhalt.includes(begriff))

  // Der Auszahlungsbetrag auf dem Beleg muss der Überweisung entsprechen
  const netto = (await hole(gf, `/api/payroll?year=${jahr}&month=${monat}`)).body
    ?.entries?.find(e => e.employeeId === annaId)?.netto
  check('Der Auszahlungsbetrag auf dem Beleg stimmt mit der Abrechnung überein',
    netto > 0 && inhalt.includes(
      netto.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })),
    `${netto} EUR`)

  const fremd = await fetch(`${BASIS}/api/files/${dateiId}`, { headers: { cookie: kita } })
  check('Fremde Leitung kommt an den Beleg NICHT heran', fremd.status === 403, `HTTP ${fremd.status}`)
}

const nachPost = (await hole(anna, `/api/notifications?employeeId=${annaId}`)).body.notifications ?? []
check('Der Mitarbeiter wird über die Abrechnung benachrichtigt',
  nachPost[0]?.id !== vorherPost && nachPost[0]?.type === 'lohnabrechnung',
  nachPost[0]?.title)

// ── D5 DATEV-Export ────────────────────────────────────────────────────────
console.log('\n=== D5 DATEV-Export ===')
const datevR = await fetch(`${BASIS}/api/payroll/export?art=datev&year=${jahr}&month=${monat}`,
  { headers: { cookie: gf } })
const datev = await datevR.text()
check('DATEV-Datei wird geliefert', datevR.status === 200, `HTTP ${datevR.status}`)
check('Sie kommt als CSV zum Herunterladen',
  (datevR.headers.get('content-disposition') ?? '').includes('.csv'))
check('Berater- und Mandantennummer stehen im Kopf',
  datev.includes('Berater 12345') && datev.includes('Mandant 678'))
check('Die Personalnummer wird verwendet, nicht die interne Kennung',
  datev.includes('"1042"'))
check('Lohnarten sind einzeln ausgewiesen',
  datev.includes('Grundentgelt') && datev.includes('Lohnsteuer') && datev.includes('Auszahlungsbetrag'))
check('Beträge mit Komma statt Punkt', /"\d+,\d{2}"/.test(datev))

const datevFremd = await fetch(`${BASIS}/api/payroll/export?art=datev&year=${jahr}&month=${monat}&locationId=${locationId}`,
  { headers: { cookie: kita } })
check('Fremde Leitung bekommt keinen Export', datevFremd.status === 403, `HTTP ${datevFremd.status}`)

// ── D6 SEPA-Datei ──────────────────────────────────────────────────────────
console.log('\n=== D6 SEPA-Datei ===')
const sepaR = await fetch(`${BASIS}/api/payroll/export?art=sepa&year=${jahr}&month=${monat}`,
  { headers: { cookie: gf } })
const sepa = await sepaR.text()
check('SEPA-Datei wird geliefert', sepaR.status === 200, `HTTP ${sepaR.status}`)
check('Format ist pain.001.001.03', sepa.includes('pain.001.001.03'))
check('Das Konto des Arbeitgebers ist die Belastung',
  sepa.includes('<IBAN>DE89370400440532013000</IBAN>'))
check('Das Konto des Mitarbeiters ist der Empfänger',
  sepa.includes('<IBAN>DE02120300000000202051</IBAN>'))

// Kontrollsumme gegen die Einzelbeträge rechnen — daran scheitern Dateien
const betraege = [...sepa.matchAll(/<InstdAmt Ccy="EUR">([\d.]+)<\/InstdAmt>/g)].map(m => Number(m[1]))
const summe = Number(sepa.match(/<CtrlSum>([\d.]+)<\/CtrlSum>/)?.[1] ?? 0)
const anzahl = Number(sepa.match(/<NbOfTxs>(\d+)<\/NbOfTxs>/)?.[1] ?? 0)
check('Die Kontrollsumme stimmt mit den Einzelbeträgen überein',
  Math.abs(betraege.reduce((s, b) => s + b, 0) - summe) < 0.005,
  `${betraege.length} Zahlungen · Summe ${summe.toFixed(2)} EUR`)
check('Die Anzahl der Zahlungen stimmt', anzahl === betraege.length)
check('Keine Umlaute in der Datei', !/[äöüÄÖÜß]/.test(sepa))
check('Ein Ausführungsdatum ist gesetzt', /<ReqdExctnDt>\d{4}-\d{2}-\d{2}<\/ReqdExctnDt>/.test(sepa))

const sepaFremd = await fetch(`${BASIS}/api/payroll/export?art=sepa&year=${jahr}&month=${monat}&locationId=${locationId}`,
  { headers: { cookie: kita } })
check('Fremde Leitung bekommt keine SEPA-Datei', sepaFremd.status === 403, `HTTP ${sepaFremd.status}`)

const mitarbeiterExport = await fetch(`${BASIS}/api/payroll/export?art=sepa&year=${jahr}&month=${monat}`,
  { headers: { cookie: anna } })
check('Ein Mitarbeiter bekommt keine SEPA-Datei', mitarbeiterExport.status === 403,
  `HTTP ${mitarbeiterExport.status}`)

process.exit(bilanz() ? 1 : 0)
