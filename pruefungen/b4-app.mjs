// Nachweis B9: Was die native Hülle am Server braucht.
//
// Die Hülle selbst lässt sich hier nicht prüfen — dafür braucht es ein Telefon.
// Prüfbar ist die andere Hälfte, und die ist die gefährlichere: Zwei neue Wege
// ins System, über die vorher nichts lief.
//
// DAS GERÄT. Beim Web-Push (§111) ließ sich einmal das EIGENE Gerät als
// Empfänger für die Meldungen einer ANDEREN Person eintragen — ab dann las man
// deren Dienstpläne und Ausfälle mit. Derselbe Fehler darf hier nicht noch
// einmal entstehen: Die Person kommt aus der Sitzung, nicht aus der Anfrage.
//
// DER LÖSCHANTRAG. Apple verlangt ihn in der App (Richtlinie 5.1.1 v), Art. 17
// DSGVO gibt das Recht dazu. Geprüft wird, dass ihn nur der Betroffene stellt,
// nur die Leitung bescheidet — und dass eine Ablehnung ohne Begründung nicht
// durchgeht (Art. 12 Abs. 4 DSGVO).

import { BASIS, pruefer, login, hole, sende } from './helfer.mjs'

const { check, bilanz } = pruefer()

const person = await login('maria.schneider@rheinblick-reha.de')
const kollege = await login('thomas.weber@rheinblick-reha.de')
const leitung = await login('leitung@rheinblick-reha.de')
const gf = await login('gf@rheinblick-reha.de')

const mPerson = (await hole(person, '/api/auth/me')).body.user
const mKollege = (await hole(kollege, '/api/auth/me')).body.user

// Eine Kennung, die es nur in diesem Lauf gibt — sonst fallen sich mehrere
// Durchläufe gegenseitig ins Handwerk.
const KENNUNG = `pruefung-b9-${Date.now()}-${'x'.repeat(20)}`

const geraeteBlock = async cookie => {
  const a = await hole(cookie, '/api/dsgvo/auskunft')
  const block = (a.body.bloecke ?? []).find(b => b.id === 'nachrichten')
  return (block?.daten ?? []).filter(d => 'plattform' in d)
}

console.log(`Person ${String(mPerson.employeeId).slice(0, 8)} · `
  + `Kollege ${String(mKollege.employeeId).slice(0, 8)}\n`)

// ── B9 Das Gerät gehört dem, der es anmeldet ───────────────────────────────
console.log('=== B9 Gerät anmelden ===')

const ohneAnmeldung = await fetch(`${BASIS}/api/push/geraet`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ kennung: KENNUNG, plattform: 'ios' }),
})
check('Ohne Anmeldung geht gar nichts', ohneAnmeldung.status === 401,
  `HTTP ${ohneAnmeldung.status}`)

const ohneKennung = await sende(person, '/api/push/geraet', 'POST', { plattform: 'ios' })
check('Ohne Gerätekennung wird abgelehnt', ohneKennung.status === 400,
  ohneKennung.body.error)

const zuKurz = await sende(person, '/api/push/geraet', 'POST',
  { kennung: 'abc', plattform: 'ios' })
check('Eine offensichtlich unbrauchbare Kennung wird abgelehnt', zuKurz.status === 400)

const falschePlattform = await sende(person, '/api/push/geraet', 'POST',
  { kennung: KENNUNG, plattform: 'symbian' })
check('Eine unbekannte Plattform wird abgelehnt', falschePlattform.status === 400,
  falschePlattform.body.error)

// §111 Der eigentliche Punkt: eine mitgeschickte fremde Kennung ändert nichts.
const mitFremderPerson = await sende(person, '/api/push/geraet', 'POST', {
  kennung: KENNUNG, plattform: 'ios', employeeId: mKollege.employeeId,
})
check('Das Anmelden geht', mitFremderPerson.status === 200, mitFremderPerson.body.error)

const beiPerson = await geraeteBlock(person)
const beiKollege = await geraeteBlock(kollege)
check('Das Gerät hängt an der angemeldeten Person', beiPerson.length >= 1,
  `${beiPerson.length} Gerät(e)`)
check('Und NICHT an der Person, die in der Anfrage stand',
  beiKollege.length === 0, `${beiKollege.length} Gerät(e) beim Kollegen`)

const ohneMitarbeiter = await sende(gf, '/api/push/geraet', 'POST',
  { kennung: `${KENNUNG}-gf`, plattform: 'android' })
check('Ein Zugang ohne Mitarbeiterdatensatz kann kein Gerät anmelden',
  ohneMitarbeiter.status === 403, `HTTP ${ohneMitarbeiter.status}`)

