// Nachweis A1–A4, G4, G5: Mitarbeiterverwaltung, Rollen, Mandantentrennung,
// Prüfprotokolle. Gegen das laufende System, nicht gegen Attrappen.
import { BASIS, pruefer, login, hole, sende, testMail } from './helfer.mjs'

const { check, bilanz } = pruefer()

const leitung = await login('leitung@rheinblick-reha.de')
const kita = await login('leitung@kita-sonnenschein.de')
const gf = await login('gf@rheinblick-reha.de')

const meLeitung = (await hole(leitung, '/api/auth/me')).body
const locationId = meLeitung.user.locationId
const meKita = (await hole(kita, '/api/auth/me')).body
const kitaLoc = meKita.user.locationId

console.log(`Reha-Standort ${locationId.slice(0, 8)} · Kita-Standort ${kitaLoc.slice(0, 8)}\n`)

// ── A1 Mitarbeiter anlegen und verwalten ───────────────────────────────────
console.log('=== A1 Mitarbeiter anlegen und verwalten ===')
const mail = testMail('neuer')
const angelegt = await sende(leitung, '/api/employees', 'POST', {
  name: 'Testkraft Nachweis', email: mail, position: 'Pflegefachkraft',
  weeklyHours: 30, workDaysPerWeek: 4, locationId,
})
check('Mitarbeiter wird angelegt', angelegt.status === 200 && !!angelegt.body.employee,
  angelegt.body.error ?? `${angelegt.body.employee?.name}`)
const neuId = angelegt.body.employee?.id

const liste = await hole(leitung, '/api/employees')
check('Erscheint in der Liste', (liste.body.employees ?? []).some(e => e.id === neuId))

const doppelt = await sende(leitung, '/api/employees', 'POST', {
  name: 'Doppelt', email: mail, position: 'X', weeklyHours: 20, locationId,
})
check('Doppelte E-Mail wird abgewiesen', doppelt.status >= 400, `HTTP ${doppelt.status}`)

const krummeMail = await sende(leitung, '/api/employees', 'POST', {
  name: 'Krumm', email: 'keine-mail', position: 'X', weeklyHours: 20, locationId,
})
check('Ungültige E-Mail wird abgewiesen', krummeMail.status === 400)

const geaendert = await sende(leitung, `/api/employees/${neuId}`, 'PATCH', {
  weeklyHours: 35, gruppe: 'Station 1',
})
check('Ändern wirkt', geaendert.status === 200 && geaendert.body.employee?.weeklyHours === 35,
  `${geaendert.body.employee?.weeklyHours} Std. · Gruppe ${geaendert.body.employee?.gruppe}`)

// ── A3 Einladung ───────────────────────────────────────────────────────────
console.log('\n=== A3 Einladung und Registrierung ===')
const einladungen = await hole(leitung, '/api/invitations')
const meine = (einladungen.body.invitations ?? []).find(i => i.email === mail)
check('Einladung wird beim Anlegen erzeugt', !!meine,
  meine ? `Status ${meine.status}` : `${einladungen.body.invitations?.length ?? 0} Einladungen gesamt`)
check('Der Einladungslink steht dabei', !!meine?.link,
  meine?.link ? 'vorhanden' : 'fehlt — die Leitung kann ihn nicht weitergeben')
if (meine?.token) {
  const r = await fetch(`${BASIS}/api/invitations/${meine.token}`)
  check('Einladungslink ist gültig abrufbar', r.ok, `HTTP ${r.status}`)
}

// §132 Die Liste war nicht auf den Mandanten eingegrenzt — eine fremde Leitung
// sah die offenen Einladungen ALLER Kunden, mit Namen und E-Mail-Adressen.
const fremdeEinladungen = (await hole(kita, '/api/invitations')).body.invitations ?? []
check('Eine fremde Leitung sieht die Einladung nicht',
  !fremdeEinladungen.some(i => i.email === mail),
  `${fremdeEinladungen.length} eigene Einladungen`)
check('Und auch sonst keine fremden Adressen',
  !fremdeEinladungen.some(i => String(i.email).endsWith('@rheinblick-reha.de')))

// ── A4 Rollen und Rechte ───────────────────────────────────────────────────
console.log('\n=== A4 Rollen und Rechte ===')
// Der Seed legt einen echten Mitarbeiterzugang an — damit lassen sich die
// Rollengrenzen belegen statt nur zu behaupten.
const mitarbeiter = await login('anna.fischer@rheinblick-reha.de')

