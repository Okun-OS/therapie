// Nachweis D16: Kein Lohn ohne freigegebenen Monat.
//
// Das ist der Preis für den Vorteil. Weil Zeiterfassung und Lohnabrechnung
// zusammenhängen, muss niemand mehr "fünf Stunden nachts, zehn am Sonntag"
// eintippen — das System rechnet die Zuschläge selbst aus der gestempelten
// Zeit. Genau deshalb darf nicht abgerechnet werden, solange die Zeiten noch
// wackeln: Eine Schicht, die abends nachgetragen wird, wäre sonst ein Zuschlag,
// der NACH der Abrechnung entsteht.
//
// Geprüft wird beides: dass aufgehalten wird, wer aufgehalten gehört — und dass
// durchgelassen wird, wer nichts freizugeben hat.

import { BASIS, pruefer, login, hole, sende, testMail, lohnPerson, monatFreigeben } from './helfer.mjs'

const { check, bilanz } = pruefer()

const gf = await login('gf@rheinblick-reha.de')
const leitung = await login('leitung@rheinblick-reha.de')
const mLeitung = (await hole(leitung, '/api/auth/me')).body.user
const locationId = mLeitung.locationId

const jetzt = new Date()
const jahr = jetzt.getFullYear(), monat = jetzt.getMonth() + 1
const mm = String(monat).padStart(2, '0')
console.log(`Abrechnungszeitraum ${mm}.${jahr}\n`)

const NAME = 'Freigabe Nachweis'
const personId = await lohnPerson(gf, locationId, NAME)

async function stammdaten(zusatz) {
  return sende(gf, `/api/employees/${personId}/payroll-profile`, 'PUT', {
    personalnummer: '9016', steuerId: '20000000016', eintrittsdatum: '2024-03-01',
    steuerklasse: 1, kinderfreibetraege: 0, konfession: 'keine',
    bundesland: 'Nordrhein-Westfalen', versicherungsart: 'GKV', zusatzbeitrag: 1.7,
    elstamStand: `${jahr}-${mm}-01`,
    lohnart: 'monat', monatsgehalt: 3400,
    ...zusatz,
  })
}

async function lauf() {
  const e = (await hole(gf, `/api/payroll?year=${jahr}&month=${monat}`))
    .body.entries?.find(x => x.employeeId === personId)
  if (e && e.status !== 'draft') {
    await sende(gf, '/api/payroll', 'PATCH', { id: e.id, status: 'draft' })
  }
  const r = await sende(gf, '/api/payroll/vorbereiten', 'POST', { year: jahr, month: monat })
  const eintrag = (await hole(gf, `/api/payroll?year=${jahr}&month=${monat}`))
    .body.entries?.find(x => x.employeeId === personId)
  return { lauf: r.body, eintrag }
}

// ── D16 Ohne Zeitbezug ─────────────────────────────────────────────────────
console.log('=== Festes Gehalt ohne erfasste Zeiten ===')

await stammdaten({})
const ohneZeiten = await lauf()
check('Wer nichts erfasst hat, wird abgerechnet',
  !!ohneZeiten.eintrag && ohneZeiten.eintrag.brutto === 3400,
  `${ohneZeiten.eintrag?.brutto} EUR`)
check('Und steht nicht in der Liste der Aufgehaltenen',
  !(ohneZeiten.lauf.ohneFreigabe ?? []).some(x => x.name === NAME),
  (ohneZeiten.lauf.ohneFreigabe ?? []).map(x => x.name).join(', '))

// ── D16 Mit erfassten Zeiten ───────────────────────────────────────────────
console.log('\n=== Sobald Zeiten erfasst sind ===')

// Eine Schicht stempeln — ab jetzt entstehen aus der Zeit Zuschläge, und die
// sind Geld.
const tag = `${jahr}-${mm}-05`
const gestempelt = await sende(gf, '/api/time-logs/backfill', 'POST', {
  employeeId: personId, locationId, date: tag,
  clockIn: '22:00', clockOut: '06:00', breakMinutes: 30,
  createdBy: 'Prüfung',
})
check('Eine Nachtschicht lässt sich erfassen', gestempelt.status === 200,
  gestempelt.body.error)

const mitZeiten = await lauf()
check('Mit erfassten Zeiten wird aufgehalten',
  (mitZeiten.lauf.ohneFreigabe ?? []).some(x => x.name === NAME),
  mitZeiten.lauf.hinweis)
// Eine schon vorhandene Abrechnung bleibt stehen, wird aber NICHT
// fortgeschrieben: Die neuen Zuschläge fließen nicht ein, solange der Monat
// offen ist. Genau darum geht es — nicht darum, Vorhandenes wegzuräumen.
check('Die Zuschläge fließen nicht ein',
  (mitZeiten.eintrag?.surchargesTotal ?? 0) === 0,
  `${mitZeiten.eintrag?.surchargesTotal} EUR`)
check('Und das Brutto bleibt das reine Gehalt',
  (mitZeiten.eintrag?.brutto ?? 0) === 3400, `${mitZeiten.eintrag?.brutto} EUR`)

const grund = (mitZeiten.lauf.ohneFreigabe ?? []).find(x => x.name === NAME)
check('Der Grund wird benannt', grund?.grund === 'kein_abschluss', grund?.grund)
check('Und im Klartext erklärt',
  /Standortleitung/.test(grund?.text ?? ''), grund?.text)
check('Die Meldung des Laufs nennt es zuerst',
  /ohne freigegebenen Monatsabschluss/.test(mitZeiten.lauf.hinweis ?? ''),
  mitZeiten.lauf.hinweis)

