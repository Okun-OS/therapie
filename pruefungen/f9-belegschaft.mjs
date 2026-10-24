// Nachweis F9: Die Belegschaft beim Einrichten anlegen.
//
// WARUM ES DAS GIBT
// Ein Regelpaket wird für einen Betrieb von Hand programmiert. Bis dahin stand
// danach eine leere Mitarbeiterliste, und der Kunde tippte achtzehn Menschen
// einzeln ein, bevor er den ersten Plan rechnen konnte. Dabei liegen genau
// diese achtzehn Zeilen schon vor uns: Wer ein Regelwerk aufnimmt, bekommt die
// Belegschaft mitgeliefert. Sie noch einmal abtippen zu lassen, ist eine
// vermeidbare Fehlerquelle an der empfindlichsten Stelle.
//
// WAS HIER GEPRÜFT WIRD
// Dass aus der Liste echte Mitarbeiterdatensätze mit Tagesmustern werden, dass
// ein zweiter Durchlauf nichts verdoppelt und niemandem den Zugang wegnimmt,
// und dass die Platzhalteradresse hält, was sie verspricht: Es geht keine
// Einladung an eine Adresse, die es nicht gibt.
//
// Und die Gegenprobe, ohne die der Rest wenig wert wäre: Mit der eingespielten
// Belegschaft lässt sich tatsächlich ein Plan rechnen.
import { pruefer, login, hole, sende } from './helfer.mjs'

const { check, bilanz } = pruefer()
const STANDORT = 'demo-standort-kita2'

const okun = await login('okun@okun.de')
const gf = await login('gf@kita-regenbogen.de')
const leitung = await login('leitung@kita-regenbogen.de')

// §183 Eigene Namen, damit die Prüfung die Demo-Belegschaft nicht anfasst.
const MARKE = Date.now().toString(36).slice(-5)
const NAMEN = [`Pruef Alpha ${MARKE}`, `Pruef Beta ${MARKE}`, `Pruef Gamma ${MARKE}`]

/** §183 Regel 1 der README: Die Prüfung räumt ihre Leute selbst wieder weg. */
async function aufraeumen() {
  const alle = (await hole(okun, `/api/okun/belegschaft?locationId=${STANDORT}`)).body.personen ?? []
  for (const p of alle) {
    if (p.name.startsWith('Pruef ')) {
      await sende(okun, `/api/employees/${p.id}`, 'DELETE')
    }
  }
}
await aufraeumen()

const stand = await hole(okun, `/api/okun/belegschaft?locationId=${STANDORT}`)
check('Die Übersicht ist für OKUN abrufbar', stand.status === 200, `HTTP ${stand.status}`)
check('Sie nennt die Gruppen des Standorts',
  (stand.body.gruppen ?? []).includes('Gruppe 1'), JSON.stringify(stand.body.gruppen))
check('Und die Betriebstage',
  (stand.body.betriebstage ?? []).includes('Mo'), JSON.stringify(stand.body.betriebstage))

const vorher = (stand.body.personen ?? []).length

// ── F9.1 Wer darf das überhaupt ────────────────────────────────────────────
console.log('=== F9.1 Nur OKUN spielt Belegschaften ein ===')

for (const [wer, cookie] of [['Unternehmen', gf], ['Standortleitung', leitung]]) {
  const r = await sende(cookie, '/api/okun/belegschaft', 'POST', {
    locationId: STANDORT, text: `${NAMEN[0]}; 40; 5; Gruppe 1; Erzieher; 5x8`, anlegen: true,
  })
  check(`${wer} darf keine Belegschaft einspielen`, r.status === 403, `HTTP ${r.status}`)
  const lesen = await hole(cookie, `/api/okun/belegschaft?locationId=${STANDORT}`)
  check(`${wer} darf die Übersicht auch nicht lesen`, lesen.status === 403,
    `HTTP ${lesen.status}`)
}

