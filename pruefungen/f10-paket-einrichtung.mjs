// Nachweis F10: Das Regelpaket bringt seine Einrichtung mit (§202).
//
// WORUM ES GEHT
// Der Eigentümer weist einem Standort ein Regelpaket zu — und danach muss
// geplant werden können. Bis §202 ging das nicht: Das Paket brachte Regeln,
// aber keine Dienstzeiten, und die sollte der Kunde selbst in einer
// Einrichtung anlegen, die es für ihn gar nicht mehr geben soll. So stand die
// Kita „Krümelkiste" da: Paket zugewiesen, „Noch keine Dienstzeiten", kein Plan.
//
// Vorher prüfte diese Datei (§198), welchen SATZ der Kunde dann liest — unter
// anderem „Schließe das Standort-Onboarding ab". Diesen Weg gibt es nicht
// mehr; geprüft wird jetzt, dass er nicht mehr gebraucht wird.
//
// GEGENPROBEN
// - Ein Paket OHNE Einrichtung (die Vorlage) legt nichts an — sonst bewiese
//   „12 Dienstzeiten angelegt" nur, dass irgendetwas Dienste anlegt.
// - Vorhandene Dienstzeiten werden NICHT überschrieben.
// - Die Leitung kann keine Dienste mehr anlegen — OKUN schon.
// - „unterwegs" darf die Leitung weiter selbst setzen, eine Gruppe umbenennen nicht.

import { pruefer, login, hole, sende, BASIS } from './helfer.mjs'

const { check, bilanz } = pruefer()

const okun = await login('okun@okun.de')
// Planen darf nur die Leitung des Mandanten, nicht OKUN. Die Standorte
// entstehen deshalb unter dieser Geschäftsführung — das Regelpaket ordnet
// OKUN zu, und das ist auch im Betrieb so.
const gf = await login('gf@rheinblick-reha.de')
const fremd = await login('leitung@kita-sonnenschein.de')

const MARKE = `F10 ${Date.now().toString(36)}`
const angelegt = []

async function standortAnlegen(name) {
  const r = await sende(gf, '/api/locations', 'POST', {
    name: `${MARKE} ${name}`, city: 'Berlin', street: 'Teststraße', houseNumber: '1', zip: '10785',
    state: 'Berlin', bundesland: 'Berlin', country: 'Deutschland',
  })
  const s = r.body?.location ?? r.body
  if (s?.id) angelegt.push(s.id)
  return s
}
const dienste = async (id) => (await hole(gf, `/api/shifts?locationId=${id}`)).body.shifts ?? []
const einheiten = async (id) => (await hole(gf, `/api/planning-units?locationId=${id}`)).body.units ?? []
const zuweisen = (id, rulePackId, frei = true) =>
  sende(okun, '/api/okun/dienstplanung', 'PATCH', { locationId: id, rulePackId, dienstplanungFrei: frei })
const planen = (id, wer = gf) =>
  sende(wer, '/api/ai/solve-schedule', 'POST', { locationId: id, von: '2026-11-02', bis: '2026-11-06', async: true })

const pakete = (await hole(okun, '/api/okun/dienstplanung')).body?.pakete ?? []
const kita = pakete.find(p => p.id === 'kita_zwei_etagen')
const vorlage = pakete.find(p => p.id === 'muster_pflege')
check('Der Rechendienst meldet die Einrichtung des Kita-Pakets',
  kita?.einrichtung?.dienstzeiten?.length === 12,
  kita ? `${kita.einrichtung?.dienstzeiten?.length ?? 0} Dienstzeiten` : 'Paket fehlt — läuft der Rechendienst?')
check('Gegenprobe: die Vorlage meldet keine', !!vorlage && !vorlage.einrichtung)

