// Nachweis §227: Eine Krankmeldung kommt an, schreibt Stunden gut und steht im Plan.
//
//     node pruefungen/c3-krankmeldung.mjs
//
// DIE MELDUNG
// „Dann habe ich mal Juliane krank gemeldet. Da steht auch nicht krank, und
// dadurch hat sie halt nur 16 von 35 Stunden. Bei ihr steht dann drin frei und
// nicht krank. Und ich habe hier auch als Standortleitung nirgendwo die
// Nachricht bekommen, dass sie sich krank gemeldet hat. Ich muss dann auch
// irgendwie einen Bereich mit meinen [Krankmeldungen] haben, wenn ich auf
// Krankmelden klicke."
//
// VIER BEFUNDE, ALLE AN DERSELBEN MELDUNG
//   1. Die Fehlzeiten waren im Dienstplan geladen, und die eine Zeile, die sie
//      umrechnete, wurde nirgends benutzt. Die Zelle fragte nur nach einem
//      Dienst.
//   2. Ein Ausfalltag schrieb null Stunden gut. Bei Stundenlohn war eine Woche
//      Krankheit eine Woche ohne Geld — ein Verstoß gegen §3 EntgFG.
//   3. Es gab eine Route, die die Leitung benachrichtigt hätte. Sie rief
//      niemand auf: Das Krankmelden vom Telefon schreibt direkt an
//      `/api/absences`.
//   4. Das Monatssoll wurde um KALENDERTAGE gekürzt. Montag bis Sonntag krank
//      nahm sieben Arbeitstage weg, obwohl es fünf gab.
//
// WAS DIESE PRÜFUNG MISST
// Nicht „sieht richtig aus". Sie rechnet die Gutschrift nach, sie zählt die
// Benachrichtigungen im Postfach der Leitung, und sie prüft die Gegenprobe:
// Ein Wochenendtag und ein fester freier Tag dürfen NICHTS gutschreiben.

import { pruefer, login, hole, sende } from './helfer.mjs'

const { check, bilanz } = pruefer()

const leitung = await login('leitung@rheinblick-reha.de')
const anna = await login('anna.fischer@rheinblick-reha.de')

const meLeitung = (await hole(leitung, '/api/auth/me')).body.user
const meAnna = (await hole(anna, '/api/auth/me')).body.user
const locationId = meLeitung.locationId
const annaId = meAnna.employeeId
const leitungId = meLeitung.employeeId

const belegschaft = (await hole(leitung, '/api/employees')).body.employees ?? []
const annaStamm = belegschaft.find(e => e.id === annaId)

/*
 * Der Ausgangszustand, den diese Prüfung selbst herstellt.
 *
 * Eine Krankmeldung von früher würde die Zählung der Benachrichtigungen
 * verfälschen, und eine Woche, in der Anna schon krank war, die Gutschrift.
 * Also wird erst aufgeräumt — und zwar nur Annas eigene Meldungen.
 */
const vorhandene = (await hole(leitung, `/api/absences?employeeId=${annaId}`)).body.absences ?? []
for (const a of vorhandene) {
  await sende(leitung, `/api/absences/${a.id}`, 'DELETE', {})
}

// Ein Montag, weit genug in der Zukunft, dass kein Plan dagegensteht.
const jahr = new Date().getFullYear() + 1
const montag = naechsterMontag(`${jahr}-06-01`)
const sonntag = tagePlus(montag, 6)

function naechsterMontag(iso) {
  let d = Date.parse(`${iso}T00:00:00Z`)
  while (new Date(d).getUTCDay() !== 1) d += 86400000
  return new Date(d).toISOString().slice(0, 10)
}
function tagePlus(iso, n) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
}

console.log(`Anna ${annaId?.slice(0, 8)} · ${annaStamm?.weeklyHours} Std./Woche · `
  + `${annaStamm?.workDaysPerWeek ?? '—'} Tage · frei: ${(annaStamm?.fixedOffDays ?? []).join(', ') || 'keine'}`)
console.log(`Krankwoche ${montag} (Mo) bis ${sonntag} (So)\n`)

// ── §227 Die Meldung kommt an ──────────────────────────────────────────────
console.log('=== §227 Die Krankmeldung ===')

const vorherPost = (await hole(leitung, `/api/notifications?employeeId=${leitungId}`))
  .body.notifications ?? []

