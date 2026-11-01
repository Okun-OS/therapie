// Nachweis §275: Die Übergabe ans Lohnbüro — und die Grenze, die sie einhält.
//
//     node pruefungen/v-lohnuebergabe.mjs
//
// WORUM ES GEHT
// Der Betrieb behält sein Lohnprogramm. OKUN Workforce liefert die Zahlen,
// die es am Monatsende braucht: Stunden, Zuschläge, Fehltage — je Person, in
// einer Datei, die sich einlesen lässt.
//
// WAS HIER AUSDRÜCKLICH MITGEPRÜFT WIRD
// Dass die Datei KEINE Abrechnung enthält. Ohne ITSG-Systemprüfung darf hier
// weder Lohnsteuer noch Netto stehen (§274). Diese Grenze ist eine Zusage an
// den Kunden, und eine Zusage ohne Gegenprobe hält genau so lange, bis sie
// jemand aus Versehen überschreibt.
//
// UND WAS DER ALTE EXPORT NICHT KONNTE
// Auf der Zuschlagsseite lag ein CSV-Knopf, dessen Datei fürs Lohnbüro
// unbrauchbar war: keine Personalnummer, „480min / 120.00€" in EINER Zelle,
// steuerfrei und steuerpflichtig nicht getrennt. Jeder dieser drei Punkte
// hat unten seine eigene Prüfung — sonst hieße „behoben" nur „angefasst".

import { BASIS, pruefer, login, hole } from './helfer.mjs'

const { check, bilanz } = pruefer()

/*
 * Die Übergabe gehört der Unternehmensebene, nicht der Standortleitung: Sie
 * enthält Beträge je Person, und die zeigt auch die Zuschlagsübersicht am
 * Bildschirm nur dort. Beide Zugänge werden hier gebraucht — der eine, um zu
 * prüfen, dass es geht, der andere, um zu prüfen, dass es NICHT geht.
 */
const GESCHAEFTSFUEHRUNG = 'gf@beispielbetrieb.de'
const STANDORTLEITUNG = 'leitung@beispielbetrieb.de'
const FREMD = 'gf@rheinblick-reha.de'

/*
 * Der Ausgangszustand, den diese Prüfung braucht: der Beispielbetrieb mit
 * gestempelten Zeiten im Vormonat (`npm run seed:schaufenster`). Ohne ihn
 * prüft das hier nichts — und das muss gesagt werden, statt stumm grün zu
 * sein.
 */
const jetzt = new Date()
const monat = jetzt.getMonth() === 0 ? 12 : jetzt.getMonth()
const jahr = jetzt.getMonth() === 0 ? jetzt.getFullYear() - 1 : jetzt.getFullYear()
console.log(`Übergabemonat: ${String(monat).padStart(2, '0')}.${jahr}\n`)

const leitung = await login(GESCHAEFTSFUEHRUNG)

// ── §275 Die Zahlen ────────────────────────────────────────────────────────
console.log('=== §275 Was übergeben wird ===')

const antwort = await hole(leitung, `/api/lohnuebergabe?jahr=${jahr}&monat=${monat}`)
check('Die Übergabe antwortet', antwort.status === 200, antwort.body?.error ?? 'ok')

const zeilen = antwort.body?.zeilen ?? []
check('Es stehen Menschen darin', zeilen.length > 0, `${zeilen.length} Zeilen`)

check('Jede Zeile hat eine Personalnummer',
  zeilen.length > 0 && zeilen.every(z => z.personalnummer),
  zeilen.filter(z => !z.personalnummer).map(z => z.name).join(', ') || 'alle vorhanden')

const mitStunden = zeilen.filter(z => z.stundenGesamt > 0)
check('Und Stunden, die wirklich gestempelt wurden',
  mitStunden.length > 0,
  `${mitStunden.length} von ${zeilen.length} mit Stunden`)

const mitZuschlag = zeilen.filter(z => z.zuschlaegeGesamt > 0)
check('Zuschläge entstehen aus diesen Zeiten',
  mitZuschlag.length > 0,
  `${mitZuschlag.length} Personen mit Zuschlag`)

/*
 * Der Punkt, an dem der alte Export scheiterte. Ein Lohnbüro bucht
 * steuerfreie und steuerpflichtige Zuschläge auf verschiedene Lohnarten;
 * zusammengeworfen muss es die Trennung selbst nachbauen — aus Zahlen, die
 * es nicht hat.
 */
