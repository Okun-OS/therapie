// Nachweis I1: Qualifikationen, Pflichtnachweise und Vertragsfristen.
//
// An diesen Fristen hängt, ob jemand mit abgelaufener Belehrung am Essen steht
// oder ob eine Befristung unbemerkt in ein unbefristetes Arbeitsverhältnis
// läuft. Beides merkt man erst, wenn es zu spät ist.
//
// Die Rechenwege sind in src/lib/__tests__/fristen.test.ts nachgerechnet. Hier
// geht es um das Zusammenspiel — und vor allem um die zwei Fragen, die über
// Vertrauen entscheiden:
//
//   WER DARF DEN KATALOG ÄNDERN? Nur die Unternehmensebene. Welche Pflichten
//   ein Betrieb führt, ist eine Entscheidung über Recht und Haftung.
//
//   WER SIEHT WAS? Was auf „nur Unternehmen" steht, bekommt eine
//   Standortleitung gar nicht erst in die Antwort — weder Name noch Zahl. Eine
//   Liste mit „3 weitere (nicht sichtbar)" verriete schon, dass es etwas gibt.

import { pruefer, login, hole, sende } from './helfer.mjs'

const { check, bilanz } = pruefer()

const gf = await login('gf@rheinblick-reha.de')
const leitung = await login('leitung@rheinblick-reha.de')
const anna = await login('anna.fischer@rheinblick-reha.de')
const fremdeLeitung = await login('susi.sonnenschein@kita-sonnenschein.de')

const mAnna = (await hole(anna, '/api/auth/me')).body.user

const EIGEN = `I1-Nachweis ${Date.now().toString(36)}`

// ── I1 Der Katalog ─────────────────────────────────────────────────────────
console.log('=== I1 Wer den Katalog ändern darf ===')

const alsLeitung = await sende(leitung, '/api/nachweisarten', 'POST',
  { name: `${EIGEN} durch Leitung` })
check('Eine Standortleitung legt keine Nachweisart an', alsLeitung.status === 403,
  `HTTP ${alsLeitung.status}`)

const alsMitarbeiter = await hole(anna, '/api/nachweisarten')
check('Ein Mitarbeiter sieht den Katalog gar nicht', alsMitarbeiter.status === 403,
  `HTTP ${alsMitarbeiter.status}`)

const leerName = await sende(gf, '/api/nachweisarten', 'POST', { name: 'x' })
check('Ein Eintrag ohne Namen wird abgelehnt', leerName.status === 400,
  leerName.body.error)

const ohneAbstand = await sende(gf, '/api/nachweisarten', 'POST', {
  name: `${EIGEN} ohne Abstand`, faelligkeit: 'wiederkehrend',
})
check('Eine wiederkehrende Frist ohne Abstand wird abgelehnt',
  ohneAbstand.status === 400, ohneAbstand.body.error)
check('Und es wird gesagt, warum das gefährlich wäre',
  /nie wieder fällig|für immer auf grün/i.test(ohneAbstand.body.error ?? ''),
  ohneAbstand.body.error)

const ohneWerte = await sende(gf, '/api/nachweisarten', 'POST', {
  name: `${EIGEN} ohne Werte`, giltFuer: 'positionen', giltFuerWerte: [],
  faelligkeit: 'einmalig',
})
check('„Gilt für bestimmte Positionen" ohne Positionen wird abgelehnt',
  ohneWerte.status === 400, ohneWerte.body.error)

// ── I1 Anlegen und Sichtbarkeit ────────────────────────────────────────────
console.log('\n=== I1 Wer was sieht ===')

const offen = await sende(gf, '/api/nachweisarten', 'POST', {
  name: `${EIGEN} Erste Hilfe`, gattung: 'nachweis', giltFuer: 'alle',
  faelligkeit: 'wiederkehrend', abstandMonate: 24, vorwarnTage: 56,
  sichtbarkeit: 'leitung', folge: 'warnen', grundlage: 'DGUV Vorschrift 1 §26',
})
check('Die Unternehmensebene legt eine Art an', offen.status === 200,
  offen.body.art?.name)

const geheim = await sende(gf, '/api/nachweisarten', 'POST', {
  name: `${EIGEN} Führungszeugnis`, gattung: 'nachweis', giltFuer: 'alle',
  faelligkeit: 'einmalig', vorwarnTage: 84,
  sichtbarkeit: 'unternehmen', folge: 'sperren', grundlage: '§30a BZRG',
})
check('Und eine, die nur sie selbst sieht', geheim.status === 200)

const beiGf = (await hole(gf, '/api/nachweisarten')).body.arten ?? []
check('Die Unternehmensebene sieht beide',
  beiGf.some(a => a.id === offen.body.art.id)
  && beiGf.some(a => a.id === geheim.body.art.id))

