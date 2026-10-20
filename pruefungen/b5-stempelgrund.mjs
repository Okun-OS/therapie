// Nachweis B5: Stempeln ohne Dienst, Abweichung vom Plan — und die Uhrzeit.
//
// §203
//
// WORUM ES GEHT
// Drei Meldungen des Eigentümers, alle an derselben Stelle:
//
//   1. „Wenn ich mich 10:19 einlogge, dann steht da 8:19." Die Uhrzeit wurde
//      in der Zeitzone des SERVERS gebildet. Bei Railway ist das UTC. Auf
//      jedem Stundenzettel stand damit eine falsche Uhrzeit — und bei
//      Nachtdiensten sogar der falsche Tag, also womöglich der falsche
//      Abrechnungsmonat.
//
//   2. Einstempeln ging, obwohl für den Tag kein Dienst geplant war, und
//      niemand erfuhr, warum.
//
//   3. Wer früher ging oder länger blieb, wurde nicht gefragt. Am Monatsende
//      sah die Leitung eine Zahl ohne Erklärung.
//
// WAS HIER DIE GEGENPROBEN SIND
// Die wichtigere Hälfte. Eine Rückfrage, die auch dann kommt, wenn alles
// stimmt, wird nach drei Tagen weggeklickt — und ist dann auch in den Fällen
// wertlos, auf die es ankommt. Deshalb steht unter jeder Frage hier der
// Nachweis, dass sie im Normalfall ausbleibt.

import { BASIS, pruefer, login, hole, sende } from './helfer.mjs'

const { check, bilanz } = pruefer()

const WER = 'maria.schneider@rheinblick-reha.de'
const person = await login(WER)
const gf = await login('gf@rheinblick-reha.de')
const ich = (await hole(person, '/api/auth/me')).body.user
const employeeId = ich.employeeId
const locationId = ich.locationId

/** Der Kalendertag in der Betriebszeitzone — unabhängig davon, wo das läuft. */
const berlinTag = (d) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(d)

const berlinUhr = (d) => new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hour12: false,
}).format(d)

const stempeln = (daten) =>
  sende(person, '/api/time-tracking/stempeln', 'POST', daten)

const zustand = async () =>
  (await hole(person, '/api/time-tracking/stempeln')).body.zustand

/** Einen Dienst für einen Tag setzen — oder wieder wegnehmen. */
async function dienstSetzen(tag, von, bis, shiftId) {
  return sende(gf, '/api/schedule-entries/apply-edits', 'POST', {
    locationId,
    changes: [{ action: 'set', employeeId, date: tag, shiftId, startTime: von, endTime: bis }],
  })
}
async function dienstLoeschen(tag) {
  return sende(gf, '/api/schedule-entries/apply-edits', 'POST', {
    locationId,
    changes: [{ action: 'remove', employeeId, date: tag }],
  })
}

/** Minuten auf eine „HH:MM" draufrechnen, über Mitternacht hinweg. */
function plus(uhr, min) {
  const [h, m] = uhr.split(':').map(Number)
  const gesamt = (h * 60 + m + min + 24 * 60) % (24 * 60)
  return `${String(Math.floor(gesamt / 60)).padStart(2, '0')}:`
    + `${String(gesamt % 60).padStart(2, '0')}`
}

/*
 * §203 Weggeräumt wird auch bei Abbruch — wie in f10 (§201).
 *
 * Beim ersten Lauf brach diese Prüfung in der Mitte ab und ließ drei Dienste
 * und eine laufende Stempelung stehen. Eine Prüfung, die nur bei Erfolg
 * aufräumt, räumt genau dann nicht auf, wenn etwas schiefgegangen ist.
 */
