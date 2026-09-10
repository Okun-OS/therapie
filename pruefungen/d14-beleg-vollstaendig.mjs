// Nachweis D14: Beleg und DATEV müssen die Sonderformen erklären.
//
// Bei einem Minijob steht auf dem Beleg sonst nur „Lohnsteuer 0,00 €" — ohne
// jede Erklärung. Und der Steuerberater bekäme im DATEV-Export gar keine
// Abgaben, obwohl die Pauschalen dort die einzigen sind.
import { BASIS, pruefer, login, hole, sende, zuruecksetzen, pruefMonate } from './helfer.mjs'
import zlib from 'node:zlib'

const { check, bilanz } = pruefer()

/** Sichtbarer Text einer PDF-Datei — Ströme entpacken, Zeichenketten dekodieren. */
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
const anna = await login('anna.fischer@rheinblick-reha.de')
const annaId = (await hole(anna, '/api/auth/me')).body.user.employeeId

const jetzt = new Date()
const jahr = jetzt.getFullYear(), monat = jetzt.getMonth() + 1
const mm = String(monat).padStart(2, '0')
console.log(`Abrechnungszeitraum ${mm}.${jahr}\n`)

await zuruecksetzen(gf, pruefMonate(jahr, monat))

async function stammdaten(zusatz) {
  return sende(gf, `/api/employees/${annaId}/payroll-profile`, 'PUT', {
    personalnummer: '1042', steuerId: '12345678901',
    steuerklasse: 1, kinderfreibetraege: 0, konfession: 'keine',
    bundesland: 'Nordrhein-Westfalen', versicherungsart: 'GKV', zusatzbeitrag: 1.7,
    iban: 'DE02120300000000202051', kontoinhaber: 'Anna Fischer',
    elstamStand: `${jahr}-${mm}-01`, eintrittsdatum: '2024-03-01', austrittsdatum: '',
    lohnart: 'monat', monatsgehalt: 3400, beschaeftigungsart: 'regulaer',
    ...zusatz,
  })
}

async function rechnenUndBeleg() {
  const vorher = (await hole(gf, `/api/payroll?year=${jahr}&month=${monat}`))
    .body.entries?.find(x => x.employeeId === annaId)
  if (vorher && vorher.status !== 'draft') {
    await sende(gf, '/api/payroll', 'PATCH', { id: vorher.id, status: 'draft' })
  }
  await sende(gf, '/api/payroll/vorbereiten', 'POST', { year: jahr, month: monat })
  await sende(gf, '/api/payroll/beleg', 'POST', { year: jahr, month: monat, employeeId: annaId })

  const akte = (await hole(anna, `/api/files?ownerType=employee&ownerId=${annaId}`)).body.dateien ?? []
  const belege = akte.filter(d => d.kategorie === 'lohnabrechnung')
    .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
  const r = await fetch(`${BASIS}/api/files/${belege[0].id}`, { headers: { cookie: anna } })
  const text = pdfText(Buffer.from(await r.arrayBuffer()))

  const datevR = await fetch(`${BASIS}/api/payroll/export?art=datev&year=${jahr}&month=${monat}`,
    { headers: { cookie: gf } })
  return { text, datev: await datevR.text() }
}

// ── Minijob ────────────────────────────────────────────────────────────────
console.log('=== Minijob ===')
await stammdaten({ monatsgehalt: 500, beschaeftigungsart: 'minijob', pauschalsteuer: true })
const mini = await rechnenUndBeleg()
check('Der Beleg nennt die Beschäftigungsart', mini.text.includes('Minijob'))
check('Er erklärt, warum keine Lohnsteuer abgeht',
  /trägt der Arbeitgeber/.test(mini.text) && mini.text.includes('40a'),
  mini.text.split('\n').find(z => z.includes('40a')))
check('Er sagt, dass der Verdienst nicht in die Steuererklärung gehört',
  /Steuererkl/.test(mini.text))
check('DATEV führt die Rentenpauschale des Arbeitgebers',
  mini.datev.includes('Rentenversicherung AG') && mini.datev.includes('"75,00"'))
check('DATEV führt die Krankenpauschale',
  mini.datev.includes('Krankenversicherung AG') && mini.datev.includes('"65,00"'))
check('DATEV führt die Pauschsteuer',
  mini.datev.includes('Pauschsteuer AG') && mini.datev.includes('"10,00"'))

// ── Kurzfristige Beschäftigung ─────────────────────────────────────────────
console.log('\n=== Kurzfristige Beschäftigung ===')
await stammdaten({ monatsgehalt: 2000, beschaeftigungsart: 'kurzfristig' })
const kurz = await rechnenUndBeleg()
check('Der Beleg nennt sie beim Namen', kurz.text.includes('kurzfristig'))
check('Und erklärt die Beitragsfreiheit', /beitragsfrei/.test(kurz.text),
  kurz.text.split('\n').find(z => z.includes('beitragsfrei')))

// ── Übergangsbereich ───────────────────────────────────────────────────────
console.log('\n=== Übergangsbereich ===')
await stammdaten({ monatsgehalt: 1200, beschaeftigungsart: 'regulaer' })
const ueber = await rechnenUndBeleg()
check('Der Beleg nennt den Übergangsbereich', ueber.text.includes('Übergangsbereich'))
check('Und erklärt den verminderten Beitrag', /vermindert/.test(ueber.text))

// ── Teilmonat ──────────────────────────────────────────────────────────────
console.log('\n=== Teilmonat ===')
await stammdaten({ eintrittsdatum: `${jahr}-${mm}-16` })
const teil = await rechnenUndBeleg()
check('Der Beleg weist die SV-Tage aus', /SV-Tage/.test(teil.text))
check('Und erklärt den Teilmonat', /Teilmonat/.test(teil.text),
  teil.text.split('\n').find(z => z.includes('Teilmonat')))

// ── Regulär ────────────────────────────────────────────────────────────────
console.log('\n=== Regulär ===')
await stammdaten({})
const normal = await rechnenUndBeleg()
check('Auch der normale Beleg nennt die SV-Tage', /SV-Tage/.test(normal.text))
check('Er trägt keine überflüssige Erklärung',
  !/Teilmonat|beitragsfrei|vermindert|40a/.test(normal.text))
check('DATEV führt die Arbeitgeberanteile',
  normal.datev.includes('Rentenversicherung AG')
  && normal.datev.includes('Arbeitslosenversicherung AG'))

process.exit(bilanz() ? 1 : 0)
