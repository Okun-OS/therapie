// Nachweis I2: Betriebliches Eingliederungsmanagement (§167 Abs. 2 SGB IX).
//
// Wer innerhalb eines Jahres länger als sechs Wochen arbeitsunfähig war, dem
// MUSS ein BEM angeboten werden. Ohne dokumentiertes Angebot ist eine spätere
// krankheitsbedingte Kündigung praktisch nicht haltbar.
//
// Die Rechenwege stehen in src/lib/__tests__/bem.test.ts. Hier geht es um das,
// was daran gefährlich ist: Es sind GESUNDHEITSDATEN nach Art. 9 DSGVO. Wer
// sie sehen darf, ist keine Bequemlichkeitsfrage — und deshalb wird hier vor
// allem geprüft, wer sie NICHT sieht.

import { pruefer, login, hole, sende, lohnPerson } from './helfer.mjs'

const { check, bilanz } = pruefer()

const gf = await login('gf@rheinblick-reha.de')
const leitung = await login('leitung@rheinblick-reha.de')
const anna = await login('anna.fischer@rheinblick-reha.de')
// Zum Aufräumen: Mitarbeiter löschen darf nur die Plattform.
const okun = await login('okun@okun.de')

const mAnna = (await hole(anna, '/api/auth/me')).body.user

// §147 Eine EIGENE Person für diesen Nachweis.
//
// Die erste Fassung rechnete mit den Fehlzeiten einer Person aus den
// Testdaten — und fiel im Gesamtlauf um, weil andere Nachweise deren
// Fehlzeiten anlegen und wieder löschen. Eine Prüfung, die an fremdem Zustand
// hängt, prüft nicht das, was sie behauptet (pruefungen/README.md, Regel 1).
//
// Mit einer frischen Person ohne Vorgeschichte ist die Rechnung eindeutig: Was
// hier an Tagen herauskommt, hat dieser Nachweis selbst angelegt.
const personId = await lohnPerson(gf, mAnna.locationId, 'BEM Nachweis')
const person = { employeeId: personId, name: 'BEM Nachweis', locationId: mAnna.locationId }

const tage = n => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)

// ── I2 Wer hereinkommt ─────────────────────────────────────────────────────
console.log('=== I2 Wer BEM sehen darf ===')

const alsMitarbeiter = await hole(anna, '/api/bem')
check('Ein Mitarbeiter kommt gar nicht herein', alsMitarbeiter.status === 403,
  `HTTP ${alsMitarbeiter.status}`)

// Ausgangszustand: Die Freigabe für die Leitung steht aus.
await sende(gf, '/api/org-settings', 'PATCH', { bemSichtbarLeitung: false })
  .catch(() => undefined)

const leitungOhneFreigabe = await hole(leitung, '/api/bem')
check('Die Standortleitung standardmäßig auch nicht',
  leitungOhneFreigabe.status === 403, `HTTP ${leitungOhneFreigabe.status}`)
check('Und es wird gesagt, warum und wer es freischalten kann',
  /Gesundheitsdaten/i.test(leitungOhneFreigabe.body.error ?? ''),
  leitungOhneFreigabe.body.error)

const beiGf = await hole(gf, '/api/bem')
check('Die Unternehmensebene kommt herein', beiGf.status === 200,
  `${(beiGf.body.eintraege ?? []).length} Einträge`)

// ── I2 Die Schwelle ────────────────────────────────────────────────────────
console.log('\n=== I2 Die Schwelle aus echten Fehlzeiten ===')

// 30 Tage krank — unter der Schwelle von 42.
const erste = await sende(gf, '/api/absences', 'POST', {
  employeeId: person.employeeId, employeeName: person.name,
  locationId: person.locationId, type: 'krankheit',
  startDate: tage(200), endDate: tage(171), days: 30,
  note: 'I2-Nachweis',
})
check('Die erste Fehlzeit wird angenommen', erste.status === 200, erste.body.error)

const nachErster = ((await hole(gf, '/api/bem')).body.eintraege ?? [])
  .find(e => e.employeeId === person.employeeId)
check('Bei 30 Tagen steht noch niemand auf der Liste', !nachErster,
  nachErster?.standText)