const tage = new Set()
const antragsIds = new Set()
let aufgeraeumt = false
async function wegraeumen() {
  if (aufgeraeumt) return
  aufgeraeumt = true
  const z = await zustand().catch(() => null)
  if (z?.laeuft) await stempeln({ aktion: 'gehen' }).catch(() => undefined)
  for (const tag of tage) await dienstLoeschen(tag).catch(() => undefined)
  /*
   * Die erzeugten Überstundenanträge schließen.
   *
   * Löschen ginge nicht: Für Überstundenanträge gibt es keinen Löschweg —
   * weder für die Leitung noch für den Antragsteller, der sich vertippt hat.
   * Das ist eine echte Lücke im Programm und steht als Befund im Bericht;
   * hier wird deshalb abgelehnt statt gelöscht, damit die Prüfung der Leitung
   * wenigstens keine offenen Posten hinterlässt.
   */
  for (const id of antragsIds) {
    await sende(gf, `/api/overtime-requests/${id}`, 'PATCH', {
      status: 'rejected', respondedBy: 'Nachweis B5',
      adminComment: 'Aus der Prüfung b5-stempelgrund — kein echter Antrag.',
    }).catch(() => undefined)
  }
}
for (const grund of ['uncaughtException', 'unhandledRejection']) {
  process.once(grund, async (fehler) => {
    console.error(`\n  ⚠ Abbruch (${grund}) — räume auf.`)
    await wegraeumen()
    console.error(fehler)
    process.exit(1)
  })
}

// Ausgangszustand: nicht eingestempelt, kein Dienst heute. (Regel 1.)
if ((await zustand())?.laeuft) await stempeln({ aktion: 'gehen' })
const heute = berlinTag(new Date())
tage.add(heute)
await dienstLoeschen(heute)

const schichten = (await hole(gf, `/api/shifts?locationId=${locationId}`)).body
const shiftId = (schichten.shifts ?? schichten ?? [])[0]?.id
check('Es gibt eine Schicht, an der sich ein Dienst festmachen lässt',
  Boolean(shiftId),
  shiftId ?? 'Keine Schicht gefunden — ohne sie lässt sich der Plan nicht setzen.')

// ── B5.1 Ohne geplanten Dienst wird gefragt ────────────────────────────────
console.log('=== B5.1 Einstempeln ohne Dienst ===')

const ohneGrund = await stempeln({ aktion: 'kommen' })
check('Ohne Dienst und ohne Grund wird abgelehnt', ohneGrund.status === 422,
  `HTTP ${ohneGrund.status} · ${JSON.stringify(ohneGrund.body).slice(0, 120)}`)
check('Und die Antwort trägt eine Kennung zum Auswerten',
  ohneGrund.body?.code === 'GRUND_NOETIG', JSON.stringify(ohneGrund.body?.code))
check('Sie bringt den Text für die Rückfrage gleich mit',
  typeof ohneGrund.body?.frage?.titel === 'string',
  JSON.stringify(ohneGrund.body?.frage ?? {}).slice(0, 100))

// Die Gegenprobe, auf die es ankommt: Es darf dabei KEINE Zeit entstanden sein.
check('Es ist dabei keine Zeitbuchung entstanden', (await zustand())?.laeuft === false,
  JSON.stringify(await zustand()))

const zuKurz = await stempeln({ aktion: 'kommen', grund: '.' })
check('Ein Punkt als Grund genügt nicht', zuKurz.status === 422,
  `HTTP ${zuKurz.status} — ein Pflichtfeld, das sich abhaken lässt, ist keins.`)

const mitGrund = await stempeln({ aktion: 'kommen', grund: 'Für Melanie eingesprungen' })
check('Mit Grund geht es', mitGrund.status === 200, `HTTP ${mitGrund.status}`)
check('Der Grund steht am Eintrag',
  mitGrund.body?.log?.grundKommen === 'Für Melanie eingesprungen',
  JSON.stringify(mitGrund.body?.log?.grundKommen))
check('Und die Abweichung ist vermerkt',
  mitGrund.body?.log?.abweichung === 'ohne-dienst',
  JSON.stringify(mitGrund.body?.log?.abweichung))

