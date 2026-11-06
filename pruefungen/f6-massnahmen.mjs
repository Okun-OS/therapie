// Nachweis F6: Maßnahmen entscheiden — genehmigen, ablehnen, kommentieren.
//
// Wenn der Rechendienst eine Gruppe nicht besetzen kann, plant er nichts
// Halbgares, sondern schlägt vor: „Gruppe 7 am Donnerstag aufteilen." Bis
// zum 27.09.2026 konnte niemand darauf antworten — der Vorschlag stand da,
// und die Leitung musste ihn außerhalb des Programms klären.
//
// Hier wird geprüft, dass die Antwort ankommt, stehen bleibt und niemandem
// gehört, dem sie nicht gehört.
import { pruefer, login, hole, sende } from './helfer.mjs'

const { check, bilanz } = pruefer()

const gf = await login('gf@rheinblick-reha.de')
const leitung = await login('leitung@rheinblick-reha.de')
const kita = await login('leitung@kita-sonnenschein.de')
const mitarbeiter = await login('anna.fischer@rheinblick-reha.de')

const locationId = (await hole(leitung, '/api/auth/me')).body.user.locationId
const fremdStandort = (await hole(kita, '/api/auth/me')).body.user.locationId
console.log(`Standort ${locationId}, fremder Standort ${fremdStandort}\n`)

// Ein Tag weit genug in der Zukunft, dass er keiner echten Planung in die
// Quere kommt. Die Maßnahme hängt am Tag, nicht am Rechenlauf — deshalb
// reicht ein Datum, es braucht keinen Lauf.
const TAG = '2027-03-11'
const TAG_ZWEI = '2027-03-12'
const ZIEL = 'pruef-gruppe-7'

/** §169 Regel 1 der README: Die Prüfung stellt ihren Ausgangszustand selbst her. */
async function zuruecksetzen() {
  for (const tag of [TAG, TAG_ZWEI]) {
    await sende(gf, '/api/planning/massnahmen', 'PATCH', {
      locationId, typ: 'aufteilen', ziel: ZIEL, tag,
      text: 'Ausgangszustand', status: 'offen', kommentar: null,
    })
  }
}
await zuruecksetzen()

const grund = { locationId, typ: 'aufteilen', ziel: ZIEL, zielName: 'Gruppe 7', tag: TAG,
  text: 'Gruppe 7 am 11.03.2027 aufteilen — die Kinder nach dem internen Aufteilungsplan.' }

// ── Entscheiden ────────────────────────────────────────────────────────────
console.log('=== Eine Maßnahme entscheiden ===')

const genehmigt = await sende(gf, '/api/planning/massnahmen', 'PATCH',
  { ...grund, status: 'genehmigt' })
check('Eine Maßnahme lässt sich genehmigen', genehmigt.status === 200,
  `HTTP ${genehmigt.status} ${JSON.stringify(genehmigt.body?.error ?? '')}`)
check('Der Status steht danach auf genehmigt',
  genehmigt.body?.massnahme?.status === 'genehmigt', genehmigt.body?.massnahme?.status)
check('Der Vorschlagstext ist mitgespeichert',
  /Aufteilungsplan/.test(genehmigt.body?.massnahme?.text ?? ''),
  genehmigt.body?.massnahme?.text)
check('Der Gruppenname bleibt lesbar, auch wenn die Gruppe später fehlt',
  genehmigt.body?.massnahme?.zielName === 'Gruppe 7', genehmigt.body?.massnahme?.zielName)

// Wer entschieden hat, steht im Protokoll — sonst weiß in vier Wochen
// niemand mehr, wen man fragen kann.
check('Es ist festgehalten, WER entschieden hat',
  !!genehmigt.body?.massnahme?.entschiedenVon, genehmigt.body?.massnahme?.entschiedenVon)
check('Und WANN', !!genehmigt.body?.massnahme?.entschiedenAm,
  genehmigt.body?.massnahme?.entschiedenAm)

// §169 Der Klartextname allein genügt dem Löschkonzept nicht: Wer heiratet,
// heißt anders, und zwei Menschen heißen gleich. Die Kennung des Kontos steht
// daneben, damit eine Auskunft und eine Löschung die Person auch finden.
check('Die Kennung des Kontos steht daneben, nicht nur der Name',
  !!genehmigt.body?.massnahme?.entschiedenVonId,
  genehmigt.body?.massnahme?.entschiedenVonId)

// ── Der Kommentar ──────────────────────────────────────────────────────────
console.log('\n=== Der Satz dazu ===')