// Weitere 20 Tage — zusammen 50, also über der Schwelle. „Wiederholt" zählt.
const zweite = await sende(gf, '/api/absences', 'POST', {
  employeeId: person.employeeId, employeeName: person.name,
  locationId: person.locationId, type: 'krankheit',
  startDate: tage(100), endDate: tage(81), days: 20,
  note: 'I2-Nachweis',
})
check('Die zweite Fehlzeit wird angenommen', zweite.status === 200)

const nachZweiter = ((await hole(gf, '/api/bem')).body.eintraege ?? [])
  .find(e => e.employeeId === person.employeeId)
check('Getrennte Zeiträume zählen zusammen — „ununterbrochen ODER wiederholt"',
  !!nachZweiter, nachZweiter?.standText)
check('Und der Stand ist „Angebot fällig"', nachZweiter?.stand === 'faellig',
  nachZweiter?.stand)
check('Die Tage stimmen', nachZweiter?.tage === 50, `${nachZweiter?.tage} Tage`)
check('Der nächste Schritt nennt die Vorschrift',
  /167/.test(nachZweiter?.naechsterSchritt ?? ''), nachZweiter?.naechsterSchritt)

// Urlaub zählt nicht mit.
const urlaub = await sende(gf, '/api/absences', 'POST', {
  employeeId: person.employeeId, employeeName: person.name,
  locationId: person.locationId, type: 'urlaub',
  startDate: tage(60), endDate: tage(41), days: 20,
  note: 'I2-Nachweis',
})
const nachUrlaub = ((await hole(gf, '/api/bem')).body.eintraege ?? [])
  .find(e => e.employeeId === person.employeeId)
check('Urlaub zählt nicht auf die Schwelle ein', nachUrlaub?.tage === 50,
  `${nachUrlaub?.tage} Tage`)

// ── I2 Der Vorgang ─────────────────────────────────────────────────────────
console.log('\n=== I2 Angebot, Antwort, Abschluss ===')

const angeboten = await sende(gf, '/api/bem', 'POST',
  { employeeId: person.employeeId, tage: 50 })
check('Das Angebot lässt sich festhalten', angeboten.status === 200,
  angeboten.body.error)
check('Mit Namen dessen, der es gemacht hat',
  !!angeboten.body.vorgang?.angebotenVon, angeboten.body.vorgang?.angebotenVon)

const vorgangId = angeboten.body.vorgang.id

const nochmalAngeboten = await sende(gf, '/api/bem', 'POST',
  { employeeId: person.employeeId, tage: 50 })
check('Ein zweiter Vorgang daneben entsteht nicht',
  nochmalAngeboten.status === 409, `HTTP ${nochmalAngeboten.status}`)

const nachAngebot = ((await hole(gf, '/api/bem')).body.eintraege ?? [])
  .find(e => e.employeeId === person.employeeId)
check('Danach steht „Antwort offen"', nachAngebot?.stand === 'angeboten',
  nachAngebot?.stand)

const ohneErgebnis = await sende(gf, '/api/bem', 'PATCH',
  { id: vorgangId, abschliessen: true })
check('Ein Abschluss ohne Ergebnis geht nicht', ohneErgebnis.status === 400,
  ohneErgebnis.body.error)
check('Und es wird gesagt, warum',
  /nur abgehakt|nicht durchgeführt/i.test(ohneErgebnis.body.error ?? ''),
  ohneErgebnis.body.error)

const zugestimmt = await sende(gf, '/api/bem', 'PATCH',
  { id: vorgangId, antwort: 'zugestimmt' })
check('Eine Zustimmung lässt sich festhalten', zugestimmt.status === 200)

const nachZustimmung = ((await hole(gf, '/api/bem')).body.eintraege ?? [])
  .find(e => e.employeeId === person.employeeId)
check('Das Verfahren läuft', nachZustimmung?.stand === 'laeuft', nachZustimmung?.stand)

const unsinn = await sende(gf, '/api/bem', 'PATCH',
  { id: vorgangId, antwort: 'vielleicht' })
check('Eine erfundene Antwort wird abgelehnt', unsinn.status === 400)

