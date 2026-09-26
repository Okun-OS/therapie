// Nachweis C6: Krankenschein und Fehlzeit sind verbunden.
//
// Bisher lagen beide nebeneinander und wussten nichts voneinander: die
// Bescheinigung als Datei in der Personalakte, die Fehlzeit im Kalender. Wer
// wissen wollte, ob für die Krankheit vom 2. bis 20. März ein Nachweis
// vorliegt, musste zwei Listen von Hand vergleichen.
//
// Der teuerste Fall ist nicht die fehlende Bescheinigung, sondern die
// unvollständige: drei Wochen krank, eine Bescheinigung über eine Woche — und
// das Kennzeichen sagt trotzdem "Nachweis vorhanden".

import { BASIS, pruefer, login, hole, sende, testMail } from './helfer.mjs'

const { check, bilanz } = pruefer()

const gf = await login('gf@rheinblick-reha.de')
const leitung = await login('leitung@rheinblick-reha.de')
const anna = await login('anna.fischer@rheinblick-reha.de')
const kitaLeitung = await login('leitung@kita-sonnenschein.de')

const locationId = (await hole(leitung, '/api/auth/me')).body.user.locationId
const mAnna = (await hole(anna, '/api/auth/me')).body.user

/** Eine Datei einreichen — wie der Browser es tut. */
async function einreichen(cookie, { ownerId, kategorie = 'krankenschein', von, bis, absenceId }) {
  const form = new FormData()
  form.append('datei', new Blob([`AU-Bescheinigung ${von ?? ''}`], { type: 'application/pdf' }),
    'au-bescheinigung.pdf')
  form.append('ownerType', 'employee')
  form.append('ownerId', ownerId)
  form.append('kategorie', kategorie)
  if (von) form.append('gueltigVon', von)
  if (bis) form.append('gueltigBis', bis)
  if (absenceId) form.append('absenceId', absenceId)
  const r = await fetch(`${BASIS}/api/files`, { method: 'POST', headers: { cookie }, body: form })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

const wegwerfen = async (cookie, id) =>
  (await fetch(`${BASIS}/api/files/${id}`, { method: 'DELETE', headers: { cookie } })).status

// Eine eigene Person, damit die Prüfung niemandem sonst in die Quere kommt.
const person = (await sende(gf, '/api/employees', 'POST', {
  name: 'Krankenschein Nachweis', email: testMail('krank'), position: 'Pflegefachkraft',
  weeklyHours: 30, workDaysPerWeek: 4, locationId,
})).body.employee
const personId = person?.id
if (!personId) {
  console.log('  ✗ FAIL  Testperson konnte nicht angelegt werden')
  console.log('\n0/1 Checks bestanden')
  process.exit(1)
}
console.log(`Testperson ${personId.slice(0, 8)} · Standort ${locationId.slice(0, 8)}\n`)

// ── C6 Wann überhaupt eine Bescheinigung verlangt wird ─────────────────────
console.log('=== C6 Wann eine Bescheinigung verlangt wird ===')

const kurzKrank = (await sende(leitung, '/api/absences', 'POST', {
  employeeId: personId, employeeName: person.name, locationId,
  type: 'krankheit', startDate: '2029-03-02', endDate: '2029-03-04', days: 3,
})).body.absence

const lageKurz = (await hole(leitung, `/api/absences/${kurzKrank.id}/nachweise`)).body
check('Drei Tage Krankheit brauchen keine Bescheinigung',
  lageKurz.lage?.pflicht?.pflichtig === false && lageKurz.lage?.deckung === 'nicht_noetig',
  lageKurz.lage?.text)

const langKrank = (await sende(leitung, '/api/absences', 'POST', {
  employeeId: personId, employeeName: person.name, locationId,
  type: 'krankheit', startDate: '2029-04-02', endDate: '2029-04-20', days: 19,
})).body.absence

const lageLang = (await hole(leitung, `/api/absences/${langKrank.id}/nachweise`)).body
check('Ab dem vierten Kalendertag wird sie verlangt',
  lageLang.lage?.pflicht?.pflichtig === true)
check('Und zwar bis zum vierten Tag',
  lageLang.lage?.pflicht?.spaetestensAm === '2029-04-05',
  lageLang.lage?.pflicht?.spaetestensAm)
check('Die Vorschrift steht dabei', /EntgFG/.test(lageLang.lage?.pflicht?.begruendung ?? ''))
check('Ohne Bescheinigung sagt die Lage das deutlich',
  lageLang.lage?.deckung === 'keine', lageLang.lage?.text)

// Das Wochenende zählt mit — Kalendertage, nicht Arbeitstage.
const ueberWochenende = (await sende(leitung, '/api/absences', 'POST', {
  employeeId: personId, employeeName: person.name, locationId,
  // Freitag bis Montag 2029: vier Kalendertage, zwei Arbeitstage
  type: 'krankheit', startDate: '2029-05-04', endDate: '2029-05-07', days: 2,
})).body.absence
const lageWE = (await hole(leitung, `/api/absences/${ueberWochenende.id}/nachweise`)).body
check('Freitag bis Montag ist der vierte Kalendertag — auch bei zwei Arbeitstagen',
  lageWE.lage?.pflicht?.pflichtig === true, lageWE.lage?.pflicht?.begruendung)

// ── C6 Zuordnen beim Einreichen ────────────────────────────────────────────
console.log('\n=== C6 Zuordnen beim Einreichen ===')

const erste = await einreichen(leitung, {
  ownerId: personId, von: '2029-04-02', bis: '2029-04-10',
})
check('Die Bescheinigung wird angenommen', erste.status === 201, erste.body.error)
check('Sie wird der passenden Fehlzeit von selbst zugeordnet',
  erste.body.zuordnung?.zugeordnet === langKrank.id,
  `${erste.body.zuordnung?.zugeordnet?.slice(0, 8)} statt ${langKrank.id.slice(0, 8)}`)

const nachErster = (await hole(leitung, `/api/absences/${langKrank.id}/nachweise`)).body
check('Sie erscheint an der Fehlzeit', (nachErster.nachweise ?? []).length === 1)
check('Die Fehlzeit gilt jetzt als belegt',
  nachErster.abwesenheit?.proofProvided === true)

// Der entscheidende Punkt: eine Woche Bescheinigung deckt keine drei Wochen.
check('Aber sie deckt nicht den ganzen Zeitraum',
  nachErster.lage?.deckung === 'teilweise', nachErster.lage?.deckung)
check('Die fehlende Zeit wird benannt',
  nachErster.lage?.luecken?.[0]?.von === '2029-04-11'
  && nachErster.lage?.luecken?.[0]?.bis === '2029-04-20',
  JSON.stringify(nachErster.lage?.luecken))
check('Und im Klartext erklärt',
  /Folgebescheinigung/.test(nachErster.lage?.text ?? ''), nachErster.lage?.text)

const zweite = await einreichen(leitung, {
  ownerId: personId, von: '2029-04-11', bis: '2029-04-20',
})
const nachZweiter = (await hole(leitung, `/api/absences/${langKrank.id}/nachweise`)).body
check('Die Folgebescheinigung schließt die Lücke',
  nachZweiter.lage?.deckung === 'vollstaendig', nachZweiter.lage?.text)
check('Beide Bescheinigungen hängen an der Fehlzeit',
  (nachZweiter.nachweise ?? []).length === 2)

// ── C6 Was passiert, wenn es nicht eindeutig ist ───────────────────────────
console.log('\n=== C6 Wenn es nicht eindeutig ist ===')

// Zwei Fehlzeiten, die sich mit demselben Zeitraum ueberschneiden.
const doppelA = (await sende(leitung, '/api/absences', 'POST', {
  employeeId: personId, employeeName: person.name, locationId,
  type: 'krankheit', startDate: '2029-06-01', endDate: '2029-06-10', days: 10,
})).body.absence
const doppelB = (await sende(leitung, '/api/absences', 'POST', {
  employeeId: personId, employeeName: person.name, locationId,
  type: 'krankheit', startDate: '2029-06-08', endDate: '2029-06-20', days: 13,
})).body.absence

const unklar = await einreichen(leitung, {
  ownerId: personId, von: '2029-06-08', bis: '2029-06-12',
})
check('Bei zwei passenden Fehlzeiten wird nicht geraten',
  unklar.body.zuordnung?.zugeordnet === null,
  `${unklar.body.zuordnung?.zugeordnet}`)
check('Stattdessen werden beide zur Auswahl gestellt',
  (unklar.body.zuordnung?.vorschlaege ?? []).length === 2,
  `${unklar.body.zuordnung?.vorschlaege?.length} Vorschläge`)

const vonHand = await sende(leitung, `/api/files/${unklar.body.datei.id}`, 'PATCH', {
  absenceId: doppelB.id,
})
check('Von Hand lässt sie sich zuordnen', vonHand.status === 200, vonHand.body.error)
check('Danach hängt sie an der richtigen Fehlzeit',
  ((await hole(leitung, `/api/absences/${doppelB.id}/nachweise`)).body.nachweise ?? []).length === 1)
check('Und nicht an der anderen',
  ((await hole(leitung, `/api/absences/${doppelA.id}/nachweise`)).body.nachweise ?? []).length === 0)

// Ohne Zeitraum kann gar nicht zugeordnet werden — und die Datei deckt nichts.
const ohneZeitraum = await einreichen(leitung, { ownerId: personId })
check('Ohne Gültigkeitszeitraum wird nicht zugeordnet',
  ohneZeitraum.body.zuordnung?.zugeordnet === null)

await sende(leitung, `/api/files/${ohneZeitraum.body.datei.id}`, 'PATCH', { absenceId: doppelA.id })
const mitBlinder = (await hole(leitung, `/api/absences/${doppelA.id}/nachweise`)).body
check('Eine Datei ohne Zeitraum deckt nichts ab',
  mitBlinder.lage?.deckung === 'teilweise' && mitBlinder.lage?.ohneZeitraum === 1,
  mitBlinder.lage?.text)
check('Darauf wird ausdrücklich hingewiesen',
  /keinen Gültigkeitszeitraum/.test(mitBlinder.lage?.text ?? ''))

// ── C6 Löschen zieht das Kennzeichen nach ──────────────────────────────────
console.log('\n=== C6 Löschen zieht nach ===')

check('Eine Bescheinigung lässt sich entfernen',
  await wegwerfen(leitung, zweite.body.datei.id) === 200)
const nachLoeschen = (await hole(leitung, `/api/absences/${langKrank.id}/nachweise`)).body
check('Die Lücke ist wieder da', nachLoeschen.lage?.deckung === 'teilweise')
check('Die Fehlzeit gilt weiter als belegt — es liegt ja noch eine vor',
  nachLoeschen.abwesenheit?.proofProvided === true)

check('Auch die letzte lässt sich entfernen',
  await wegwerfen(leitung, erste.body.datei.id) === 200)
const ganzLeer = (await hole(leitung, `/api/absences/${langKrank.id}/nachweise`)).body
check('Danach gilt die Fehlzeit wieder als unbelegt',
  ganzLeer.abwesenheit?.proofProvided === false,
  `proofProvided=${ganzLeer.abwesenheit?.proofProvided}`)
check('Und die Lage sagt: keine Bescheinigung', ganzLeer.lage?.deckung === 'keine')

// ── C6 In der Liste sichtbar ───────────────────────────────────────────────
console.log('\n=== C6 In der Liste sichtbar ===')

const liste = (await hole(leitung, `/api/absences?locationId=${locationId}`)).body.absences ?? []
const inListe = liste.find(a => a.id === doppelB.id)
check('Jede Fehlzeit der Liste trägt ihre Nachweislage', !!inListe?.nachweisLage,
  `${liste.length} Fehlzeiten`)
check('Die unbelegte fällt darin auf',
  liste.find(a => a.id === langKrank.id)?.nachweisLage?.deckung === 'keine')

// ── C6 Der Mitarbeiter selbst ──────────────────────────────────────────────
console.log('\n=== C6 Der Mitarbeiter selbst ===')

// §123 Anna ist eine Person aus den Testdaten, kein Wegwerf-Datensatz. Reste
// aus früheren Läufen werden deshalb zuerst entfernt — sonst gäbe es beim
// zweiten Durchlauf zwei gleiche Fehlzeiten, und die Zuordnung wäre zu Recht
// nicht mehr eindeutig. Eine Prüfung, die nur beim ersten Mal besteht, ist kein
// Sicherheitsnetz.
const annasFehlzeiten = (await hole(anna, `/api/absences?employeeId=${mAnna.employeeId}`))
  .body.absences ?? []
for (const alt of annasFehlzeiten.filter(a => a.startDate === '2029-09-03')) {
  await fetch(`${BASIS}/api/absences/${alt.id}`, { method: 'DELETE', headers: { cookie: leitung } })
}

const eigene = (await sende(leitung, '/api/absences', 'POST', {
  employeeId: mAnna.employeeId, employeeName: mAnna.name, locationId,
  type: 'krankheit', startDate: '2029-09-03', endDate: '2029-09-14', days: 12,
})).body.absence

const selbstEingereicht = await einreichen(anna, {
  ownerId: mAnna.employeeId, von: '2029-09-03', bis: '2029-09-14',
})
check('Ein Mitarbeiter reicht seine eigene Bescheinigung ein',
  selbstEingereicht.status === 201, selbstEingereicht.body.error)
check('Sie wird seiner Fehlzeit zugeordnet',
  selbstEingereicht.body.zuordnung?.zugeordnet === eigene.id)

const eigeneLage = await hole(anna, `/api/absences/${eigene.id}/nachweise`)
check('Er sieht selbst, ob seine Fehlzeit gedeckt ist',
  eigeneLage.status === 200 && eigeneLage.body.lage?.deckung === 'vollstaendig')

const loesen = await sende(anna, `/api/files/${selbstEingereicht.body.datei.id}`, 'PATCH', {
  absenceId: null,
})
check('Er darf die Zuordnung auch selbst ändern', loesen.status === 200, loesen.body.error)

const unerlaubt = await sende(anna, `/api/files/${selbstEingereicht.body.datei.id}`, 'PATCH', {
  sichtbarFuerMitarbeiter: false,
})
check('Sonst darf er an der Akte nichts ändern', unerlaubt.status === 403,
  `HTTP ${unerlaubt.status}`)

// ── C6 Grenzen ─────────────────────────────────────────────────────────────
console.log('\n=== C6 Grenzen ===')

const fremdeFehlzeit = await sende(anna, `/api/files/${selbstEingereicht.body.datei.id}`, 'PATCH', {
  absenceId: langKrank.id,
})
check('Eine Bescheinigung lässt sich nicht an eine fremde Krankheit hängen',
  fremdeFehlzeit.status === 400, `HTTP ${fremdeFehlzeit.status}`)

const fremdeLage = await hole(kitaLeitung, `/api/absences/${langKrank.id}/nachweise`)
check('Eine fremde Leitung sieht die Nachweise nicht', fremdeLage.status >= 400,
  `HTTP ${fremdeLage.status}`)

const fremderUpload = await einreichen(anna, {
  ownerId: personId, von: '2029-04-02', bis: '2029-04-10',
})
check('Und reicht auch nichts für andere ein', fremderUpload.status === 403,
  `HTTP ${fremderUpload.status}`)

const erfundeneFehlzeit = await einreichen(leitung, {
  ownerId: personId, von: '2029-04-02', bis: '2029-04-10', absenceId: eigene.id,
})
check('Eine angegebene Fehlzeit muss zur Person gehören',
  erfundeneFehlzeit.status === 400, `HTTP ${erfundeneFehlzeit.status}`)

// ── C6 Eine Fehlzeit wieder entfernen ──────────────────────────────────────
console.log('\n=== C6 Eine Fehlzeit entfernen ===')

// Versehentlich erfasste Krankmeldungen mussten bisher stehen bleiben — sie
// fliessen in Fehlzeitenquoten und in die Lohnabrechnung ein.
const zuLoeschen = (await sende(leitung, '/api/absences', 'POST', {
  employeeId: personId, employeeName: person.name, locationId,
  type: 'krankheit', startDate: '2029-11-05', endDate: '2029-11-20', days: 16,
})).body.absence
const daran = await einreichen(leitung, {
  ownerId: personId, von: '2029-11-05', bis: '2029-11-20',
})

const durchMitarbeiter = await fetch(`${BASIS}/api/absences/${zuLoeschen.id}`, {
  method: 'DELETE', headers: { cookie: anna },
})
check('Ein Mitarbeiter löscht keine Fehlzeit', durchMitarbeiter.status === 403,
  `HTTP ${durchMitarbeiter.status}`)

const geloescht = await fetch(`${BASIS}/api/absences/${zuLoeschen.id}`, {
  method: 'DELETE', headers: { cookie: leitung },
})
check('Die Leitung kann eine Fehlzeit entfernen', geloescht.status === 200,
  `HTTP ${geloescht.status}`)
check('Danach ist sie weg',
  (await hole(leitung, `/api/absences/${zuLoeschen.id}/nachweise`)).status === 404)

// Die Bescheinigung gehoert in die Personalakte und bleibt dort.
const akte = (await hole(leitung, `/api/files?ownerType=employee&ownerId=${personId}`))
  .body.dateien ?? []
const nochDa = akte.find(d => d.id === daran.body.datei.id)
check('Die Bescheinigung bleibt in der Personalakte', !!nochDa)
check('Sie hat nur ihre Zuordnung verloren', nochDa?.absenceId === null,
  `${nochDa?.absenceId}`)

// Annas Akte wieder aufräumen — sie gehoert zu den Testdaten und soll nicht
// mit jedem Lauf um eine Datei wachsen.
await wegwerfen(leitung, selbstEingereicht.body.datei.id)

// ── C6 Betriebliche Regelung ───────────────────────────────────────────────
console.log('\n=== C6 Bescheinigung ab dem ersten Tag ===')

const vorher = (await hole(gf, '/api/org-settings')).body.settings?.auNachweisAbTag ?? null
await sende(gf, '/api/org-settings', 'PATCH', { auNachweisAbTag: 1 })

const abTag1 = (await hole(leitung, `/api/absences/${kurzKrank.id}/nachweise`)).body
check('Verlangt der Betrieb sie ab dem ersten Tag, gilt das auch für drei Tage',
  abTag1.lage?.pflicht?.pflichtig === true, abTag1.lage?.pflicht?.begruendung)
check('Die Vorschrift dafür wird genannt',
  /§5 Abs.1 Satz 3/.test(abTag1.lage?.pflicht?.begruendung ?? ''))
check('Der Stichtag ist dann der erste Tag',
  abTag1.lage?.pflicht?.spaetestensAm === '2029-03-02')

await sende(gf, '/api/org-settings', 'PATCH', { auNachweisAbTag: vorher })
const zurueck = (await hole(leitung, `/api/absences/${kurzKrank.id}/nachweise`)).body
check('Zurückgestellt gilt wieder die gesetzliche Frist',
  zurueck.lage?.pflicht?.pflichtig === false)

// ── C6 Andere Abwesenheitsarten ────────────────────────────────────────────
const fortbildung = (await sende(leitung, '/api/absences', 'POST', {
  employeeId: personId, employeeName: person.name, locationId,
  type: 'fortbildung', startDate: '2029-07-01', endDate: '2029-07-20', days: 20,
})).body.absence
const lageFortbildung = (await hole(leitung, `/api/absences/${fortbildung.id}/nachweise`)).body
check('Für eine Fortbildung wird keine Bescheinigung verlangt',
  lageFortbildung.lage?.pflicht?.pflichtig === false
  && lageFortbildung.lage?.deckung === 'nicht_noetig')

process.exit(bilanz() > 0 ? 1 : 0)