try {
  console.log('\n=== Zuweisen legt an, was fehlt ===')
  const a = await standortAnlegen('Kita')
  check('Gegenprobe: ein frischer Standort hat keine Dienstzeiten', (await dienste(a.id)).length === 0)
  const zu = await zuweisen(a.id, 'kita_zwei_etagen')
  check('Zuweisen meldet, was angelegt wurde',
    zu.body?.einrichtung?.dienstzeiten?.angelegt === 12 && zu.body?.einrichtung?.struktur?.angelegt === 10,
    zu.body?.hinweis ?? `HTTP ${zu.status}`)
  const d = await dienste(a.id)
  check('12 Dienstzeiten am Standort, mit den Zeiten aus dem Paket',
    d.length === 12 && d.some(x => x.name === 'Frühdienst 8' && x.startTime === '06:00' && x.endTime === '14:30'),
    `${d.length} · ${d.map(x => x.name).slice(0, 3).join(', ')}`)
  const e = await einheiten(a.id)
  const g1 = e.find(u => u.name === 'Gruppe 1')
  const unten = e.find(u => u.name === 'untere Etage')
  check('Etagen und Gruppen stehen, die Gruppe hängt an ihrer Etage',
    e.length === 10 && !!g1 && g1.parentId === unten?.id, `${e.length} Einheiten`)
  check('Mo–Fr gilt ohnehin — dafür wird nichts geschrieben',
    zu.body?.einrichtung?.arbeitstage?.gesetzt === null
      && JSON.stringify(zu.body?.einrichtung?.arbeitstage?.vorhanden) === JSON.stringify(['Mo', 'Di', 'Mi', 'Do', 'Fr']),
    JSON.stringify(zu.body?.einrichtung?.arbeitstage))
  const liste = (await hole(okun, '/api/okun/dienstplanung')).body.standorte.find(s => s.id === a.id)
  check('OKUN sieht es am Standort', liste?.dienstzeiten === 12 && liste?.einheiten === 10,
    JSON.stringify({ dienstzeiten: liste?.dienstzeiten, einheiten: liste?.einheiten }))

  const lauf = await planen(a.id)
  check('Und es lässt sich planen', lauf.status === 200 && !!lauf.body?.sessionId,
    lauf.body?.error ?? `HTTP ${lauf.status}`)

  console.log('\n=== Die Wohngruppe: sieben Tage ===')
  const w = await standortAnlegen('Wohngruppe')
  const zuW = await zuweisen(w.id, 'wohngruppe_fuenf')
  check('Gegenprobe zu Mo–Fr: hier werden die sieben Tage geschrieben',
    zuW.body?.einrichtung?.arbeitstage?.gesetzt?.length === 7, JSON.stringify(zuW.body?.einrichtung?.arbeitstage))
  check('18 Dienstzeiten, ein Bereich', (await dienste(w.id)).length === 18 && (await einheiten(w.id)).length === 1)

  console.log('\n=== Nichts wird überschrieben ===')
  const b = await standortAnlegen('vorhanden')
  const eigener = await sende(okun, '/api/shifts', 'POST', {
    locationId: b.id, name: 'Eigener Dienst', type: 'early', startTime: '07:00', endTime: '15:00',
  })
  check('OKUN legt einen Dienst an', eigener.status === 200 || eigener.status === 201, `HTTP ${eigener.status}`)
  const zuB = await zuweisen(b.id, 'kita_zwei_etagen')
  const dB = await dienste(b.id)
  check('Vorhandene Dienstzeiten bleiben, das Paket legt keine dazu',
    dB.length === 1 && dB[0].name === 'Eigener Dienst' && zuB.body?.einrichtung?.dienstzeiten?.angelegt === 0,
    `${dB.length} Dienste · ${zuB.body?.hinweis}`)

  console.log('\n=== Paket ohne Einrichtung, Standort ohne Paket ===')
  const c = await standortAnlegen('Vorlage')
  const zuC = await zuweisen(c.id, 'muster_pflege')
  check('Die Vorlage legt nichts an — und sagt das',
    (await dienste(c.id)).length === 0 && /bringt keine Dienstzeiten mit/.test(zuC.body?.hinweis ?? ''),
    zuC.body?.hinweis)
  const lC = await planen(c.id)
  check('Planen: 422 mit Kennung', lC.status === 422 && lC.body?.code === 'NO_SHIFTS', `HTTP ${lC.status}`)
  check('Die Meldung nennt Regelpaket und OKUN', /Regelpaket/.test(lC.body?.error) && /OKUN/.test(lC.body?.error),
    lC.body?.error)
  check('…und schickt NICHT in ein Onboarding', !/Onboarding/i.test(lC.body?.error ?? ''))

  const ohne = await standortAnlegen('ohne Paket')
  await sende(okun, '/api/okun/dienstplanung', 'PATCH', { locationId: ohne.id, dienstplanungFrei: true })
  const lO = await planen(ohne.id)
  check('Ohne Paket: 422, OKUN richtet ein — kein Onboarding',
    lO.status === 422 && /OKUN/.test(lO.body?.error) && !/Onboarding/i.test(lO.body?.error ?? ''), lO.body?.error)

  console.log('\n=== Paket vor §202 zugewiesen: wird nachgeholt ===')
  const n = await standortAnlegen('nachholen')
  await zuweisen(n.id, 'kita_zwei_etagen')
  for (const x of await dienste(n.id)) await sende(okun, `/api/shifts/${x.id}`, 'DELETE')
  check('Ausgangslage: Paket da, Dienstzeiten weg', (await dienste(n.id)).length === 0)
  const nach = await sende(gf, '/api/planning/einrichtung', 'POST', { locationId: n.id })
  check('Beim Öffnen des Dienstplans werden sie nachgeholt',
    nach.status === 200 && nach.body?.dienstzeiten === 12 && (await dienste(n.id)).length === 12,
    nach.body?.error ?? JSON.stringify(nach.body))
  for (const x of await dienste(n.id)) await sende(okun, `/api/shifts/${x.id}`, 'DELETE')
  const lN = await planen(n.id)
  check('…und spätestens beim Planen', lN.status === 200 && (await dienste(n.id)).length === 12,
    lN.body?.error ?? `HTTP ${lN.status}`)
  const fremdNach = await sende(fremd, '/api/planning/einrichtung', 'POST', { locationId: n.id })
  check('Eine fremde Leitung kann das nicht auslösen', fremdNach.status === 403, `HTTP ${fremdNach.status}`)

  console.log('\n=== Der Weg des Dienstplan-Knopfs prüft jetzt wie der andere ===')
  const gesperrt = await standortAnlegen('gesperrt')
  await zuweisen(gesperrt.id, 'kita_zwei_etagen', false)
  const lG = await planen(gesperrt.id)
  check('Nicht freigeschaltet: 423 — vorher rechnete dieser Weg trotzdem', lG.status === 423,
    lG.body?.error ?? `HTTP ${lG.status}`)
  const lF = await planen(a.id, fremd)
  check('Fremde Leitung: 403 — vorher rechnete dieser Weg trotzdem', lF.status === 403, `HTTP ${lF.status}`)

  console.log('\n=== Einrichtung schreibt nur noch OKUN ===')
  const dienstGf = await sende(gf, '/api/shifts', 'POST', {
    locationId: a.id, name: 'Selbstgebaut', type: 'early', startTime: '06:00', endTime: '12:00',
  })
  check('Das Unternehmen legt KEINE Dienste mehr an', dienstGf.status === 403, `HTTP ${dienstGf.status}`)
  const regelnGf = await sende(gf, '/api/planning-rules', 'PUT', { locationId: a.id, maxWeeklyHours: 60 })
  check('…und ändert keine Basisregeln', regelnGf.status === 403, `HTTP ${regelnGf.status}`)
  const umbenennen = await sende(gf, '/api/planning-units', 'PUT', { id: g1.id, name: 'Umbenannt' })
  check('…und benennt keine Gruppe um', umbenennen.status === 403, `HTTP ${umbenennen.status}`)
  const unterwegs = await sende(gf, '/api/planning-units', 'PUT', {
    id: g1.id, unterwegsVon: '2026-11-03', unterwegsBis: '2026-11-04', unterwegsGrund: 'Ausflug',
  })
  check('Gegenprobe: „unterwegs" darf es weiter selbst eintragen', unterwegs.status === 200,
    unterwegs.body?.error ?? `HTTP ${unterwegs.status}`)
  check('Gegenprobe: am Namen hat sich nichts geändert',
    (await einheiten(a.id)).some(u => u.id === g1.id && u.name === 'Gruppe 1'))
} finally {
  for (const id of angelegt) {
    await fetch(`${BASIS}/api/locations/${id}`, { method: 'DELETE', headers: { cookie: okun } })
  }
}

const danach = (await hole(gf, '/api/locations')).body.locations ?? []
check('Die Prüfung lässt keine Standorte zurück',
  !danach.some(l => l.name?.includes(MARKE)),
  danach.filter(l => l.name?.includes(MARKE)).map(l => l.name).join(', ') || 'keine')

process.exit(bilanz() ? 1 : 0)
