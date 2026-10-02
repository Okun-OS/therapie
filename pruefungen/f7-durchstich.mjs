// Nachweis F7: Der Durchstich — vom Regelpaket bis in die App der Kraft.
//
// WARUM ES DIESE PRÜFUNG GIBT
// Bis zum 02.10.2026 war die Dienstplanung an einem Demo-Betrieb geprüft, in
// dem die sechzehn Namen aus dem Regelpaket zwar echte Mitarbeiterdatensätze
// hatten — aber kein einziges Benutzerkonto. Geprüft war damit: „Das
// Regelpaket erzeugt auf dem Bildschirm der Leitung einen guten Plan." Nicht
// geprüft war die Frage, auf die es am Ende ankommt: Kommt dieser Plan bei
// der Person an, für die er gerechnet wurde?
//
// Der Betreiber hat genau das in Zweifel gezogen, und er hatte recht. Beim
// ersten Durchstich fielen zwei Dinge auf, die vorher niemand sehen konnte:
//
//   1. Das Tagesmuster stand im Regelpaket, die Stundenzahl in den
//      Stammdaten. Änderte jemand die Stunden in der Maske, widersprachen
//      sich beide — und dann kam nicht ein schlechterer Plan heraus, sondern
//      GAR KEINER, für den ganzen Standort. Gemessen: 35 → Plan, 28 → kein
//      Plan, 40 → kein Plan, 35 → Plan.
//
//   2. `/api/employee-planning-profile` hatte keine Zugriffsprüfung. Jede
//      angemeldete Person konnte das Planungsprofil jedes Menschen lesen und
//      überschreiben.
//
// WAS HIER GEPRÜFT WIRD
// Die ganze Kette in der Reihenfolge, in der ein Betrieb sie geht: planen,
// speichern, veröffentlichen, als Beschäftigte ansehen. Dann die beiden
// Bewegungen, die im Betrieb ständig vorkommen — Stunden ändern und jemanden
// langfristig krankschreiben — und bei jeder die Gegenprobe, dass der Plan
// danach immer noch entsteht.
//
// Voraussetzung: `npm run seed:kita` und ein laufender Rechendienst.
import { pruefer, login, hole, sende } from './helfer.mjs'

const { check, bilanz } = pruefer()
const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'
const STANDORT = 'demo-standort-kita2'

const leitung = await login('leitung@kita-regenbogen.de')

// ── Der Zeitraum ───────────────────────────────────────────────────────────
// Weit genug in der Zukunft, dass er keiner anderen Prüfung in die Quere
// kommt, und eine volle Woche Montag bis Freitag — kürzere Zeiträume sagen
// über Tagesmuster nichts aus.
const iso = d => d.toISOString().slice(0, 10)
const plus = (d, n) => { const x = new Date(d); x.setDate(d.getDate() + n); return x }
const montag = (() => {
  const d = new Date(); const t = d.getDay()
  const m = new Date(d)
  m.setDate(d.getDate() - t + (t === 0 ? -6 : 1))
  m.setHours(12, 0, 0, 0)
  m.setDate(m.getDate() + 21)
  return m
})()
const TAGE = Array.from({ length: 5 }, (_, i) => iso(plus(montag, i)))
console.log(`Zeitraum ${TAGE[0]} bis ${TAGE[4]}\n`)

const belegschaft = (await hole(leitung, '/api/employees')).body.employees ?? []
const steffi = belegschaft.find(e => e.email === 'stephanie.lang@kita-regenbogen.de')
const felix = belegschaft.find(e => e.email === 'felix.arndt@kita-regenbogen.de')
if (!steffi || !felix) {
  console.error('Der Demo-Mandant fehlt. Bitte zuerst: npm run seed:kita')
  process.exit(1)
}

/**
 * §181 Regel 1 der README: Die Prüfung stellt ihren Ausgangszustand selbst her.
 *
 * Sie verschiebt Stunden, Muster und Krankmeldungen — alles Dinge, über die
 * eine nachfolgende Prüfung stolpert, wenn sie liegen bleiben. Besonders die
 * Krankmeldung: Sie würde eine Kraft in jedem weiteren Plan fehlen lassen,
 * und der Fehler fiele erst zwei Prüfungen später auf.
 */
const MUSTER_NORMAL = [{ stunden: 7, tage: 5 }]
async function ausgangszustand() {
  await sende(leitung, `/api/employees/${steffi.id}/planning-profile`, 'PUT', {
    tagesmuster: MUSTER_NORMAL, planungsStundenSoll: null,
  })
  await sende(leitung, `/api/employees/${steffi.id}`, 'PATCH', { weeklyHours: 35 })
  const vorhandene = (await hole(leitung, `/api/absences?locationId=${STANDORT}`)).body.absences ?? []
  for (const a of vorhandene) {
    if (a.note === 'Nachweis Durchstich') {
      await sende(leitung, `/api/absences/${a.id}`, 'DELETE')
    }
  }
}
await ausgangszustand()

