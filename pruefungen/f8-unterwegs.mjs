// Nachweis F8: „Diese Gruppe ist unterwegs" — vor der Planung sagbar.
//
// WARUM ES DIESE PRÜFUNG GIBT
// Der Betreiber fragte: Kann ich vor dem Rechnen sagen, dass Gruppe 3 auf
// Fahrt ist und gar nicht verplant werden muss? Die Antwort war nein. Es gab
// nur die Maßnahme „aufteilen", und die entsteht erst, NACHDEM der
// Rechendienst gemeldet hat, dass er die Gruppe nicht besetzen kann. Eine
// Leitung, die die Fahrt seit sechs Wochen im Kalender stehen hat, musste
// also erst einen Fehlschlag abwarten, um ihn zu bestätigen.
//
// WAS DER BAU DABEI GEFUNDEN HAT
// Die Abgabesperre aus §166 — „diese Gruppe gibt in der Eingewöhnung niemanden
// ab" — ließ sich über die Schnittstelle gar nicht setzen. Die Maske schickte
// sie, die Route reichte sie weiter, und `updatePlanningUnitById` schrieb sie
// nicht; beim Lesen kam sie ebenfalls nicht zurück. Die Regel war im
// Rechendienst gebaut, geprüft — und unerreichbar. Nichts ging kaputt, es
// geschah nur nichts, und genau deshalb fiel es zwei Wochen lang niemandem auf.
//
// Voraussetzung: `npm run seed:kita` und ein laufender Rechendienst.
import { pruefer, login, hole, sende } from './helfer.mjs'

const { check, bilanz } = pruefer()
const STANDORT = 'demo-standort-kita2'

const leitung = await login('leitung@kita-regenbogen.de')
const fremd = await login('leitung@rheinblick-reha.de')

const iso = d => d.toISOString().slice(0, 10)
const plus = (d, n) => { const x = new Date(d); x.setDate(d.getDate() + n); return x }
const montag = (() => {
  const d = new Date(); const t = d.getDay()
  const m = new Date(d)
  m.setDate(d.getDate() - t + (t === 0 ? -6 : 1))
  m.setHours(12, 0, 0, 0)
  m.setDate(m.getDate() + 28)
  return m
})()
const TAGE = Array.from({ length: 5 }, (_, i) => iso(plus(montag, i)))
// Die Fahrt dauert drei Tage, nicht die ganze Woche — so lässt sich prüfen,
// dass der Zeitraum endet und nicht einfach alles verschluckt.
const FAHRT_VON = TAGE[0], FAHRT_BIS = TAGE[2]
console.log(`Zeitraum ${TAGE[0]} bis ${TAGE[4]}, Fahrt ${FAHRT_VON} bis ${FAHRT_BIS}\n`)

const einheiten = (await hole(leitung, `/api/planning-units?locationId=${STANDORT}`)).body.units ?? []
const gruppe = einheiten.find(u => u.name === 'Gruppe 3')
const andere = einheiten.find(u => u.name === 'Gruppe 4')
if (!gruppe || !andere) {
  console.error('Der Demo-Mandant fehlt. Bitte zuerst: npm run seed:kita')
  process.exit(1)
}

const belegschaft = (await hole(leitung, '/api/employees')).body.employees ?? []
const eigene = belegschaft.filter(e => e.gruppe === 'Gruppe 3').map(e => e.id)

/** §182 Regel 1 der README: Die Prüfung stellt ihren Ausgangszustand selbst her. */
async function ausgangszustand() {
  for (const u of [gruppe, andere]) {
    await sende(leitung, '/api/planning-units', 'PUT', {
      id: u.id, unterwegsVon: null, unterwegsBis: null, unterwegsGrund: null,
      abgabeGesperrtBis: null, abgabeGrund: null,
    })
  }
}
await ausgangszustand()

async function planen() {
  const r = await sende(leitung, '/api/ai/solve-schedule', 'POST',
    { locationId: STANDORT, von: TAGE[0], bis: TAGE[4] })
  const inGruppe = (gruppenId, tag) => Object.entries(r.body.week ?? {})
    .filter(([, tage]) => tage?.[tag]?.shiftId && tage[tag].gruppe === gruppenId)
    .map(([id]) => id)
  return { status: r.status, body: r.body, inGruppe, fehler: r.body?.error }
}

