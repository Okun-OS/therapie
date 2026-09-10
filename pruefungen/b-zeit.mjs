// Nachweis B1–B6: Zeiterfassung, Protokolle, Freigabe, Monatsabschluss,
// Überstunden, Stundenkonto. Gegen das laufende System.
import { pruefer, login, hole, sende } from './helfer.mjs'

const { check, bilanz } = pruefer()

const leitung = await login('leitung@rheinblick-reha.de')
const kita = await login('leitung@kita-sonnenschein.de')
const anna = await login('anna.fischer@rheinblick-reha.de')

const meLeitung = (await hole(leitung, '/api/auth/me')).body.user
const meAnna = (await hole(anna, '/api/auth/me')).body.user
const locationId = meLeitung.locationId
const annaId = meAnna.employeeId

const alle = (await hole(leitung, '/api/employees')).body.employees ?? []
const kollege = alle.find(e => e.id !== annaId && e.locationId === locationId)

const heute = new Date().toISOString().slice(0, 10)
console.log(`Anna ${annaId?.slice(0, 8)} · Kollege ${kollege?.name} · ${heute}\n`)

// Sauberer Ausgangszustand: eine noch laufende Erfassung beenden
const laufend = await hole(anna, `/api/time-tracking/active?employeeId=${annaId}`)
if (laufend.body.entryId) {
  await sende(anna, '/api/time-tracking/clock-out', 'POST', { timeClockEntryId: laufend.body.entryId })
}

// ── B2 Zeiterfassung aus Sicht des Mitarbeiters ────────────────────────────
console.log('=== B2 Ein- und Ausstempeln ===')
const ein = await sende(anna, '/api/time-tracking/clock-in', 'POST',
  { employeeId: annaId, date: heute, locationId })
check('Mitarbeiter kann sich einstempeln', ein.status === 200 && !!ein.body.entry,
  ein.body.error ?? `Eintrag ${ein.body.entry?.id?.slice(0, 8)}`)
const eintragId = ein.body.entry?.id

const aktiv = await hole(anna, `/api/time-tracking/active?employeeId=${annaId}`)
check('Laufende Erfassung ist abrufbar', aktiv.status === 200, `HTTP ${aktiv.status}`)

const pauseAn = await sende(anna, '/api/time-tracking/break/start', 'POST',
  { employeeId: annaId })
check('Pause starten geht', pauseAn.status === 200, pauseAn.body.error ?? '')
const pauseAus = await sende(anna, '/api/time-tracking/break/end', 'POST',
  { employeeId: annaId })
const fremdePause = await sende(anna, '/api/time-tracking/break/start', 'POST',
  { employeeId: kollege.id })
check('Mitarbeiter kann KEINE Pause für einen Kollegen buchen', fremdePause.status === 403,
  `HTTP ${fremdePause.status}`)
check('Pause beenden geht', pauseAus.status === 200, pauseAus.body.error ?? '')

const doppeltEin = await sende(anna, '/api/time-tracking/clock-in', 'POST',
  { employeeId: annaId, date: heute, locationId })
check('Doppeltes Einstempeln wird verhindert', doppeltEin.status >= 400,
  doppeltEin.status < 400 ? 'Zweite laufende Erfassung wurde angelegt!' : doppeltEin.body.error)

// ── Schutz: für andere stempeln ────────────────────────────────────────────
console.log('\n=== Schutz der Zeiterfassung ===')
const fremdEin = await sende(anna, '/api/time-tracking/clock-in', 'POST',
  { employeeId: kollege.id, date: heute, locationId })
check('Mitarbeiter kann NICHT für einen Kollegen einstempeln', fremdEin.status === 403,
  `HTTP ${fremdEin.status}` + (fremdEin.status === 200 ? ' — fremder Eintrag wurde angelegt!' : ''))
if (fremdEin.status === 200 && fremdEin.body.entry?.id) {
  await sende(leitung, '/api/time-tracking/clock-out', 'POST', { timeClockEntryId: fremdEin.body.entry.id })
}

const fremdMandant = await sende(kita, '/api/time-tracking/clock-in', 'POST',
  { employeeId: annaId, date: heute, locationId })
check('Fremde Leitung kann NICHT für einen Reha-Mitarbeiter stempeln',
  fremdMandant.status === 403, `HTTP ${fremdMandant.status}`)

const offen = (await hole(anna, `/api/time-tracking/active?employeeId=${annaId}`)).body.entryId
const aus = await sende(anna, '/api/time-tracking/clock-out', 'POST',
  { timeClockEntryId: eintragId ?? offen })
check('Mitarbeiter kann sich ausstempeln', aus.status === 200, aus.body.error ?? '')

// ── B1 Sicht der Leitung ───────────────────────────────────────────────────
console.log('\n=== B1 Zeiterfassung aus Sicht der Leitung ===')
const logs = await hole(leitung, `/api/time-logs?locationId=${locationId}`)
check('Leitung sieht die Zeitbuchungen', logs.status === 200,
  `${logs.body.logs?.length ?? 0} Buchungen`)
const fremdeLogs = await hole(kita, `/api/time-logs?locationId=${locationId}`)
const fremdDrin = (fremdeLogs.body.logs ?? []).some(l => l.locationId === locationId)
check('Fremde Leitung sieht die Buchungen NICHT', fremdeLogs.status === 403 || !fremdDrin,
  `HTTP ${fremdeLogs.status} · ${fremdeLogs.body.logs?.length ?? 0} Einträge`)

