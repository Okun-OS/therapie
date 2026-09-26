// Nachweis C1–C5: Urlaubsanträge, Jahresplanung, Urlaubsregeln,
// Abwesenheiten, Schließzeiten. Gegen das laufende System.
import { pruefer, login, hole, sende } from './helfer.mjs'

const { check, bilanz } = pruefer()

const leitung = await login('leitung@rheinblick-reha.de')
const kita = await login('leitung@kita-sonnenschein.de')
const anna = await login('anna.fischer@rheinblick-reha.de')

const meLeitung = (await hole(leitung, '/api/auth/me')).body.user
const meAnna = (await hole(anna, '/api/auth/me')).body.user
const locationId = meLeitung.locationId
const annaId = meAnna.employeeId
const kollege = ((await hole(leitung, '/api/employees')).body.employees ?? [])
  .find(e => e.id !== annaId && e.locationId === locationId)

const jahr = new Date().getFullYear() + 1
const von = `${jahr}-07-06`, bis = `${jahr}-07-17`
console.log(`Anna ${annaId?.slice(0, 8)} · Kollege ${kollege?.name} · Urlaub ${von} bis ${bis}\n`)

// ── C1 Urlaubsanträge ──────────────────────────────────────────────────────
console.log('=== C1 Urlaubsanträge ===')
const antrag = await sende(anna, '/api/vacation-requests', 'POST', {
  employeeId: annaId, employeeName: 'Anna Fischer', locationId,
  startDate: von, endDate: bis, days: 10, reason: 'Sommerurlaub',
})
check('Mitarbeiter kann Urlaub beantragen', antrag.status === 200 || antrag.status === 201,
  antrag.body.error ?? `${antrag.body.request?.days} Tage`)
const antragId = antrag.body.request?.id

const fremdAntrag = await sende(anna, '/api/vacation-requests', 'POST', {
  employeeId: kollege.id, employeeName: kollege.name, locationId,
  startDate: von, endDate: bis, days: 10, reason: 'Fremdantrag',
})
check('Mitarbeiter kann KEINEN Urlaub für einen Kollegen beantragen',
  fremdAntrag.status === 403, `HTTP ${fremdAntrag.status}`)

const eigene = await hole(anna, `/api/vacation-requests?employeeId=${annaId}`)
check('Eigene Anträge sind abrufbar', eigene.status === 200,
  `${eigene.body.requests?.length ?? 0} Anträge`)
const fremdeAntraege = await hole(anna, `/api/vacation-requests?employeeId=${kollege.id}`)
check('Anträge eines Kollegen sind NICHT abrufbar', fremdeAntraege.status === 403,
  `HTTP ${fremdeAntraege.status}`)

if (antragId) {
  const selbst = await sende(anna, `/api/vacation-requests/${antragId}`, 'PATCH',
    { status: 'approved', respondedBy: 'anna' })
  check('Mitarbeiter kann den eigenen Antrag NICHT genehmigen', selbst.status === 403,
    `HTTP ${selbst.status}`)

  const fremdeLeitung = await sende(kita, `/api/vacation-requests/${antragId}`, 'PATCH',
    { status: 'approved', respondedBy: 'kita' })
  check('Fremde Leitung kann NICHT genehmigen', fremdeLeitung.status === 403 || fremdeLeitung.status === 404,
    `HTTP ${fremdeLeitung.status}`)

  const genehmigt = await sende(leitung, `/api/vacation-requests/${antragId}`, 'PATCH',
    { status: 'approved', respondedBy: meLeitung.userId ?? 'leitung' })
  check('Eigene Leitung kann genehmigen', genehmigt.status === 200, genehmigt.body.error ?? 'genehmigt')
}

// ── C3 Urlaubsregeln ───────────────────────────────────────────────────────
console.log('\n=== C3 Urlaubsregeln ===')
const regeln = await hole(leitung, `/api/vacation-rules?locationId=${locationId}`)
check('Urlaubsregeln sind abrufbar', regeln.status === 200, `HTTP ${regeln.status}`)

const regelnGesetzt = await sende(leitung, '/api/vacation-rules', 'PUT', {
  locationId, rules: { facilityDescription: 'Reha-Zentrum, Mo–Fr', maxConcurrent: 3 },
})
check('Eigene Leitung kann Urlaubsregeln setzen', regelnGesetzt.status === 200,
  regelnGesetzt.body.error ?? 'gesetzt')

const luecke = await sende(leitung, '/api/vacation-rules', 'PUT', { locationId, rules: {} })
check('Unvollständige Regeln werden verständlich abgelehnt (nicht 500)',
  luecke.status === 400 && !!luecke.body.error, `HTTP ${luecke.status} · ${luecke.body.error ?? 'kein Text'}`)

const fremdeRegeln = await sende(kita, '/api/vacation-rules', 'PUT', {
  locationId, rules: { facilityDescription: 'gekapert', maxConcurrent: 99 },
})
check('Fremde Leitung kann die Urlaubsregeln NICHT überschreiben',
  fremdeRegeln.status === 403, `HTTP ${fremdeRegeln.status}`)

const fremdeRegelnLesen = await hole(kita, `/api/vacation-rules?locationId=${locationId}`)
check('Fremde Leitung kann die Urlaubsregeln nicht einmal lesen',
  fremdeRegelnLesen.status === 403, `HTTP ${fremdeRegelnLesen.status}`)