/** Einen Plan rechnen und zurückgeben, was dabei für eine Person herauskam. */
async function planen() {
  const r = await sende(leitung, '/api/ai/solve-schedule', 'POST',
    { locationId: STANDORT, von: TAGE[0], bis: TAGE[4] })
  const dienste = (id) => Object.entries(r.body.week?.[id] ?? {})
    .filter(([, v]) => v?.shiftId)
    .map(([datum, v]) => ({ datum, schichtId: v.shiftId, name: v.note, gruppe: v.gruppe }))
  return { status: r.status, body: r.body, dienste, fehler: r.body?.error }
}

// ── F7.1 Die Kette: planen, speichern, ansehen ─────────────────────────────
console.log('=== F7.1 Vom Regelpaket bis in die App ===')

const lauf = await planen()
check('Die Leitung bekommt einen Plan', lauf.status === 200,
  lauf.fehler ?? `HTTP ${lauf.status}`)

const ihre = lauf.dienste(steffi.id)
check('Und darin stehen Dienste für eine namentliche Kraft', ihre.length > 0,
  `${ihre.length} Dienste für ${steffi.name}`)
check('Fünf Dienste — ihr Tagesmuster sagt fünfmal sieben Stunden',
  ihre.length === 5, ihre.map(d => d.name).join(', '))

const gespeichert = await sende(leitung, '/api/schedule-entries/save-week', 'POST', {
  locationId: STANDORT, weekDates: TAGE, assignments: lauf.body.week,
  status: 'published', sessionId: lauf.body.sessionId,
})
check('Der Plan lässt sich veröffentlichen', gespeichert.status === 200,
  `HTTP ${gespeichert.status} ${JSON.stringify(gespeichert.body?.error ?? '')}`)

// Jetzt der Teil, der vorher nie geprüft war: ihr eigenes Konto.
const ihrZugang = await login('stephanie.lang@kita-regenbogen.de')
const ich = (await hole(ihrZugang, '/api/auth/me')).body.user
check('Die Kraft kann sich selbst anmelden', !!ich?.employeeId, JSON.stringify(ich ?? {}))
check('Und ihr Konto hängt an ihrem Mitarbeiterdatensatz',
  ich?.employeeId === steffi.id, `${ich?.employeeId} ≠ ${steffi.id}`)

const beiIhr = await hole(ihrZugang, `/api/schedule-entries?employeeId=${steffi.id}`)
const ihreEintraege = (beiIhr.body.entries ?? []).filter(e => TAGE.includes(e.date))
check('Sie sieht ihren Dienstplan', beiIhr.status === 200 && ihreEintraege.length > 0,
  `HTTP ${beiIhr.status}, ${ihreEintraege.length} Einträge`)
check('Es sind genau die Dienste, die gerechnet wurden',
  ihreEintraege.length === ihre.length
  && ihre.every(d => ihreEintraege.some(e => e.date === d.datum && e.shiftId === d.schichtId)),
  `gerechnet: ${ihre.map(d => `${d.datum}/${d.schichtId}`).join(' ')}\n`
  + `           gesehen:   ${ihreEintraege.map(e => `${e.date}/${e.shiftId}`).join(' ')}`)
check('Und sie stehen auf „veröffentlicht"',
  ihreEintraege.every(e => e.status === 'published'),
  [...new Set(ihreEintraege.map(e => e.status))].join(', '))

// Gegenproben: Der Plan gehört ihr, nicht allen.
const vomKollegen = await hole(await login('felix.arndt@kita-regenbogen.de'),
  `/api/schedule-entries?employeeId=${steffi.id}`)
check('Eine Kollegin sieht ihren Plan NICHT', vomKollegen.status === 403,
  `HTTP ${vomKollegen.status}`)
const ohneAnmeldung = await fetch(`${BASIS}/api/schedule-entries?employeeId=${steffi.id}`)
check('Und ohne Anmeldung erst recht nicht', ohneAnmeldung.status === 401,
  `HTTP ${ohneAnmeldung.status}`)

// §181 Was das Regelpaket seit heute NICHT mehr selbst weiß: wer welche
// Schicht lieber mag und wer an welchen Tagen fest frei hat. Beides steht in
// den Personalakten. Wenn es trotzdem im Plan ankommt, ist die Verschiebung
// mehr als eine Umsortierung.
const julianeId = belegschaft.find(e => e.email === 'juliane.roth@kita-regenbogen.de')?.id
const heikeId = belegschaft.find(e => e.email === 'heike.stein@kita-regenbogen.de')?.id
const schichten = (await hole(leitung, '/api/shifts')).body.shifts ?? []
const typVon = new Map(schichten.map(s => [s.id, s.type]))

