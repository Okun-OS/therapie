// Nachweis I3: Nachweise anfordern — mit Rückweg.
//
// Der Ablauf: Der Betrieb fordert etwas an, der Mensch lädt es hoch, der
// Betrieb nimmt es ab oder fragt nach. Klingt einfach; die Fallen liegen
// woanders:
//
//   DARF SICH JEMAND SELBST ABNEHMEN? Nein — das ist der ganze Sinn der
//   Sache. Wer seinen eigenen Nachweis abhaken kann, braucht keinen.
//
//   SIEHT EIN KOLLEGE DIE ANFORDERUNG? Nein. Was jemand einzureichen hat,
//   geht niemanden sonst etwas an — und was er hochlädt, erst recht nicht.
//
//   WIRD DIE FRIST WIRKLICH ERFÜLLT? Das ist der eigentliche Zweck. Ohne
//   diesen Schritt gäbe es zwei Wahrheiten: eine abgenommene Bescheinigung
//   und eine Frist, die weiter auf Rot steht.
//
// Die Zustandsregeln sind in src/lib/__tests__/anforderung.test.ts einzeln
// nachgerechnet.

import { pruefer, login, hole, sende, BASIS } from './helfer.mjs'

const { check, bilanz } = pruefer()

const gf = await login('gf@rheinblick-reha.de')
const leitung = await login('leitung@rheinblick-reha.de')
const anna = await login('anna.fischer@rheinblick-reha.de')
// Ein fremder Betrieb: die Leitung dort und eine Person dort. Beide
// müssen draußen bleiben — die Leitung ist der schärfere Fall.
const fremdeLeitung = await login('leitung@kita-sonnenschein.de')
const fremdePerson = await login('susi.sonnenschein@kita-sonnenschein.de')

const mAnna = (await hole(anna, '/api/auth/me')).body.user
const EIGEN = `I3-Anforderung ${Date.now().toString(36)}`