// ── D16 Abschluss angelegt, aber nicht freigegeben ─────────────────────────
console.log('\n=== Abschluss angelegt, aber offen ===')

const angelegt = await sende(gf, '/api/monthly-closings/get-or-create', 'POST', {
  employeeId: personId, year: jahr, month: monat,
  employeeInfo: { employeeName: NAME, locationId },
})
check('Der Monatsabschluss lässt sich anlegen', angelegt.status === 200,
  angelegt.body.error)

const nurAngelegt = await lauf()
const grund2 = (nurAngelegt.lauf.ohneFreigabe ?? []).find(x => x.name === NAME)
check('Ein offener Abschluss reicht nicht', !!grund2, 'wird weiterhin aufgehalten')
check('Und der Unterschied wird benannt', grund2?.grund === 'nicht_freigegeben',
  grund2?.grund)
check('„Geprüft" ist nicht „freigegeben"',
  /nicht freigegeben/.test(grund2?.text ?? ''), grund2?.text)

// ── D16 Nach der Freigabe ──────────────────────────────────────────────────
console.log('\n=== Nach der Freigabe durch die Standortleitung ===')

const frei = await monatFreigeben(leitung, personId, jahr, monat, NAME)
check('Die Standortleitung gibt den Monat frei', frei.ok, `HTTP ${frei.status}`)

const nachFreigabe = await lauf()
check('Jetzt wird abgerechnet', !!nachFreigabe.eintrag,
  `${nachFreigabe.eintrag?.brutto} EUR`)
check('Und niemand mehr aufgehalten',
  !(nachFreigabe.lauf.ohneFreigabe ?? []).some(x => x.name === NAME))

// Der eigentliche Gewinn: die Zuschläge kommen aus der gestempelten Zeit,
// niemand hat sie eingetippt.
check('Die Zuschläge stehen in der Abrechnung',
  (nachFreigabe.eintrag?.surchargesTotal ?? 0) > 0,
  `${nachFreigabe.eintrag?.surchargesTotal} EUR aus der Zeiterfassung`)
check('Das Grundgehalt bleibt davon unberührt',
  Math.abs((nachFreigabe.eintrag?.brutto ?? 0)
    - 3400 - (nachFreigabe.eintrag?.surchargesTotal ?? 0)) < 0.02,
  `${nachFreigabe.eintrag?.brutto} = 3400 + ${nachFreigabe.eintrag?.surchargesTotal}`)

// ── D16 Die Monatsgrenze ───────────────────────────────────────────────────
console.log('\n=== Monat und Monat bleiben getrennt ===')

// Eine Schicht im Vormonat darf diesen Monat nicht berühren.
const vor = monat === 1 ? { j: jahr - 1, m: 12 } : { j: jahr, m: monat - 1 }
const vorMm = String(vor.m).padStart(2, '0')
await sende(gf, '/api/time-logs/backfill', 'POST', {
  employeeId: personId, locationId, date: `${vor.j}-${vorMm}-10`,
  clockIn: '22:00', clockOut: '06:00', breakMinutes: 30,
  createdBy: 'Prüfung',
})

const zuschlaegeVorher = nachFreigabe.eintrag?.surchargesTotal ?? 0
const nachVormonat = await lauf()
check('Eine Schicht im Vormonat ändert diesen Monat nicht',
  Math.abs((nachVormonat.eintrag?.surchargesTotal ?? 0) - zuschlaegeVorher) < 0.02,
  `${zuschlaegeVorher} → ${nachVormonat.eintrag?.surchargesTotal}`)

// Der schärfste Fall: eine Nachtschicht, die am LETZTEN Tag des Vormonats
// beginnt und erst im neuen Monat endet. Sie gehört zu dem Tag, an dem sie
// begonnen hat — sonst wanderten Zuschläge stillschweigend über die
// Monatsgrenze, und der freigegebene Vormonat würde nachträglich teurer.
const letzterVortag = new Date(Date.UTC(vor.j, vor.m, 0)).getUTCDate()
await sende(gf, '/api/time-logs/backfill', 'POST', {
  employeeId: personId, locationId, date: `${vor.j}-${vorMm}-${letzterVortag}`,
  clockIn: '22:00', clockOut: '06:00', breakMinutes: 30,
  createdBy: 'Prüfung',
})
const ueberDieGrenze = await lauf()
check('Eine Nachtschicht über den Monatswechsel bleibt im alten Monat',
  Math.abs((ueberDieGrenze.eintrag?.surchargesTotal ?? 0) - zuschlaegeVorher) < 0.02,
  `${zuschlaegeVorher} → ${ueberDieGrenze.eintrag?.surchargesTotal}`)

// ── D16 Wer freigeben darf ─────────────────────────────────────────────────
console.log('\n=== Wer freigeben darf ===')

const kitaLeitung = await login('leitung@kita-sonnenschein.de')
const fremd = await monatFreigeben(kitaLeitung, personId, jahr, monat, NAME)
check('Eine fremde Leitung gibt den Monat nicht frei', !fremd.ok,
  `HTTP ${fremd.status}`)

const mitarbeiter = await login('anna.fischer@rheinblick-reha.de')
const durchMitarbeiter = await sende(mitarbeiter, '/api/monthly-closings/get-or-create', 'POST', {
  employeeId: personId, year: jahr, month: monat,
})
check('Und ein Kollege auch nicht', durchMitarbeiter.status === 403,
  `HTTP ${durchMitarbeiter.status}`)

process.exit(bilanz() > 0 ? 1 : 0)