check('Die Vorliebe aus der Personalakte wirkt im Plan',
  lauf.dienste(julianeId).every(d => typVon.get(d.schichtId) !== 'late'),
  lauf.dienste(julianeId).map(d => `${d.datum} ${d.name}`).join(', '))
check('Und ein fester freier Tag aus der Personalakte auch',
  lauf.dienste(heikeId).every(d => new Date(d.datum).getDay() !== 5),
  lauf.dienste(heikeId).map(d => `${d.datum} ${d.name}`).join(', '))
check('Ihr Tagesmuster steht ebenfalls dort — vier Tage, einer davon kürzer',
  lauf.dienste(heikeId).length === 4,
  lauf.dienste(heikeId).map(d => d.name).join(', '))

// ── F7.2 Das Planungsprofil gehört nicht allen ─────────────────────────────
console.log('\n=== F7.2 Wer das Planungsprofil sehen darf ===')

// §181 Diese Route hatte gar keine Zugriffsprüfung — und sie lässt auch die
// Rolle „employee" herein. Jede angemeldete Person konnte damit das Profil
// jedes Menschen lesen und überschreiben.
const kollegenZugang = await login('felix.arndt@kita-regenbogen.de')
const fremdesProfil = await hole(kollegenZugang,
  `/api/employee-planning-profile?employeeId=${steffi.id}`)
check('Eine Kollegin liest ein fremdes Planungsprofil NICHT',
  fremdesProfil.status === 403, `HTTP ${fremdesProfil.status}`)

const fremdSchreiben = await sende(kollegenZugang, '/api/employee-planning-profile', 'PUT',
  { employeeId: steffi.id, planningNote: 'von der Kollegin eingetragen' })
check('Und überschreibt es erst recht nicht', fremdSchreiben.status === 403,
  `HTTP ${fremdSchreiben.status}`)

const eigenes = await hole(kollegenZugang,
  `/api/employee-planning-profile?employeeId=${felix.id}`)
check('Ihr eigenes Profil sieht sie weiterhin', eigenes.status === 200,
  `HTTP ${eigenes.status}`)

// ── F7.3 Stunden ändern — und der Plan ändert sich mit ─────────────────────
console.log('\n=== F7.3 Eine Änderung in der Maske wirkt im Plan ===')

const kuerzer = await sende(leitung, `/api/employees/${steffi.id}/planning-profile`, 'PUT', {
  tagesmuster: [{ stunden: 7, tage: 4 }], planungsStundenSoll: 28,
})
check('Muster und Stunden lassen sich gemeinsam ändern', kuerzer.status === 200,
  `HTTP ${kuerzer.status} ${JSON.stringify(kuerzer.body?.error ?? '')}`)

const nachher = await planen()
check('Danach entsteht weiterhin ein Plan', nachher.status === 200,
  nachher.fehler ?? `HTTP ${nachher.status}`)
check('Und die Kraft steht nur noch an vier Tagen darin',
  nachher.dienste(steffi.id).length === 4,
  nachher.dienste(steffi.id).map(d => `${d.datum} ${d.name}`).join(', '))

// ── F7.4 Der Widerspruch, der den Betrieb lahmlegte ────────────────────────
console.log('\n=== F7.4 Stunden und Muster können nicht auseinanderlaufen ===')

// Erst zurück auf den Normalfall: Muster an den VERTRAGSSTUNDEN, keine
// abweichenden Planstunden. Nur dann hängt das Muster überhaupt an der Zahl,
// die gleich geändert wird — stehen Planstunden daneben, ist die
// Vertragsstundenzahl für den Dienstplan ohne Bedeutung, und eine Ablehnung
// wäre falsch.
await ausgangszustand()

// Nur die Stunden, ohne das Muster: Genau das machte den Standort planlos.
const nurStunden = await sende(leitung, `/api/employees/${steffi.id}`, 'PATCH',
  { weeklyHours: 20 })
check('Die Stundenzahl allein lässt sich nicht gegen das Muster ändern',
  nurStunden.status === 400, `HTTP ${nurStunden.status}`)
check('Und die Meldung nennt beide Zahlen',
  /Tagesmuster/.test(nurStunden.body?.error ?? '')
  && /\d+\s*(Std|Wochenstunden)/.test(nurStunden.body?.error ?? ''),
  nurStunden.body?.error)

