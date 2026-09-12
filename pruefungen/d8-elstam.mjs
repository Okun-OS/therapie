// Nachweis D8: ELStAM-Stand, Warnung und Import der Änderungsliste.
import { BASIS, pruefer, login, hole, sende, zuruecksetzen, pruefMonate } from './helfer.mjs'

const { check, bilanz } = pruefer()

const gf = await login('gf@rheinblick-reha.de')
const kita = await login('leitung@kita-sonnenschein.de')
const anna = await login('anna.fischer@rheinblick-reha.de')
const annaId = (await hole(anna, '/api/auth/me')).body.user.employeeId

const jetzt = new Date()
const jahr = jetzt.getFullYear(), monat = jetzt.getMonth() + 1
const mm = String(monat).padStart(2, '0')
console.log(`Abrechnungszeitraum ${mm}.${jahr}\n`)

// §123 Ausgangszustand herstellen — sonst besteht die Prüfung nur einzeln
await zuruecksetzen(gf, pruefMonate(jahr, monat))

// ── Ausgangslage: Steuer-ID setzen, ELStAM-Stand entfernen ─────────────────
console.log('=== Vorbereitung ===')
const stamm = await sende(gf, `/api/employees/${annaId}/payroll-profile`, 'PUT', {
  personalnummer: '9008', steuerId: '20000000008',
  steuerklasse: 1, kinderfreibetraege: 0, konfession: 'keine',
  bundesland: 'Nordrhein-Westfalen', versicherungsart: 'GKV', zusatzbeitrag: 1.7,
  lohnart: 'monat', monatsgehalt: 3400,
  iban: 'DE02120300000000202051', kontoinhaber: 'Anna Fischer',
  elstamStand: '', elstamQuelle: '',
})
check('Ausgangslage gesetzt: Steuerklasse 1, kein ELStAM-Stand', stamm.status === 200,
  stamm.body.error ?? 'gespeichert')

// ── Warnung im Abrechnungslauf ─────────────────────────────────────────────
console.log('\n=== Warnung vor dem Abrechnungslauf ===')
const ohneStand = await sende(gf, '/api/payroll/vorbereiten', 'POST', { year: jahr, month: monat })
const gewarnt = (ohneStand.body.veralteteMerkmale ?? []).find(v => v.name === 'Anna Fischer')
check('Ein fehlender ELStAM-Stand wird gemeldet', !!gewarnt, gewarnt?.text)
check('Die Meldung steht auch in der Zusammenfassung',
  /ELStAM/.test(ohneStand.body.hinweis ?? ''), ohneStand.body.hinweis)
check('Die Abrechnung läuft trotzdem durch — gewarnt, nicht gesperrt',
  ohneStand.status === 200 && ohneStand.body.angelegt > 0)

// ── Vorschau der Änderungsliste ────────────────────────────────────────────
console.log('\n=== Änderungsliste einlesen (Vorschau) ===')
const liste = [
  'IdNr;Arbeitnehmer;St.Kl.;ZKF;KiSt;Freibetrag mtl.',
  '20000000008;Anna Fischer;III;1,0;ev;',
  '00000000000;Fremde Person;I;0;--;',
].join('\r\n')

const vorschau = await sende(gf, '/api/payroll/elstam', 'POST', { inhalt: liste })
check('Die Liste wird gelesen', vorschau.status === 200, vorschau.body.error ?? vorschau.body.hinweis)
const annaZeile = (vorschau.body.abgleich ?? []).find(a => a.employeeId === annaId)
check('Anna wird über die Steuer-ID zugeordnet', annaZeile?.zuordnung === 'steuerId')
check('Die Änderungen werden benannt, nicht nur gezählt',
  annaZeile?.aenderungen?.some(a => a.feld === 'steuerklasse' && a.bisher === '1' && a.neu === '3'),
  annaZeile?.aenderungen?.map(a => `${a.feld}: ${a.bisher}→${a.neu}`).join(', '))
check('Ein Satz ohne passenden Mitarbeiter wird gemeldet statt still verworfen',
  (vorschau.body.abgleich ?? []).some(a => !a.employeeId && /Kein Mitarbeiter/.test(a.hinweis ?? '')))