const abgelehnt = await sende(gf, '/api/planning/massnahmen', 'PATCH', {
  ...grund, status: 'abgelehnt',
  kommentar: 'Nein — Frau Berger kommt aus dem Urlaub zurück und übernimmt.',
})
check('Dieselbe Maßnahme lässt sich umentscheiden', abgelehnt.status === 200,
  `HTTP ${abgelehnt.status}`)
check('Der Status ist jetzt abgelehnt',
  abgelehnt.body?.massnahme?.status === 'abgelehnt', abgelehnt.body?.massnahme?.status)
check('Der Kommentar steht dabei',
  /Frau Berger/.test(abgelehnt.body?.massnahme?.kommentar ?? ''),
  abgelehnt.body?.massnahme?.kommentar)
check('Es ist kein zweiter Eintrag entstanden, sondern derselbe',
  abgelehnt.body?.massnahme?.id === genehmigt.body?.massnahme?.id,
  `${genehmigt.body?.massnahme?.id} → ${abgelehnt.body?.massnahme?.id}`)

// Ein leerer Kommentar ist kein Kommentar — sonst bliebe ein Satz stehen,
// den niemand mehr meint.
const geleert = await sende(gf, '/api/planning/massnahmen', 'PATCH',
  { ...grund, status: 'abgelehnt', kommentar: '   ' })
check('Ein leerer Kommentar löscht den alten, statt ihn stehen zu lassen',
  geleert.body?.massnahme?.kommentar === null, JSON.stringify(geleert.body?.massnahme?.kommentar))

// Zurücknehmen heißt: es ist wieder unentschieden. Dann darf auch niemand
// mehr als Entscheider im Protokoll stehen.
const zurueck = await sende(gf, '/api/planning/massnahmen', 'PATCH',
  { ...grund, status: 'offen' })
check('Eine Entscheidung lässt sich zurücknehmen',
  zurueck.body?.massnahme?.status === 'offen', zurueck.body?.massnahme?.status)
check('Danach steht niemand mehr als Entscheider darin',
  zurueck.body?.massnahme?.entschiedenVon === null,
  JSON.stringify(zurueck.body?.massnahme?.entschiedenVon))
check('Auch die Kennung ist weg', zurueck.body?.massnahme?.entschiedenVonId === null,
  JSON.stringify(zurueck.body?.massnahme?.entschiedenVonId))
check('Und kein Zeitpunkt', zurueck.body?.massnahme?.entschiedenAm === null,
  JSON.stringify(zurueck.body?.massnahme?.entschiedenAm))

// ── Lesen ──────────────────────────────────────────────────────────────────
console.log('\n=== Wiederfinden ===')

await sende(gf, '/api/planning/massnahmen', 'PATCH', { ...grund, status: 'genehmigt' })
await sende(gf, '/api/planning/massnahmen', 'PATCH', {
  ...grund, tag: TAG_ZWEI, status: 'abgelehnt',
  text: 'Gruppe 7 am 12.03.2027 aufteilen.',
})

const liste = await hole(gf,
  `/api/planning/massnahmen?locationId=${locationId}&von=${TAG}&bis=${TAG_ZWEI}`)
check('Die Entscheidungen sind wieder abrufbar', liste.status === 200, `HTTP ${liste.status}`)
const meine = (liste.body?.massnahmen ?? []).filter(m => m.ziel === ZIEL)
check('Beide Tage stehen darin', meine.length === 2, `${meine.length} gefunden`)
check('Sie stehen nach Tag sortiert',
  meine[0]?.tag === TAG && meine[1]?.tag === TAG_ZWEI,
  meine.map(m => m.tag).join(', '))

// Der Zeitraum ist eine Grenze, keine Empfehlung: Eine Entscheidung außerhalb
// darf nicht mitkommen, sonst zeigt die Oberfläche Maßnahmen zu Tagen an, die
// gar nicht geplant werden.
const engeListe = await hole(gf,
  `/api/planning/massnahmen?locationId=${locationId}&von=${TAG}&bis=${TAG}`)
check('Ein Tag außerhalb des Zeitraums kommt NICHT mit',
  (engeListe.body?.massnahmen ?? []).filter(m => m.ziel === ZIEL && m.tag === TAG_ZWEI).length === 0,
  JSON.stringify((engeListe.body?.massnahmen ?? []).map(m => m.tag)))