check('Steuerfrei und steuerpflichtig stehen getrennt',
  zeilen.every(z => 'zuschlaegeSteuerfrei' in z && 'zuschlaegeSteuerpflichtig' in z),
  'beide Spalten vorhanden')

check('Und die beiden ergeben zusammen den Gesamtbetrag',
  zeilen.every(z =>
    Math.abs((z.zuschlaegeSteuerfrei + z.zuschlaegeSteuerpflichtig) - z.zuschlaegeGesamt) < 0.02),
  mitZuschlag[0]
    ? `${mitZuschlag[0].zuschlaegeSteuerfrei} + ${mitZuschlag[0].zuschlaegeSteuerpflichtig}`
      + ` = ${mitZuschlag[0].zuschlaegeGesamt}`
    : 'keine Zuschläge im Monat')

// ── §274 Die Grenze ────────────────────────────────────────────────────────
console.log('\n=== §274 Es ist KEINE Abrechnung ===')

/*
 * Die Gegenprobe zur Zusage. Taucht hier eines dieser Felder auf, ist aus
 * der Übergabe eine Abrechnung geworden — und die darf ohne
 * ITSG-Systemprüfung nicht ausgeliefert werden.
 */
const VERBOTEN = [
  'lohnsteuer', 'netto', 'brutto', 'sozialversicherung', 'kirchensteuer',
  'rentenversicherung', 'auszahlung', 'solidaritaetszuschlag',
]
const felderRoh = JSON.stringify(zeilen[0] ?? {}).toLowerCase()
for (const feld of VERBOTEN) {
  check(`Kein Feld „${feld}" in der Übergabe`,
    !felderRoh.includes(feld),
    'Ohne ITSG-Systemprüfung wird nicht abgerechnet')
}

// ── §275 Die Datei ─────────────────────────────────────────────────────────
console.log('\n=== §275 Die Datei, die beim Lohnbüro ankommt ===')

const datei = await fetch(`${BASIS}/api/lohnuebergabe?jahr=${jahr}&monat=${monat}&format=csv`, {
  headers: { Cookie: leitung },
})
/*
 * Die ROHEN Bytes, nicht der dekodierte Text.
 *
 * `response.text()` entfernt ein führendes Byte-Order-Mark beim Dekodieren —
 * so will es der Standard. Die erste Fassung dieser Prüfung las deshalb ein
 * Anführungszeichen und meldete ein fehlendes BOM, das sehr wohl da war.
 * Excel liest keine dekodierten Zeichenketten, sondern Bytes; also wird hier
 * gemessen, was Excel sieht.
 */
const rohe = Buffer.from(await datei.arrayBuffer())
const text = rohe.toString('utf8')

check('Sie wird als Datei geliefert', datei.status === 200
  && (datei.headers.get('content-type') ?? '').includes('text/csv'),
  `HTTP ${datei.status}, ${datei.headers.get('content-type')}`)

check('Mit einem Namen, unter dem man sie wiederfindet',
  /filename="lohnuebergabe-.+-\d{4}-\d{2}\.csv"/.test(datei.headers.get('content-disposition') ?? ''),
  datei.headers.get('content-disposition'))

check('Sie beginnt mit den drei Bytes, die Excel UTF-8 lesen lassen',
  rohe[0] === 0xEF && rohe[1] === 0xBB && rohe[2] === 0xBF,
  `erste Bytes: ${[...rohe.subarray(0, 3)].map(b => b.toString(16).toUpperCase()).join(' ')}`)

/*
 * Und die Gegenprobe dazu: ein Umlaut muss unversehrt ankommen. Ohne BOM
 * liest eine deutsche Excel-Installation die Datei als Westeuropäisch und
 * macht aus „Zuschläge" ein „ZuschlÃ¤ge" — auffällig genug, dass es jemand
 * meldet, aber erst beim Kunden.
 */
check('Und Umlaute stehen unversehrt darin',
  text.includes('Zuschläge gesamt') && !text.includes('Ã'),
  'sonst liest Excel die Datei als Westeuropäisch')

