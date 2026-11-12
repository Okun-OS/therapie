// Nachweis §200: E-Mail-Adresse eines Mitarbeiters tauschen und neu einladen.
//
// Was hier bewiesen wird, und warum jedes Mal mit Gegenprobe:
// - Der ALTE Einladungslink stirbt. Gegenprobe: vorher war er gültig — sonst
//   bewiese „ungültig" nur, dass es ihn nie gab.
// - Ein bestehendes Konto zieht mit um und bleibt EIN Konto. Gegenprobe: Mit
//   der neuen Adresse und dem ALTEN Passwort kommt man hinein — das geht nur,
//   wenn es dasselbe Konto ist und kein zweites angelegt wurde.
// - Dieselbe Wirkung über die normale Bearbeitung (PATCH). Gegenprobe: Ohne
//   Adresswechsel bleibt der Link gültig, es wird nicht bei jedem Speichern
//   neu eingeladen.
// - Wer noch nie eingeladen wurde (Anlage im Gespräch), bekommt beim Ändern
//   KEINE Einladung — die kommt erst mit der Bestätigung.
// - Eine fremde Leitung kommt nicht heran. Vorher prüfte die Route nur die Rolle.
import { BASIS, pruefer, login, hole, sende, testMail } from './helfer.mjs'

const { check, bilanz } = pruefer()

const leitung = await login('leitung@rheinblick-reha.de')
const gf = await login('gf@rheinblick-reha.de')
const fremd = await login('leitung@kita-sonnenschein.de')
const mitarbeiterin = await login('anna.fischer@rheinblick-reha.de')
const locationId = (await hole(leitung, '/api/auth/me')).body.user.locationId

const einladungFuer = async (email) =>
  ((await hole(leitung, '/api/invitations')).body.invitations ?? []).find(i => i.email === email)
const linkGueltig = async (token) => (await fetch(`${BASIS}/api/invitations/${token}`)).status === 200
const kannAnmelden = (email, passwort) => login(email, passwort).then(() => true, () => false)

// Ausgangszustand selbst herstellen: eine frische Person mit Einladung.
const alt = testMail('zugang-alt')
const angelegt = await sende(leitung, '/api/employees', 'POST', {
  name: 'Zugang Nachweis', email: alt, position: 'Pflegefachkraft', weeklyHours: 20, locationId,
})
const id = angelegt.body.employee?.id
if (!id) {
  check('Testperson angelegt', false, angelegt.body.error ?? `HTTP ${angelegt.status}`)
  process.exit(bilanz() ? 1 : 0)
}

console.log('=== Stand des Zugangs ===')
const stand0 = await hole(leitung, `/api/employees/${id}/invite`)
check('Die Leitung sieht den Stand', stand0.status === 200 && stand0.body.email === alt,
  JSON.stringify(stand0.body))
check('Noch kein Konto, Einladung offen',
  stand0.body.konto === false && stand0.body.einladung?.abgelaufen === false)

console.log('\n=== Adresse tauschen, noch ohne Konto ===')
const tokenAlt = (await einladungFuer(alt))?.token
check('Gegenprobe: der alte Link ist VOR dem Tausch gültig', !!tokenAlt && await linkGueltig(tokenAlt))

const neu1 = testMail('zugang-neu')
const tausch1 = await sende(leitung, `/api/employees/${id}/invite`, 'POST', { email: neu1.toUpperCase() })
check('Tausch wird angenommen', tausch1.status === 200 && tausch1.body.adresseGeaendert === true,
  tausch1.body.error ?? `HTTP ${tausch1.status}`)
check('Die Adresse wird klein geschrieben gespeichert', tausch1.body.email === neu1, tausch1.body.email)
check('Kein Konto, also auch keins umgestellt', tausch1.body.kontoUmgestellt === false)
check('Der alte Link ist danach ungültig', !(await linkGueltig(tokenAlt)))
const einladung1 = await einladungFuer(neu1)
check('Die neue Einladung geht an die neue Adresse', !!einladung1?.token && await linkGueltig(einladung1.token))
const nachTausch = await hole(leitung, `/api/employees/${id}`)
check('Der Mitarbeiter trägt die neue Adresse', nachTausch.body.employee?.email === neu1,
  nachTausch.body.employee?.email)

