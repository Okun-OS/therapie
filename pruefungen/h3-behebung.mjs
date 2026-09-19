// Nachweis H3: Was der Lauf selbst beheben darf — und was nicht.
//
// Hier entscheidet sich, ob ein Programm, das Gehälter rechnet, sich selbst
// verändern darf. Die Regeln stehen in src/lib/behebung.ts und sind dort
// einzeln nachgerechnet. Diese Prüfung stellt die andere Frage: Halten sie
// auch am laufenden System, über die Schnittstelle, mit echten Funden?
//
// Der Maßstab: Ein zu streng abgelehnter Fund kostet einen Klick. Ein zu
// großzügig durchgewinkter kostet im schlimmsten Fall einen falschen Lohn.
// Deshalb werden die Fälle, in denen NICHT gehandelt werden darf, gründlicher
// geprüft als die anderen.

import { BASIS, pruefer, login, hole, sende } from './helfer.mjs'

const { check, bilanz } = pruefer()

const SCHLUESSEL = process.env.FUNDE_TOKEN ?? ''
const anna = await login('anna.fischer@rheinblick-reha.de')
const leitung = await login('leitung@rheinblick-reha.de')
const okun = await login('okun@okun.de')

const mit = async (methode, daten, pfad = '/api/okun/funde/behebung', schluessel = SCHLUESSEL) => {
  const r = await fetch(`${BASIS}${pfad}`, {
    method: methode,
    headers: {
      ...(schluessel ? { authorization: `Bearer ${schluessel}` } : {}),
      'Content-Type': 'application/json',
    },
    body: daten === undefined ? undefined : JSON.stringify(daten),
  })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

// ── Ohne Schlüssel ─────────────────────────────────────────────────────────
console.log('=== H3 Der Zugang ===')

const ohne = await mit('POST', {}, '/api/okun/funde/behebung', '')
check('Ohne Schlüssel wird abgewiesen', ohne.status === 401 || ohne.status === 503,
  `HTTP ${ohne.status}`)

if (!SCHLUESSEL) {
  console.log('\n  Hinweis: FUNDE_TOKEN ist hier nicht gesetzt — der Rest der Prüfung')
  console.log('  wurde nicht ausgeführt. Dafür:')
  console.log('    FUNDE_TOKEN=<Wert aus der Umgebung des Systems> npm run pruefen -- h3')
  process.exit(bilanz() > 0 ? 1 : 0)
}

/** Einen vollständig gemeldeten Fund anlegen und seine innere Kennung holen. */
async function fund(bereich, art = 'fehler', titelZusatz = '') {
  const angelegt = await sende(anna, '/api/bug-reports', 'POST', {
    art, bereich,
    title: `H3-Nachweis ${titelZusatz} ${Date.now().toString(36)}`,
    schritte: 'Auf die Seite gehen und den Knopf drücken.',
    description: 'Es passiert nichts, keine Rückmeldung.',
    erwartet: 'Der Knopf sollte die Ansicht wechseln.',
    haeufigkeit: 'immer',
  })
  const alle = (await hole(okun, '/api/bug-reports')).body.reports ?? []
  const treffer = alle.find(f => f.ticketId === angelegt.body.ticketId)
  return { id: treffer?.id, ticketId: angelegt.body.ticketId, roh: treffer }
}

const GRUEN = { pruefungen: 730, pruefungenFehler: 0, modultests: 484, modultestsFehler: 0, build: true }

const melden = (f, zusatz = {}) => mit('POST', {
  fundId: f.id, klasse: 'anzeige',
  dateien: ['src/components/chat/Nachrichten.tsx'],
  zeilen: 3,
  begruendung: 'Beschriftung stand auf Englisch. Auf Deutsch geändert.',
  pruefstand: GRUEN,
  ...zusatz,
})

// ── H3 Der eine Weg, der ohne Rückfrage rausgeht ───────────────────────────
console.log('\n=== H3 Reine Anzeige geht raus ===')

const f1 = await fund('nachrichten', 'fehler', 'anzeige')
check('Der Testfund ist angelegt', !!f1.id, f1.ticketId)

const direkt = await melden(f1)
check('Eine reine Anzeigeänderung darf direkt raus', direkt.body.ausgang === 'direkt',
  `${direkt.body.ausgang} · ${direkt.body.grund}`)
check('Und bekommt den Arbeitszweig genannt',
  direkt.body.zweig === 'claude/scheduling-saas-app-vntbc', direkt.body.zweig)

const gepusht = await mit('PATCH', { id: direkt.body.behebungId, commit: 'a1b2c3d4e5f6' })
check('Nach dem Pushen gilt sie als ausgerollt',
  gepusht.body.behebung?.status === 'ausgerollt', gepusht.body.behebung?.status)

const nachher = ((await hole(okun, '/api/bug-reports')).body.reports ?? [])
  .find(x => x.id === f1.id)
check('Und der Fund ist damit erledigt', nachher?.status === 'resolved', nachher?.status)
check('Mit einer Notiz, die sagt, dass es automatisch ging',
  /automatisch/i.test(nachher?.erledigtNotiz ?? ''), nachher?.erledigtNotiz)

const nochmal = await melden(f1)
check('Für denselben Fund gibt es keine zweite Behebung', nochmal.status === 409,
  `HTTP ${nochmal.status}`)

// ── H3 Was gebaut wird, aber warten muss ───────────────────────────────────
console.log('\n=== H3 Verhalten wartet ===')

const f2 = await fund('nachrichten', 'fehler', 'logik')
const logik = await melden(f2, { klasse: 'logik' })
check('Eine Änderung am Verhalten geht nicht von selbst raus',
  logik.body.ausgang === 'sammeln', `${logik.body.ausgang} · ${logik.body.grund}`)
check('Sie bekommt einen eigenen Zweig',
  (logik.body.zweig ?? '').startsWith('claude/behebung-'), logik.body.zweig)

const f3 = await fund('nachrichten', 'fehler', 'api')
const apidatei = await melden(f3, { dateien: ['src/app/api/chat/route.ts'] })
check('Eine Schnittstelle gilt nie als Anzeige — auch wenn der Lauf das behauptet',
  apidatei.body.ausgang === 'sammeln', apidatei.body.ausgang)

const f4 = await fund('nachrichten', 'fehler', 'gross')
const gross = await melden(f4, { zeilen: 120 })
check('Eine große Änderung wartet, auch wenn sie nur die Anzeige betrifft',
  gross.body.ausgang === 'sammeln', `${gross.body.zeilen} · ${gross.body.grund}`)

const f5 = await fund('nachrichten', 'fehler', 'heikledatei')
const lohnseite = await melden(f5, { dateien: ['src/app/employee/lohn/page.tsx'] })
check('Eine Anzeigedatei an einer heiklen Stelle wartet',
  lohnseite.body.ausgang === 'sammeln', lohnseite.body.grund)

// ── H3 Was gar nicht angefasst wird ────────────────────────────────────────
console.log('\n=== H3 Die Grenzen ===')

const f6 = await fund('nachrichten', 'fehler', 'pruefung')
const pruefung = await melden(f6, { dateien: ['pruefungen/b-zeit.mjs'] })
check('Der Lauf darf seine eigenen Prüfungen nicht ändern',
  pruefung.status === 409 && pruefung.body.ausgang === 'abgelehnt',
  `HTTP ${pruefung.status} · ${pruefung.body.grund}`)
check('Und es steht dabei, warum', /Prüfung/i.test(pruefung.body.grund ?? ''),
  pruefung.body.grund)

const f7 = await fund('nachrichten', 'fehler', 'getarnt')
const getarnt = await melden(f7, {
  dateien: ['src/components/ui/Card.tsx', 'src/lib/__tests__/lohn.test.ts'],
})
check('Auch als Beifang nicht — eine verbotene Datei kippt die ganze Behebung',
  getarnt.body.ausgang === 'abgelehnt', getarnt.body.grund)

const f8 = await fund('nachrichten', 'fehler', 'wanderung')
const wanderung = await melden(f8, { dateien: ['prisma/schema.prisma'] })
check('An der Datenbank ändert der Lauf nichts',
  wanderung.body.ausgang === 'abgelehnt', wanderung.body.grund)

const f9 = await fund('nachrichten', 'fehler', 'regeln')
const regeln = await melden(f9, { dateien: ['src/lib/behebung.ts'] })
check('Und an seinen eigenen Regeln erst recht nicht',
  regeln.body.ausgang === 'abgelehnt', regeln.body.grund)

// ── H3 Der Prüfstand ───────────────────────────────────────────────────────
console.log('\n=== H3 Ungeprüft geht nichts ===')

const f10 = await fund('nachrichten', 'fehler', 'rot')
const rot = await melden(f10, { pruefstand: { ...GRUEN, pruefungenFehler: 1 } })
check('Eine einzige rote Prüfung hält alles an', rot.status === 409,
  `HTTP ${rot.status} · ${rot.body.grund}`)

const f11 = await fund('nachrichten', 'fehler', 'leer')
const leer = await melden(f11, {
  pruefstand: { pruefungen: 0, modultests: 0, build: true },
})
check('Eine gar nicht gelaufene Prüfreihe ist kein grünes Ergebnis',
  leer.status === 409, leer.body.grund)

const f12 = await fund('nachrichten', 'fehler', 'ohnebuild')
const ohneBuild = await melden(f12, { pruefstand: { ...GRUEN, build: false } })
check('Ohne Build geht nichts', ohneBuild.status === 409, ohneBuild.body.grund)

// ── H3 Geld und Recht ──────────────────────────────────────────────────────
console.log('\n=== H3 Geld und Recht ===')

const fLohn = await fund('lohn', 'fehler', 'lohn')
const ohneFreigabe = await melden(fLohn)
check('Ein Lohnfund wird ohne Freigabe nicht angefasst',
  ohneFreigabe.body.ausgang === 'abgelehnt', ohneFreigabe.body.grund)
check('Mit dem Hinweis auf die Freigabe',
  /Freigabe/i.test(ohneFreigabe.body.grund ?? ''), ohneFreigabe.body.grund)

await sende(okun, '/api/bug-reports', 'PATCH', { id: fLohn.id, freigabe: 'freigegeben' })
const mitFreigabe = await melden(fLohn)
check('Nach der Freigabe wird er gebaut — aber gesammelt, nicht ausgerollt',
  mitFreigabe.body.ausgang === 'sammeln',
  `${mitFreigabe.body.ausgang} · ${mitFreigabe.body.grund}`)

const fVerb = await fund('nachrichten', 'verbesserung', 'verbesserung')
const verbesserung = await melden(fVerb)
check('Eine Verbesserung ohne Freigabe wird nicht gebaut',
  verbesserung.body.ausgang === 'abgelehnt', verbesserung.body.grund)

// ── H3 Das Tor ─────────────────────────────────────────────────────────────
console.log('\n=== H3 Freigeben und Zusammenführen ===')

const wartende = logik.body.behebungId
const vorschnell = await mit('PATCH', { id: wartende, zusammengefuehrt: true })
check('Der Lauf kann eine wartende Behebung nicht selbst zusammenführen',
  vorschnell.status === 409, `HTTP ${vorschnell.status} · ${vorschnell.body.error}`)

const alsLeitung = await sende(leitung, '/api/behebungen', 'PATCH',
  { id: wartende, status: 'freigegeben' })
check('Eine Standortleitung entscheidet nicht über den Quelltext',
  alsLeitung.status === 403, `HTTP ${alsLeitung.status}`)

const freigegeben = await sende(okun, '/api/behebungen', 'PATCH',
  { id: wartende, status: 'freigegeben' })
check('OKUN kann freigeben', freigegeben.body.behebung?.status === 'freigegeben',
  freigegeben.body.behebung?.status)
check('Und es steht dabei, wer', !!freigegeben.body.behebung?.entschiedenVon,
  freigegeben.body.behebung?.entschiedenVon)

const zuHolen = await mit('GET')
check('Der Lauf sieht die freigegebene Behebung',
  (zuHolen.body.freigegeben ?? []).some(b => b.id === wartende),
  `${zuHolen.body.anzahl} freigegeben`)

const zusammengefuehrt = await mit('PATCH',
  { id: wartende, commit: 'f00ba4c0ffee', zusammengefuehrt: true })
check('Nach der Freigabe darf er zusammenführen',
  zusammengefuehrt.body.behebung?.status === 'ausgerollt',
  zusammengefuehrt.body.behebung?.status)

const fundDanach = ((await hole(okun, '/api/bug-reports')).body.reports ?? [])
  .find(x => x.id === f2.id)
check('Und der Fund ist erledigt', fundDanach?.status === 'resolved', fundDanach?.status)
check('Mit dem Hinweis, dass eine Freigabe davorstand',
  /Freigabe/i.test(fundDanach?.erledigtNotiz ?? ''), fundDanach?.erledigtNotiz)

// ── H3 Verwerfen ───────────────────────────────────────────────────────────
console.log('\n=== H3 Verwerfen ===')

const zuVerwerfen = apidatei.body.behebungId
const verworfen = await sende(okun, '/api/behebungen', 'PATCH',
  { id: zuVerwerfen, status: 'verworfen', notiz: 'Anders lösen.' })
check('Verwerfen geht', verworfen.body.behebung?.status === 'verworfen')

const trotzdem = await mit('PATCH', { id: zuVerwerfen, commit: 'deadbeef' })
check('Eine verworfene Behebung rührt der Lauf nicht mehr an',
  trotzdem.status === 409, `HTTP ${trotzdem.status}`)

const fundOffen = ((await hole(okun, '/api/bug-reports')).body.reports ?? [])
  .find(x => x.id === f3.id)
check('Der Fund bleibt dabei offen — verworfen heißt nicht erledigt',
  fundOffen?.status !== 'resolved', fundOffen?.status)

const nachtraeglich = await sende(okun, '/api/behebungen', 'PATCH',
  { id: direkt.body.behebungId, status: 'verworfen' })
check('Was schon draußen ist, lässt sich nicht nachträglich freigeben oder verwerfen',
  nachtraeglich.status === 409, `HTTP ${nachtraeglich.status}`)

// ── H3 Wer die Liste sehen darf ────────────────────────────────────────────
console.log('\n=== H3 Einsicht ===')

const listeLeitung = await hole(leitung, '/api/behebungen')
check('Die Liste sieht nur OKUN', listeLeitung.status === 403,
  `HTTP ${listeLeitung.status}`)

const listeOkun = await hole(okun, '/api/behebungen')
check('OKUN sieht sie', listeOkun.status === 200
  && (listeOkun.body.behebungen ?? []).length > 0,
  `${(listeOkun.body.behebungen ?? []).length} Einträge`)

// Aufräumen: Jeden Testfund schließen, der noch offen ist — nicht nur die aus
// DIESEM Lauf. Bricht die Prüfung vorzeitig ab, bleiben sonst Funde liegen, die
// der stündliche Lauf danach ernsthaft zu beheben versucht.
const zuSchliessen = ((await hole(okun, '/api/bug-reports')).body.reports ?? [])
  .filter(f => /^H3-Nachweis/.test(f.title ?? '')
    && !['resolved', 'abgelehnt'].includes(f.status))
for (const f of zuSchliessen) {
  await sende(okun, '/api/bug-reports', 'PATCH', {
    id: f.id, status: 'abgelehnt',
    adminNotes: 'H3-Nachweis — automatisch geschlossen.',
  })
}
const offeneTests = ((await hole(okun, '/api/bug-reports')).body.reports ?? [])
  .filter(f => /^H3-Nachweis/.test(f.title ?? '')
    && !['resolved', 'abgelehnt'].includes(f.status))
check('Der Nachweis lässt keine offenen Testfunde zurück', offeneTests.length === 0,
  `${offeneTests.length} offen`)

process.exit(bilanz() > 0 ? 1 : 0)