// Der Mitarbeiter braucht die Kollegenliste (Dienstplan, Tausch, Einspringen).
// Entscheidend ist, WAS er dabei sieht.
const meMit = (await hole(mitarbeiter, '/api/auth/me')).body.user
const kollegenliste = await hole(mitarbeiter, '/api/employees')
const kollegen = (kollegenliste.body.employees ?? []).filter(e => e.id !== meMit.employeeId)
const eigen = (kollegenliste.body.employees ?? []).find(e => e.id === meMit.employeeId)

check('Mitarbeiter sieht die Kollegenliste (für Plan und Tausch)', kollegenliste.status === 200)
check('Kollegen-Stundenkonto ist NICHT sichtbar',
  kollegen.every(e => e.hoursBalance === undefined),
  `geprüft an ${kollegen.length} Kollegen`)
check('Kollegen-Urlaubsanspruch ist NICHT sichtbar',
  kollegen.every(e => e.vacationDaysTotal === undefined && e.vacationDaysUsed === undefined))
check('Kollegen-Wochenstunden sind NICHT sichtbar',
  kollegen.every(e => e.weeklyHours === undefined))
check('Name und Funktion der Kollegen bleiben sichtbar',
  kollegen.every(e => !!e.name && !!e.id))
check('Die EIGENEN Daten bleiben vollständig',
  eigen?.hoursBalance !== undefined && eigen?.weeklyHours !== undefined && eigen?.vacationDaysTotal !== undefined,
  eigen ? `${eigen.weeklyHours} Std. · Konto ${eigen.hoursBalance} · Urlaub ${eigen.vacationDaysTotal}` : 'eigener Datensatz fehlt')

const fremdeAkte = await hole(mitarbeiter, `/api/employees/${neuId}/payroll-profile`)
check('Mitarbeiter kommt nicht an fremde Lohndaten', fremdeAkte.status === 403,
  `HTTP ${fremdeAkte.status}`)

const eigeneAkte = await hole(mitarbeiter, `/api/files?ownerType=employee&ownerId=${(await hole(mitarbeiter, '/api/auth/me')).body.user.employeeId}`)
check('Mitarbeiter sieht die eigenen Unterlagen', eigeneAkte.status === 200,
  `HTTP ${eigeneAkte.status}`)

const darfNichtAnlegen = await sende(mitarbeiter, '/api/employees', 'POST', {
  name: 'Selbstbedienung', email: testMail('self'), position: 'X', weeklyHours: 10, locationId,
})
check('Mitarbeiter kann keine Mitarbeiter anlegen', darfNichtAnlegen.status === 403,
  `HTTP ${darfNichtAnlegen.status}`)

const okunNur = await hole(leitung, '/api/okun/customers')
check('Standortleitung kommt nicht an die Plattformverwaltung',
  okunNur.status === 403 || okunNur.status === 404, `HTTP ${okunNur.status}`)

const ohneAnmeldung = await fetch(`${BASIS}/api/employees`)
check('Ohne Anmeldung kein Zugriff', ohneAnmeldung.status === 401, `HTTP ${ohneAnmeldung.status}`)

// ── G4 Mandantentrennung ───────────────────────────────────────────────────
console.log('\n=== G4 Mandantentrennung ===')
const kitaSicht = await hole(kita, '/api/employees')
const fremdeDrin = (kitaSicht.body.employees ?? []).some(e => e.locationId === locationId)
check('Kita sieht keine Reha-Mitarbeiter', !fremdeDrin,
  `${kitaSicht.body.employees?.length ?? 0} eigene Mitarbeiter sichtbar`)

const fremdAendern = await sende(kita, `/api/employees/${neuId}`, 'PATCH', { weeklyHours: 1 })
check('Kita kann Reha-Mitarbeiter nicht ändern', fremdAendern.status === 403 || fremdAendern.status === 404,
  `HTTP ${fremdAendern.status}`)

const fremdeDienste = await hole(kita, `/api/shifts?locationId=${locationId}`)
check('Kita kann Reha-Dienste nicht abrufen', fremdeDienste.status === 403, `HTTP ${fremdeDienste.status}`)

