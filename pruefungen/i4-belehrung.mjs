// Nachweis I4: Belehrungen digital.
//
// Der Sinn dieses Moduls ist ein Nachweis — und ein Nachweis ist nur so viel
// wert wie das, was ihn angreifbar macht. Deshalb prüft diese Datei vor allem
// die Angriffsflächen:
//
//   LÄSST SICH DER INHALT NACHTRÄGLICH AUSTAUSCHEN? Nein. Ab dem Verteilen ist
//   er festgeschrieben. Ginge es, könnte jederzeit behauptet werden, jemand
//   habe etwas anderes bestätigt, als er gelesen hat.
//
//   KANN JEMAND FÜR EINEN ANDEREN BESTÄTIGEN? Nein — weder die Leitung noch
//   ein Kollege. Eine Belehrung, die jemand für einen anderen abhakt, belegt
//   nichts.
//
//   TRÄGT DER BELEG, WAS ER TRAGEN MUSS? Name, Wortlaut und Fingerabdruck des
//   Dokuments aus dem Zeitpunkt des Klicks — als Kopien, nicht als Verweise.
//
// Die Rechenwege sind in src/lib/__tests__/belehrung.test.ts nachgerechnet.

import { pruefer, login, hole, sende, BASIS } from './helfer.mjs'

const { check, bilanz } = pruefer()

const gf = await login('gf@rheinblick-reha.de')
const leitung = await login('leitung@rheinblick-reha.de')
const anna = await login('anna.fischer@rheinblick-reha.de')
const fremdeLeitung = await login('leitung@kita-sonnenschein.de')
const fremdePerson = await login('susi.sonnenschein@kita-sonnenschein.de')

const mAnna = (await hole(anna, '/api/auth/me')).body.user
const EIGEN = `I4-Belehrung ${Date.now().toString(36)}`
const INHALT = `%PDF-1.4\n% Hygienebelehrung ${Date.now()}\n`