const beiLeitung = (await hole(leitung, '/api/nachweisarten')).body.arten ?? []
check('Die Standortleitung sieht die freigegebene',
  beiLeitung.some(a => a.id === offen.body.art.id))
check('Und die andere gar nicht — nicht ausgegraut, sondern weg',
  !beiLeitung.some(a => a.id === geheim.body.art.id),
  `${beiLeitung.length} sichtbar`)
check('Sie bekommt auch keine Vorlagen zum Übernehmen',
  ((await hole(leitung, '/api/nachweisarten')).body.vorlagen ?? []).length === 0)

// ── I1 Fristen für eine Person ─────────────────────────────────────────────
console.log('\n=== I1 Fristen entstehen ===')

const angelegt = await sende(gf, '/api/fristen', 'POST',
  { employeeId: mAnna.employeeId })
check('Aus dem Katalog entstehen Fristen', angelegt.status === 200
  && (angelegt.body.angelegt ?? 0) >= 2, `${angelegt.body.angelegt} angelegt`)

const nochmal = await sende(gf, '/api/fristen', 'POST',
  { employeeId: mAnna.employeeId })
check('Ein zweiter Lauf legt nichts doppelt an', nochmal.body.angelegt === 0,
  `${nochmal.body.angelegt}`)

const beiGfListe = (await hole(gf, `/api/fristen?employeeId=${mAnna.employeeId}`))
  .body.eintraege ?? []
const meineOffen = beiGfListe.find(e => e.nachweisartId === offen.body.art.id)
const meineGeheim = beiGfListe.find(e => e.nachweisartId === geheim.body.art.id)
check('Die Unternehmensebene sieht beide Fristen', !!meineOffen && !!meineGeheim)
check('Eine nie erfüllte Frist steht offen',
  ['fehlt', 'abgelaufen'].includes(meineOffen?.stand), meineOffen?.stand)
check('Und die Grundlage steht dabei',
  /DGUV/.test(meineOffen?.grundlage ?? ''), meineOffen?.grundlage)

const beiLeitungListe = (await hole(leitung, `/api/fristen?employeeId=${mAnna.employeeId}`))
  .body.eintraege ?? []
check('Die Standortleitung sieht die freigegebene Frist',
  beiLeitungListe.some(e => e.nachweisartId === offen.body.art.id))
check('Die vertrauliche fehlt in ihrer Antwort vollständig',
  !beiLeitungListe.some(e => e.nachweisartId === geheim.body.art.id),
  `${beiLeitungListe.length} sichtbar`)

// ── I1 Erfüllen ────────────────────────────────────────────────────────────
console.log('\n=== I1 Erfüllen und befreien ===')

const erfuellt = await sende(gf, '/api/fristen', 'PATCH',
  { id: meineOffen.id, erfuelltAm: '2026-09-01' })
check('Eine Frist lässt sich als erfüllt eintragen', erfuellt.status === 200)
check('Das nächste Ablaufdatum rechnet das System selbst',
  (erfuellt.body.frist?.faelligAm ?? '').startsWith('2028-09-01'),
  erfuellt.body.frist?.faelligAm)

const danach = ((await hole(gf, `/api/fristen?employeeId=${mAnna.employeeId}`))
  .body.eintraege ?? []).find(e => e.id === meineOffen.id)
check('Danach ist sie gültig', danach?.stand === 'gueltig', danach?.standText)

const ohneGrund = await sende(gf, '/api/fristen', 'PATCH',
  { id: meineOffen.id, befreien: true })
check('Eine Befreiung ohne Begründung geht nicht', ohneGrund.status === 400,
  ohneGrund.body.error)

const befreit = await sende(gf, '/api/fristen', 'PATCH',
  { id: meineOffen.id, befreien: true, befreitGrund: 'I1-Nachweis: in Elternzeit' })
check('Mit Begründung geht sie', befreit.status === 200)
const nachBefreiung = ((await hole(gf, `/api/fristen?employeeId=${mAnna.employeeId}`))
  .body.eintraege ?? []).find(e => e.id === meineOffen.id)
check('Und der Stand sagt es samt Grund', nachBefreiung?.stand === 'befreit'
  && /Elternzeit/.test(nachBefreiung?.standText ?? ''), nachBefreiung?.standText)

const leitungAendertGeheim = await sende(leitung, '/api/fristen', 'PATCH',
  { id: meineGeheim.id, erfuelltAm: '2026-01-01' })
check('Was die Leitung nicht sehen darf, darf sie auch nicht ändern',
  leitungAendertGeheim.status === 404, `HTTP ${leitungAendertGeheim.status}`)

// ── I1 Eigene Fristen und fremde Mandanten ─────────────────────────────────
console.log('\n=== I1 Grenzen ===')

const eigene = (await hole(anna, '/api/fristen')).body.eintraege ?? []
check('Ein Mitarbeiter sieht seine eigenen Fristen', eigene.length > 0,
  `${eigene.length}`)