const mitarbeiterRegeln = await sende(anna, '/api/vacation-rules', 'PUT', {
  locationId, rules: { facilityDescription: 'x', maxConcurrent: 99 },
})
check('Mitarbeiter kann keine Urlaubsregeln ändern', mitarbeiterRegeln.status === 403,
  `HTTP ${mitarbeiterRegeln.status}`)

// ── C2 Jahresplanung ───────────────────────────────────────────────────────
console.log('\n=== C2 Jahresplanung ===')
const wuenscheSammeln = await sende(leitung, '/api/vacation-plan/collect-wishes', 'POST', { locationId })
check('Wunschsammlung lässt sich starten', wuenscheSammeln.status === 200 || wuenscheSammeln.status === 201,
  wuenscheSammeln.body.error ?? 'gestartet')
const fremdSammeln = await sende(kita, '/api/vacation-plan/collect-wishes', 'POST', { locationId })
check('Fremde Leitung kann hier keine Wunschsammlung starten',
  fremdSammeln.status === 403, `HTTP ${fremdSammeln.status}`)

const praeferenz = await sende(anna, '/api/vacation-preferences', 'PUT', {
  employeeId: annaId, hasChildren: true, preferredMonths: [7, 8],
  preferredPeriod: 'Sommerferien', priority: 'high',
})
check('Mitarbeiter kann Urlaubswünsche hinterlegen',
  praeferenz.status === 200 || praeferenz.status === 201, praeferenz.body.error ?? 'gespeichert')

const fremdPraeferenz = await sende(anna, '/api/vacation-preferences', 'PUT', {
  employeeId: kollege.id, hasChildren: true, preferredMonths: [7],
})
check('Mitarbeiter kann KEINE Wünsche für Kollegen hinterlegen',
  fremdPraeferenz.status === 403, `HTTP ${fremdPraeferenz.status}`)

// ── C4 Abwesenheiten ───────────────────────────────────────────────────────
console.log('\n=== C4 Abwesenheiten ===')
const krank = await sende(anna, '/api/absences', 'POST', {
  employeeId: annaId, employeeName: 'Anna Fischer', locationId,
  type: 'krankheit', startDate: `${jahr}-03-02`, endDate: `${jahr}-03-04`, days: 3,
})
check('Krankmeldung lässt sich erfassen', krank.status === 200 || krank.status === 201,
  krank.body.error ?? `${krank.body.absence?.days} Tage`)
const krankId = krank.body.absence?.id

const fremdKrank = await sende(anna, '/api/absences', 'POST', {
  employeeId: kollege.id, employeeName: kollege.name, locationId,
  type: 'krankheit', startDate: `${jahr}-03-02`, endDate: `${jahr}-03-04`, days: 3,
})
check('Mitarbeiter kann KEINE Abwesenheit für Kollegen erfassen',
  fremdKrank.status === 403, `HTTP ${fremdKrank.status}`)

if (krankId) {
  const fremdAendern = await sende(kita, `/api/absences/${krankId}`, 'PATCH', { days: 99 })
  check('Fremde Leitung kann die Abwesenheit NICHT ändern',
    fremdAendern.status === 403 || fremdAendern.status === 404, `HTTP ${fremdAendern.status}`)
  const eigeneAendern = await sende(leitung, `/api/absences/${krankId}`, 'PATCH', { days: 2 })
  check('Eigene Leitung kann sie korrigieren', eigeneAendern.status === 200,
    eigeneAendern.body.error ?? '2 Tage')
}

// ── C5 Schließzeiten ───────────────────────────────────────────────────────
console.log('\n=== C5 Schließzeiten ===')
const schliess = await sende(leitung, '/api/closure-periods', 'POST', {
  locationId, name: 'Betriebsferien Prüfung', startDate: `${jahr}-12-27`, endDate: `${jahr}-12-31`,
})
check('Schließzeit lässt sich anlegen', schliess.status === 200 || schliess.status === 201,
  schliess.body.error ?? schliess.body.closure?.name)
const schliessId = schliess.body.closure?.id

const fremdSchliess = await sende(kita, '/api/closure-periods', 'POST', {
  locationId, name: 'Fremde Schließzeit', startDate: `${jahr}-11-01`, endDate: `${jahr}-11-02`,
})
check('Fremde Leitung kann hier KEINE Schließzeit anlegen',
  fremdSchliess.status === 403, `HTTP ${fremdSchliess.status}`)

const fremdLesen = await hole(kita, `/api/closure-periods?locationId=${locationId}`)
check('Fremde Leitung kann die Schließzeiten nicht lesen', fremdLesen.status === 403,
  `HTTP ${fremdLesen.status}`)

const verdreht = await sende(leitung, '/api/closure-periods', 'POST', {
  locationId, name: 'Verdreht', startDate: `${jahr}-12-31`, endDate: `${jahr}-12-27`,
})
check('Ende vor Beginn wird abgewiesen', verdreht.status === 400, `HTTP ${verdreht.status}`)

if (schliessId) {
  const fremdLoeschen = await sende(kita, `/api/closure-periods?id=${schliessId}`, 'DELETE')
  check('Fremde Leitung kann sie nicht löschen', fremdLoeschen.status === 403,
    `HTTP ${fremdLoeschen.status}`)
  const weg = await sende(leitung, `/api/closure-periods?id=${schliessId}`, 'DELETE')
  check('Eigene Leitung kann sie löschen', weg.status === 200, weg.body.error ?? 'gelöscht')
}

process.exit(bilanz() ? 1 : 0)