// ── B5.2 Die Uhrzeit — der gemeldete Fehler ────────────────────────────────
console.log('\n=== B5.2 Die Uhrzeit steht in Ortszeit, nicht in Serverzeit ===')

const erwartet = berlinUhr(new Date())
const gespeichert = mitGrund.body?.log?.clockIn
check('Die gespeicherte Uhrzeit ist die Ortszeit des Betriebs',
  gespeichert === erwartet,
  `gespeichert ${gespeichert}, erwartet ${erwartet} — `
  + 'stand hier zwei Stunden weniger, lief dieser Dienst wieder in UTC.')
check('Und der Tag ebenfalls', mitGrund.body?.log?.date === heute,
  `${mitGrund.body?.log?.date} statt ${heute}`)

// ── B5.3 Nach dem Ausstempeln wird nachgefragt ─────────────────────────────
console.log('\n=== B5.3 Die Nachfrage beim Gehen ===')

const raus = await stempeln({ aktion: 'gehen' })
check('Das Ausstempeln gelingt', raus.status === 200, `HTTP ${raus.status}`)
check('Der Stempel sitzt — die Uhr läuft nicht mehr',
  raus.body?.zustand?.laeuft === false,
  'Die Rückfrage darf das Ausstempeln NICHT blockieren: Die gearbeitete Zeit '
  + 'ist Lohn, die Begründung ist Erklärung.')
check('Es wird nach einem Grund gefragt',
  raus.body?.nachfrage?.art === 'ohne-dienst',
  JSON.stringify(raus.body?.nachfrage ?? null))

const logId = raus.body?.nachfrage?.logId

// Gegenproben an der Begründung
const leer = await sende(person, '/api/time-tracking/begruendung', 'POST', { logId, grund: ' ' })
check('Eine leere Begründung wird abgelehnt', leer.status === 400, `HTTP ${leer.status}`)

const fremd = await sende(person, '/api/time-tracking/begruendung', 'POST',
  { logId: 'gibt-es-nicht', grund: 'irgendwas' })
check('Eine fremde Kennung lässt sich nicht beschriften', fremd.status === 404,
  `HTTP ${fremd.status}`)

const ohneAnmeldung = await fetch(`${BASIS}/api/time-tracking/begruendung`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ logId, grund: 'irgendwas' }),
})
check('Ohne Anmeldung geht gar nichts', ohneAnmeldung.status === 401,
  `HTTP ${ohneAnmeldung.status}`)

const begruendet = await sende(person, '/api/time-tracking/begruendung', 'POST',
  { logId, grund: 'Kollegin war krank, Gruppe wäre sonst allein gewesen' })
check('Die Begründung wird gespeichert',
  begruendet.status === 200 && begruendet.body?.log?.grundGehen?.includes('krank'),
  `HTTP ${begruendet.status} · ${JSON.stringify(begruendet.body?.log?.grundGehen)}`)

// ── B5.4 Die Gegenprobe: Wer seinen Dienst arbeitet, wird NICHT gefragt ────
console.log('\n=== B5.4 Wer seinen Dienst arbeitet, wird nicht gefragt ===')

const vorZwei = new Date(Date.now() - 2 * 60 * 60 * 1000)
const tagVorZwei = berlinTag(vorZwei)
tage.add(tagVorZwei)
const beginn = berlinUhr(vorZwei)

await dienstSetzen(tagVorZwei, beginn, plus(beginn, 120), shiftId)

const kommenPlan = await stempeln({ aktion: 'kommen', zeitpunkt: vorZwei.toISOString() })
check('Mit geplantem Dienst braucht es keinen Grund', kommenPlan.status === 200,
  `HTTP ${kommenPlan.status} · ${JSON.stringify(kommenPlan.body?.error ?? '')}`)
