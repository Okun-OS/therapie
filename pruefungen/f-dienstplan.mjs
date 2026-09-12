// Nachweis F1–F4: Rechenkern, Plan erzeugen und veröffentlichen,
// Dienstwünsche mit Konfliktlösung, Schichttausch.
import { pruefer, login, hole, sende } from './helfer.mjs'

const { check, bilanz } = pruefer()

const leitung = await login('leitung@rheinblick-reha.de')
const kita = await login('leitung@kita-sonnenschein.de')
const anna = await login('anna.fischer@rheinblick-reha.de')

const meLeitung = (await hole(leitung, '/api/auth/me')).body.user
const meAnna = (await hole(anna, '/api/auth/me')).body.user
const locationId = meLeitung.locationId
const annaId = meAnna.employeeId
const alleMA = (await hole(leitung, '/api/employees')).body.employees ?? []
const kollege = alleMA.find(e => e.id !== annaId && e.locationId === locationId)
const dienste = (await hole(leitung, `/api/shifts?locationId=${locationId}`)).body.shifts ?? []

// Montag der übernächsten Woche
const basis = new Date(); basis.setDate(basis.getDate() + 14)
while (basis.getDay() !== 1) basis.setDate(basis.getDate() + 1)
const tag = (n) => { const d = new Date(basis); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const woche = [0, 1, 2, 3, 4].map(tag)

console.log(`Standort ${locationId.slice(0, 12)} · ${alleMA.filter(e => e.locationId === locationId).length} Mitarbeiter · ${dienste.length} Dienste`)
console.log(`Planwoche ${woche[0]} bis ${woche[4]}\n`)

// ── F1 Rechenkern ──────────────────────────────────────────────────────────
console.log('=== F1 Rechenkern ===')
const status = await hole(leitung, '/api/admin/solver-status')
check('Rechendienst ist erreichbar', status.status === 200 && status.body.configured !== false,
  status.body.hinweis?.slice(0, 90) ?? `HTTP ${status.status}`)
check('Rechendienst ist auf dem passenden Stand', status.body.versionOk === true,
  `Version ${status.body.solverVersion} · benötigt ${status.body.benoetigteVersion}`)

// ── F2 Plan erzeugen ───────────────────────────────────────────────────────
console.log('\n=== F2 Plan erzeugen und speichern ===')
const lauf = await sende(leitung, '/api/planning/runs', 'POST', {
  locationId, von: woche[0], bis: woche[4],
})
// Der Lauf antwortet mit 202 und rechnet im Hintergrund weiter.
check('Planungslauf wird angenommen', lauf.status === 202 && !!lauf.body.sessionId,
  lauf.body.error ?? `Lauf ${lauf.body.sessionId?.slice(0, 10)} · Status ${lauf.body.status}`)

let ergebnis = null
if (lauf.body.sessionId) {
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 3000))
    const stand = await hole(leitung, `/api/planning-sessions/${lauf.body.sessionId}`)
    const st = stand.body.session?.status ?? stand.body.status
    if (st && st !== 'queued' && st !== 'running') { ergebnis = stand.body; break }
  }
}
check('Der Lauf kommt zu einem Ergebnis', !!ergebnis,
  ergebnis ? `Status ${ergebnis.session?.status ?? ergebnis.status}` : 'nach 2 Minuten kein Ergebnis')

if (ergebnis) {
  const sitzung = ergebnis.session ?? ergebnis
  // Der Plan kommt als Zuordnung Mitarbeiter -> Datum -> Dienst ("week")
  const zuordnung = sitzung.week ?? {}
  const eintraege = Object.entries(zuordnung).flatMap(([mid, tage]) =>
    Object.entries(tage ?? {}).map(([datum, z]) => ({
      mitarbeiterId: mid, datum, schichtId: z?.shiftId,
      startzeit: z?.startTime, endzeit: z?.endTime,
    })).filter(e => e.schichtId))
  check('Der Lauf liefert Zuweisungen', eintraege.length > 0,
    `${eintraege.length} Zuweisungen für ${Object.keys(zuordnung).length} Personen`)

  const bewertung = sitzung.bewertung
  check('Der Plan wird bewertet', !!bewertung,
    bewertung ? `Score ${bewertung.gesamtScore}/100 · ${bewertung.freigabeEmpfehlung}` : 'keine Bewertung')

  // §96: keine erfundenen Dienstzeiten
  const dienstNach = new Map(dienste.map(d => [d.id, d]))
  const krumme = eintraege.filter(e => {
    const d = dienstNach.get(e.schichtId)
    if (!d) return false
    const s = e.startzeit ?? d.startTime, x = e.endzeit ?? d.endTime
    return s !== d.startTime || x !== d.endTime
  })
  check('Keine erfundenen Dienstzeiten im erzeugten Plan', krumme.length === 0,
    krumme.length ? `${krumme.length} Einträge mit abweichender Zeit` : `${eintraege.length} Einträge geprüft`)
}