check('Und alle gehören ihm selbst',
  eigene.every(e => e.employeeId === mAnna.employeeId))

const fremde = await hole(anna, `/api/fristen?employeeId=irgendwer`)
check('Aber nicht die einer Kollegin',
  (fremde.body.eintraege ?? []).every(e => e.employeeId === mAnna.employeeId),
  `${(fremde.body.eintraege ?? []).length}`)

const andererMandant = (await hole(fremdeLeitung, '/api/nachweisarten')).body.arten ?? []
check('Der Katalog endet am eigenen Mandanten',
  !andererMandant.some(a => a.name.startsWith(EIGEN)),
  `${andererMandant.length} beim anderen Kunden`)

// ── I1 Vorlagen ────────────────────────────────────────────────────────────
console.log('\n=== I1 Vorlagen ===')

const vorlagen = (await hole(gf, '/api/nachweisarten')).body.vorlagen ?? []
check('Es gibt Vorlagen je Betriebsform', vorlagen.length >= 4,
  vorlagen.map(v => v.schluessel).join(', '))

const uebernommen = await sende(gf, '/api/nachweisarten', 'POST', { vorlage: 'allgemein' })
check('Eine Vorlage lässt sich übernehmen', uebernommen.status === 200,
  `${uebernommen.body.angelegt} angelegt`)

const zweimal = await sende(gf, '/api/nachweisarten', 'POST', { vorlage: 'allgemein' })
check('Ein zweiter Klick überschreibt nichts', zweimal.body.angelegt === 0,
  `${zweimal.body.angelegt} angelegt, ${zweimal.body.uebersprungen} übersprungen`)

const unbekannt = await sende(gf, '/api/nachweisarten', 'POST', { vorlage: 'quatsch' })
check('Eine unbekannte Vorlage wird abgelehnt', unbekannt.status === 400)

// ── I1 Abschalten statt löschen ────────────────────────────────────────────
console.log('\n=== I1 Abschalten ===')

const abgeschaltet = await sende(gf, '/api/nachweisarten', 'DELETE',
  { id: offen.body.art.id })
check('Eine Art lässt sich abschalten', abgeschaltet.status === 200)
check('Und die vorhandenen Einträge bleiben erhalten',
  /bleiben erhalten/i.test(abgeschaltet.body.hinweis ?? ''), abgeschaltet.body.hinweis)

const nachAbschalten = ((await hole(gf, `/api/fristen?employeeId=${mAnna.employeeId}`))
  .body.eintraege ?? []).find(e => e.id === meineOffen.id)
check('Die Frist der Person steht weiterhin da', !!nachAbschalten)

// ── I1 Entfernen ───────────────────────────────────────────────────────────
console.log('\n=== I1 Entfernen ===')

const entfernt = await sende(gf, '/api/fristen', 'DELETE', { id: meineGeheim.id })
check('Eine Frist lässt sich entfernen', entfernt.status === 200)
check('Und ist danach weg',
  !((await hole(gf, `/api/fristen?employeeId=${mAnna.employeeId}`)).body.eintraege ?? [])
    .some(e => e.id === meineGeheim.id))

const nochmalEntfernen = await sende(gf, '/api/fristen', 'DELETE', { id: meineGeheim.id })
check('Ein zweites Mal meldet sauber „nicht gefunden"',
  nochmalEntfernen.status === 404, `HTTP ${nochmalEntfernen.status}`)

// Aufräumen: Was dieser Nachweis angelegt hat, wird wieder abgeschaltet und die
// Fristen der Testperson entfernt — sonst summiert sich das über die Läufe und
// wird irgendwann selbst zur Fehlerquelle (siehe §143).
const meineFristen = ((await hole(gf, `/api/fristen?employeeId=${mAnna.employeeId}`))
  .body.eintraege ?? []).filter(e => e.bezeichnung.startsWith('I1-Nachweis'))
for (const f of meineFristen) {
  await sende(gf, '/api/fristen', 'DELETE', { id: f.id })
}
const meine = ((await hole(gf, '/api/nachweisarten')).body.arten ?? [])
  .filter(a => a.name.startsWith('I1-Nachweis') && a.aktiv)
for (const a of meine) {
  await sende(gf, '/api/nachweisarten', 'DELETE', { id: a.id })
}
check('Der Nachweis lässt keine aktiven Testeinträge zurück',
  ((await hole(gf, '/api/nachweisarten')).body.arten ?? [])
    .filter(a => a.name.startsWith('I1-Nachweis') && a.aktiv).length === 0)
check('Und keine Testfristen',
  ((await hole(gf, `/api/fristen?employeeId=${mAnna.employeeId}`)).body.eintraege ?? [])
    .filter(e => e.bezeichnung.startsWith('I1-Nachweis')).length === 0)

process.exit(bilanz() > 0 ? 1 : 0)