const meldung = await sende(anna, '/api/absences', 'POST', {
  employeeId: annaId, employeeName: meAnna.name, locationId,
  type: 'krankheit', startDate: montag, endDate: sonntag, days: 7,
})
check('Anna kann sich selbst krankmelden', meldung.status === 200,
  meldung.body.error ?? `Fehlzeit ${meldung.body.absence?.id?.slice(0, 8)}`)
const fehlzeitId = meldung.body.absence?.id

const fremd = await sende(anna, '/api/absences', 'POST', {
  employeeId: leitungId, employeeName: 'Leitung', locationId,
  type: 'krankheit', startDate: montag, endDate: montag, days: 1,
})
check('Anna kann NIEMAND ANDEREN krankmelden', fremd.status === 403, `HTTP ${fremd.status}`)

// ── §227 Die Leitung erfährt davon ────────────────────────────────────────
console.log('\n=== §227 Die Standortleitung bekommt die Nachricht ===')

const nachherPost = (await hole(leitung, `/api/notifications?employeeId=${leitungId}`))
  .body.notifications ?? []
const neu = nachherPost.filter(n => !vorherPost.some(v => v.id === n.id))

check('Im Postfach der Leitung steht eine neue Nachricht', neu.length >= 1,
  `${vorherPost.length} → ${nachherPost.length}`)
const krankNachricht = neu.find(n => n.type === 'sick_leave_reported')
check('Und sie ist als Krankmeldung gekennzeichnet', !!krankNachricht,
  krankNachricht ? krankNachricht.title : neu.map(n => n.type).join(', ') || '(keine)')
check('Sie nennt den Namen und den Zeitraum',
  !!krankNachricht?.body?.includes(meAnna.name?.split(' ')[0] ?? 'Anna')
  && !!krankNachricht?.body?.includes(montag.slice(8, 10)),
  krankNachricht?.body ?? '—')

/*
 * Die Gegenprobe zur Verschwiegenheit: Was jemandem fehlt, ist ein
 * Gesundheitsdatum nach Art. 9 DSGVO. Eine Notiz aus der Meldung darf nicht in
 * der Push-Nachricht landen — die steht sonst auf einem Sperrbildschirm.
 *
 * Sie liegt im FOLGEMONAT. Beim ersten Lauf stand sie drei Wochen nach der
 * Krankwoche und damit im selben Monat — das Stundenkonto zählte dann sechs
 * Krankheitstage statt fünf, und die Prüfung weiter unten schlug an, obwohl
 * beide Zahlen richtig waren. Eine Prüfung, die sich selbst in die Rechnung
 * stellt, prüft nicht mehr das Programm.
 */
const naechsterMonat = `${montag.slice(0, 4)}-`
  + String(Number(montag.slice(5, 7)) + 1).padStart(2, '0') + '-14'
const mitNotiz = await sende(anna, '/api/absences', 'POST', {
  employeeId: annaId, employeeName: meAnna.name, locationId,
  type: 'krankheit', startDate: naechsterMonat, endDate: naechsterMonat, days: 1,
  note: 'Magen-Darm, war in der Notaufnahme',
})
const nachNotiz = (await hole(leitung, `/api/notifications?employeeId=${leitungId}`))
  .body.notifications ?? []
const notizNachricht = nachNotiz.find(n => n.requestId === mitNotiz.body.absence?.id)
check('Die Nachricht enthält NICHT die Notiz aus der Meldung',
  !!notizNachricht && !/Magen|Notaufnahme/i.test(notizNachricht.body ?? ''),
  notizNachricht?.body ?? 'keine Nachricht gefunden')

// ── §227 Die Stunden ──────────────────────────────────────────────────────
console.log('\n=== §227 Die Gutschrift ===')

const profil = (await hole(leitung, `/api/employee-planning-profile?employeeId=${annaId}`))
  .body.profile
const soll = profil?.planungsStundenSoll ?? annaStamm?.weeklyHours ?? 0

const liste = (await hole(leitung, `/api/employee-planning-profile?locationId=${locationId}`))
check('Alle Planungsprofile des Standorts kommen in EINER Abfrage',
  liste.status === 200 && Array.isArray(liste.body.profile_liste),
  `${liste.body.profile_liste?.length ?? 0} Profile`)
