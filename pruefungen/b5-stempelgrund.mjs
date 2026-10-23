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

/** Minuten zwischen zwei „HH:MM", über Mitternacht hinweg. */
function dauerMinuten(von, bis) {
  const m = (u) => { const [h, x] = String(u).split(':').map(Number); return h * 60 + x }
  const a = m(von); const b = m(bis)
  return b >= a ? b - a : b + 24 * 60 - a
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


// ── B5.6 Den eigenen Antrag zurückziehen ───────────────────────────────────
console.log('\n=== B5.6 Zurückziehen ===')

/*
 * §204 Vorher führte hier nichts heraus: Wer versehentlich Mehrarbeit
 * gemeldet hatte, bekam den Antrag nicht mehr weg, und die Leitung musste
 * über einen fremden Irrtum entscheiden.
 *
 * Die Gegenproben sind hier die halbe Prüfung. Ein Löschweg, der zu weit
 * reicht, ist schlimmer als keiner: Dann verschwinden fremde Anträge oder
 * entschiedene Vorgänge, und hinterher steht Aussage gegen Aussage.
 */
const vorVierB = new Date(Date.now() - 4 * 60 * 60 * 1000)
const tagB = berlinTag(vorVierB)
tage.add(tagB)
await dienstSetzen(tagB, berlinUhr(vorVierB), plus(berlinUhr(vorVierB), 120), shiftId)
await stempeln({ aktion: 'kommen', zeitpunkt: vorVierB.toISOString() })
const rausB = await stempeln({ aktion: 'gehen' })
const neuerAntrag = (await sende(person, '/api/time-tracking/begruendung', 'POST', {
  logId: rausB.body?.nachfrage?.logId,
  grund: 'Versehentlich gemeldet — wird gleich zurückgezogen',
})).body?.antrag
check('Für den Versuch steht ein Antrag bereit', Boolean(neuerAntrag?.id),
  JSON.stringify(neuerAntrag))
if (neuerAntrag?.id) antragsIds.add(neuerAntrag.id)

// Gegenprobe 1: Ein Fremder kommt nicht heran.
const fremderZugang = await login('thomas.weber@rheinblick-reha.de')
const fremdesLoeschen = await sende(fremderZugang,
  `/api/overtime-requests/${neuerAntrag?.id}`, 'DELETE')
check('Ein fremder Antrag lässt sich NICHT zurückziehen',
  fremdesLoeschen.status === 403, `HTTP ${fremdesLoeschen.status}`)

// Gegenprobe 2: Auch die Leitung nicht — sie hat genehmigen und ablehnen,
// und beides hinterlässt eine Spur.
const leitungLoeschen = await sende(gf,
  `/api/overtime-requests/${neuerAntrag?.id}`, 'DELETE')
check('Auch die Leitung löscht keinen fremden Antrag',
  leitungLoeschen.status === 403, `HTTP ${leitungLoeschen.status}`)

const ohneAnmeldungLoeschen = await fetch(
  `${BASIS}/api/overtime-requests/${neuerAntrag?.id}`, { method: 'DELETE' })
check('Ohne Anmeldung erst recht nicht', ohneAnmeldungLoeschen.status === 401,
  `HTTP ${ohneAnmeldungLoeschen.status}`)

// Und er ist nach alldem noch da.
check('Nach den Fehlversuchen steht der Antrag unverändert da',
  (await antraege()).some(a => a.id === neuerAntrag?.id))

const zurueck = await sende(person, `/api/overtime-requests/${neuerAntrag?.id}`, 'DELETE')
check('Der eigene Antrag lässt sich zurückziehen', zurueck.status === 200,
  `HTTP ${zurueck.status} · ${JSON.stringify(zurueck.body)}`)
check('Und ist danach wirklich weg',
  !(await antraege()).some(a => a.id === neuerAntrag?.id))
if (neuerAntrag?.id) antragsIds.delete(neuerAntrag.id)

// Gegenprobe 3: Die Spur bleibt am Zeiteintrag. Genau deshalb darf der
// Antrag verschwinden — was passiert ist, steht woanders.
const logsNachher = (await hole(person,
  `/api/time-logs?employeeId=${employeeId}`)).body.logs ?? []
const betroffen = logsNachher.find(l => l.id === rausB.body?.nachfrage?.logId)
check('Die Begründung steht weiterhin am Zeiteintrag',
  (betroffen?.grundGehen ?? '').includes('Versehentlich'),
  JSON.stringify(betroffen?.grundGehen))
check('Und die Abweichung ebenfalls', betroffen?.abweichung === 'laenger',
  JSON.stringify(betroffen?.abweichung))

/*
 * §204 Und sie kommt bei der LEITUNG an.
 *
 * Diese beiden Checks waren beim ersten Lauf rot — und haben damit einen
 * größeren Fehler aufgedeckt als den, um den es hier ging: Die Felder gab es
 * seit §203 in der Datenbank, aber der Mapper ließ sie weg. Gefragt wurde
 * also, gespeichert auch, gelesen von niemandem. Die Leitung sah weiter eine
 * Zahl ohne Erklärung — genau das, was §203 abstellen sollte.
 *
 * Deshalb steht die Prüfung jetzt ausdrücklich auch aus ihrer Sicht da.
 */
const ausSichtDerLeitung = (await hole(gf,
  `/api/time-logs?employeeId=${employeeId}`)).body.logs ?? []
const beiDerLeitung = ausSichtDerLeitung.find(l => l.id === rausB.body?.nachfrage?.logId)
check('Die Leitung sieht die Abweichung', beiDerLeitung?.abweichung === 'laenger',
  JSON.stringify(beiDerLeitung?.abweichung))
check('Und sie sieht auch den Grund dazu',
  (beiDerLeitung?.grundGehen ?? '').includes('Versehentlich'),
  JSON.stringify(beiDerLeitung?.grundGehen))

// Gegenprobe 4: Ein entschiedener Antrag bleibt. „Zurückziehen" nach der
// Genehmigung hiesse, eine Entscheidung zu tilgen.
const vorDreiB = new Date(Date.now() - 3 * 60 * 60 * 1000)
const tagC = berlinTag(vorDreiB)
tage.add(tagC)
await dienstSetzen(tagC, berlinUhr(vorDreiB), plus(berlinUhr(vorDreiB), 60), shiftId)
await stempeln({ aktion: 'kommen', zeitpunkt: vorDreiB.toISOString() })
const rausC = await stempeln({ aktion: 'gehen' })
const antragC = (await sende(person, '/api/time-tracking/begruendung', 'POST', {
  logId: rausC.body?.nachfrage?.logId, grund: 'Wird gleich entschieden',
})).body?.antrag
if (antragC?.id) antragsIds.add(antragC.id)
await sende(gf, `/api/overtime-requests/${antragC?.id}`, 'PATCH', {
  status: 'approved', respondedBy: 'Nachweis B5', approvedMinutes: 60,
})
const nachEntscheidung = await sende(person,
  `/api/overtime-requests/${antragC?.id}`, 'DELETE')
check('Ein entschiedener Antrag lässt sich nicht mehr zurückziehen',
  nachEntscheidung.status === 409, `HTTP ${nachEntscheidung.status}`)
check('Und die Antwort sagt, warum',
  nachEntscheidung.body?.code === 'SCHON_ENTSCHIEDEN',
  JSON.stringify(nachEntscheidung.body?.code))

const erfunden = await sende(person, '/api/overtime-requests/gibt-es-nicht', 'DELETE')
check('Eine erfundene Kennung ergibt 404', erfunden.status === 404,
  `HTTP ${erfunden.status}`)


// ── B5.7 Die Pause wird genau einmal abgezogen ─────────────────────────────
console.log('\n=== B5.7 Pause, Summen und die Korrektur ===')

/*
 * §206 Der Eigentümer hat gemeldet: „Die Zeiten stimmen nicht überein."
 * Ein Eintrag zeigte 3 h 32 min, die Kachel darüber 0 h 44 min für denselben
 * Tag. 212 − 168 = 44 — die Pause war ein zweites Mal abgezogen.
 *
 * Dahinter steckte Schlimmeres: Die Spalte `totalMinutes` hatte ZWEI
 * Bedeutungen. Die Stempeluhr schrieb netto, die Korrektur der Leitung
 * brutto — und die Lohnabrechnung nimmt den Wert unverändert als bezahlte
 * Zeit. Eine korrigierte Buchung wurde um die ganze Pause zu hoch bezahlt.
 *
 * Deshalb steht hier die Gegenprobe, die das gefunden hätte: beide
 * Schreibwege am selben Eintrag, und beide müssen dieselbe Zahl ergeben.
 */

const vorDrei = new Date(Date.now() - 3 * 60 * 60 * 1000)
const vorEins = new Date(Date.now() - 1 * 60 * 60 * 1000)
const tagP = berlinTag(vorDrei)
tage.add(tagP)
await dienstSetzen(tagP, berlinUhr(vorDrei), plus(berlinUhr(vorDrei), 180), shiftId)

const kommenP = await stempeln({ aktion: 'kommen', zeitpunkt: vorDrei.toISOString() })
// Eine Stunde Pause, nachgereicht wie aus dem Funkloch.
await stempeln({ aktion: 'pause-start', zeitpunkt: vorEins.toISOString() })
await stempeln({ aktion: 'pause-ende', zeitpunkt: new Date(Date.now() - 30 * 60 * 1000).toISOString() })
await stempeln({ aktion: 'gehen' })

/*
 * §206 Die Buchung über ihre KENNUNG wiederfinden, nicht über das Datum.
 *
 * Erster Versuch nahm die erste Buchung des Tages. Allein bestand die
 * Prüfung damit, im Gesamtlauf nicht: b2 und b3 stempeln für dieselbe Person
 * am selben Tag und lassen ihre Buchungen stehen — dann traf `find` die
 * falsche. Eine Prüfung, die nur allein besteht, ist kein Sicherheitsnetz
 * (Regel 1 der Nachweis-README).
 */
const eigeneId = kommenP.body?.log?.id
const logsP = (await hole(person, `/api/time-logs?employeeId=${employeeId}`)).body.logs ?? []
const eintrag = logsP.find(l => l.id === eigeneId)
check('Die Zeitbuchung steht da', Boolean(eintrag), JSON.stringify(eintrag ?? null).slice(0, 140))
check('Die Pause ist vermerkt', (eintrag?.breakMinutes ?? 0) >= 25,
  `${eintrag?.breakMinutes} Minuten`)

// Anwesenheit = gearbeitet + Pause. Die Stempeluhr hat die Pause genau
// einmal abgezogen — also muss das wieder zusammenpassen.
const anwesend = dauerMinuten(eintrag?.clockIn, eintrag?.clockOut)
check('Gearbeitet + Pause ergibt wieder die Anwesenheit',
  Math.abs((eintrag.totalMinutes + eintrag.breakMinutes) - anwesend) <= 1,
  `${eintrag?.totalMinutes} + ${eintrag?.breakMinutes} = `
  + `${eintrag?.totalMinutes + eintrag?.breakMinutes}, anwesend ${anwesend}`)

// Die Summe im Stundenkonto darf die Pause NICHT noch einmal abziehen.
const jahr = Number(tagP.slice(0, 4))
const monat = Number(tagP.slice(5, 7))
const konto = (await hole(person,
  `/api/hours-account?employeeId=${employeeId}&year=${jahr}&month=${monat}`)).body.summary
const summeAusEintraegen = logsP
  .filter(l => l.date.startsWith(`${jahr}-${String(monat).padStart(2, '0')}`))
  .reduce((s, l) => s + (l.totalMinutes ?? 0), 0)
check('Das Stundenkonto zählt dieselben Minuten wie die Einträge',
  konto?.istMinutes === summeAusEintraegen,
  `Konto ${konto?.istMinutes}, Einträge ${summeAusEintraegen} — `
  + 'ein Unterschied in Höhe der Pausen hieße: zweimal abgezogen.')

// ── Die Korrektur der Leitung schreibt dasselbe ───────────────────────────
const abschluss = (await sende(gf, '/api/monthly-closings/get-or-create', 'POST', {
  employeeId, year: jahr, month: monat,
})).body
const abschlussId = abschluss?.closing?.id ?? abschluss?.id
check('Für den Monat gibt es einen Abschluss', Boolean(abschlussId),
  JSON.stringify(abschluss ?? null).slice(0, 140))

const neuesEnde = plus(eintrag.clockOut, 60)
const korrigiert = await sende(gf, `/api/monthly-closings/${abschlussId}/correct`, 'POST', {
  timeLogId: eintrag.id,
  updates: { clockIn: eintrag.clockIn, clockOut: neuesEnde, breakMinutes: eintrag.breakMinutes },
  correctedBy: 'Nachweis B5',
})
check('Die Leitung kann die Buchung korrigieren', korrigiert.status === 200,
  `HTTP ${korrigiert.status} · ${JSON.stringify(korrigiert.body).slice(0, 120)}`)

const nachKorrektur = ((await hole(person,
  `/api/time-logs?employeeId=${employeeId}`)).body.logs ?? []).find(l => l.id === eintrag.id)
const anwesendNeu = dauerMinuten(nachKorrektur?.clockIn, nachKorrektur?.clockOut)
check('Auch nach der Korrektur ist die Pause genau einmal abgezogen',
  nachKorrektur?.totalMinutes === anwesendNeu - nachKorrektur?.breakMinutes,
  `${nachKorrektur?.totalMinutes} statt ${anwesendNeu - (nachKorrektur?.breakMinutes ?? 0)} `
  + '— hier schrieb die Korrektur brutto, die Stempeluhr netto. Die '
  + 'Lohnabrechnung nimmt den Wert ungeprüft als bezahlte Zeit.')
check('Und die Stunde mehr ist wirklich angekommen',
  nachKorrektur?.totalMinutes === eintrag.totalMinutes + 60,
  `${eintrag?.totalMinutes} → ${nachKorrektur?.totalMinutes}`)

// ── B5.8 (§219) Die Uhrzeit beim Einstempeln ──────────────────────────────
console.log('\n=== B5.8 Einstempeln zur falschen Zeit ===')

/*
 * Der Fall aus dem Betrieb: Für den Tag ist 07:15 geplant, eingestempelt wird
 * um 23 Uhr — und es kam keine einzige Rückfrage. Gefragt wurde bis §219 nur,
 * OB ein Dienst geplant ist, nicht ob DIESER gerade anfängt. Wer dann acht
 * Stunden blieb, hatte obendrein eine tadellose Dauer.
 */
if ((await zustand())?.laeuft) await stempeln({ aktion: 'gehen' })

const jetzt = new Date()
const tagHeute = berlinTag(jetzt)
tage.add(tagHeute)
const langeHer = new Date(jetzt.getTime() - 6 * 60 * 60 * 1000)
await dienstSetzen(tagHeute, berlinUhr(langeHer), plus(berlinUhr(langeHer), 120), shiftId)

const zuSpaet = await stempeln({ aktion: 'kommen' })
check('Sechs Stunden nach Dienstbeginn wird gefragt',
  zuSpaet.status === 422 && zuSpaet.body?.code === 'GRUND_NOETIG',
  `HTTP ${zuSpaet.status} · ${JSON.stringify(zuSpaet.body?.code ?? null)}`)
check('Und zwar als „später angefangen", nicht als „ohne Dienst"',
  zuSpaet.body?.frage?.art === 'kommen-spaet',
  JSON.stringify(zuSpaet.body?.frage?.art ?? null))
check('Die Frage nennt die geplante Zeit',
  /\d{2}:\d{2}/.test(zuSpaet.body?.frage?.text ?? ''),
  zuSpaet.body?.frage?.text?.slice(0, 90) ?? '')
check('Ohne Grund ist niemand eingestempelt', (await zustand())?.laeuft === false)

const spaetMitGrund = await stempeln({
  aktion: 'kommen', grund: 'Dienst mit Melanie getauscht',
})
check('Mit Grund geht es', spaetMitGrund.status === 200,
  `HTTP ${spaetMitGrund.status} · ${JSON.stringify(spaetMitGrund.body?.error ?? '')}`)
check('Die Abweichung steht am Eintrag',
  spaetMitGrund.body?.log?.abweichung === 'kommen-spaet',
  JSON.stringify(spaetMitGrund.body?.log?.abweichung))
check('Und der Grund dazu',
  String(spaetMitGrund.body?.log?.grundKommen ?? '').includes('getauscht'),
  JSON.stringify(spaetMitGrund.body?.log?.grundKommen))

await stempeln({ aktion: 'gehen' })
await dienstLoeschen(tagHeute)

/*
 * Die Gegenprobe steht schon in B5.4: Dort wird zum geplanten Beginn
 * gestempelt, und es kommt keine Frage. Ohne sie wäre „es wird gefragt" auch
 * dann grün, wenn das Programm bei JEDEM Einstempeln fragte — und eine
 * Rückfrage ohne Anlass wird weggeklickt und ist dann überall wertlos.
 */

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