check('Spalten mit Semikolon, Zahlen mit Komma',
  text.includes(';') && /\d,\d\d/.test(text) && !/\d\.\d\d;/.test(text),
  'sonst fällt die Datei in einer deutschen Excel-Installation falsch')

/*
 * „480min / 120.00€" in einer Zelle war der schlimmste Teil des alten
 * Exports: Das ist keine Zahl, sondern ein Satz. Weder Excel noch DATEV
 * können damit rechnen.
 */
check('Keine Zelle enthält zwei Zahlen und eine Einheit',
  !/min\s*\//.test(text) && !text.includes('€'),
  'jede Zahl steht allein in ihrer Zelle')

/** Zerlegt wie ein CSV-Leser — Semikolons in Anführungszeichen trennen nicht. */
const felder = (zeile) => {
  const aus = []
  let feld = '', inAnfuehrung = false
  for (let i = 0; i < zeile.length; i++) {
    const c = zeile[i]
    if (inAnfuehrung) {
      if (c === '"' && zeile[i + 1] === '"') { feld += '"'; i++ }
      else if (c === '"') inAnfuehrung = false
      else feld += c
    } else if (c === '"') inAnfuehrung = true
    else if (c === ';') { aus.push(feld); feld = '' }
    else feld += c
  }
  aus.push(feld)
  return aus
}

const reihen = text.replace(/^﻿/, '').split('\r\n').filter(Boolean)
const ueberschriften = felder(reihen[1] ?? '')
check('Jede Zeile hat so viele Werte wie es Überschriften gibt',
  reihen.slice(2).every(r => felder(r).length === ueberschriften.length),
  `${ueberschriften.length} Spalten, ${reihen.length - 2} Zeilen`)

check('Eine Zeile Kopf, eine Zeile Überschriften, dann die Menschen',
  reihen.length === zeilen.length + 2,
  `${reihen.length} Reihen bei ${zeilen.length} Personen`)

// ── §275 Was vorher gesagt wird ────────────────────────────────────────────
console.log('\n=== §275 Mängel werden benannt, nicht verschwiegen ===')

check('Die Antwort führt eine Mängelliste',
  Array.isArray(antwort.body?.maengel),
  JSON.stringify(antwort.body?.maengel ?? null))

check('Und sie ist leer, solange nichts fehlt',
  (antwort.body?.maengel ?? []).length === 0,
  (antwort.body?.maengel ?? []).map(m => `${m.art}: ${m.betroffen.join(', ')}`).join(' · ') || 'keine')

// ── Abschottung ────────────────────────────────────────────────────────────
console.log('\n=== §275 Wer das NICHT bekommt ===')

const ohne = await fetch(`${BASIS}/api/lohnuebergabe?jahr=${jahr}&monat=${monat}`)
check('Ohne Anmeldung gibt es nichts', ohne.status === 401 || ohne.status === 403,
  `HTTP ${ohne.status}`)

/*
 * Die Gegenprobe zur Rollenregel, und die wichtigste Prüfung hier.
 *
 * Die Zuschlagsübersicht blendet Beträge für eine Standortleitung aus. Wäre
 * diese Datei trotzdem für sie zu holen, hinge die ganze Regel an der
 * Bildschirmanzeige — und wer die Adresse kennt, umginge sie mit einem
 * einzigen Aufruf. Genau so sieht ein Datenleck aus, das niemandem auffällt:
 * Die Oberfläche sagt nein, die Schnittstelle ja.
 */
const standortleitung = await login(STANDORTLEITUNG)
const alsLeitung = await hole(standortleitung, `/api/lohnuebergabe?jahr=${jahr}&monat=${monat}`)
check('Eine Standortleitung bekommt die Übergabe NICHT',
  alsLeitung.status === 403,
  `HTTP ${alsLeitung.status} — die Datei führt Beträge je Person`)

check('Und auch die Datei nicht',
  (await fetch(`${BASIS}/api/lohnuebergabe?jahr=${jahr}&monat=${monat}&format=csv`,
    { headers: { Cookie: standortleitung } })).status === 403,
  'sonst hinge die Regel allein an der Bildschirmanzeige')

const unsinn = await hole(leitung, `/api/lohnuebergabe?jahr=${jahr}&monat=13`)
check('Ein Monat 13 wird abgewiesen', unsinn.status === 400, unsinn.body?.error)