check('Und es wird keine Abweichung vermerkt',
  !kommenPlan.body?.log?.abweichung,
  JSON.stringify(kommenPlan.body?.log?.abweichung))

const rausPlan = await stempeln({ aktion: 'gehen' })
check('Wer seinen Dienst arbeitet, wird NICHT gefragt',
  rausPlan.status === 200 && !rausPlan.body?.nachfrage,
  JSON.stringify(rausPlan.body?.nachfrage ?? 'keine Nachfrage'))

// ── B5.5 Länger geblieben: Frage UND Überstundenantrag ─────────────────────
console.log('\n=== B5.5 Länger geblieben ===')

const vorVier = new Date(Date.now() - 4 * 60 * 60 * 1000)
const tagVorVier = berlinTag(vorVier)
tage.add(tagVorVier)
const beginn2 = berlinUhr(vorVier)

// Plan: zwei Stunden. Gearbeitet werden vier.
await dienstSetzen(tagVorVier, beginn2, plus(beginn2, 120), shiftId)

await stempeln({ aktion: 'kommen', zeitpunkt: vorVier.toISOString() })
const laenger = await stempeln({ aktion: 'gehen' })
check('Zwei Stunden mehr werden bemerkt',
  laenger.body?.nachfrage?.art === 'laenger',
  JSON.stringify(laenger.body?.nachfrage ?? null))
check('Und die Meldung nennt den Plan',
  /\d{2}:\d{2}/.test(laenger.body?.nachfrage?.text ?? ''),
  laenger.body?.nachfrage?.text ?? '')

// Die Liste braucht eine Kennung — ohne sie antwortet die Route mit 400.
const antraege = async () =>
  (await hole(person, `/api/overtime-requests?employeeId=${employeeId}`)).body.requests ?? []
const anzahlVorher = (await antraege()).length

const mitAntrag = await sende(person, '/api/time-tracking/begruendung', 'POST', {
  logId: laenger.body?.nachfrage?.logId,
  grund: 'Übergabe an den Spätdienst hat gedauert',
  kategorie: 'Übergabe dauerte länger',
})
check('Aus der Begründung entsteht ein Überstundenantrag',
  Boolean(mitAntrag.body?.antrag?.id), JSON.stringify(mitAntrag.body?.antrag))
if (mitAntrag.body?.antrag?.id) antragsIds.add(mitAntrag.body.antrag.id)

const liste = await antraege()
check('Er steht auch wirklich in der Liste', liste.length === anzahlVorher + 1,
  `${anzahlVorher} → ${liste.length}`)
const neuester = liste.find(r => r.id === mitAntrag.body?.antrag?.id)
check('Mit der gewählten Kategorie, nicht einer geratenen',
  neuester?.reason === 'Übergabe dauerte länger', JSON.stringify(neuester?.reason))
check('Und dem freien Text als Kommentar',
  (neuester?.comment ?? '').includes('Spätdienst'), JSON.stringify(neuester?.comment))

// ── Aufräumen ──────────────────────────────────────────────────────────────
await wegraeumen()

const restlich = (await hole(person, `/api/schedule-entries?employeeId=${employeeId}`)).body
check('Die Prüfung lässt keine Dienste zurück',
  !(restlich.entries ?? []).some(e => tage.has(e.date)),
  (restlich.entries ?? []).filter(e => tage.has(e.date))
    .map(e => e.date).join(', ') || 'keine')
check('Und niemanden eingestempelt', (await zustand())?.laeuft === false)

// Nur die EIGENEN Anträge zählen hier. Alles andere aufzulisten sähe nach
// einem Befund aus, wo keiner ist.
const meineOffen = (await antraege())
  .filter(a => antragsIds.has(a.id) && a.status === 'pending')
check('Und keinen offenen Überstundenantrag', meineOffen.length === 0,
  meineOffen.map(a => a.id).join(', ') || 'keiner')

process.exit(bilanz() ? 1 : 0)