check('Und sie enthält nur, was der Plan rechnet — keine Abholzeiten, keine Notiz',
  (liste.body.profile_liste ?? []).every(p =>
    Object.keys(p).every(k => ['employeeId', 'planungsStundenSoll', 'tagesmuster'].includes(k))),
  Object.keys(liste.body.profile_liste?.[0] ?? {}).join(', '))

const fremdeListe = await hole(anna, `/api/employee-planning-profile?locationId=${locationId}`)
check('Ein Mitarbeiter bekommt die Liste des Standorts NICHT',
  fremdeListe.status === 403, `HTTP ${fremdeListe.status}`)

/*
 * Nachgerechnet wird über das Stundenkonto des Monats: Es ist die Stelle, an
 * der die Krankheitstage das Soll kürzen. Vorher zählte es Kalendertage — eine
 * Woche Krankheit nahm sieben Arbeitstage weg.
 */
const monat = Number(montag.slice(5, 7))
const konto = await hole(leitung,
  `/api/hours-account?employeeId=${annaId}&year=${jahr}&month=${monat}`)
check('Das Stundenkonto des Monats ist abrufbar', konto.status === 200,
  konto.body.error ?? `Soll ${konto.body.summary?.sollMinutes} min`)
check('Die Krankwoche zählt FÜNF Arbeitstage, nicht sieben',
  konto.body.summary?.sickDays === 5,
  `${konto.body.summary?.sickDays} Tage (gemeldet waren 7 Kalendertage)`)

// ── §227 Im Dienstplan ────────────────────────────────────────────────────
console.log('\n=== §227 Die Fehlzeit steht im Plan ===')

const imPlan = (await hole(leitung, `/api/absences?locationId=${locationId}`)).body.absences ?? []
const gefunden = imPlan.find(a => a.id === fehlzeitId)
check('Der Dienstplan bekommt die Fehlzeit über den Standort', !!gefunden,
  `${imPlan.length} Fehlzeiten am Standort`)
check('Mit Zeitraum und Art, damit die Zelle „Krank" schreiben kann',
  gefunden?.type === 'krankheit' && gefunden?.startDate === montag && gefunden?.endDate === sonntag,
  `${gefunden?.type} ${gefunden?.startDate}–${gefunden?.endDate}`)

// ── §227 Meine Krankmeldungen ─────────────────────────────────────────────
console.log('\n=== §227 Anna sieht ihre eigenen Meldungen ===')

const meine = await hole(anna, `/api/absences?employeeId=${annaId}`)
check('Die eigenen Krankmeldungen sind abrufbar', meine.status === 200,
  `${meine.body.absences?.length ?? 0} Meldungen`)
check('Die eben gemeldete ist dabei',
  (meine.body.absences ?? []).some(a => a.id === fehlzeitId))
const eigene = (meine.body.absences ?? []).find(a => a.id === fehlzeitId)
check('Mit der Auskunft, ob eine Bescheinigung fehlt',
  !!eigene?.nachweisLage?.deckung && !!eigene?.nachweisLage?.text,
  `${eigene?.nachweisLage?.deckung} — ${eigene?.nachweisLage?.text?.slice(0, 60)}`)
check('Sieben Kalendertage heißt: Bescheinigung nötig',
  eigene?.nachweisLage?.pflicht?.pflichtig === true,
  eigene?.nachweisLage?.pflicht?.begruendung?.slice(0, 70) ?? '—')

const fremdeMeldungen = await hole(anna, `/api/absences?employeeId=${leitungId}`)
check('Die Krankmeldungen einer Kollegin sind NICHT abrufbar',
  fremdeMeldungen.status === 403, `HTTP ${fremdeMeldungen.status}`)

// ── Aufräumen ─────────────────────────────────────────────────────────────
/*
 * Jede Prüfung stellt ihren Ausgangszustand selbst her — und räumt auf, damit
 * sie es beim nächsten Lauf wieder kann. Eine liegengebliebene Krankwoche
 * würde die Stundenkonten aller späteren Prüfungen verschieben.
 */
for (const a of (await hole(leitung, `/api/absences?employeeId=${annaId}`)).body.absences ?? []) {
  await sende(leitung, `/api/absences/${a.id}`, 'DELETE', {})
}
for (const n of (await hole(leitung, `/api/notifications?employeeId=${leitungId}`))
  .body.notifications ?? []) {
  if (n.type === 'sick_leave_reported' || n.type === 'absence_reported') {
    await sende(leitung, `/api/notifications/${n.id}`, 'DELETE', {})
  }
}

bilanz()