const fremdLauf = await sende(kita, '/api/planning/runs', 'POST', {
  locationId, von: woche[0], bis: woche[4],
})
check('Fremde Leitung kann hier keinen Plan erzeugen', fremdLauf.status === 403,
  `HTTP ${fremdLauf.status}` + (fremdLauf.status === 202 ? ' — Lauf am fremden Standort gestartet!' : ''))

if (lauf.body.sessionId) {
  const fremdEinsicht = await hole(kita, `/api/planning-sessions/${lauf.body.sessionId}`)
  check('Fremde Leitung kann den Lauf nicht einsehen', fremdEinsicht.status === 403,
    `HTTP ${fremdEinsicht.status}`)
}

// Woche von Hand speichern
const gespeichert = await sende(leitung, '/api/schedule-entries/save-week', 'POST', {
  locationId, weekDates: woche, status: 'draft',
  assignments: { [annaId]: { [woche[0]]: { shiftId: dienste[0]?.id } } },
})
check('Woche lässt sich speichern', gespeichert.status === 200 || gespeichert.status === 201,
  gespeichert.body.error ?? 'gespeichert')

const fremdSpeichern = await sende(kita, '/api/schedule-entries/save-week', 'POST', {
  locationId, weekDates: woche, status: 'draft',
  assignments: { [annaId]: { [woche[1]]: { shiftId: dienste[0]?.id } } },
})
check('Fremde Leitung kann die Woche NICHT überschreiben', fremdSpeichern.status === 403,
  `HTTP ${fremdSpeichern.status}`)

const plan = await hole(leitung, `/api/schedule-entries?locationId=${locationId}`)
check('Der gespeicherte Plan ist abrufbar', plan.status === 200,
  `${plan.body.entries?.length ?? 0} Einträge`)
const fremdPlan = await hole(kita, `/api/schedule-entries?locationId=${locationId}`)
check('Fremde Leitung sieht den Plan NICHT', fremdPlan.status === 403, `HTTP ${fremdPlan.status}`)

// Planungsregeln
const regelnFremd = await sende(kita, '/api/planning-rules', 'PUT', {
  locationId, maxWeeklyHours: 60, restHours: 1, maxConsecutiveDays: 14,
})
check('Fremde Leitung kann die Arbeitszeitregeln NICHT ändern', regelnFremd.status === 403,
  `HTTP ${regelnFremd.status}`)
const regelnMitarbeiter = await sende(anna, '/api/planning-rules', 'PUT', {
  locationId, maxWeeklyHours: 60,
})
check('Mitarbeiter kann die Arbeitszeitregeln NICHT ändern', regelnMitarbeiter.status === 403,
  `HTTP ${regelnMitarbeiter.status}`)

// Einheiten
const fremdEinheit = await sende(kita, '/api/planning-units', 'POST', {
  locationId, name: 'Fremde Einheit', type: 'gruppe', minStaff: 1,
})
check('Fremde Leitung kann hier keine Einheit anlegen', fremdEinheit.status === 403,
  `HTTP ${fremdEinheit.status}`)

// ── F3 Dienstwünsche ───────────────────────────────────────────────────────
console.log('\n=== F3 Dienstwünsche ===')
const wunsch = await sende(anna, '/api/wish-submissions', 'POST', {
  employeeId: annaId, employeeName: 'Anna Fischer', locationId,
  date: woche[2], preferredShiftType: 'frueh', importance: 'hoch', reason: 'Arzttermin',
})
check('Mitarbeiter kann einen Dienstwunsch eintragen',
  wunsch.status === 200 || wunsch.status === 201, wunsch.body.error ?? 'eingetragen')

