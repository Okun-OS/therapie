// Nachweis J: Recruiting, Karriereseite und Bewerber.
//
// Hier hängt mehr dran als an den meisten anderen Prüfungen, denn hier gibt es
// zum ersten Mal eine Tür ohne Anmeldung. Drei Fragen entscheiden:
//
//   GEHT NICHTS NACH DRAUSSEN, WAS NICHT RAUS SOLL? Ein Entwurf, eine
//   geschlossene Anzeige, eine Seite, die nie eingeschaltet wurde — all das
//   darf ein Fremder nicht sehen, auch nicht, wenn er die Adresse errät.
//
//   KOMMT NICHTS HEREIN, WAS NICHT HEREIN SOLL? Das Formular steht offen im
//   Netz. Ein Automat wird wortlos verworfen, ein zu langer Text abgelehnt.
//
//   SIEHT DIE RICHTIGE PERSON DIE BEWERBUNG? Eine Bewerbung ist eine
//   Personalangelegenheit. Eine fremde Leitung hat daran nichts zu suchen.
//
// Die Rechenwege (Adressen, Löschfristen, JSON-LD) sind in
// src/lib/__tests__/recruiting.test.ts nachgerechnet.

import { pruefer, login, hole, sende, BASIS } from './helfer.mjs'

const { check, bilanz } = pruefer()

const gf = await login('gf@rheinblick-reha.de')
const leitung = await login('leitung@rheinblick-reha.de')
const anna = await login('anna.fischer@rheinblick-reha.de')
const fremdeLeitung = await login('susi.sonnenschein@kita-sonnenschein.de')

const EIGEN = `J-Recruiting ${Date.now().toString(36)}`
const SLUG = `j-pruefung-${Date.now().toString(36)}`

const standorte = (await hole(gf, '/api/locations')).body.locations ?? []
const meinStandort = (await hole(leitung, '/api/locations')).body.locations?.[0]?.id
const andererStandort = standorte.find(s => s.id !== meinStandort)?.id ?? null