// ── B9 Das Diensttelefon wechselt den Besitzer ─────────────────────────────
//
// Ein reales Ereignis, kein Sonderfall: Das Telefon der Station wird
// weitergereicht. Bliebe der alte Eintrag stehen, bekäme der Vorgänger weiter
// die Dienstpläne seines Nachfolgers auf den Sperrbildschirm.
console.log('\n=== B9 Besitzerwechsel ===')

const uebernommen = await sende(kollege, '/api/push/geraet', 'POST',
  { kennung: KENNUNG, plattform: 'ios' })
check('Der Nächste kann dasselbe Gerät anmelden', uebernommen.status === 200)

const nachWechselPerson = await geraeteBlock(person)
const nachWechselKollege = await geraeteBlock(kollege)
check('Danach hängt es am Neuen', nachWechselKollege.length === 1,
  `${nachWechselKollege.length}`)
check('Und nicht mehr am Vorgänger — sonst läse der mit',
  nachWechselPerson.length === 0, `${nachWechselPerson.length}`)

// ── B9 Abmelden ────────────────────────────────────────────────────────────
console.log('\n=== B9 Abmelden ===')

const fremdesAbmelden = await sende(person, '/api/push/geraet', 'DELETE',
  { kennung: KENNUNG })
check('Ein fremdes Gerät lässt sich nicht abmelden',
  (await geraeteBlock(kollege)).length === 1,
  `HTTP ${fremdesAbmelden.status}, Gerät steht noch`)
check('Und das wird nicht verraten — sonst ließen sich Kennungen erraten',
  fremdesAbmelden.status === 200, `HTTP ${fremdesAbmelden.status}`)

const eigenesAbmelden = await sende(kollege, '/api/push/geraet', 'DELETE',
  { kennung: KENNUNG })
check('Das eigene Gerät lässt sich abmelden', eigenesAbmelden.status === 200)
check('Danach ist es wirklich weg', (await geraeteBlock(kollege)).length === 0)

// ── B9 Der Löschantrag ─────────────────────────────────────────────────────
console.log('\n=== B9 Löschung beantragen ===')

const gestellt = await sende(person, '/api/dsgvo/loeschantrag', 'POST',
  { begruendung: 'Nachweis B9' })
check('Ein Mitarbeiter kann die Löschung selbst beantragen', gestellt.status === 200,
  gestellt.body.error)
check('Der Antrag steht danach offen', gestellt.body.antrag?.status === 'offen',
  gestellt.body.antrag?.status)

const nochmal = await sende(person, '/api/dsgvo/loeschantrag', 'POST', {})
check('Ein zweiter Antrag legt keinen zweiten an', nochmal.body.schonGestellt === true)
check('Sondern gibt den offenen zurück',
  nochmal.body.antrag?.id === gestellt.body.antrag?.id)

const meine = (await hole(person, '/api/dsgvo/loeschantrag')).body.antraege ?? []
check('Man sieht seinen eigenen Antrag', meine.some(a => a.id === gestellt.body.antrag.id))

const fremde = (await hole(kollege, '/api/dsgvo/loeschantrag')).body.antraege ?? []
check('Der Antrag einer Kollegin geht niemanden etwas an',
  !fremde.some(a => a.id === gestellt.body.antrag.id),
  `${fremde.length} beim Kollegen sichtbar`)

const beiLeitung = (await hole(leitung, '/api/dsgvo/loeschantrag')).body.antraege ?? []
check('Die Standortleitung sieht ihn',
  beiLeitung.some(a => a.id === gestellt.body.antrag.id))

// ── B9 Bescheiden ──────────────────────────────────────────────────────────
console.log('\n=== B9 Bescheiden ===')

const selbstBeschieden = await sende(person, '/api/dsgvo/loeschantrag', 'PATCH',
  { id: gestellt.body.antrag.id, status: 'erledigt' })
check('Niemand bescheidet seinen Antrag selbst', selbstBeschieden.status === 403,
  `HTTP ${selbstBeschieden.status}`)

const ohneGrund = await sende(leitung, '/api/dsgvo/loeschantrag', 'PATCH',
  { id: gestellt.body.antrag.id, status: 'abgelehnt' })
check('Eine Ablehnung ohne Begründung geht nicht — Art. 12 Abs. 4 DSGVO',
  ohneGrund.status === 400, ohneGrund.body.error)

const unsinn = await sende(leitung, '/api/dsgvo/loeschantrag', 'PATCH',
  { id: gestellt.body.antrag.id, status: 'vielleicht' })
check('Ein erfundener Status wird abgelehnt', unsinn.status === 400)

const grund = 'Ihre Lohnunterlagen müssen nach §147 AO aufbewahrt werden. '
  + 'Wir melden uns nach Ablauf der Frist von selbst.'
const beschieden = await sende(leitung, '/api/dsgvo/loeschantrag', 'PATCH',
  { id: gestellt.body.antrag.id, status: 'abgelehnt', antwort: grund })