const ohneAnmeldung = await fetch(
  `${process.env.PRUEF_BASIS ?? 'http://localhost:3000'}/api/okun/belegschaft?locationId=${STANDORT}`)
check('Ohne Anmeldung erst recht nicht', ohneAnmeldung.status === 401,
  `HTTP ${ohneAnmeldung.status}`)

// ── F9.2 Erst prüfen, dann anlegen ─────────────────────────────────────────
console.log('\n=== F9.2 Erst zeigen, dann anlegen ===')

const LISTE = [
  '# Name; Stunden; Tage/Woche; Gruppe; Funktion; Muster; Frei; Vorliebe',
  `${NAMEN[0]}; 40; 5; Gruppe 1; Erzieher; 5x8`,
  `${NAMEN[1]}; 30; 4; Gruppe 5; Erzieher; 3x8+1x6; Fr; frueh`,
  `${NAMEN[2]}; 25; 5; ; Springer; 5x5`,
].join('\n')

const vorschau = await sende(okun, '/api/okun/belegschaft', 'POST', {
  locationId: STANDORT, text: LISTE,
})
check('Die Vorschau liest die Liste', vorschau.status === 200 && vorschau.body.gelesen?.length === 3,
  `HTTP ${vorschau.status}, ${vorschau.body.gelesen?.length} Zeilen`)
check('Und legt dabei nichts an', vorschau.body.angelegt === 0)
const nachVorschau = (await hole(okun, `/api/okun/belegschaft?locationId=${STANDORT}`))
  .body.personen ?? []
check('Es ist auch wirklich niemand dazugekommen', nachVorschau.length === vorher,
  `${vorher} → ${nachVorschau.length}`)

check('Das Tagesmuster wird aus „3x8+1x6" gelesen',
  (vorschau.body.gelesen?.[1]?.muster ?? []).length === 2
  && (vorschau.body.gelesen?.[1]?.muster ?? [])
    .some(m => m.stunden === 8 && m.tage === 3),
  JSON.stringify(vorschau.body.gelesen?.[1]?.muster))
check('Der feste freie Tag auch',
  JSON.stringify(vorschau.body.gelesen?.[1]?.freieTage) === JSON.stringify(['Fr']),
  JSON.stringify(vorschau.body.gelesen?.[1]?.freieTage))

// ── F9.3 Eine kaputte Zeile verhindert die ganze Liste ─────────────────────
console.log('\n=== F9.3 Nichts oder alles ===')

const kaputt = await sende(okun, '/api/okun/belegschaft', 'POST', {
  locationId: STANDORT, anlegen: true,
  text: [
    `${NAMEN[0]}; 40; 5; Gruppe 1; Erzieher; 5x8`,
    // 5×7 = 35, im Vertrag stehen 40 — genau der Widerspruch, der im
    // September einen ganzen Standort planlos gemacht hat.
    `${NAMEN[1]}; 40; 5; Gruppe 5; Erzieher; 5x7`,
  ].join('\n'),
})
check('Eine Liste mit einer falschen Zeile wird abgelehnt', kaputt.status === 400,
  `HTTP ${kaputt.status}`)
check('Die Meldung nennt die Zeile', kaputt.body.fehler?.[0]?.zeile === 2,
  JSON.stringify(kaputt.body.fehler?.[0]))
check('Und sagt, was nicht stimmt',
  /35/.test(kaputt.body.fehler?.[0]?.text ?? '') && /40/.test(kaputt.body.fehler?.[0]?.text ?? ''),
  kaputt.body.fehler?.[0]?.text)

const nachKaputt = (await hole(okun, `/api/okun/belegschaft?locationId=${STANDORT}`))
  .body.personen ?? []
check('Auch die GUTE Zeile wurde nicht angelegt', nachKaputt.length === vorher,
  `${vorher} → ${nachKaputt.length} — halb eingelesen wäre schlimmer als gar nicht`)

