// Nachweis D13: Ein- und Austritte innerhalb des Monats.
import { pruefer, login, hole, sende, zuruecksetzen, pruefMonate } from './helfer.mjs'

const { check, bilanz } = pruefer()

const gf = await login('gf@rheinblick-reha.de')
const anna = await login('anna.fischer@rheinblick-reha.de')
const annaId = (await hole(anna, '/api/auth/me')).body.user.employeeId

const jetzt = new Date()
const jahr = jetzt.getFullYear(), monat = jetzt.getMonth() + 1
const mm = String(monat).padStart(2, '0')
const letzterTag = new Date(Date.UTC(jahr, monat, 0)).getUTCDate()
console.log(`Abrechnungszeitraum ${mm}.${jahr} (${letzterTag} Kalendertage)\n`)

// §123 Ausgangszustand herstellen — sonst besteht die Prüfung nur einzeln
await zuruecksetzen(gf, pruefMonate(jahr, monat))

async function stammdaten(zusatz) {
  return sende(gf, `/api/employees/${annaId}/payroll-profile`, 'PUT', {
    personalnummer: '1042', steuerId: '12345678901',
    steuerklasse: 1, kinderfreibetraege: 0, konfession: 'keine',
    bundesland: 'Nordrhein-Westfalen', versicherungsart: 'GKV', zusatzbeitrag: 1.7,
    iban: 'DE02120300000000202051', kontoinhaber: 'Anna Fischer',
    elstamStand: `${jahr}-${mm}-01`,
    lohnart: 'monat', monatsgehalt: 3400, beschaeftigungsart: 'regulaer',
    eintrittsdatum: '2024-03-01', austrittsdatum: '',
    ...zusatz,
  })
}

async function rechnen() {
  const e = (await hole(gf, `/api/payroll?year=${jahr}&month=${monat}`))
    .body.entries?.find(x => x.employeeId === annaId)
  if (e && e.status !== 'draft') {
    await sende(gf, '/api/payroll', 'PATCH', { id: e.id, status: 'draft' })
  }
  const lauf = await sende(gf, '/api/payroll/vorbereiten', 'POST', { year: jahr, month: monat })
  const eintrag = (await hole(gf, `/api/payroll?year=${jahr}&month=${monat}`))
    .body.entries.find(x => x.employeeId === annaId)
  return { lauf: lauf.body, eintrag }
}

// ── Voller Monat als Vergleich ─────────────────────────────────────────────
console.log('=== Voller Monat ===')
await stammdaten({})
const voll = await rechnen()
check('Ein voller Monat hat 30 SV-Tage', voll.eintrag.svTage === 30, `${voll.eintrag.svTage}`)
check('Und das volle Gehalt', voll.eintrag.brutto === 3400, `${voll.eintrag.brutto} EUR`)

// ── Eintritt in der Monatsmitte ────────────────────────────────────────────
console.log('\n=== Eintritt am 16. ===')
await stammdaten({ eintrittsdatum: `${jahr}-${mm}-16` })
const spaet = await rechnen()
const erwarteteTage = letzterTag === 31 ? 15 : (letzterTag === 30 ? 15 : 30 - 15)
check('Die SV-Tage sind gekürzt', spaet.eintrag.svTage < 30 && spaet.eintrag.svTage > 0,
  `${spaet.eintrag.svTage} SV-Tage`)
check('Das Gehalt ist anteilig',
  Math.abs(spaet.eintrag.brutto - 3400 * spaet.eintrag.svTage / 30) < 0.02,
  `${spaet.eintrag.brutto} EUR statt 3400`)
check('Die Beiträge sinken mit', spaet.eintrag.rvAN < voll.eintrag.rvAN,
  `${spaet.eintrag.rvAN} statt ${voll.eintrag.rvAN} EUR`)
check('Der Lauf meldet den Teilmonat',
  (spaet.lauf.teilmonate ?? []).some(t => t.name === 'Anna Fischer'),
  spaet.lauf.hinweis)
check('Es bleibt eine reguläre Beschäftigung — kein Minijob',
  spaet.eintrag.beschaeftigungsart === 'regulaer',
  spaet.eintrag.beschaeftigungsart)

// ── Austritt in der Monatsmitte ────────────────────────────────────────────
console.log('\n=== Austritt am 15. ===')
await stammdaten({ austrittsdatum: `${jahr}-${mm}-15` })
const frueh = await rechnen()
check('Auch beim Austritt wird gekürzt', frueh.eintrag.svTage === 15,
  `${frueh.eintrag.svTage} SV-Tage`)
check('Zusammen ergeben beide Teile genau 30 SV-Tage',
  frueh.eintrag.svTage + spaet.eintrag.svTage === 30,
  `${frueh.eintrag.svTage} + ${spaet.eintrag.svTage}`)
check('Und zusammen genau ein volles Gehalt',
  Math.abs((frueh.eintrag.brutto + spaet.eintrag.brutto) - 3400) < 0.05,
  `${frueh.eintrag.brutto} + ${spaet.eintrag.brutto} = ${(frueh.eintrag.brutto + spaet.eintrag.brutto).toFixed(2)}`)

// ── Gar nicht beschäftigt ──────────────────────────────────────────────────
console.log('\n=== Vor dem Eintritt und nach dem Austritt ===')
await stammdaten({ eintrittsdatum: `${jahr + 1}-01-01` })
const nochNicht = await rechnen()
check('Wer noch nicht da ist, bekommt keine Abrechnung',
  (nochNicht.lauf.nichtBeschaeftigt ?? []).includes('Anna Fischer'),
  nochNicht.lauf.hinweis)

await stammdaten({ eintrittsdatum: '2024-03-01', austrittsdatum: `${jahr - 1}-12-31` })
const nichtMehr = await rechnen()
check('Wer schon weg ist, auch nicht',
  (nichtMehr.lauf.nichtBeschaeftigt ?? []).includes('Anna Fischer'))

// ── Gutverdiener: die Grenze wird mitgekürzt ───────────────────────────────
console.log('\n=== Beitragsbemessungsgrenze im Teilmonat ===')
await stammdaten({ monatsgehalt: 30000, eintrittsdatum: `${jahr}-${mm}-16` })
const hoch = await rechnen()
// BBG RV 2026 = 8450 im Monat, anteilig nach SV-Tagen
const erwarteteGrenze = 8450 * hoch.eintrag.svTage / 30
check('Die Rentenversicherung deckelt an der anteiligen Grenze',
  Math.abs(hoch.eintrag.rvAN - erwarteteGrenze * 0.093) < 0.5,
  `${hoch.eintrag.rvAN} EUR (Grenze ${erwarteteGrenze.toFixed(2)})`)

await stammdaten({ monatsgehalt: 30000 })
const hochVoll = await rechnen()
check('Im vollen Monat gilt die volle Grenze',
  Math.abs(hochVoll.eintrag.rvAN - 8450 * 0.093) < 0.02,
  `${hochVoll.eintrag.rvAN} EUR`)

// ── Ausgangszustand ────────────────────────────────────────────────────────
await stammdaten({})
await rechnen()

process.exit(bilanz() ? 1 : 0)