check('Mit Begründung geht es', beschieden.status === 200, beschieden.body.error)
check('Und es steht dabei, wer bescheiden hat',
  !!beschieden.body.antrag?.bearbeitetVon, beschieden.body.antrag?.bearbeitetVon)

const danach = (await hole(person, '/api/dsgvo/loeschantrag')).body.antraege ?? []
const meiner = danach.find(a => a.id === gestellt.body.antrag.id)
check('Die Person liest die Begründung in ihrer App', meiner?.antwort === grund)
check('Und der Antrag gilt nicht mehr als offen', meiner?.status === 'abgelehnt')

const wiederOffen = await sende(person, '/api/dsgvo/loeschantrag', 'POST', {})
check('Nach einer Ablehnung lässt sich erneut beantragen',
  wiederOffen.body.schonGestellt !== true
  && wiederOffen.body.antrag?.id !== gestellt.body.antrag?.id,
  wiederOffen.body.antrag?.status)

// ── B9 Das Konto löscht sich nicht mehr selbst ─────────────────────────────
//
// §140 Bis hierher löschte „Mein Konto → Konto unwiderruflich löschen" das
// Benutzerkonto sofort und überschrieb Name und E-Mail des Mitarbeiters — ohne
// jede Prüfung. Das Lohnkonto muss sechs Jahre zuordenbar bleiben (§41 EStG,
// §28f SGB IV, §147 AO); danach stünden Abrechnungen ohne Person da, und dem
// Menschen fehlte die Grundlage seiner eigenen Lohnsteuerbescheinigung.
//
// ACHTUNG BEIM LESEN DIESER PRÜFUNG: Sie ruft den Weg wirklich auf. Käme die
// alte Fassung zurück, wäre danach ein Testkonto weg — und alle übrigen
// Nachweise, die sich damit anmelden, fielen ebenfalls aus. Genau das ist
// beabsichtigt: Diese Rückkehr darf nicht leise passieren.
console.log('\n=== B9 Kein Sofort-Löschen des eigenen Kontos ===')

const selbstLoeschen = await sende(person, '/api/auth/me', 'DELETE')
check('Das eigene Konto lässt sich nicht sofort löschen',
  selbstLoeschen.status === 409, `HTTP ${selbstLoeschen.status}`)
check('Und es wird gesagt, warum und wie es richtig geht',
  /Aufbewahrungsfrist/i.test(selbstLoeschen.body.error ?? '')
  && /Löschantrag/i.test(selbstLoeschen.body.error ?? ''),
  selbstLoeschen.body.error)

const nochDa = await hole(person, '/api/auth/me')
check('Das Konto ist danach unverändert da', nochDa.status === 200
  && nochDa.body.user?.employeeId === mPerson.employeeId,
  `HTTP ${nochDa.status}`)

// Der alte, unvollständige Auskunftsweg ist weg: Er gab vier Tabellen aus und
// nannte sich „alle gespeicherten Daten". Eine Auskunft, die unvollständig ist
// und sich vollständig nennt, ist schlimmer als gar keine.
const alterExport = await hole(person, '/api/auth/me/export')
check('Der alte, unvollständige Export ist abgeschafft',
  alterExport.status === 404 || alterExport.status === 405,
  `HTTP ${alterExport.status}`)

// ── B9 Der Antrag steht in der eigenen Auskunft ────────────────────────────
console.log('\n=== B9 In der Auskunft ===')

const auskunft = await hole(person, '/api/dsgvo/auskunft')
const protokolle = (auskunft.body.bloecke ?? []).find(b => b.id === 'protokolle')
check('Der eigene Löschantrag steht in der Auskunft',
  (protokolle?.daten ?? []).some(d => d.status === 'abgelehnt'),
  `${protokolle?.anzahl ?? 0} Einträge im Block Protokolle`)
check('Mit der Antwort, die darauf ergangen ist',
  (protokolle?.daten ?? []).some(d => d.antwort === grund))

// Aufräumen: kein offener Antrag bleibt stehen, sonst steht er beim nächsten
// Lauf in der Liste der Leitung und verschiebt jede Zählung.
if (wiederOffen.body.antrag?.id) {
  await sende(leitung, '/api/dsgvo/loeschantrag', 'PATCH', {
    id: wiederOffen.body.antrag.id, status: 'abgelehnt',
    antwort: 'Nachweis B9 — automatisch geschlossen.',
  })
}
const restOffen = ((await hole(leitung, '/api/dsgvo/loeschantrag')).body.antraege ?? [])
  .filter(a => a.status === 'offen' && a.employeeId === mPerson.employeeId)
check('Der Nachweis lässt keinen offenen Antrag zurück', restOffen.length === 0,
  `${restOffen.length} offen`)

process.exit(bilanz() > 0 ? 1 : 0)