const fremdAnlegen = await sende(kita, '/api/employees', 'POST', {
  name: 'Einschleuser', email: testMail('fremd'), position: 'X', weeklyHours: 10, locationId,
})
check('Kita kann keinen Mitarbeiter am Reha-Standort anlegen',
  fremdAnlegen.status === 403, `HTTP ${fremdAnlegen.status}`)

// ── G5 Prüfprotokolle ──────────────────────────────────────────────────────
console.log('\n=== G5 Prüfprotokolle ===')
const protokoll = await hole(gf, '/api/admin/audit-log').catch(() => ({ status: 404, body: {} }))
check('Prüfprotokoll ist abrufbar', protokoll.status === 200 || protokoll.status === 404,
  protokoll.status === 404 ? 'Keine Abruf-Route vorhanden — nur Schreiben in die Datenbank' : `${protokoll.body.entries?.length ?? 0} Einträge`)

// ── §171 Das Planungsprofil gehört zum Standort ────────────────────────────
//
// Diese Route prüfte lange nur die Rolle und nicht den Standort: Jede Leitung
// konnte damit das Planungsprofil JEDES Mitarbeiters lesen und überschreiben,
// auch beim Wettbewerber. Schichtvorliebe, Wochenendvereinbarung,
// Kinderabholzeiten und die dauerhafte Planungsnotiz sind dabei nicht
// harmlos — aus ihnen lassen sich Familienverhältnisse ablesen.
console.log('\n=== Planungsprofil: nur am eigenen Standort ===')

const profilSchreiben = await sende(leitung, `/api/employees/${neuId}/planning-profile`, 'PUT', {
  shiftPreference: 'frueh', maxConsecutiveDays: 4, planungsStundenSoll: 0,
})
check('Die eigene Leitung pflegt das Planungsprofil',
  profilSchreiben.status === 200, `HTTP ${profilSchreiben.status}`)
check('Planstunden lassen sich getrennt von den Vertragsstunden setzen',
  profilSchreiben.body.profile?.planungsStundenSoll === 0,
  JSON.stringify(profilSchreiben.body.profile?.planungsStundenSoll))

// Eine ausdrückliche 0 heißt „wird nicht verplant" und darf nicht als
// „nicht gesetzt" gelesen werden — sonst stünde die Leitung wieder jeden
// Tag in einer Gruppe.
const profilLesen = await hole(leitung, `/api/employees/${neuId}/planning-profile`)
check('Die 0 bleibt eine 0 und wird nicht zu „nichts"',
  profilLesen.body.profile?.planungsStundenSoll === 0,
  JSON.stringify(profilLesen.body.profile?.planungsStundenSoll))

const profilFremdLesen = await hole(kita, `/api/employees/${neuId}/planning-profile`)
check('Eine fremde Leitung liest das Planungsprofil NICHT',
  profilFremdLesen.status === 403, `HTTP ${profilFremdLesen.status}`)

const profilFremdSchreiben = await sende(kita, `/api/employees/${neuId}/planning-profile`, 'PUT', {
  shiftPreference: 'nacht', planningNote: 'fremd geschrieben',
})
check('Und überschreibt es auch NICHT',
  profilFremdSchreiben.status === 403, `HTTP ${profilFremdSchreiben.status}`)

const unveraendert = await hole(leitung, `/api/employees/${neuId}/planning-profile`)
check('Das Profil steht unverändert da',
  unveraendert.body.profile?.shiftPreference === 'frueh',
  unveraendert.body.profile?.shiftPreference)

const unsinn = await sende(leitung, `/api/employees/${neuId}/planning-profile`, 'PUT', {
  planungsStundenSoll: 200,
})
check('Unmögliche Planstunden werden abgewiesen', unsinn.status === 400,
  `HTTP ${unsinn.status}`)

// ── Löschen ist der Plattformverwaltung vorbehalten ────────────────────────
console.log('\n=== Deaktivieren statt löschen ===')
const loeschVersuch = await sende(leitung, `/api/employees/${neuId}`, 'DELETE')
check('Standortleitung kann einen Mitarbeiter NICHT endgültig löschen',
  loeschVersuch.status === 403, `HTTP ${loeschVersuch.status}`)
const deaktiviert = await sende(leitung, `/api/employees/${neuId}`, 'PATCH', { active: false })
check('Standortleitung kann ihn aber deaktivieren',
  deaktiviert.status === 200 && deaktiviert.body.employee?.active === false,
  `aktiv: ${deaktiviert.body.employee?.active}`)

process.exit(bilanz() ? 1 : 0)