// ── Was der Rechendienst davon bekommt ─────────────────────────────────────
// Nur genehmigte Maßnahmen gehen in die nächste Rechnung. Eine abgelehnte
// darf den Plan nicht verändern — sonst hätte „nein" dieselbe Wirkung wie
// „ja", und das wäre der schlimmste Fehler, den dieses Feld machen kann.
console.log('\n=== Nur Genehmigtes wirkt ===')
const alle = (await hole(gf,
  `/api/planning/massnahmen?locationId=${locationId}&von=${TAG}&bis=${TAG_ZWEI}`)).body.massnahmen ?? []
const wirksam = alle.filter(m => m.ziel === ZIEL && m.status === 'genehmigt')
check('Genau die genehmigte Maßnahme gilt als wirksam',
  wirksam.length === 1 && wirksam[0].tag === TAG,
  alle.filter(m => m.ziel === ZIEL).map(m => `${m.tag}:${m.status}`).join(', '))

// ── Gegenproben ────────────────────────────────────────────────────────────
console.log('\n=== Gegenproben ===')

const fremdLesen = await hole(kita, `/api/planning/massnahmen?locationId=${locationId}`)
check('Eine fremde Leitung liest die Maßnahmen NICHT',
  fremdLesen.status === 403, `HTTP ${fremdLesen.status}`)

const fremdSchreiben = await sende(kita, '/api/planning/massnahmen', 'PATCH',
  { ...grund, status: 'genehmigt' })
check('Eine fremde Leitung entscheidet sie auch NICHT',
  fremdSchreiben.status === 403, `HTTP ${fremdSchreiben.status}`)

const mitarbeiterLesen = await hole(mitarbeiter, `/api/planning/massnahmen?locationId=${locationId}`)
check('Ein Mitarbeiter kommt an die Liste NICHT heran',
  mitarbeiterLesen.status === 403, `HTTP ${mitarbeiterLesen.status}`)

const mitarbeiterSchreiben = await sende(mitarbeiter, '/api/planning/massnahmen', 'PATCH',
  { ...grund, status: 'genehmigt' })
check('Ein Mitarbeiter genehmigt keine Gruppenaufteilung',
  mitarbeiterSchreiben.status === 403, `HTTP ${mitarbeiterSchreiben.status}`)

// §164 Der Fehler, der schon zweimal in der Oberfläche stand: ein fehlendes
// Feld wurde als Zeichenkette "undefined" gespeichert.
const ohneTyp = await sende(gf, '/api/planning/massnahmen', 'PATCH',
  { locationId, ziel: ZIEL, tag: TAG, text: 'x', status: 'genehmigt' })
check('Eine Maßnahme ohne Typ wird abgewiesen', ohneTyp.status === 400, `HTTP ${ohneTyp.status}`)
check('…und nicht als "undefined" gespeichert',
  !/^undefined$/.test(ohneTyp.body?.massnahme?.typ ?? ''), ohneTyp.body?.massnahme?.typ)

const falscherTyp = await sende(gf, '/api/planning/massnahmen', 'PATCH',
  { ...grund, typ: 'gruppe_schliessen', status: 'genehmigt' })
check('Ein erfundener Maßnahmentyp wird abgewiesen',
  falscherTyp.status === 400, `HTTP ${falscherTyp.status}`)

const falscherStatus = await sende(gf, '/api/planning/massnahmen', 'PATCH',
  { ...grund, status: 'vielleicht' })
check('Ein erfundener Status wird abgewiesen',
  falscherStatus.status === 400, `HTTP ${falscherStatus.status}`)

const falscherTag = await sende(gf, '/api/planning/massnahmen', 'PATCH',
  { ...grund, tag: '11.03.2027', status: 'genehmigt' })
check('Ein Datum in der falschen Form wird abgewiesen',
  falscherTag.status === 400, `HTTP ${falscherTag.status}`)

const ohneStandort = await hole(gf, '/api/planning/massnahmen')
check('Ohne Standort gibt es keine Liste', ohneStandort.status === 400,
  `HTTP ${ohneStandort.status}`)

// ── Aufräumen ──────────────────────────────────────────────────────────────
await zuruecksetzen()
const danach = (await hole(gf,
  `/api/planning/massnahmen?locationId=${locationId}&von=${TAG}&bis=${TAG_ZWEI}`)).body.massnahmen ?? []
check('Der Ausgangszustand ist wiederhergestellt',
  danach.filter(m => m.ziel === ZIEL && m.status !== 'offen').length === 0,
  danach.filter(m => m.ziel === ZIEL).map(m => `${m.tag}:${m.status}`).join(', '))

process.exit(bilanz() ? 1 : 0)