const abgeschlossen = await sende(gf, '/api/bem', 'PATCH', {
  id: vorgangId, ergebnis: 'I2-Nachweis: Stufenweise Wiedereingliederung vereinbart.',
  abschliessen: true,
})
check('Mit Ergebnis lässt sich abschließen', abgeschlossen.status === 200)

const nachAbschluss = ((await hole(gf, '/api/bem')).body.eintraege ?? [])
  .find(e => e.employeeId === person.employeeId)
check('Danach steht der Vorgang auf abgeschlossen',
  nachAbschluss?.stand === 'abgeschlossen', nachAbschluss?.stand)
check('Und die Tage lösen nicht sofort wieder aus — gezählt wird ab dem Abschluss',
  nachAbschluss?.stand !== 'faellig')

const nachtraeglich = await sende(gf, '/api/bem', 'PATCH',
  { id: vorgangId, antwort: 'abgelehnt' })
check('Ein abgeschlossenes Verfahren wird nicht umgeschrieben',
  nachtraeglich.status === 409, `HTTP ${nachtraeglich.status}`)

// ── I2 Freigabe für die Standortleitung ────────────────────────────────────
console.log('\n=== I2 Freigabe für die Leitung ===')

const freigeschaltet = await sende(gf, '/api/org-settings', 'PATCH',
  { bemSichtbarLeitung: true })
if (freigeschaltet.status === 200) {
  const leitungMitFreigabe = await hole(leitung, '/api/bem')
  check('Nach der Freischaltung kommt die Leitung herein',
    leitungMitFreigabe.status === 200, `HTTP ${leitungMitFreigabe.status}`)
  check('Sie sieht aber nur ihren eigenen Standort',
    (leitungMitFreigabe.body.eintraege ?? [])
      .every(e => e.locationId === person.locationId || e.locationId === null),
    `${(leitungMitFreigabe.body.eintraege ?? []).length} Einträge`)

  // Zurückstellen: Der Standard ist AUS, und so soll der Nachweis ihn lassen.
  await sende(gf, '/api/org-settings', 'PATCH', { bemSichtbarLeitung: false })
  check('Und danach ist wieder zu',
    (await hole(leitung, '/api/bem')).status === 403)
} else {
  check('Die Freischaltung ist über die Einstellungen erreichbar', false,
    `HTTP ${freigeschaltet.status} — /api/org-settings nimmt bemSichtbarLeitung nicht an`)
}

const selbstFreigeschaltet = await sende(leitung, '/api/org-settings', 'PATCH',
  { bemSichtbarLeitung: true })
check('Die Standortleitung kann sich die Freigabe nicht selbst erteilen',
  selbstFreigeschaltet.status === 403, `HTTP ${selbstFreigeschaltet.status}`)
check('Und danach ist sie immer noch draußen',
  (await hole(leitung, '/api/bem')).status === 403)

// Aufräumen: Die Testfehlzeiten wieder entfernen, sonst verschieben sie die
// Abwesenheits- und Lohnnachweise beim nächsten Lauf.
const meine = ((await hole(gf, '/api/absences')).body.absences ?? [])
  .filter(a => a.note === 'I2-Nachweis')
for (const a of meine) {
  await sende(gf, `/api/absences/${a.id}`, 'DELETE')
}
check('Der Nachweis lässt keine Testfehlzeiten zurück',
  ((await hole(gf, '/api/absences')).body.absences ?? [])
    .filter(a => a.note === 'I2-Nachweis').length === 0)

// Und die Testperson selbst. Beim ersten Lauf blieb sie stehen — und weil sie
// „BEM Nachweis" hieß, stand sie alphabetisch vorn und wurde vom Lohnnachweis
// d12 als Testperson gegriffen, der daraufhin umfiel. Wer jemanden anlegt,
// räumt ihn auch weg.
const reste = ((await hole(gf, '/api/employees')).body.employees ?? [])
  .filter(e => e.name === 'BEM Nachweis')
for (const e of reste) {
  await sende(okun, `/api/employees/${e.id}`, 'DELETE')
}
check('Und keine Testperson',
  ((await hole(gf, '/api/employees')).body.employees ?? [])
    .filter(e => e.name === 'BEM Nachweis').length === 0)

process.exit(bilanz() > 0 ? 1 : 0)