/** Ohne Anmeldung — so, wie ein Fremder das System sieht. */
const oeffentlich = async (pfad) => {
  const r = await fetch(`${BASIS}${pfad}`)
  const text = await r.text()
  let body = {}
  try { body = JSON.parse(text) } catch { body = { roh: text } }
  return { status: r.status, body, text }
}
const oeffentlichSenden = async (pfad, daten) => {
  const r = await fetch(`${BASIS}${pfad}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(daten),
  })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

// ── J1 Wer eine Stelle ausschreiben darf ───────────────────────────────────
console.log('=== J1 Stellen anlegen ===')

const ohneTitel = await sende(gf, '/api/stellen', 'POST', {})
check('Eine Anzeige ohne Titel wird abgelehnt', ohneTitel.status === 400,
  ohneTitel.body.error)

const alsMitarbeiter = await hole(anna, '/api/stellen')
check('Ein Mitarbeiter sieht die Stellenverwaltung gar nicht',
  alsMitarbeiter.status === 403, `HTTP ${alsMitarbeiter.status}`)

const unternehmensweit = await sende(leitung, '/api/stellen', 'POST', {
  titel: `${EIGEN} unternehmensweit`,
})
check('Eine Standortleitung schreibt nicht unternehmensweit aus',
  unternehmensweit.status === 403, unternehmensweit.body.error)

const fremd = andererStandort
  ? await sende(leitung, '/api/stellen', 'POST', {
    titel: `${EIGEN} fremd`, locationId: andererStandort,
  })
  : { status: 403, body: {} }
check('Eine Standortleitung schreibt nicht für einen fremden Standort aus',
  fremd.status === 403, `HTTP ${fremd.status}`)

const angelegt = await sende(gf, '/api/stellen', 'POST', {
  titel: `${EIGEN} Erzieherin`, locationId: meinStandort,
  umfang: 'teilzeit', stundenProWoche: 30,
})
const stelleId = angelegt.body.stelle?.id
check('Die Unternehmensebene legt eine Anzeige an', !!stelleId, angelegt.body.error)
check('Sie entsteht als Entwurf und nicht im Internet',
  angelegt.body.stelle?.status === 'entwurf', angelegt.body.stelle?.status)
check('Sie bekommt eine lesbare Adresse',
  /^j-recruiting-[a-z0-9-]+-erzieherin$/.test(angelegt.body.stelle?.slug ?? ''),
  angelegt.body.stelle?.slug)
check('Der Ort wird vom Standort übernommen', !!angelegt.body.stelle?.ort,
  angelegt.body.stelle?.ort)

const zweite = await sende(gf, '/api/stellen', 'POST', {
  titel: `${EIGEN} Erzieherin`, locationId: meinStandort,
})
check('Zwei gleichnamige Anzeigen bekommen verschiedene Adressen',
  !!zweite.body.stelle?.slug && zweite.body.stelle.slug !== angelegt.body.stelle?.slug,
  `${angelegt.body.stelle?.slug} / ${zweite.body.stelle?.slug}`)

// ── J2 Veröffentlichen ─────────────────────────────────────────────────────
console.log('\n=== J2 Was eine Anzeige braucht, bevor sie online darf ===')

const unfertig = await sende(gf, '/api/stellen', 'PATCH', {
  id: stelleId, status: 'veroeffentlicht',
})
check('Eine unfertige Anzeige geht nicht online', unfertig.status === 400,
  unfertig.body.error)
check('Und es steht da, was fehlt', (unfertig.body.fehlt ?? []).length > 0,
  JSON.stringify(unfertig.body.fehlt))

const erfundenerStand = await sende(gf, '/api/stellen', 'PATCH', {
  id: stelleId, status: 'schwebend',
})
check('Ein erfundener Stand wird abgelehnt', erfundenerStand.status === 400,
  erfundenerStand.body.error)

const fertig = await sende(gf, '/api/stellen', 'PATCH', {
  id: stelleId, status: 'veroeffentlicht',
  beschreibung: 'Wir suchen eine Erzieherin für unsere Krippengruppe mit '
    + 'fünfzehn Kindern und einem eingespielten Team von vier Personen.',
  aufgaben: ['Begleitung der Kinder', 'Elternarbeit'],
  profil: ['Staatliche Anerkennung'],
  wirBieten: ['Unbefristeter Vertrag'],
  verguetungVon: 3200, verguetungBis: 3800, verguetungZeit: 'monat',
})
check('Wird das Fehlende im selben Zug nachgereicht, geht sie online',
  fertig.body.stelle?.status === 'veroeffentlicht', fertig.body.error)
check('Der Tag der Veröffentlichung wird festgehalten',
  !!fertig.body.stelle?.veroeffentlichtAm)

const slug = fertig.body.stelle?.slug

// ── J3 Die Karriereseite ───────────────────────────────────────────────────
console.log('\n=== J3 Die Seite nach draußen ===')

const durchLeitung = await sende(leitung, '/api/karriere-einstellungen', 'PATCH', {
  karriereSlug: SLUG,
})
check('Eine Standortleitung richtet die öffentliche Seite nicht ein',
  durchLeitung.status === 403, `HTTP ${durchLeitung.status}`)

const ohneImpressum = await sende(gf, '/api/karriere-einstellungen', 'PATCH', {
  karriereSlug: SLUG, karriereImpressum: '', karriereAktiv: true,
})
check('Ohne Impressum geht die Seite nicht online', ohneImpressum.status === 400,
  ohneImpressum.body.error)
check('Und es wird auf §5 DDG verwiesen',
  JSON.stringify(ohneImpressum.body.fehlt ?? []).includes('DDG'),
  JSON.stringify(ohneImpressum.body.fehlt))

const vorAnschalten = await oeffentlich(`/api/karriere/${SLUG}`)
check('Vor dem Einschalten findet ein Fremder die Seite nicht',
  vorAnschalten.status === 404, `HTTP ${vorAnschalten.status}`)

const erfunden = await oeffentlich('/api/karriere/gibt-es-nicht-xyz')
check('Eine unbekannte Adresse sieht genauso aus wie eine ausgeschaltete',
  erfunden.status === vorAnschalten.status, `HTTP ${erfunden.status}`)

const online = await sende(gf, '/api/karriere-einstellungen', 'PATCH', {
  karriereSlug: SLUG,
  karriereImpressum: 'Rheinblick Reha gGmbH, Musterweg 1, 50667 Köln\n'
    + 'Vertreten durch: Dr. Beispiel\nTelefon: 0221 000000',
  karriereUeberschrift: 'Arbeiten am Rheinblick',
  karriereAktiv: true,
})
check('Mit Impressum geht sie online', online.body.einstellungen?.karriereAktiv === true,
  online.body.error)

const seite = await oeffentlich(`/api/karriere/${SLUG}`)
check('Ein Fremder sieht die Seite ohne Anmeldung', seite.status === 200,
  `HTTP ${seite.status}`)
check('Die veröffentlichte Anzeige steht darauf',
  (seite.body.stellen ?? []).some(s => s.slug === slug))
check('Der Entwurf steht NICHT darauf',
  !(seite.body.stellen ?? []).some(s => s.slug === zweite.body.stelle?.slug),
  JSON.stringify((seite.body.stellen ?? []).map(s => s.slug)))
check('Die Anzeige trägt strukturierte Daten für Google for Jobs',
  seite.body.stellen?.[0]?.jobPosting?.['@type'] === 'JobPosting')
check('Mit dem Tag der Veröffentlichung — ohne ihn verwirft Google sie',
  /^\d{4}-\d{2}-\d{2}$/.test(seite.body.stellen?.[0]?.jobPosting?.datePosted ?? ''),
  seite.body.stellen?.[0]?.jobPosting?.datePosted)

const seiteHtml = await oeffentlich(`/karriere/${SLUG}`)
check('Die Seite selbst lädt ohne Anmeldung', seiteHtml.status === 200,
  `HTTP ${seiteHtml.status}`)
check('Und zeigt die Überschrift des Betriebs',
  (seiteHtml.text ?? '').includes('Arbeiten am Rheinblick'))

const anzeigeHtml = await oeffentlich(`/karriere/${SLUG}/${slug}`)
check('Die einzelne Anzeige lädt ohne Anmeldung', anzeigeHtml.status === 200,
  `HTTP ${anzeigeHtml.status}`)
check('Sie trägt das JobPosting im Seitenquelltext',
  (anzeigeHtml.text ?? '').includes('"@type":"JobPosting"'))

const feed = await oeffentlich(`/karriere/${SLUG}/stellen.xml`)
check('Der Feed für die Stellenbörsen ist abrufbar', feed.status === 200,
  `HTTP ${feed.status}`)
check('Er enthält die veröffentlichte Anzeige',
  (feed.text ?? '').includes(`${EIGEN} Erzieherin`))
check('Und nicht den Entwurf',
  ((feed.text ?? '').match(/<job>/g) ?? []).length
    === (seite.body.stellen ?? []).length,
  `${((feed.text ?? '').match(/<job>/g) ?? []).length} Anzeigen im Feed`)

const fremdeSeite = await sende(fremdeLeitung, '/api/karriere-einstellungen', 'PATCH', {
  karriereSlug: SLUG,
})
check('Ein fremder Betrieb kann die Adresse nicht übernehmen',
  fremdeSeite.status === 409 || fremdeSeite.status === 403,
  `HTTP ${fremdeSeite.status}: ${fremdeSeite.body.error}`)

// ── J4 Was durch das offene Formular kommt ─────────────────────────────────
console.log('\n=== J4 Der Eingang ===')

const ohneName = await oeffentlichSenden(`/api/karriere/${SLUG}`, {
  email: 'jemand@example.de',
})
check('Eine Bewerbung ohne Namen wird abgelehnt', ohneName.status === 400,
  ohneName.body.error)

const krummeMail = await oeffentlichSenden(`/api/karriere/${SLUG}`, {
  name: 'Test Bewerber', email: 'keine-mail',
})
check('Eine unvollständige E-Mail-Adresse wird abgelehnt', krummeMail.status === 400,
  krummeMail.body.error)

const zuLang = await oeffentlichSenden(`/api/karriere/${SLUG}`, {
  name: 'Test Bewerber', email: 'lang@example.de', nachricht: 'x'.repeat(6000),
})
check('Eine übergroße Nachricht wird abgelehnt', zuLang.status === 400,
  zuLang.body.error)

const automat = await oeffentlichSenden(`/api/karriere/${SLUG}`, {
  name: 'Werbe Automat', email: 'spam@example.de', webseite: 'http://spam.example',
})
check('Ein Automat bekommt „danke" und wird verworfen',
  automat.status === 200 && !automat.body.id,
  `HTTP ${automat.status}, id=${automat.body.id ?? 'keine'}`)

const falscheStelle = await oeffentlichSenden(`/api/karriere/${SLUG}`, {
  name: 'Test Bewerber', email: 'irr@example.de', stelle: 'gibt-es-nicht',
})
check('Eine Bewerbung auf eine unbekannte Stelle wird abgelehnt',
  falscheStelle.status === 404, falscheStelle.body.error)

const aufEntwurf = await oeffentlichSenden(`/api/karriere/${SLUG}`, {
  name: 'Test Bewerber', email: 'entwurf@example.de',
  stelle: zweite.body.stelle?.slug,
})
check('Auch nicht auf einen Entwurf, dessen Adresse man kennt',
  aufEntwurf.status === 404, aufEntwurf.body.error)

const NAME = `${EIGEN} Bewerberin`
const eingang = await oeffentlichSenden(`/api/karriere/${SLUG}`, {
  name: NAME, email: `j-bewerbung-${Date.now()}@pruefung.test`,
  telefon: '0221 12345', nachricht: 'Ich würde gern bei Ihnen arbeiten.',
  stelle: slug,
})
check('Eine gültige Bewerbung kommt an', eingang.status === 200 && !!eingang.body.id,
  eingang.body.error)

// ── J5 Wer die Bewerbung sieht ─────────────────────────────────────────────
console.log('\n=== J5 Wer die Bewerbung sieht ===')

const beimBetrieb = await hole(gf, '/api/bewerbungen')
const meine = (beimBetrieb.body.bewerbungen ?? []).find(b => b.id === eingang.body.id)
check('Sie liegt beim Betrieb im Programm', !!meine)
check('Mit dem Titel der Stelle, auf die sie sich bezieht',
  meine?.stelleTitel === `${EIGEN} Erzieherin`, meine?.stelleTitel)
check('Und dem Vermerk, dass sie über die Karriereseite kam',
  meine?.quelle === 'karriereseite', meine?.quelle)

const beiEigenerLeitung = await hole(leitung, '/api/bewerbungen')
check('Die zuständige Standortleitung sieht sie',
  (beiEigenerLeitung.body.bewerbungen ?? []).some(b => b.id === eingang.body.id))

const beiFremderLeitung = await hole(fremdeLeitung, '/api/bewerbungen')
check('Eine fremde Leitung sieht sie nicht',
  !(beiFremderLeitung.body.bewerbungen ?? []).some(b => b.id === eingang.body.id))

const durchMitarbeiter = await hole(anna, `/api/bewerbungen/${eingang.body.id}`)
check('Ein Mitarbeiter kommt gar nicht heran', durchMitarbeiter.status === 403,
  `HTTP ${durchMitarbeiter.status}`)

const fremdZugriff = await hole(fremdeLeitung, `/api/bewerbungen/${eingang.body.id}`)
check('Eine fremde Leitung kommt auch über die Kennung nicht heran',
  fremdZugriff.status === 404 || fremdZugriff.status === 403,
  `HTTP ${fremdZugriff.status}`)

const fremdAendern = await sende(fremdeLeitung, '/api/bewerbungen', 'PATCH', {
  id: eingang.body.id, status: 'absage',
})
check('Und ändert schon gar nichts daran',
  fremdAendern.status === 404 || fremdAendern.status === 403,
  `HTTP ${fremdAendern.status}`)

// ── J6 Die Pipeline und die Löschfrist ─────────────────────────────────────
console.log('\n=== J6 Der Weg durch das Verfahren ===')

const detail = await hole(gf, `/api/bewerbungen/${eingang.body.id}`)
check('Der Eingang steht im Verlauf',
  (detail.body.verlauf ?? []).some(e => e.art === 'eingegangen'),
  JSON.stringify((detail.body.verlauf ?? []).map(e => e.art)))

const gesichtet = await sende(gf, '/api/bewerbungen', 'PATCH', {
  id: eingang.body.id, status: 'gesichtet',
})
check('Der Stand lässt sich bewegen', gesichtet.body.bewerbung?.status === 'gesichtet',
  gesichtet.body.error)
check('Solange das Verfahren läuft, gibt es keine Löschfrist',
  gesichtet.body.bewerbung?.loeschenAb === null,
  gesichtet.body.bewerbung?.loeschenAb)

const perStatus = await sende(gf, '/api/bewerbungen', 'PATCH', {
  id: eingang.body.id, status: 'eingestellt',
})
check('Eine Einstellung entsteht nicht durch Setzen des Stands',
  perStatus.status === 400, perStatus.body.error)

const abgesagt = await sende(gf, '/api/bewerbungen', 'PATCH', {
  id: eingang.body.id, status: 'absage', grund: 'Stelle anderweitig besetzt',
})
check('Eine Absage beendet das Verfahren',
  abgesagt.body.bewerbung?.status === 'absage', abgesagt.body.error)
check('Und setzt damit die Löschfrist', !!abgesagt.body.bewerbung?.loeschenAb,
  abgesagt.body.bewerbung?.loeschenAb)

const frist = new Date(abgesagt.body.bewerbung?.loeschenAb ?? 0)
const inMonaten = (frist - Date.now()) / (1000 * 60 * 60 * 24 * 30)
check('Sie liegt bei rund sechs Monaten (§15 Abs.4 AGG)',
  inMonaten > 5.5 && inMonaten < 6.5, `${inMonaten.toFixed(1)} Monate`)

const zurueck = await sende(gf, '/api/bewerbungen', 'PATCH', {
  id: eingang.body.id, status: 'gespraech',
})
check('Kommt die Bewerbung zurück ins Verfahren, fällt die Frist weg',
  zurueck.body.bewerbung?.loeschenAb === null,
  zurueck.body.bewerbung?.loeschenAb)

const verlaufNachher = await hole(gf, `/api/bewerbungen/${eingang.body.id}`)
check('Jeder Standwechsel steht im Verlauf',
  (verlaufNachher.body.verlauf ?? []).filter(e => e.art === 'stand').length >= 3,
  `${(verlaufNachher.body.verlauf ?? []).filter(e => e.art === 'stand').length} Einträge`)
check('Mit dem Grund, der bei der Absage angegeben wurde',
  (verlaufNachher.body.verlauf ?? []).some(
    e => (e.text ?? '').includes('anderweitig besetzt')))

// ── J7 Aus dem Bewerber wird ein Mitarbeiter ───────────────────────────────
console.log('\n=== J7 Die Übernahme ===')

const ohneStunden = await sende(gf, `/api/bewerbungen/${eingang.body.id}`, 'POST', {
  aktion: 'uebernehmen', locationId: meinStandort, position: 'Erzieherin',
})
check('Eine Übernahme ohne Wochenstunden wird abgelehnt', ohneStunden.status === 400,
  ohneStunden.body.error)

const uebernommen = await sende(gf, `/api/bewerbungen/${eingang.body.id}`, 'POST', {
  aktion: 'uebernehmen', locationId: meinStandort, position: 'Erzieherin',
  weeklyHours: 30, einladen: false,
})
const neuerMitarbeiter = uebernommen.body.employee?.id
check('Aus der Bewerbung entsteht ein Mitarbeiter', !!neuerMitarbeiter,
  uebernommen.body.error)
check('Der Name kommt aus der Bewerbung',
  uebernommen.body.employee?.name === NAME, uebernommen.body.employee?.name)

const nachUebernahme = (await hole(gf, '/api/bewerbungen')).body.bewerbungen ?? []
const jetzt = nachUebernahme.find(b => b.id === eingang.body.id)
check('Die Bewerbung steht danach auf „eingestellt"', jetzt?.status === 'eingestellt',
  jetzt?.status)
check('Sie ist mit dem Mitarbeiter verknüpft', jetzt?.employeeId === neuerMitarbeiter)
check('Und wird nicht mehr gelöscht — sie folgt jetzt der Personalakte',
  jetzt?.loeschenAb === null, jetzt?.loeschenAb)

const nochmal = await sende(gf, `/api/bewerbungen/${eingang.body.id}`, 'POST', {
  aktion: 'uebernehmen', locationId: meinStandort, position: 'Erzieherin',
  weeklyHours: 30,
})
check('Zweimal übernehmen geht nicht', nochmal.status === 409, nochmal.body.error)

const nachtraeglich = await sende(gf, '/api/bewerbungen', 'PATCH', {
  id: eingang.body.id, status: 'absage',
})
check('Ein Eingestellter wird nicht nachträglich abgesagt',
  nachtraeglich.status === 400, nachtraeglich.body.error)

const loeschversuch = await fetch(`${BASIS}/api/bewerbungen/${eingang.body.id}`, {
  method: 'DELETE', headers: { cookie: gf },
})
check('Und seine Bewerbung wird hier nicht gelöscht — dafür gibt es die Akte',
  loeschversuch.status === 409, `HTTP ${loeschversuch.status}`)

const fristenNeu = await hole(gf, `/api/fristen?employeeId=${neuerMitarbeiter}`)
check('Die Pflichtnachweise stehen ab dem ersten Tag',
  (fristenNeu.body.eintraege ?? []).length > 0,
  `${(fristenNeu.body.eintraege ?? []).length} Fristen`)

// ── J8 Der Feierabend: was nicht mehr online steht ─────────────────────────
console.log('\n=== J8 Schließen und abschalten ===')

const geschlossen = await sende(gf, '/api/stellen', 'PATCH', {
  id: stelleId, status: 'geschlossen',
})
check('Eine Anzeige lässt sich schließen',
  geschlossen.body.stelle?.status === 'geschlossen', geschlossen.body.error)

const nachSchliessen = await oeffentlich(`/api/karriere/${SLUG}`)
check('Danach steht sie nicht mehr auf der Karriereseite',
  !(nachSchliessen.body.stellen ?? []).some(s => s.slug === slug))

const alteAnzeige = await oeffentlich(`/karriere/${SLUG}/${slug}`)
check('Und ihre Adresse führt ins Leere', alteAnzeige.status === 404,
  `HTTP ${alteAnzeige.status}`)

const bewerbungDaran = await oeffentlichSenden(`/api/karriere/${SLUG}`, {
  name: 'Zu spät', email: 'spaet@example.de', stelle: slug,
})
check('Auf eine geschlossene Stelle bewirbt sich niemand mehr',
  bewerbungDaran.status === 404, bewerbungDaran.body.error)

const loeschenMitBewerbung = await fetch(`${BASIS}/api/stellen?id=${stelleId}`, {
  method: 'DELETE', headers: { cookie: gf },
})
check('Eine Anzeige mit Bewerbungen wird nicht gelöscht, sondern geschlossen',
  loeschenMitBewerbung.status === 409, `HTTP ${loeschenMitBewerbung.status}`)

const abgeschaltet = await sende(gf, '/api/karriere-einstellungen', 'PATCH', {
  karriereAktiv: false,
})
check('Die Seite lässt sich wieder abschalten',
  abgeschaltet.body.einstellungen?.karriereAktiv === false, abgeschaltet.body.error)

const danach = await oeffentlich(`/api/karriere/${SLUG}`)
check('Danach ist sie für einen Fremden verschwunden', danach.status === 404,
  `HTTP ${danach.status}`)

const feedDanach = await oeffentlich(`/karriere/${SLUG}/stellen.xml`)
check('Auch der Feed', feedDanach.status === 404, `HTTP ${feedDanach.status}`)

// ── Aufräumen ──────────────────────────────────────────────────────────────
//
// Was diese Prüfung anlegt, räumt sie wieder weg: den Entwurf, die
// Karriereadresse und die angelegte Person. Eine Prüfung, die Spuren
// hinterlässt, bringt die nächste zum Scheitern — das ist hier schon
// zweimal passiert.
console.log('\n=== Aufräumen ===')

if (zweite.body.stelle?.id) {
  await fetch(`${BASIS}/api/stellen?id=${zweite.body.stelle.id}`, {
    method: 'DELETE', headers: { cookie: gf },
  })
}
await sende(gf, '/api/karriere-einstellungen', 'PATCH', {
  karriereSlug: `${SLUG}-abgelegt`, karriereAktiv: false,
})

if (neuerMitarbeiter) {
  const okun = await login('okun@okun.de').catch(() => null)
  if (okun) {
    await fetch(`${BASIS}/api/employees/${neuerMitarbeiter}`, {
      method: 'DELETE', headers: { cookie: okun },
    })
  }
}

const aufgeraeumt = (await hole(gf, '/api/stellen')).body.stellen ?? []
check('Die Prüfung hinterlässt keinen Entwurf',
  !aufgeraeumt.some(s => s.id === zweite.body.stelle?.id))

process.exit(bilanz() ? 1 : 0)