console.log('\n=== Konto einrichten, dann Adresse tauschen ===')
const PW_ALT = 'Zugang-Alt-1234!'
const PW_NEU = 'Zugang-Neu-1234!'
const angenommen = await fetch(`${BASIS}/api/invitations/${einladung1?.token}/accept`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: PW_ALT, name: 'Zugang Nachweis' }),
})
check('Einladung angenommen, Konto steht', angenommen.ok, `HTTP ${angenommen.status}`)
check('Anmeldung mit der Adresse klappt', await kannAnmelden(neu1, PW_ALT))
check('Der Stand zeigt das Konto',
  (await hole(leitung, `/api/employees/${id}/invite`)).body.konto === true)

const neu2 = testMail('zugang-zwei')
const tausch2 = await sende(gf, `/api/employees/${id}/invite`, 'POST', { email: neu2 })
check('Die Geschäftsführung kann es auch', tausch2.status === 200, tausch2.body.error ?? '')
check('Das Konto wird umgestellt', tausch2.body.kontoUmgestellt === true)
check('Mit der alten Adresse kommt man nicht mehr hinein', !(await kannAnmelden(neu1, PW_ALT)))
check('Gegenprobe: mit der neuen Adresse und dem ALTEN Passwort schon — dasselbe Konto',
  await kannAnmelden(neu2, PW_ALT))

const einladung2 = await einladungFuer(neu2)
const neuGesetzt = await fetch(`${BASIS}/api/invitations/${einladung2?.token}/accept`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: PW_NEU }),
})
check('Über die neue Einladung wird ein neues Passwort gesetzt', neuGesetzt.ok, `HTTP ${neuGesetzt.status}`)
check('Das neue Passwort gilt', await kannAnmelden(neu2, PW_NEU))
check('Das alte nicht mehr', !(await kannAnmelden(neu2, PW_ALT)))

console.log('\n=== Abweisungen ===')
const belegt = await sende(leitung, `/api/employees/${id}/invite`, 'POST',
  { email: 'anna.fischer@rheinblick-reha.de' })
check('Eine vergebene Adresse wird abgewiesen', belegt.status === 409, belegt.body.error ?? '')
const krumm = await sende(leitung, `/api/employees/${id}/invite`, 'POST', { email: 'kein-at-zeichen' })
check('Eine ungültige Adresse wird abgewiesen', krumm.status === 400, krumm.body.error ?? '')
check('Danach steht die Adresse unverändert da',
  (await hole(leitung, `/api/employees/${id}/invite`)).body.email === neu2)

const fremdLesen = await hole(fremd, `/api/employees/${id}/invite`)
check('Eine fremde Leitung sieht den Zugang NICHT', fremdLesen.status === 403, `HTTP ${fremdLesen.status}`)
const fremdTausch = await sende(fremd, `/api/employees/${id}/invite`, 'POST', { email: testMail('fremd') })
check('Und lenkt ihn auch NICHT um', fremdTausch.status === 403, `HTTP ${fremdTausch.status}`)
const fremdPatch = await sende(fremd, `/api/employees/${id}`, 'PATCH', { email: testMail('fremd') })
check('Auch nicht über die Bearbeitung', fremdPatch.status === 403, `HTTP ${fremdPatch.status}`)
const selbst = await sende(mitarbeiterin, `/api/employees/${id}/invite`, 'POST', {})
check('Eine Mitarbeiterin kann niemanden einladen', selbst.status === 403, `HTTP ${selbst.status}`)
check('Gegenprobe: das Konto ist unberührt', await kannAnmelden(neu2, PW_NEU))

console.log('\n=== Dieselbe Wirkung über die normale Bearbeitung ===')
const tokenVorPatch = (await einladungFuer(neu2))?.token ?? null
// Nach dem Annehmen gibt es keine offene Einladung; eine erzeugen, damit der
// Unterschied zwischen „bleibt" und „stirbt" messbar ist.
await sende(leitung, `/api/employees/${id}/invite`, 'POST', {})
const tokenOffen = (await einladungFuer(neu2))?.token
check('Neu einladen ohne Adresswechsel erzeugt einen Link', !!tokenOffen && tokenOffen !== tokenVorPatch)