const fremdeGruppe = await sende(okun, '/api/okun/belegschaft', 'POST', {
  locationId: STANDORT, anlegen: true,
  text: `${NAMEN[0]}; 40; 5; Gruppe 99; Erzieher; 5x8`,
})
check('Eine Gruppe, die es nicht gibt, wird gemeldet', fremdeGruppe.status === 400,
  fremdeGruppe.body.fehler?.[0]?.text)

// ── F9.4 Anlegen ───────────────────────────────────────────────────────────
console.log('\n=== F9.4 Die Belegschaft entsteht ===')

const angelegt = await sende(okun, '/api/okun/belegschaft', 'POST', {
  locationId: STANDORT, text: LISTE, anlegen: true,
})
check('Die Liste lässt sich anlegen', angelegt.status === 200 && angelegt.body.angelegt === 3,
  `HTTP ${angelegt.status}, ${angelegt.body.angelegt} angelegt: ${angelegt.body.hinweis ?? angelegt.body.error}`)

const jetzt = (await hole(okun, `/api/okun/belegschaft?locationId=${STANDORT}`)).body.personen ?? []
const alpha = jetzt.find(p => p.name === NAMEN[0])
const beta = jetzt.find(p => p.name === NAMEN[1])
check('Sie stehen in den Stammdaten', !!alpha && !!beta)
check('Mit ihren Stunden', alpha?.weeklyHours === 40 && beta?.weeklyHours === 30,
  `${alpha?.weeklyHours} / ${beta?.weeklyHours}`)
check('Mit ihrer Gruppe', alpha?.gruppe === 'Gruppe 1', alpha?.gruppe)
// Verglichen wird der Inhalt, nicht die Schreibweise: Die Reihenfolge der
// Felder im gespeicherten JSON ist nichts, worauf sich eine Prüfung stützen
// sollte.
const gleichesMuster = (a, b) => (a ?? []).length === b.length
  && b.every(soll => (a ?? []).some(x => x.stunden === soll.stunden && x.tage === soll.tage))
check('Mit ihrem Tagesmuster',
  gleichesMuster(beta?.tagesmuster, [{ stunden: 8, tage: 3 }, { stunden: 6, tage: 1 }]),
  JSON.stringify(beta?.tagesmuster))
check('Mit ihrem festen freien Tag',
  JSON.stringify(beta?.fixedOffDays) === JSON.stringify(['Fr']),
  JSON.stringify(beta?.fixedOffDays))
check('Und mit ihrer Schichtvorliebe', beta?.vorliebe === 'frueh', beta?.vorliebe)

// ── F9.5 Die Adresse, die noch keine ist ───────────────────────────────────
console.log('\n=== F9.5 Ohne Adresse keine Einladung ===')

check('Die Adresse ist als Platzhalter gekennzeichnet', alpha?.ohneAdresse === true,
  `${alpha?.email}`)
check('Und sie endet auf .invalid — dorthin kann nichts zugestellt werden',
  /\.invalid$/.test(alpha?.email ?? ''), alpha?.email)

const einladung = await sende(gf, '/api/invitations', 'POST', {
  email: alpha?.email, role: 'employee', name: alpha?.name,
  employeeId: alpha?.id, locationId: STANDORT,
})
check('An eine Platzhalteradresse geht keine Einladung', einladung.status === 400,
  `HTTP ${einladung.status}: ${einladung.body?.error ?? ''}`)
check('Die Meldung sagt, was zu tun ist',
  /Adresse/.test(einladung.body?.error ?? ''), einladung.body?.error)