/** Eine Belehrung anlegen — wie es die Oberfläche tut. */
async function anlegen(cookie, felder, inhalt = INHALT) {
  const form = new FormData()
  for (const [k, v] of Object.entries(felder)) form.set(k, String(v))
  if (inhalt !== null) {
    form.set('datei', new File([Buffer.from(inhalt)], 'belehrung.pdf',
      { type: 'application/pdf' }))
  }
  const r = await fetch(`${BASIS}/api/belehrungen`, {
    method: 'POST', headers: { cookie }, body: form,
  })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

const dokument = async (cookie, id) => {
  const r = await fetch(`${BASIS}/api/belehrungen/${id}/dokument`, {
    headers: { cookie },
  })
  return { status: r.status, text: r.ok ? await r.text() : '' }
}

// ── I4.1 Anlegen ───────────────────────────────────────────────────────────
console.log('=== I4.1 Anlegen ===')

const ohneTitel = await anlegen(gf, {})
check('Eine Belehrung ohne Titel wird abgelehnt', ohneTitel.status === 400,
  ohneTitel.body.error)

const durchMitarbeiter = await anlegen(anna, { titel: `${EIGEN} durch Anna` })
check('Ein Mitarbeiter legt keine Belehrung an', durchMitarbeiter.status === 403,
  `HTTP ${durchMitarbeiter.status}`)

const ohneDatei = await anlegen(gf, { titel: `${EIGEN} ohne Datei` }, null)
check('Ohne Dokument entsteht nur ein Entwurf',
  ohneDatei.body.belehrung?.status === 'entwurf', ohneDatei.body.error)
check('Und es steht da, dass das Dokument fehlt',
  JSON.stringify(ohneDatei.body.fehlt ?? []).includes('leeres Blatt'),
  JSON.stringify(ohneDatei.body.fehlt))

const angelegt = await anlegen(gf, {
  titel: EIGEN,
  beschreibung: 'Die monatliche Hygienebelehrung.',
  bestaetigungstext: 'Ich habe die Belehrung gelesen, verstanden und erkenne sie an.',
  wiederholung: 'monatlich',
})
const id = angelegt.body.belehrung?.id
check('Die Unternehmensebene legt eine Belehrung an', !!id, angelegt.body.error)
check('Sie entsteht als Entwurf',
  angelegt.body.belehrung?.status === 'entwurf', angelegt.body.belehrung?.status)
check('Das Dokument bekommt sofort einen Fingerabdruck',
  /^[0-9a-f]{64}$/.test(angelegt.body.belehrung?.pruefsumme ?? ''),
  angelegt.body.belehrung?.pruefsumme)
check('Sie ist vollständig und kann raus',
  (angelegt.body.fehlt ?? []).length === 0, JSON.stringify(angelegt.body.fehlt))

// Derselbe Inhalt, derselbe Fingerabdruck — anderer Inhalt, anderer.
const gleich = await anlegen(gf, { titel: `${EIGEN} gleich` }, INHALT)
const anders = await anlegen(gf, { titel: `${EIGEN} anders` }, `${INHALT}x`)
check('Derselbe Inhalt ergibt denselben Fingerabdruck',
  gleich.body.belehrung?.pruefsumme === angelegt.body.belehrung?.pruefsumme)
check('Ein geändertes Zeichen ergibt einen anderen',
  anders.body.belehrung?.pruefsumme !== angelegt.body.belehrung?.pruefsumme)

// ── I4.2 Solange noch nichts verteilt ist ──────────────────────────────────
console.log('\n=== I4.2 Vor dem Verteilen ===')

const vorher = await hole(anna, '/api/belehrungen')
check('Ein Entwurf ist für niemanden sichtbar',
  !(vorher.body.belehrungen ?? []).some(b => b.id === id))

const entwurfDetail = await hole(anna, `/api/belehrungen/${id}`)
check('Auch nicht über die Kennung', entwurfDetail.status === 404,
  `HTTP ${entwurfDetail.status}`)

const entwurfDokument = await dokument(anna, id)
check('Und das Dokument ist nicht abrufbar', entwurfDokument.status === 404,
  `HTTP ${entwurfDokument.status}`)

const frueh = await sende(anna, `/api/belehrungen/${id}`, 'POST', {
  aktion: 'bestaetigen',
})
check('Ein Entwurf lässt sich nicht bestätigen', frueh.status === 404,
  `HTTP ${frueh.status}`)

const aenderbar = await sende(gf, `/api/belehrungen/${id}`, 'PATCH', {
  beschreibung: 'Geändert, solange es noch geht.',
})
check('Am Entwurf lässt sich alles ändern', aenderbar.status === 200,
  aenderbar.body.error)

const unvollstaendigVerteilen = await sende(
  gf, `/api/belehrungen/${ohneDatei.body.belehrung?.id}`, 'POST',
  { aktion: 'verteilen' })
check('Eine Belehrung ohne Dokument geht nicht raus',
  unvollstaendigVerteilen.status === 400, unvollstaendigVerteilen.body.error)
check('Und es steht da, was fehlt',
  (unvollstaendigVerteilen.body.fehlt ?? []).length > 0,
  JSON.stringify(unvollstaendigVerteilen.body.fehlt))

// ── I4.3 Verteilen ─────────────────────────────────────────────────────────
console.log('\n=== I4.3 Verteilen ===')

const durchPerson = await sende(anna, `/api/belehrungen/${id}`, 'POST', {
  aktion: 'verteilen',
})
// 404 und nicht 403: Ein Entwurf existiert für einen Mitarbeiter nicht. Ein
// „keine Berechtigung" verriete bereits, dass es ihn gibt.
check('Ein Mitarbeiter verteilt nichts', durchPerson.status === 404,
  `HTTP ${durchPerson.status}`)

// Bewusst an eine Handvoll und nicht an alle 300 Testpersonen: Jeder Lauf
// legte sonst dreihundert Belege an, die nie wieder wegkommen — eine
// verteilte Runde lässt sich nicht löschen, und das ist richtig so. Geprüft
// wird dadurch dasselbe: Die Auswahl ist ein zusätzlicher Filter ÜBER der
// Standortgrenze, nicht statt ihr.
const team = ((await hole(leitung, '/api/employees')).body.employees ?? [])
  .filter(e => e.active !== false)
  .slice(0, 3)
  .map(e => e.id)
const empfaenger = Array.from(new Set([mAnna.employeeId, ...team]))

const verteilt = await sende(gf, `/api/belehrungen/${id}`, 'POST', {
  aktion: 'verteilen', employeeIds: empfaenger,
})
check('Die Unternehmensebene verteilt', verteilt.body.verteilt === empfaenger.length,
  `${verteilt.body.verteilt} von ${empfaenger.length}`)

const nochmal = await sende(gf, `/api/belehrungen/${id}`, 'POST', {
  aktion: 'verteilen',
})
check('Zweimal verteilen geht nicht', nochmal.status === 409, nochmal.body.error)

const jetztSichtbar = await hole(anna, '/api/belehrungen')
const meine = (jetztSichtbar.body.belehrungen ?? []).find(b => b.id === id)
check('Die Person sieht die Belehrung jetzt', !!meine)
check('Mit dem Satz, den sie bestätigen soll',
  /gelesen, verstanden/.test(meine?.bestaetigungstext ?? ''),
  meine?.bestaetigungstext)
check('Und zählt als offen', jetztSichtbar.body.offen > 0,
  `${jetztSichtbar.body.offen} offen`)

const beiFremder = await hole(fremdePerson, '/api/belehrungen')
check('Ein fremder Betrieb bekommt nichts davon',
  !(beiFremder.body.belehrungen ?? []).some(b => b.id === id))
const fremdDetail = await hole(fremdeLeitung, `/api/belehrungen/${id}`)
check('Auch die fremde Leitung nicht', fremdDetail.status === 404,
  `HTTP ${fremdDetail.status}`)

// ── I4.4 Der Inhalt ist festgeschrieben ────────────────────────────────────
console.log('\n=== I4.4 Festgeschrieben ===')

const textAendern = await sende(gf, `/api/belehrungen/${id}`, 'PATCH', {
  bestaetigungstext: 'Ich erkenne alles an, was mir je gesagt wurde.',
})
check('Der bestätigte Wortlaut lässt sich nicht mehr austauschen',
  textAendern.status === 409, textAendern.body.error)
check('Und es wird gesagt, warum das gefährlich wäre',
  /wertlos/i.test(textAendern.body.error ?? ''), textAendern.body.error)

const titelAendern = await sende(gf, `/api/belehrungen/${id}`, 'PATCH', {
  titel: 'Etwas ganz anderes',
})
check('Der Titel auch nicht — er steht auf jedem Beleg',
  titelAendern.status === 409, titelAendern.body.error)

const fristAendern = await sende(gf, `/api/belehrungen/${id}`, 'PATCH', {
  fristBis: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
})
check('Die Frist lässt sich verlängern — das schadet niemandem',
  fristAendern.status === 200, fristAendern.body.error)

const loeschversuch = await fetch(`${BASIS}/api/belehrungen/${id}`, {
  method: 'DELETE', headers: { cookie: gf },
})
check('Eine verteilte Runde lässt sich nicht löschen',
  loeschversuch.status === 409, `HTTP ${loeschversuch.status}`)

// ── I4.5 Bestätigen ────────────────────────────────────────────────────────
console.log('\n=== I4.5 Bestätigen ===')

const ohneLesen = await sende(anna, `/api/belehrungen/${id}`, 'POST', {
  aktion: 'bestaetigen',
})
check('Ohne geöffnetes Dokument geht es nicht', ohneLesen.status === 400,
  ohneLesen.body.error)
check('Und es wird gesagt, warum',
  /öffne zuerst/i.test(ohneLesen.body.error ?? ''), ohneLesen.body.error)

const fuerJemanden = await sende(gf, `/api/belehrungen/${id}`, 'POST', {
  aktion: 'bestaetigen',
})
check('Der Betrieb bestätigt nicht für jemanden', fuerJemanden.status === 403,
  fuerJemanden.body.error)
check('Und es wird gesagt, warum das nichts belegen würde',
  /belegt nichts/i.test(fuerJemanden.body.error ?? ''), fuerJemanden.body.error)

const gelesen = await dokument(anna, id)
check('Die Person kann das Dokument öffnen', gelesen.status === 200,
  `HTTP ${gelesen.status}`)
check('Und bekommt genau das hochgeladene Dokument',
  gelesen.text.includes('Hygienebelehrung'))

const fremdDokument = await dokument(fremdePerson, id)
check('Ein fremder Betrieb kommt an das Dokument nicht heran',
  fremdDokument.status === 404 || fremdDokument.status === 403,
  `HTTP ${fremdDokument.status}`)

const bestaetigt = await sende(anna, `/api/belehrungen/${id}`, 'POST', {
  aktion: 'bestaetigen',
})
check('Nach dem Öffnen geht es', bestaetigt.status === 200, bestaetigt.body.error)
check('Der Zeitpunkt wird festgehalten', !!bestaetigt.body.bestaetigtAm)

const zweimal = await sende(anna, `/api/belehrungen/${id}`, 'POST', {
  aktion: 'bestaetigen',
})
check('Zweimal bestätigen geht nicht', zweimal.status === 400, zweimal.body.error)

// ── I4.6 Der Beleg ─────────────────────────────────────────────────────────
console.log('\n=== I4.6 Was der Beleg trägt ===')

const liste = await hole(gf, `/api/belehrungen/${id}`)
const meinBeleg = (liste.body.belege ?? []).find(b => b.employeeId === mAnna.employeeId)
check('Der Betrieb sieht die Namensliste', (liste.body.belege ?? []).length > 0,
  `${(liste.body.belege ?? []).length} Belege`)
check('Der Beleg trägt den Namen', meinBeleg?.personName === mAnna.name,
  meinBeleg?.personName)
check('Er trägt den Wortlaut als Kopie',
  /gelesen, verstanden/.test(meinBeleg?.wortlaut ?? ''), meinBeleg?.wortlaut)
check('Er trägt den Fingerabdruck des Dokuments',
  meinBeleg?.pruefsumme === angelegt.body.belehrung?.pruefsumme,
  meinBeleg?.pruefsumme)
check('Er hält fest, wann geöffnet wurde', !!meinBeleg?.angesehenAm)
check('Und womit bestätigt wurde', !!meinBeleg?.geraet, meinBeleg?.geraet)
check('Das System beurteilt die Belastbarkeit des Belegs',
  ['belegt', 'knapp'].includes(meinBeleg?.guete?.stufe),
  JSON.stringify(meinBeleg?.guete))

check('Der Stand beantwortet, wer noch fehlt',
  liste.body.stand?.bestaetigt === 1
    && liste.body.stand?.gesamt === empfaenger.length
    && liste.body.stand?.offen === empfaenger.length - 1,
  JSON.stringify(liste.body.stand))

const eigeneSicht = await hole(anna, `/api/belehrungen/${id}`)
check('Die Person sieht ihren eigenen Beleg',
  !!eigeneSicht.body.beleg?.bestaetigtAm)
check('Aber nicht die Liste der anderen',
  eigeneSicht.body.belege === undefined)

// ── I4.7 Erinnern, schließen, wiederholen ──────────────────────────────────
console.log('\n=== I4.7 Der weitere Weg ===')

const erinnert = await sende(gf, `/api/belehrungen/${id}`, 'POST', {
  aktion: 'erinnern',
})
check('Die Offenen lassen sich erinnern', erinnert.status === 200,
  JSON.stringify(erinnert.body))

const sofortNochmal = await sende(gf, `/api/belehrungen/${id}`, 'POST', {
  aktion: 'erinnern',
})
check('Aber nicht zweimal am selben Tag',
  sofortNochmal.body.erinnert === 0, JSON.stringify(sofortNochmal.body))

const wiederholt = await sende(gf, `/api/belehrungen/${id}`, 'POST', {
  aktion: 'wiederholen',
})
const neueRunde = wiederholt.body.belehrung?.id
check('Eine neue Runde entsteht aus derselben Vorlage', !!neueRunde,
  wiederholt.body.error)
check('Sie trägt den Monat im Titel',
  /\(\w+ \d{4}\)$/.test(wiederholt.body.belehrung?.titel ?? ''),
  wiederholt.body.belehrung?.titel)
check('Sie ist wieder ein Entwurf',
  wiederholt.body.belehrung?.status === 'entwurf')
check('Und teilt den Fingerabdruck — es ist dasselbe Dokument',
  wiederholt.body.belehrung?.pruefsumme === angelegt.body.belehrung?.pruefsumme)

const geschlossen = await sende(gf, `/api/belehrungen/${id}`, 'POST', {
  aktion: 'schliessen',
})
check('Die laufende Runde lässt sich schließen', geschlossen.status === 200,
  geschlossen.body.error)

const nachSchliessen = await sende(gf, `/api/belehrungen/${id}`, 'PATCH', {
  fristBis: null,
})
check('Danach lässt sich gar nichts mehr ändern', nachSchliessen.status === 409,
  nachSchliessen.body.error)

const belegBleibt = await hole(gf, `/api/belehrungen/${id}`)
check('Die abgegebenen Belege bleiben, wie sie sind',
  (belegBleibt.body.belege ?? []).some(
    b => b.employeeId === mAnna.employeeId && b.bestaetigtAm))

// ── Aufräumen ──────────────────────────────────────────────────────────────
//
// Die verteilte Runde bleibt — an ihr hängen Belege, und genau die sollen
// nicht gelöscht werden können. Weggeräumt werden die Entwürfe, die diese
// Prüfung nebenbei erzeugt hat.
console.log('\n=== Aufräumen ===')

for (const entwurf of [
  ohneDatei.body.belehrung?.id, gleich.body.belehrung?.id,
  anders.body.belehrung?.id, neueRunde,
].filter(Boolean)) {
  await fetch(`${BASIS}/api/belehrungen/${entwurf}`, {
    method: 'DELETE', headers: { cookie: gf },
  })
}

const danach = (await hole(gf, '/api/belehrungen')).body.belehrungen ?? []
check('Die Prüfung hinterlässt keine Entwürfe',
  !danach.some(b => b.status === 'entwurf' && b.titel.startsWith('I4-Belehrung')),
  danach.filter(b => b.status === 'entwurf').map(b => b.titel).join(', '))

process.exit(bilanz() ? 1 : 0)