const ohneWechsel = await sende(leitung, `/api/employees/${id}`, 'PATCH', { email: neu2, weeklyHours: 20 })
check('Speichern mit unveränderter Adresse lädt nicht neu ein',
  ohneWechsel.status === 200 && !ohneWechsel.body.zugang && await linkGueltig(tokenOffen))

const neu3 = testMail('zugang-drei')
const perPatch = await sende(leitung, `/api/employees/${id}`, 'PATCH', { email: neu3 })
check('Adresswechsel über die Bearbeitung meldet die neue Einladung',
  perPatch.status === 200 && perPatch.body.zugang?.adresseGeaendert === true, perPatch.body.error ?? '')
check('Auch hier stirbt der alte Link', !(await linkGueltig(tokenOffen)))
check('Und auch hier zieht das Konto mit', await kannAnmelden(neu3, PW_NEU))

console.log('\n=== Anlage im Gespräch: noch keine Einladung ===')
const entwurfMail = testMail('entwurf')
const entwurf = await sende(leitung, '/api/employees', 'POST', {
  name: 'Entwurf Nachweis', email: entwurfMail, position: 'Pflegefachkraft', weeklyHours: 20,
  locationId, sendInvitation: false,
})
const entwurfId = entwurf.body.employee?.id
check('Gegenprobe: ohne Bestätigung gibt es keine Einladung', !(await einladungFuer(entwurfMail)))
const korrigiert = testMail('entwurf-korrigiert')
const korrektur = await sende(leitung, `/api/employees/${entwurfId}`, 'PATCH', { email: korrigiert })
check('Die Adresse lässt sich im Entwurf korrigieren',
  korrektur.status === 200 && korrektur.body.employee?.email === korrigiert, korrektur.body.error ?? '')
check('…ohne dass schon eine Einladung hinausgeht',
  !korrektur.body.zugang && !(await einladungFuer(korrigiert)))
const bestaetigt = await sende(leitung, `/api/employees/${entwurfId}/invite`, 'POST', {})
check('Mit der Bestätigung geht sie an die korrigierte Adresse',
  bestaetigt.status === 200 && !!(await einladungFuer(korrigiert)))

console.log('\n=== Platzhalter aus dem Einspielen der Belegschaft (§183) ===')
const platzhalter = `zugang.${Date.now()}@${locationId}.noch-ohne-adresse.invalid`
const ohneAdresse = await sende(leitung, '/api/employees', 'POST', {
  name: 'Platzhalter Nachweis', email: platzhalter, position: 'Pflegefachkraft', weeklyHours: 20,
  locationId, sendInvitation: false,
})
const ohneAdresseId = ohneAdresse.body.employee?.id
const insLeere = await sende(leitung, `/api/employees/${ohneAdresseId}/invite`, 'POST', {})
check('An den Platzhalter wird NICHT eingeladen', insLeere.status === 400 && !(await einladungFuer(platzhalter)),
  insLeere.body.error ?? `HTTP ${insLeere.status}`)
const echteAdresse = testMail('echt')
const eingetragen = await sende(leitung, `/api/employees/${ohneAdresseId}/invite`, 'POST', { email: echteAdresse })
check('Gegenprobe: mit echter Adresse geht die Einladung raus',
  eingetragen.status === 200 && !!(await einladungFuer(echteAdresse)), eingetragen.body.error ?? '')

// Aufräumen wie in den anderen Prüfungen: deaktivieren, nicht löschen.
await sende(leitung, `/api/employees/${ohneAdresseId}`, 'PATCH', { active: false })
await sende(leitung, `/api/employees/${id}`, 'PATCH', { active: false })
await sende(leitung, `/api/employees/${entwurfId}`, 'PATCH', { active: false })

process.exit(bilanz() ? 1 : 0)