// ── B5 Überstunden ─────────────────────────────────────────────────────────
console.log('\n=== B5 Überstunden beantragen und genehmigen ===')
// Fuer einen Ueberstundenantrag braucht es eine Zeitbuchung als Bezug
const buchung = await sende(leitung, '/api/time-logs/backfill', 'POST', {
  employeeId: annaId, date: heute, clockIn: '07:00', clockOut: '17:00',
  breakMinutes: 30, locationId, createdBy: meLeitung.userId ?? 'leitung',
})
const timeLogId = buchung.body.log?.id ?? buchung.body.timeLog?.id
check('Leitung kann eine Zeitbuchung nachtragen', buchung.status === 200 || buchung.status === 201,
  buchung.body.error ?? `Buchung ${String(timeLogId).slice(0, 8)}`)

const antrag = await sende(anna, '/api/overtime-requests', 'POST', {
  employeeId: annaId, employeeName: 'Anna Fischer', locationId, date: heute,
  timeLogId, overtimeMinutes: 90, reason: 'Übergabe verlängert',
})
check('Mitarbeiter kann Überstunden beantragen', antrag.status === 200 || antrag.status === 201,
  antrag.body.error ?? `${antrag.body.request?.minutes} Minuten`)
const antragId = antrag.body.request?.id

if (antragId) {
  const selbstGenehmigt = await sende(anna, `/api/overtime-requests/${antragId}`, 'PATCH',
    { status: 'approved', respondedBy: 'anna', approvedMinutes: 90 })
  check('Mitarbeiter kann den eigenen Antrag NICHT selbst genehmigen',
    selbstGenehmigt.status === 403,
    `HTTP ${selbstGenehmigt.status}` + (selbstGenehmigt.status === 200 ? ' — Selbstgenehmigung möglich!' : ''))

  const genehmigt = await sende(leitung, `/api/overtime-requests/${antragId}`, 'PATCH',
    { status: 'approved', respondedBy: 'leitung', approvedMinutes: 60 })
  check('Leitung kann genehmigen (auch teilweise)', genehmigt.status === 200,
    genehmigt.body.error ?? 'genehmigt')

  const fremdGenehmigt = await sende(kita, `/api/overtime-requests/${antragId}`, 'PATCH',
    { status: 'rejected', respondedBy: 'kita' })
  check('Fremde Leitung kann NICHT genehmigen', fremdGenehmigt.status === 403 || fremdGenehmigt.status === 404,
    `HTTP ${fremdGenehmigt.status}`)
}

// ── B6 Stundenkonto ────────────────────────────────────────────────────────
console.log('\n=== B6 Stundenkonto ===')
const jetzt = new Date()
const konto = await hole(anna, `/api/hours-account?employeeId=${annaId}&year=${jetzt.getFullYear()}&month=${jetzt.getMonth()+1}`)
check('Eigenes Stundenkonto ist abrufbar', konto.status === 200, `HTTP ${konto.status}`)
const fremdKonto = await hole(anna, `/api/hours-account?employeeId=${kollege.id}&year=${jetzt.getFullYear()}&month=${jetzt.getMonth()+1}`)
check('Fremdes Stundenkonto ist NICHT abrufbar', fremdKonto.status === 403,
  `HTTP ${fremdKonto.status}` + (fremdKonto.status === 200 ? ' — Kollegenkonto einsehbar!' : ''))

// ── B4 Monatsabschluss und Freigabe ────────────────────────────────────────
console.log('\n=== B4 Monatsabschluss und Freigabe ===')
const jahr = new Date().getFullYear(); const monat = new Date().getMonth() + 1
const abschluss = await sende(leitung, '/api/monthly-closings/get-or-create', 'POST',
  { employeeId: annaId, year: jahr, month: monat })
check('Monatsabschluss wird angelegt', abschluss.status === 200 || abschluss.status === 201,
  abschluss.body.error ?? `Status ${abschluss.body.closing?.status}`)

const abschluesse = await hole(leitung, `/api/monthly-closings?employeeId=${annaId}`)
check('Monatsabschlüsse sind abrufbar', abschluesse.status === 200,
  `${abschluesse.body.closings?.length ?? 0} Abschlüsse`)

const freigaben = await hole(leitung, `/api/timesheet-approval?locationId=${locationId}`)
check('Freigaben sind abrufbar', freigaben.status === 200, `HTTP ${freigaben.status}`)

// ── B3 Protokoll ───────────────────────────────────────────────────────────
console.log('\n=== B3 Zeiterfassungsprotokoll ===')
const dok = await hole(anna, `/api/time-tracking/monthly-document?employeeId=${annaId}&year=${jahr}&month=${monat}`)
check('Monatsprotokoll wird erzeugt', dok.status === 200, `HTTP ${dok.status}`)
const fremdDok = await hole(anna, `/api/time-tracking/monthly-document?employeeId=${kollege.id}&year=${jahr}&month=${monat}`)
check('Protokoll eines Kollegen ist NICHT abrufbar', fremdDok.status === 403,
  `HTTP ${fremdDok.status}` + (fremdDok.status === 200 ? ' — fremdes Protokoll einsehbar!' : ''))

process.exit(bilanz() ? 1 : 0)
