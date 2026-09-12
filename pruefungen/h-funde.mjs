// Nachweis H1: Funde erfassen, bewerten, freigeben.
//
// Der Kern: Eine Meldung ist nur dann etwas wert, wenn sich damit arbeiten
// lässt. Deshalb wird hier vor allem geprüft, dass die Bewertung auf dem SERVER
// entsteht — ein Browser, der seine eigene Meldung für vollständig erklärt,
// wäre kein Prüfsystem, sondern eine Selbstbescheinigung.
//
// Und der zweite Kern: Verbesserungsvorschläge werden nie ohne Freigabe gebaut.

import { BASIS, pruefer, login, hole, sende } from './helfer.mjs'

const { check, bilanz } = pruefer()

const okun = await login('okun@okun.de')
const gf = await login('gf@rheinblick-reha.de')
const anna = await login('anna.fischer@rheinblick-reha.de')
const kitaLeitung = await login('leitung@kita-sonnenschein.de')

const VOLL = {
  art: 'fehler',
  bereich: 'nachrichten',
  title: 'Gruppe lässt sich nicht eröffnen',
  schritte: 'Als Leitung auf Nachrichten, dann Gruppe eröffnen, Namen eingetragen.',
  description: 'Nach dem Klick passiert nichts, die Maske bleibt offen.',
  erwartet: 'Die Gruppe sollte angelegt werden und sich öffnen.',
  haeufigkeit: 'immer',
}

// ── H1 Erfassen ────────────────────────────────────────────────────────────
console.log('=== H1 Einen Fund melden ===')

const ohneAnmeldung = await fetch(`${BASIS}/api/bug-reports`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(VOLL),
})
check('Ohne Anmeldung nimmt niemand etwas entgegen', ohneAnmeldung.status === 401,
  `HTTP ${ohneAnmeldung.status}`)

const ohneTitel = await sende(anna, '/api/bug-reports', 'POST', { ...VOLL, title: '' })
check('Ohne Überschrift wird abgewiesen', ohneTitel.status === 400)

const voll = await sende(anna, '/api/bug-reports', 'POST', VOLL)
check('Ein vollständiger Fund wird angenommen', voll.status === 200 && !!voll.body.ticketId,
  voll.body.ticketId)
check('Die Bewertung fällt grün aus', voll.body.bewertung?.stufe === 'gruen',
  voll.body.bewertung?.text)
check('Die Kennung zeigt die Art schon vorn', /^F-/.test(voll.body.ticketId ?? ''),
  voll.body.ticketId)

// Die entscheidende Angabe weglassen — der Rest bleibt vollständig.
const ohneErwartung = await sende(anna, '/api/bug-reports', 'POST', { ...VOLL, erwartet: '' })
check('Ohne „Was hättest du erwartet" wird die Meldung gelb',
  ohneErwartung.body.bewertung?.stufe === 'gelb',
  ohneErwartung.body.bewertung?.text)
check('Sie wird trotzdem angenommen — eine abgewiesene Meldung ist verloren',
  ohneErwartung.status === 200 && !!ohneErwartung.body.ticketId)
check('Und es wird gesagt, was fehlt',
  /erwartet/.test((ohneErwartung.body.bewertung?.fehlt ?? []).join(' ')),
  (ohneErwartung.body.bewertung?.fehlt ?? []).join(' | '))

// Der Browser darf sich die Bewertung nicht selbst ausstellen.
const geschummelt = await sende(anna, '/api/bug-reports', 'POST', {
  ...VOLL, erwartet: '', meldeQualitaet: 'gruen', status: 'resolved',
})
check('Eine mitgeschickte Bewertung wird nicht übernommen',
  geschummelt.body.bewertung?.stufe === 'gelb')

// ── H1 Was Geld oder Recht berührt ─────────────────────────────────────────
console.log('\n=== H1 Geld und Recht ===')