/** Eine Datei hochladen — wie es die App tut. */
async function hochladen(cookie, id, dateiname, text = '') {
  const form = new FormData()
  form.set('text', text)
  form.set('datei', new File(
    [Buffer.from('%PDF-1.4\n% Prüfdatei\n')], dateiname,
    { type: 'application/pdf' },
  ))
  const r = await fetch(`${BASIS}/api/anforderungen/${id}`, {
    method: 'POST', headers: { cookie }, body: form,
  })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

// ── I3.1 Anfordern ─────────────────────────────────────────────────────────
console.log('=== I3.1 Anfordern ===')

const ohneTitel = await sende(gf, '/api/anforderungen', 'POST', {
  employeeId: mAnna.employeeId,
})
check('Eine Anforderung ohne Titel wird abgelehnt', ohneTitel.status === 400,
  ohneTitel.body.error)

const ohneWen = await sende(gf, '/api/anforderungen', 'POST', { titel: EIGEN })
check('Eine Anforderung ohne Empfänger wird abgelehnt', ohneWen.status === 400,
  ohneWen.body.error)

const durchMitarbeiter = await sende(anna, '/api/anforderungen', 'POST', {
  titel: `${EIGEN} selbst`, employeeId: mAnna.employeeId,
})
check('Ein Mitarbeiter fordert nichts an', durchMitarbeiter.status === 403,
  `HTTP ${durchMitarbeiter.status}`)

const fremdAnfordern = await sende(fremdeLeitung, '/api/anforderungen', 'POST', {
  titel: `${EIGEN} fremd`, employeeId: mAnna.employeeId,
})
check('Eine fremde Leitung fordert nichts von fremden Leuten an',
  fremdAnfordern.status === 403, `HTTP ${fremdAnfordern.status}`)

const angelegt = await sende(gf, '/api/anforderungen', 'POST', {
  titel: EIGEN,
  hinweis: 'Bitte das erweiterte Führungszeugnis, nicht älter als drei Monate.',
  employeeId: mAnna.employeeId,
  fristBis: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
})
check('Die Unternehmensebene fordert an', angelegt.body.angelegt === 1,
  angelegt.body.error)
const id = angelegt.body.ids?.[0]

const doppelt = await sende(gf, '/api/anforderungen', 'POST', {
  titel: EIGEN, employeeId: mAnna.employeeId,
})
check('Dasselbe wird nicht zweimal angefordert',
  doppelt.body.angelegt === 0 && doppelt.body.uebersprungen === 1,
  JSON.stringify(doppelt.body))

// ── I3.2 Wer sie sieht ─────────────────────────────────────────────────────
console.log('\n=== I3.2 Wer sie sieht ===')

const beiAnna = await hole(anna, '/api/anforderungen')
check('Die Person sieht ihre eigene Anforderung',
  (beiAnna.body.anforderungen ?? []).some(a => a.id === id))
check('Mit dem Hinweis, was zu tun ist',
  /hochladen|einreichen/i.test(
    (beiAnna.body.anforderungen ?? []).find(a => a.id === id)?.hinweis ?? ''),
  (beiAnna.body.anforderungen ?? []).find(a => a.id === id)?.hinweis)

const beiLeitung = await hole(leitung, '/api/anforderungen')
check('Die zuständige Leitung sieht sie',
  (beiLeitung.body.anforderungen ?? []).some(a => a.id === id))

const beiFremder = await hole(fremdeLeitung, '/api/anforderungen')
check('Eine fremde Leitung sieht sie nicht',
  !(beiFremder.body.anforderungen ?? []).some(a => a.id === id))

const fremdDetail = await hole(fremdeLeitung, `/api/anforderungen/${id}`)
check('Und kommt auch über die Kennung nicht heran',
  fremdDetail.status === 404 || fremdDetail.status === 403,
  `HTTP ${fremdDetail.status}`)

const fremdePersonDetail = await hole(fremdePerson, `/api/anforderungen/${id}`)
check('Ein fremder Mitarbeiter auch nicht',
  fremdePersonDetail.status === 404 || fremdePersonDetail.status === 403,
  `HTTP ${fremdePersonDetail.status}`)

// Ein Kollege desselben Standorts darf hier gar nichts sehen.
const kollegen = (await hole(leitung, '/api/employees')).body.employees ?? []
const kollege = kollegen.find(e => e.id !== mAnna.employeeId && e.active !== false)
if (kollege?.email) {
  const alsKollege = await login(kollege.email).catch(() => null)
  if (alsKollege) {
    const sicht = await hole(alsKollege, '/api/anforderungen')
    check('Ein Kollege sieht die Anforderung eines anderen nicht',
      !(sicht.body.anforderungen ?? []).some(a => a.id === id))
    const versuch = await hole(alsKollege, `/api/anforderungen/${id}`)
    check('Auch nicht über die Kennung', versuch.status === 404,
      `HTTP ${versuch.status}`)
  }
}

// ── I3.3 Wer was tun darf ──────────────────────────────────────────────────
console.log('\n=== I3.3 Wer was tun darf ===')

const selbstAbnehmen = await sende(anna, `/api/anforderungen/${id}`, 'PATCH', {
  status: 'erledigt',
})
check('Niemand nimmt sich selbst ab', selbstAbnehmen.status === 400,
  selbstAbnehmen.body.error)
check('Und bekommt gesagt, warum',
  /entscheidet der Betrieb/i.test(selbstAbnehmen.body.error ?? ''),
  selbstAbnehmen.body.error)

const fuerJemandenEinreichen = await sende(gf, `/api/anforderungen/${id}`, 'PATCH', {
  status: 'eingereicht',
})
check('Der Betrieb reicht nicht für jemanden ein',
  fuerJemandenEinreichen.status === 400, fuerJemandenEinreichen.body.error)

const rueckfrageZuNichts = await sende(gf, `/api/anforderungen/${id}`, 'PATCH', {
  status: 'rueckfrage', notiz: 'Wo bleibt es?',
})
check('Keine Rückfrage zu etwas, das noch gar nicht vorliegt',
  rueckfrageZuNichts.status === 400, rueckfrageZuNichts.body.error)

const erfundenerStand = await sende(gf, `/api/anforderungen/${id}`, 'PATCH', {
  status: 'schwebend',
})
check('Ein erfundener Stand wird abgelehnt', erfundenerStand.status === 400,
  erfundenerStand.body.error)

// ── I3.4 Einreichen und prüfen ─────────────────────────────────────────────
console.log('\n=== I3.4 Der Rückweg ===')

const leer = await sende(anna, `/api/anforderungen/${id}`, 'POST', { text: '   ' })
check('Ein leerer Beitrag wird abgelehnt', leer.status === 400, leer.body.error)

const eingereicht = await hochladen(anna, id, 'fuehrungszeugnis.pdf',
  'Hier ist es, gestern ausgestellt.')
check('Die Person lädt hoch', eingereicht.status === 200, eingereicht.body.error)
check('Der Upload setzt den Vorgang zugleich auf „eingereicht"',
  eingereicht.body.stand === 'eingereicht', eingereicht.body.stand)
check('Und die Datei landet in der Personalakte', !!eingereicht.body.dateiId)

const akte = await hole(gf,
  `/api/files?ownerType=employee&ownerId=${mAnna.employeeId}`)
check('Der Betrieb findet sie dort',
  (akte.body.dateien ?? []).some(d => d.id === eingereicht.body.dateiId))

const eigeneAkte = await hole(anna,
  `/api/files?ownerType=employee&ownerId=${mAnna.employeeId}`)
check('Und die Person sieht das selbst Eingereichte auch wieder',
  (eigeneAkte.body.dateien ?? []).some(d => d.id === eingereicht.body.dateiId))

const fremdeDatei = await fetch(`${BASIS}/api/files/${eingereicht.body.dateiId}`, {
  headers: { cookie: fremdeLeitung },
})
check('Eine fremde Leitung kommt an die Datei nicht heran',
  fremdeDatei.status === 403 || fremdeDatei.status === 404,
  `HTTP ${fremdeDatei.status}`)

const rueckfrage = await sende(gf, `/api/anforderungen/${id}`, 'PATCH', {
  status: 'rueckfrage',
})
check('Eine Rückfrage ohne Frage wird abgelehnt', rueckfrage.status === 400,
  rueckfrage.body.error)

const nachgefragt = await sende(gf, `/api/anforderungen/${id}`, 'PATCH', {
  status: 'rueckfrage', notiz: 'Die zweite Seite fehlt.',
})
check('Mit Frage geht sie durch', nachgefragt.status === 200, nachgefragt.body.error)

const nachDerFrage = await hole(anna, `/api/anforderungen/${id}`)
check('Die Person sieht die Rückfrage',
  (nachDerFrage.body.beitraege ?? []).some(
    b => (b.text ?? '').includes('zweite Seite')))
check('Und sieht, dass sie wieder am Zug ist',
  /Rückfrage/i.test(nachDerFrage.body.anforderung?.hinweisText ?? ''),
  nachDerFrage.body.anforderung?.hinweisText)

const nochmal = await hochladen(anna, id, 'fuehrungszeugnis-2.pdf', 'Jetzt vollständig.')
check('Aus der Rückfrage heraus lässt sich erneut einreichen',
  nochmal.body.stand === 'eingereicht', nochmal.body.stand)

// ── I3.5 Abnehmen erfüllt die Frist ────────────────────────────────────────
console.log('\n=== I3.5 Die Abnahme erfüllt die Frist ===')

// Eine echte Frist, an der die Anforderung hängt.
const arten = (await hole(gf, '/api/nachweisarten')).body.arten ?? []
let art = arten.find(a => a.aktiv && a.faelligkeit !== 'einmalig')
if (!art) {
  const neu = await sende(gf, '/api/nachweisarten', 'POST', {
    name: `${EIGEN} Art`, faelligkeit: 'wiederkehrend', abstandMonate: 12,
    giltFuer: 'einzeln',
  })
  art = neu.body.art
}

const zugewiesen = await sende(gf, '/api/fristen', 'POST', {
  employeeId: mAnna.employeeId, nachweisartId: art?.id,
})
const fristen = (await hole(gf, `/api/fristen?employeeId=${mAnna.employeeId}`))
  .body.eintraege ?? []
const frist = fristen.find(f => f.bezeichnung === art?.name)
check('Es gibt eine Frist, an die sich hängen lässt', !!frist,
  `${fristen.length} Fristen, angelegt: ${zugewiesen.body.angelegt}`)

const mitFrist = await sende(gf, '/api/anforderungen', 'POST', {
  titel: `${EIGEN} mit Frist`, employeeId: mAnna.employeeId, fristId: frist?.id,
})
const idMitFrist = mitFrist.body.ids?.[0]
check('Eine Anforderung lässt sich an eine Frist hängen', !!idMitFrist,
  mitFrist.body.error)

await hochladen(anna, idMitFrist, 'schulung.pdf', 'Teilnahmebescheinigung.')

const abgenommen = await sende(gf, `/api/anforderungen/${idMitFrist}`, 'PATCH', {
  status: 'erledigt',
})
check('Der Betrieb nimmt ab', abgenommen.status === 200, abgenommen.body.error)
check('Und die Frist gilt damit als erfüllt', abgenommen.body.fristErfuellt === true,
  JSON.stringify(abgenommen.body))

const nachher = (await hole(gf, `/api/fristen?employeeId=${mAnna.employeeId}`))
  .body.eintraege ?? []
const fristNachher = nachher.find(f => f.id === frist?.id)
check('Die Frist trägt jetzt ein Erfüllungsdatum', !!fristNachher?.erfuelltAm,
  fristNachher?.erfuelltAm)
check('Und steht wieder auf gültig', fristNachher?.stand === 'gueltig',
  fristNachher?.stand)
check('Der Nachweis hängt an der Frist', !!fristNachher?.dateiId)

const nachtraeglich = await sende(gf, `/api/anforderungen/${idMitFrist}`, 'PATCH', {
  status: 'rueckfrage', notiz: 'Doch nicht?',
})
check('Ein abgenommener Vorgang wird nicht mehr umgeschrieben',
  nachtraeglich.status === 400, nachtraeglich.body.error)

const nachtraeglichSchreiben = await sende(
  anna, `/api/anforderungen/${idMitFrist}`, 'POST', { text: 'Noch eine Frage?' })
check('Und es lässt sich auch nichts mehr hineinschreiben',
  nachtraeglichSchreiben.status === 409, nachtraeglichSchreiben.body.error)

// ── I3.6 Erinnern ──────────────────────────────────────────────────────────
console.log('\n=== I3.6 Erinnern, ohne zu drangsalieren ===')

const sofort = await sende(gf, '/api/anforderungen', 'PATCH', {
  aktion: 'erinnern', id,
})
check('Kurz nach dem Anfordern wird nicht gleich gemahnt',
  sofort.body.erinnert === 0 && sofort.body.zuFrueh === 1,
  JSON.stringify(sofort.body))
check('Und es wird gesagt, warum', /paar Tage/i.test(sofort.body.hinweis ?? ''),
  sofort.body.hinweis)

const durchFremde = await sende(fremdeLeitung, '/api/anforderungen', 'PATCH', {
  aktion: 'erinnern', id,
})
check('Eine fremde Leitung mahnt niemanden',
  durchFremde.status === 403 || durchFremde.body.erinnert === 0,
  `HTTP ${durchFremde.status}: ${JSON.stringify(durchFremde.body)}`)

const durchFremdePerson = await sende(fremdePerson, '/api/anforderungen', 'PATCH', {
  aktion: 'erinnern', id,
})
check('Ein fremder Mitarbeiter erst recht nicht',
  durchFremdePerson.status === 403, `HTTP ${durchFremdePerson.status}`)

// ── I3.7 Zurückziehen ──────────────────────────────────────────────────────
console.log('\n=== I3.7 Zurückziehen ===')

const durchPerson = await sende(anna, `/api/anforderungen/${id}`, 'PATCH', {
  status: 'zurueckgezogen',
})
check('Die Person zieht nichts zurück', durchPerson.status === 400,
  durchPerson.body.error)

const zurueck = await sende(gf, `/api/anforderungen/${id}`, 'PATCH', {
  status: 'zurueckgezogen', notiz: 'Prüfung beendet.',
})
check('Der Betrieb zieht zurück', zurueck.status === 200, zurueck.body.error)

const danach = await hole(anna, '/api/anforderungen')
const weg = (danach.body.anforderungen ?? []).find(a => a.id === id)
check('Danach steht der Vorgang auf „zurückgezogen"',
  weg?.stand === 'zurueckgezogen', weg?.stand)
check('Er zählt nicht mehr als offen',
  !(danach.body.zusammenfassung?.offen > 0
    && (danach.body.anforderungen ?? [])
      .filter(a => a.stand === 'offen').some(a => a.id === id)))

// ── Aufräumen ──────────────────────────────────────────────────────────────
//
// Jeder Lauf lädt Dateien in eine echte Personalakte. Blieben sie liegen,
// wüchse die Akte einer Testperson mit jedem Prüflauf um drei Dokumente — und
// nach einem Monat sucht niemand mehr darin etwas.
console.log('\n=== Aufräumen ===')

const hochgeladen = [
  ...(await hole(gf, `/api/anforderungen/${id}`)).body.beitraege ?? [],
  ...(await hole(gf, `/api/anforderungen/${idMitFrist}`)).body.beitraege ?? [],
].map(b => b.dateiId).filter(Boolean)

for (const dateiId of hochgeladen) {
  await fetch(`${BASIS}/api/files/${dateiId}`, {
    method: 'DELETE', headers: { cookie: gf },
  })
}

const akteDanach = await hole(gf,
  `/api/files?ownerType=employee&ownerId=${mAnna.employeeId}`)
check('Die Prüfung lässt keine Dateien in der Personalakte zurück',
  !(akteDanach.body.dateien ?? []).some(d => hochgeladen.includes(d.id)),
  `${hochgeladen.length} aufgeräumt`)

// Den Vorgang mit Frist ebenfalls schließen, damit die Liste nicht wächst.
await sende(gf, `/api/anforderungen/${idMitFrist}`, 'PATCH', {
  status: 'zurueckgezogen',
}).catch(() => undefined)

process.exit(bilanz() ? 1 : 0)