// ── F8.1 Der Zeitraum lässt sich überhaupt setzen ──────────────────────────
console.log('=== F8.1 Den Zeitraum eintragen ===')

const gesetzt = await sende(leitung, '/api/planning-units', 'PUT', {
  id: gruppe.id, unterwegsVon: FAHRT_VON, unterwegsBis: FAHRT_BIS,
  unterwegsGrund: 'Gruppenfahrt',
})
check('Der Zeitraum lässt sich setzen', gesetzt.status === 200,
  `HTTP ${gesetzt.status} ${JSON.stringify(gesetzt.body?.error ?? '')}`)
check('Und kommt gespeichert zurück',
  gesetzt.body?.unit?.unterwegsVon === FAHRT_VON
  && gesetzt.body?.unit?.unterwegsBis === FAHRT_BIS,
  JSON.stringify(gesetzt.body?.unit ?? {}))
check('Mit dem Grund daneben', gesetzt.body?.unit?.unterwegsGrund === 'Gruppenfahrt',
  gesetzt.body?.unit?.unterwegsGrund)

// §182 Die Gegenprobe, die den eigentlichen Fehler gefunden hat: Steht er
// auch beim nächsten LESEN noch da? Bei der Abgabesperre tat er das nicht —
// die Maske sah immer ein leeres Feld und löschte beim Speichern, was drin
// stand.
const neuGelesen = (await hole(leitung, `/api/planning-units?locationId=${STANDORT}`))
  .body.units?.find(u => u.id === gruppe.id)
check('Beim nächsten Lesen steht er immer noch da',
  neuGelesen?.unterwegsVon === FAHRT_VON && neuGelesen?.unterwegsBis === FAHRT_BIS,
  JSON.stringify({ von: neuGelesen?.unterwegsVon, bis: neuGelesen?.unterwegsBis }))

// Dasselbe für die Abgabesperre — sie war der Fund.
const sperre = await sende(leitung, '/api/planning-units', 'PUT', {
  id: andere.id, abgabeGesperrtBis: TAGE[4], abgabeGrund: 'Eingewöhnung',
})
check('Auch die Abgabesperre lässt sich setzen', sperre.status === 200,
  `HTTP ${sperre.status}`)
const sperreGelesen = (await hole(leitung, `/api/planning-units?locationId=${STANDORT}`))
  .body.units?.find(u => u.id === andere.id)
check('Und sie steht beim nächsten Lesen noch da',
  sperreGelesen?.abgabeGesperrtBis === TAGE[4],
  `gelesen: ${sperreGelesen?.abgabeGesperrtBis}`)
check('Mit ihrem Grund', sperreGelesen?.abgabeGrund === 'Eingewöhnung',
  sperreGelesen?.abgabeGrund)

// ── F8.2 Ein halber Zeitraum wird abgelehnt ────────────────────────────────
console.log('\n=== F8.2 Kein Zeitraum ohne Ende ===')

for (const [was, daten] of [
  ['nur ein Anfang', { unterwegsVon: FAHRT_VON, unterwegsBis: null }],
  ['nur ein Ende', { unterwegsVon: null, unterwegsBis: FAHRT_BIS }],
]) {
  const r = await sende(leitung, '/api/planning-units', 'PUT', { id: gruppe.id, ...daten })
  check(`Ein Zeitraum mit ${was} wird abgelehnt`, r.status === 400,
    `HTTP ${r.status}: ${r.body?.error ?? ''}`)
}
const verdreht = await sende(leitung, '/api/planning-units', 'PUT', {
  id: gruppe.id, unterwegsVon: FAHRT_BIS, unterwegsBis: FAHRT_VON,
})
check('Ein Ende vor dem Anfang wird abgelehnt', verdreht.status === 400,
  `HTTP ${verdreht.status}: ${verdreht.body?.error ?? ''}`)

const unsinn = await sende(leitung, '/api/planning-units', 'PUT', {
  id: gruppe.id, unterwegsVon: '12.10.2026', unterwegsBis: '15.10.2026',
})
check('Ein Datum in falscher Form wird abgelehnt', unsinn.status === 400,
  `HTTP ${unsinn.status}`)

// Und der Zeitraum von vorhin steht nach all dem unverändert da.
const unberuehrt = (await hole(leitung, `/api/planning-units?locationId=${STANDORT}`))
  .body.units?.find(u => u.id === gruppe.id)