const fremdWunsch = await sende(anna, '/api/wish-submissions', 'POST', {
  employeeId: kollege.id, employeeName: kollege.name, locationId,
  date: woche[2], preferredShiftType: 'spaet', importance: 'hoch',
})
check('Wunsch auf fremden Namen wird abgewiesen', fremdWunsch.status === 403,
  `HTTP ${fremdWunsch.status}`)

const eigeneWuensche = await hole(anna, `/api/wish-submissions?employeeId=${annaId}`)
check('Eigene Wünsche sind abrufbar', eigeneWuensche.status === 200,
  `${eigeneWuensche.body.wishes?.length ?? 0} Wünsche`)
const fremdeWuensche = await hole(anna, `/api/wish-submissions?employeeId=${kollege.id}`)
check('Wünsche eines Kollegen sind NICHT abrufbar', fremdeWuensche.status === 403,
  `HTTP ${fremdeWuensche.status}`)
const fremdeStandortWuensche = await hole(kita, `/api/wish-submissions?locationId=${locationId}`)
check('Fremde Leitung sieht die Wünsche NICHT', fremdeStandortWuensche.status === 403,
  `HTTP ${fremdeStandortWuensche.status}`)

// ── F4 Schichttausch ───────────────────────────────────────────────────────
console.log('\n=== F4 Schichttausch ===')
// Beide Personen bekommen einen Dienst, dann wird getauscht
await sende(leitung, '/api/schedule-entries/save-week', 'POST', {
  locationId, weekDates: woche, status: 'draft',
  assignments: {
    [annaId]:      { [woche[3]]: { shiftId: dienste[0]?.id } },
    [kollege.id]:  { [woche[4]]: { shiftId: dienste[1]?.id ?? dienste[0]?.id } },
  },
})
const tausch = await sende(anna, '/api/swap-requests', 'POST', {
  requesterId: annaId, requesterName: 'Anna Fischer',
  requesterDate: woche[3], requesterShiftId: dienste[0]?.id,
  targetEmployeeId: kollege.id, targetEmployeeName: kollege.name,
  targetDate: woche[4], targetShiftId: dienste[1]?.id ?? dienste[0]?.id,
  message: 'Tauschen wir?', locationId,
})
check('Tauschanfrage lässt sich stellen', tausch.status === 200 || tausch.status === 201,
  tausch.body.error ?? 'gestellt')
const tauschId = tausch.body.request?.id

if (tauschId) {
  const falscheAntwort = await sende(anna, `/api/swap-requests/${tauschId}`, 'PATCH',
    { status: 'accepted' })
  check('Nur die angefragte Person darf antworten — nicht der Fragende',
    falscheAntwort.status === 403, `HTTP ${falscheAntwort.status}`)

  const angenommen = await sende(leitung, `/api/swap-requests/${tauschId}`, 'PATCH',
    { status: 'accepted' })
  check('Die Leitung kann den Tausch bestätigen', angenommen.status === 200,
    angenommen.body.error ?? 'bestätigt')

  const nachTausch = (await hole(leitung, `/api/schedule-entries?locationId=${locationId}`)).body.entries ?? []
  const annaHat = nachTausch.find(e => e.employeeId === annaId && e.date === woche[4])
  const kollegeHat = nachTausch.find(e => e.employeeId === kollege.id && e.date === woche[3])
  check('Die Dienste sind danach wirklich getauscht', !!annaHat && !!kollegeHat,
    `Anna am ${woche[4]}: ${annaHat ? 'ja' : 'nein'} · ${kollege.name} am ${woche[3]}: ${kollegeHat ? 'ja' : 'nein'}`)

  const nochmal = await sende(leitung, `/api/swap-requests/${tauschId}`, 'PATCH',
    { status: 'declined' })
  check('Ein beantworteter Tausch lässt sich nicht erneut beantworten',
    nochmal.status === 409, `HTTP ${nochmal.status}`)
}

process.exit(bilanz() ? 1 : 0)