// Gegenprobe: Mit einer echten Adresse geht die Einladung sehr wohl raus.
// Sonst wäre die Prüfung oben auch dann grün, wenn gar nichts mehr ginge.
const echteAdresse = `pruef.alpha.${MARKE}@kita-regenbogen.de`
await sende(gf, `/api/employees/${alpha?.id}`, 'PATCH', { email: echteAdresse })
const echteEinladung = await sende(gf, '/api/invitations', 'POST', {
  email: echteAdresse, role: 'employee', name: alpha?.name,
  employeeId: alpha?.id, locationId: STANDORT,
})
check('Mit echter Adresse geht die Einladung raus', echteEinladung.status === 200,
  `HTTP ${echteEinladung.status}: ${echteEinladung.body?.error ?? ''}`)

// ── F9.6 Zweimal einspielen ────────────────────────────────────────────────
console.log('\n=== F9.6 Ein zweiter Durchlauf ===')

const nochmal = await sende(okun, '/api/okun/belegschaft', 'POST', {
  locationId: STANDORT, text: LISTE, anlegen: true,
})
check('Ein zweiter Durchlauf legt niemanden doppelt an',
  nochmal.body.angelegt === 0 && nochmal.body.geaendert === 3,
  `${nochmal.body.angelegt} neu, ${nochmal.body.geaendert} geändert`)

const danach = (await hole(okun, `/api/okun/belegschaft?locationId=${STANDORT}`)).body.personen ?? []
check('Es sind genauso viele wie vorher',
  danach.filter(p => p.name.startsWith('Pruef ')).length === 3,
  `${danach.filter(p => p.name.startsWith('Pruef ')).length}`)

// §183 Das Wichtigste am zweiten Durchlauf: Wer schon eine echte Adresse hat,
// behält sie. Sonst nähme ein Nachtrag einer längst angemeldeten Kollegin den
// Zugang weg — und niemand merkte es, bis sie sich nicht mehr anmelden kann.
const alphaDanach = danach.find(p => p.name === NAMEN[0])
check('Eine schon eingetragene echte Adresse bleibt unangetastet',
  alphaDanach?.email === echteAdresse, alphaDanach?.email)

// ── F9.7 Damit lässt sich planen ───────────────────────────────────────────
console.log('\n=== F9.7 Die Gegenprobe: ein Plan entsteht ===')

const iso = d => d.toISOString().slice(0, 10)
const plus = (d, n) => { const x = new Date(d); x.setDate(d.getDate() + n); return x }
const montag = (() => {
  const d = new Date(); const t = d.getDay()
  const m = new Date(d)
  m.setDate(d.getDate() - t + (t === 0 ? -6 : 1))
  m.setHours(12, 0, 0, 0)
  m.setDate(m.getDate() + 35)
  return m
})()
const VON = iso(montag), BIS = iso(plus(montag, 4))

const lauf = await sende(leitung, '/api/ai/solve-schedule', 'POST',
  { locationId: STANDORT, von: VON, bis: BIS })
check('Mit der eingespielten Belegschaft entsteht ein Plan', lauf.status === 200,
  lauf.body?.error ?? `HTTP ${lauf.status}`)

const tageVon = id => Object.entries(lauf.body.week?.[id] ?? {})
  .filter(([, v]) => v?.shiftId)
const betaId = danach.find(p => p.name === NAMEN[1])?.id
check('Die eingespielte Vier-Tage-Kraft steht an vier Tagen darin',
  tageVon(betaId).length === 4,
  tageVon(betaId).map(([d, v]) => `${d} ${v.note}`).join(', '))
check('Und an ihrem festen freien Tag nicht',
  tageVon(betaId).every(([d]) => new Date(d).getDay() !== 5),
  tageVon(betaId).map(([d]) => d).join(', '))

await aufraeumen()
const sauber = (await hole(okun, `/api/okun/belegschaft?locationId=${STANDORT}`)).body.personen ?? []
check('Die Prüfung räumt ihre Leute wieder weg',
  sauber.filter(p => p.name.startsWith('Pruef ')).length === 0,
  `${sauber.filter(p => p.name.startsWith('Pruef ')).length} übrig`)

process.exit(bilanz() ? 1 : 0)