const lohnFund = await sende(anna, '/api/bug-reports', 'POST', {
  ...VOLL, bereich: 'lohn', title: 'Nettobetrag stimmt nicht mit dem Beleg überein',
})
const meine = (await hole(anna, '/api/bug-reports')).body.reports ?? []
const lohn = meine.find(f => f.ticketId === lohnFund.body.ticketId)
check('Ein Fund am Lohn gilt von selbst als heikel', lohn?.heikel === true)
check('Und bekommt hohe Dringlichkeit', lohn?.priority === 'high', lohn?.priority)

// ── H1 Verbesserungsvorschläge ─────────────────────────────────────────────
console.log('\n=== H1 Verbesserungsvorschlag und Freigabe ===')

const vorschlag = await sende(anna, '/api/bug-reports', 'POST', {
  art: 'verbesserung', bereich: 'dienstplan',
  title: 'Woche wechseln braucht zu viele Klicks',
  description: 'Man muss jedes Mal über den Kalender gehen.',
  erwartet: 'Pfeile direkt über der Tabelle wären schneller.',
})
check('Ein Vorschlag wird angenommen', vorschlag.status === 200, vorschlag.body.error)
check('Er ist als freigabepflichtig gekennzeichnet',
  vorschlag.body.freigabePflichtig === true)
check('Ohne Schritte und Häufigkeit ist er trotzdem vollständig',
  vorschlag.body.bewertung?.stufe === 'gruen', vorschlag.body.bewertung?.text)

const meine2 = (await hole(anna, '/api/bug-reports')).body.reports ?? []
const v = meine2.find(f => f.ticketId === vorschlag.body.ticketId)
check('Er wartet auf Freigabe statt einfach offen zu sein',
  v?.status === 'wartet_freigabe', v?.status)
check('Die Freigabe steht auf offen', v?.freigabe === 'offen')

const durchMelder = await sende(anna, '/api/bug-reports', 'PATCH', {
  id: v.id, freigabe: 'freigegeben',
})
check('Der Melder kann seinen Vorschlag nicht selbst freigeben',
  durchMelder.status === 403, `HTTP ${durchMelder.status}`)

const durchKunde = await sende(gf, '/api/bug-reports', 'PATCH', {
  id: v.id, freigabe: 'freigegeben',
})
check('Auch das Unternehmen nicht', durchKunde.status === 403,
  `HTTP ${durchKunde.status}`)

const freigegeben = await sende(okun, '/api/bug-reports', 'PATCH', {
  id: v.id, freigabe: 'freigegeben', freigabeNotiz: 'Guter Punkt, bauen wir.',
})
check('OKUN gibt frei', freigegeben.status === 200, freigegeben.body.error)
check('Der Status springt auf freigegeben',
  freigegeben.body.report?.status === 'freigegeben')
check('Wer freigegeben hat, wird festgehalten',
  !!freigegeben.body.report?.freigabeVon && !!freigegeben.body.report?.freigabeAm,
  freigegeben.body.report?.freigabeVon)

// Eine Ablehnung bleibt mit Begruendung stehen — sonst liegt derselbe
// Vorschlag in drei Wochen wieder auf dem Tisch.
const zweiter = await sende(anna, '/api/bug-reports', 'POST', {
  art: 'wunsch', bereich: 'dienstplan',
  title: 'Dienstplan soll sich selbst an das Wetter anpassen',
  description: 'Bei Regen sind mehr Leute krank.',
  erwartet: 'Das System sollte die Wettervorhersage einbeziehen.',
})
const meine3 = (await hole(anna, '/api/bug-reports')).body.reports ?? []
const w = meine3.find(f => f.ticketId === zweiter.body.ticketId)
check('Auch ein Wunsch wartet auf Freigabe', w?.status === 'wartet_freigabe')

const abgelehnt = await sende(okun, '/api/bug-reports', 'PATCH', {
  id: w.id, freigabe: 'abgelehnt', freigabeNotiz: 'Zu unsicher, um darauf zu planen.',
})
check('Ein Vorschlag lässt sich ablehnen', abgelehnt.body.report?.status === 'abgelehnt')
check('Die Begründung bleibt stehen',
  abgelehnt.body.report?.freigabeNotiz?.includes('unsicher'),
  abgelehnt.body.report?.freigabeNotiz)