const ohneZeitraum = await hole(leitung, '/api/lohnuebergabe')
check('Und ohne Zeitraum ebenfalls', ohneZeitraum.status === 400, ohneZeitraum.body?.error)

/*
 * Die Mandantentrennung. Eine Datei ist schneller weitergereicht als eine
 * Bildschirmseite — wenn hier die Stunden eines fremden Betriebs auftauchen,
 * ist das ein Datenschutzvorfall und kein Schönheitsfehler.
 */
const fremd = await login(FREMD)
const fremdAntwort = await hole(fremd, `/api/lohnuebergabe?jahr=${jahr}&monat=${monat}`)
const unsereNamen = new Set(zeilen.map(z => z.name))
const fremdeNamen = (fremdAntwort.body?.zeilen ?? []).map(z => z.name)
check('Ein anderer Mandant sieht keinen unserer Menschen',
  fremdeNamen.every(n => !unsereNamen.has(n)),
  fremdeNamen.filter(n => unsereNamen.has(n)).join(', ') || 'keine Überschneidung')

// ── §275 Die Übersicht, aus der die Übergabe entsteht ──────────────────────
console.log('\n=== §275 Die Zuschlagsübersicht trägt mehrere Standorte ===')

/*
 * Der Fund vom 01.11.2026: `/api/surcharges` verlangte EINEN Standort und
 * antwortete einer Geschäftsführung — die an keinem hängt — mit HTTP 400.
 * Die Seite zeigte „0 Mitarbeiter · Keine Einträge". Ausgerechnet dieser
 * Rolle sind die Beträge vorbehalten; sie konnte die Seite nicht öffnen.
 */
const uebersichtGf = await hole(leitung, `/api/surcharges?year=${jahr}&month=${monat}`)
check('Die Geschäftsführung bekommt die Übersicht überhaupt',
  uebersichtGf.status === 200,
  `HTTP ${uebersichtGf.status} ${uebersichtGf.body?.error ?? ''}`)
check('Und sie ist nicht leer',
  (uebersichtGf.body?.rows ?? []).length > 0,
  `${(uebersichtGf.body?.rows ?? []).length} Zeilen`)

const uebersichtLeitung = await hole(standortleitung, `/api/surcharges?year=${jahr}&month=${monat}`)
check('Die Standortleitung bekommt sie weiterhin',
  uebersichtLeitung.status === 200 && (uebersichtLeitung.body?.rows ?? []).length > 0,
  `HTTP ${uebersichtLeitung.status}, ${(uebersichtLeitung.body?.rows ?? []).length} Zeilen`)

/*
 * Und die Gegenprobe zum Zusammenfassen: ein Betrieb mit mehreren Standorten
 * muss mehr als einen davon sehen. Mit der alten Fassung war das gar nicht
 * möglich — eine Prüfung nur am Beispielbetrieb (ein Standort) hätte den
 * Fehler nicht bemerkt.
 */
const mehrfach = await hole(fremd, `/api/surcharges?year=${jahr}&month=${monat}`)
check('Ein Betrieb mit mehreren Standorten sieht sie alle',
  (mehrfach.body?.standorte ?? 0) > 1,
  `${mehrfach.body?.standorte} Standorte, ${(mehrfach.body?.rows ?? []).length} Zeilen`)

check('Jeder Mensch steht dabei nur einmal darin',
  (() => {
    const namen = (mehrfach.body?.rows ?? []).map(r => r.employeeId)
    return namen.length === new Set(namen).size
  })(),
  'wer an zwei Standorten arbeitet, ist trotzdem eine Person')

/*
 * Und das Bundesland wird nur genannt, wenn es eindeutig ist. „Feiertage
 * nach Bundesland Bayern" über drei Länder hinweg wäre eine Behauptung, die
 * für zwei davon falsch ist — und Feiertagszuschläge hängen daran.
 */
check('Über mehrere Standorte wird kein einzelnes Bundesland behauptet',
  (mehrfach.body?.standorte ?? 0) <= 1 || mehrfach.body?.bundesland === undefined,
  `Bundesland: ${mehrfach.body?.bundesland ?? '— (richtig, mehrere Standorte)'}`)

const fehlschlaege = bilanz()
process.exit(fehlschlaege > 0 ? 1 : 0)