// Gegenprobe zur Gegenprobe: Stehen abweichende Planstunden daneben, hängt
// das Muster an IHNEN — dann darf die Vertragsstundenzahl sich bewegen, ohne
// dass jemand widerspricht. Sonst wäre aus der Prüfung eine Sperre geworden,
// die auch dort greift, wo nichts auseinanderlaufen kann.
await sende(leitung, `/api/employees/${steffi.id}/planning-profile`, 'PUT', {
  tagesmuster: [{ stunden: 7, tage: 4 }], planungsStundenSoll: 28,
})
const mitPlanstunden = await sende(leitung, `/api/employees/${steffi.id}`, 'PATCH',
  { weeklyHours: 20 })
check('Mit abweichenden Planstunden darf sich die Vertragszeit bewegen',
  mitPlanstunden.status === 200,
  `HTTP ${mitPlanstunden.status} ${JSON.stringify(mitPlanstunden.body?.error ?? '')}`)
await sende(leitung, `/api/employees/${steffi.id}`, 'PATCH', { weeklyHours: 35 })

// Umgekehrt genauso: ein Muster, das nicht zur Stundenzahl passt.
const nurMuster = await sende(leitung, `/api/employees/${steffi.id}/planning-profile`, 'PUT', {
  tagesmuster: [{ stunden: 8, tage: 5 }], planungsStundenSoll: 28,
})
check('Ein Muster, das nicht zu den Stunden passt, wird abgelehnt',
  nurMuster.status === 400, `HTTP ${nurMuster.status}`)
check('Auch hier mit beiden Zahlen im Satz',
  /40/.test(nurMuster.body?.error ?? '') && /28/.test(nurMuster.body?.error ?? ''),
  nurMuster.body?.error)

// Gegenprobe: Zusammen geht es. Sonst wäre die Prüfung oben auch dann grün,
// wenn gar nichts mehr änderbar wäre.
const zusammen = await sende(leitung, `/api/employees/${steffi.id}/planning-profile`, 'PUT', {
  tagesmuster: [{ stunden: 8, tage: 5 }], planungsStundenSoll: 40,
})
check('Beides zusammen geht', zusammen.status === 200,
  `HTTP ${zusammen.status} ${JSON.stringify(zusammen.body?.error ?? '')}`)

// Und ein Muster, das mehr Tage belegt als die Woche hergibt.
const zuVieleTage = await sende(leitung, `/api/employees/${steffi.id}/planning-profile`, 'PUT', {
  tagesmuster: [{ stunden: 5, tage: 8 }], planungsStundenSoll: 40,
})
check('Ein Muster über acht Arbeitstage wird abgelehnt',
  zuVieleTage.status === 400, `HTTP ${zuVieleTage.status}`)

await sende(leitung, `/api/employees/${steffi.id}/planning-profile`, 'PUT', {
  tagesmuster: MUSTER_NORMAL, planungsStundenSoll: null,
})

// ── F7.5 Acht Wochen krank — Daten, keine Regel ────────────────────────────
console.log('\n=== F7.5 Eine lange Krankmeldung vor der Planung ===')

const krankBis = iso(plus(montag, 55))
const krank = await sende(leitung, '/api/absences', 'POST', {
  employeeId: steffi.id, employeeName: steffi.name, locationId: STANDORT,
  type: 'sick', startDate: TAGE[0], endDate: krankBis, days: 56,
  note: 'Nachweis Durchstich',
})
check('Eine Krankmeldung über acht Wochen lässt sich erfassen',
  krank.status === 200, `HTTP ${krank.status} ${JSON.stringify(krank.body?.error ?? '')}`)

const ohneSie = await planen()
check('Der Plan entsteht trotzdem', ohneSie.status === 200,
  ohneSie.fehler ?? `HTTP ${ohneSie.status}`)
check('Sie wird nicht eingeplant', ohneSie.dienste(steffi.id).length === 0,
  ohneSie.dienste(steffi.id).map(d => d.datum).join(', '))
check('Ihr Tagesmuster reißt dadurch keine Regel',
  !/Stephanie|Tagesmuster/i.test(JSON.stringify(ohneSie.body?.bewertung?.verletzungen ?? [])),
  JSON.stringify(ohneSie.body?.bewertung?.verletzungen ?? []).slice(0, 200))
check('Und die anderen werden weiter verplant',
  ohneSie.dienste(felix.id).length > 0,
  `${ohneSie.dienste(felix.id).length} Dienste für ${felix.name}`)

// Das Entscheidende: Es ist keine Regel, die stehen bleibt. Nimmt man die
// Krankmeldung zurück, ist die Person im nächsten Lauf wieder dabei — ohne
// dass jemand etwas zurücksetzen muss.
await ausgangszustand()
const wiederDa = await planen()
check('Nach Ende der Krankmeldung ist sie von selbst wieder im Plan',
  wiederDa.dienste(steffi.id).length === 5,
  `${wiederDa.dienste(steffi.id).length} Dienste — eine Abwesenheit ist ein Datum, keine Regel`)

process.exit(bilanz() ? 1 : 0)