const vorher = (await hole(gf, `/api/employees/${annaId}/payroll-profile`)).body.profil
check('Die Vorschau ändert noch NICHTS', vorher.steuerklasse === 1,
  `Steuerklasse weiterhin ${vorher.steuerklasse}`)

// ── Übernahme ──────────────────────────────────────────────────────────────
console.log('\n=== Übernahme nach Bestätigung ===')
const ohneBestaetigung = await sende(gf, '/api/payroll/elstam?uebernehmen=1', 'POST',
  { inhalt: liste, stand: `${jahr}-${mm}-01`, uebernehmenFuer: [] })
check('Ohne Bestätigung wird nichts übernommen', ohneBestaetigung.status === 400,
  ohneBestaetigung.body.error)

const uebernahme = await sende(gf, '/api/payroll/elstam?uebernehmen=1', 'POST', {
  inhalt: liste, stand: `${jahr}-${mm}-01`,
  quelle: `Änderungsliste ${mm}/${jahr}`, uebernehmenFuer: [annaId],
})
check('Die bestätigten Änderungen werden übernommen', uebernahme.status === 200,
  uebernahme.body.hinweis ?? uebernahme.body.error)

const nachher = (await hole(gf, `/api/employees/${annaId}/payroll-profile`)).body.profil
check('Die Steuerklasse steht jetzt auf III', nachher.steuerklasse === 3)
check('Der Kinderfreibetrag wurde mit übernommen', nachher.kinderfreibetraege === 1)
check('Die Konfession wurde mit übernommen', nachher.konfession === 'ev')
check('Der Stand ist gesetzt', nachher.elstamStand === `${jahr}-${mm}-01`, nachher.elstamStand)
check('Die Quelle ist festgehalten', /Änderungsliste/.test(nachher.elstamQuelle ?? ''),
  nachher.elstamQuelle)
check('Es steht fest, wer bestätigt hat', !!nachher.elstamBestaetigtVon,
  nachher.elstamBestaetigtVon)
check('Nicht genannte Felder blieben unangetastet',
  nachher.monatsgehalt === 3400 && nachher.iban === 'DE02120300000000202051')

// ── Wirkung auf die Abrechnung ─────────────────────────────────────────────
console.log('\n=== Wirkung auf die Lohnsteuer ===')
const nachUebernahme = await sende(gf, '/api/payroll/vorbereiten', 'POST', { year: jahr, month: monat })
check('Jetzt wird nicht mehr vor Anna gewarnt',
  !(nachUebernahme.body.veralteteMerkmale ?? []).some(v => v.name === 'Anna Fischer'))

const abrechnung = (await hole(gf, `/api/payroll?year=${jahr}&month=${monat}`))
  .body.entries?.find(e => e.employeeId === annaId)
check('Die Abrechnung rechnet mit Steuerklasse III', abrechnung?.taxClass === 3)
check('Die Lohnsteuer ist dadurch deutlich niedriger',
  abrechnung?.lohnsteuer > 0 && abrechnung.lohnsteuer < 200,
  `${abrechnung?.lohnsteuer} EUR (vorher rund 388 EUR in Klasse I)`)

// ── Abschottung ────────────────────────────────────────────────────────────
console.log('\n=== Abschottung ===')
const fremd = await sende(kita, '/api/payroll/elstam', 'POST', { inhalt: liste })
const fremdTrifft = (fremd.body.abgleich ?? []).some(a => a.employeeId === annaId)
check('Eine fremde Leitung findet Anna in ihrer Liste NICHT', !fremdTrifft,
  `HTTP ${fremd.status}`)

const fremdSchreibt = await sende(kita, '/api/payroll/elstam?uebernehmen=1', 'POST',
  { inhalt: liste, uebernehmenFuer: [annaId] })
const unveraendert = (await hole(gf, `/api/employees/${annaId}/payroll-profile`)).body.profil
check('Und kann ihr Profil auch nicht über die Datei ändern',
  unveraendert.steuerklasse === 3, `HTTP ${fremdSchreibt.status}, Steuerklasse ${unveraendert.steuerklasse}`)

const mitarbeiter = await sende(anna, '/api/payroll/elstam', 'POST', { inhalt: liste })
check('Ein Mitarbeiter kommt gar nicht an den Import', mitarbeiter.status === 403,
  `HTTP ${mitarbeiter.status}`)

process.exit(bilanz() ? 1 : 0)