// ── H1 Rückfrage und Antwort ───────────────────────────────────────────────
console.log('\n=== H1 Rückfrage ===')

const unvollstaendig = meine2.find(f => f.ticketId === ohneErwartung.body.ticketId)
const gefragt = await sende(okun, '/api/bug-reports', 'PATCH', {
  id: unvollstaendig.id, rueckfrage: 'Was hättest du an der Stelle erwartet?',
})
check('OKUN kann nachfragen', gefragt.body.report?.status === 'rueckfrage')

const fremdeAntwort = await sende(kitaLeitung, '/api/bug-reports', 'PATCH', {
  id: unvollstaendig.id, antwort: 'Keine Ahnung.',
})
check('Ein Fremder antwortet nicht auf fremde Funde', fremdeAntwort.status === 403,
  `HTTP ${fremdeAntwort.status}`)

const geantwortet = await sende(anna, '/api/bug-reports', 'PATCH', {
  id: unvollstaendig.id, antwort: 'Dass die Gruppe danach in der Liste steht.',
})
check('Der Melder darf antworten', geantwortet.status === 200, geantwortet.body.error)
check('Mit der Antwort geht der Fund zurück in die Bearbeitung',
  geantwortet.body.report?.status === 'open', geantwortet.body.report?.status)

const unerlaubt = await sende(anna, '/api/bug-reports', 'PATCH', {
  id: unvollstaendig.id, status: 'resolved',
})
check('Sonst darf der Melder nichts ändern', unerlaubt.status === 403,
  `HTTP ${unerlaubt.status}`)

// ── H1 Wer was sieht ───────────────────────────────────────────────────────
console.log('\n=== H1 Wer welche Funde sieht ===')

const beiKita = (await hole(kitaLeitung, '/api/bug-reports')).body
check('Ein anderer Mandant sieht die fremden Funde nicht',
  !(beiKita.reports ?? []).some(f => f.ticketId === voll.body.ticketId),
  `${beiKita.reports?.length ?? 0} eigene Funde`)
check('Und bekommt gesagt, dass er nur die eigenen sieht', beiKita.nurEigene === true)

const beiGf = (await hole(gf, '/api/bug-reports')).body.reports ?? []
check('Auch die eigene Geschäftsführung sieht fremde Meldungen nicht',
  !beiGf.some(f => f.ticketId === voll.body.ticketId),
  `${beiGf.length} eigene Funde`)

const beiOkun = (await hole(okun, '/api/bug-reports')).body
check('OKUN sieht alles', (beiOkun.reports ?? [])
  .some(f => f.ticketId === voll.body.ticketId))
check('Und weiß, dass es die volle Sicht ist', beiOkun.nurEigene === false)

const beiAnna = (await hole(anna, '/api/bug-reports')).body.reports ?? []
check('Der Melder findet seine eigenen wieder',
  beiAnna.some(f => f.ticketId === voll.body.ticketId))

// ── H1 Erledigen ───────────────────────────────────────────────────────────
console.log('\n=== H1 Erledigen ===')

const erledigt = await sende(okun, '/api/bug-reports', 'PATCH', {
  id: voll.body.id ?? beiAnna.find(f => f.ticketId === voll.body.ticketId)?.id,
  erledigtNotiz: 'Der Chat hängt jetzt am Benutzerkonto statt am Mitarbeiter.',
})
check('Ein Fund lässt sich abschließen', erledigt.body.report?.status === 'resolved')
check('Mit einem Satz, was geändert wurde',
  erledigt.body.report?.erledigtNotiz?.includes('Benutzerkonto'))
check('Und mit Zeitpunkt', !!erledigt.body.report?.erledigtAm)

process.exit(bilanz() > 0 ? 1 : 0)