check('Nach den Ablehnungen steht der gültige Zeitraum unverändert da',
  unberuehrt?.unterwegsVon === FAHRT_VON && unberuehrt?.unterwegsBis === FAHRT_BIS,
  JSON.stringify({ von: unberuehrt?.unterwegsVon, bis: unberuehrt?.unterwegsBis }))

// ── F8.3 Niemand darf fremde Gruppen verschicken ───────────────────────────
console.log('\n=== F8.3 Nur der eigene Standort ===')

const fremdZugriff = await sende(fremd, '/api/planning-units', 'PUT', {
  id: gruppe.id, unterwegsVon: FAHRT_VON, unterwegsBis: FAHRT_BIS,
  unterwegsGrund: 'von fremder Leitung',
})
check('Eine fremde Leitung kann diese Gruppe nicht verschicken',
  fremdZugriff.status === 403, `HTTP ${fremdZugriff.status}`)
const nachFremd = (await hole(leitung, `/api/planning-units?locationId=${STANDORT}`))
  .body.units?.find(u => u.id === gruppe.id)
check('Und hat nichts verändert', nachFremd?.unterwegsGrund === 'Gruppenfahrt',
  nachFremd?.unterwegsGrund)

// ── F8.4 Der Plan hält sich daran ──────────────────────────────────────────
console.log('\n=== F8.4 Was der Rechendienst daraus macht ===')

// Die Abgabesperre von oben wieder weg — sie gehört zu F8.1 und würde hier
// die Vertretungswege verengen.
await sende(leitung, '/api/planning-units', 'PUT', {
  id: andere.id, abgabeGesperrtBis: null, abgabeGrund: null,
})

const lauf = await planen()
check('Es entsteht ein Plan', lauf.status === 200, lauf.fehler ?? `HTTP ${lauf.status}`)

const fahrtTage = [TAGE[0], TAGE[1], TAGE[2]]
const danach = [TAGE[3], TAGE[4]]

check('An den Fahrttagen steht keine fremde Kraft in der Gruppe',
  fahrtTage.every(tag => lauf.inGruppe(gruppe.id, tag).every(id => eigene.includes(id))),
  fahrtTage.map(tag => `${tag}: ${lauf.inGruppe(gruppe.id, tag).length} Personen`).join(', '))

check('Und ihre eigenen Kräfte stehen in keiner anderen Gruppe',
  fahrtTage.every(tag => einheiten
    .filter(u => u.type === 'gruppe' && u.id !== gruppe.id)
    .every(u => lauf.inGruppe(u.id, tag).every(id => !eigene.includes(id)))),
  'Wer mit auf Fahrt ist, kann nicht gleichzeitig im Haus aushelfen')

check('Die unbesetzte Gruppe wird NICHT als Verletzung gemeldet',
  !(lauf.body?.bewertung?.verletzungen ?? [])
    .some(v => /Gruppe 3/.test(v.beschreibung ?? '') && fahrtTage.some(t => (v.beschreibung ?? '').includes(t))),
  JSON.stringify((lauf.body?.bewertung?.verletzungen ?? []).map(v => v.beschreibung)).slice(0, 300))

// Die Gegenprobe: Nach der Fahrt ist alles wieder normal. Ohne sie wäre die
// Prüfung auch dann grün, wenn der Zeitraum einfach alles verschluckte.
check('Nach der Fahrt ist die Gruppe wieder besetzt',
  danach.every(tag => lauf.inGruppe(gruppe.id, tag).length > 0),
  danach.map(tag => `${tag}: ${lauf.inGruppe(gruppe.id, tag).length}`).join(', '))

// Und die zweite Gegenprobe: Ohne Zeitraum ist die Gruppe an genau denselben
// Tagen besetzt. Sonst könnte der Grund auch ganz woanders liegen.
await ausgangszustand()
const ohne = await planen()
check('Ohne Zeitraum ist dieselbe Gruppe an allen Tagen besetzt',
  ohne.status === 200 && TAGE.every(tag => ohne.inGruppe(gruppe.id, tag).length > 0),
  ohne.fehler ?? TAGE.map(tag => `${tag}: ${ohne.inGruppe(gruppe.id, tag).length}`).join(', '))

process.exit(bilanz() ? 1 : 0)
