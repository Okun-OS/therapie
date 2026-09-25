// Nachweis G2: Anmeldeschutz, Verarbeitungsverzeichnis und Maßnahmen.
//
// Zwei Dinge, die zusammengehören: Die Maßnahme (Art. 32) und das Dokument,
// das sie behauptet (Art. 30). Ein Dokument, das eine Maßnahme beschreibt, die
// es nicht gibt, ist schlimmer als gar keines — es behauptet Sorgfalt, die
// nicht stattgefunden hat. Deshalb wird hier beides am laufenden System
// geprüft, nicht nur im Text.
//
// Die Rechenwege der Bremse sind in src/lib/__tests__/anmeldeschutz.test.ts
// nachgerechnet, die Vollständigkeit der Dokumente in
// src/lib/__tests__/dsgvo-verzeichnis.test.ts.

import { pruefer, login, hole, sende, BASIS } from './helfer.mjs'

const { check, bilanz } = pruefer()

const gf = await login('gf@rheinblick-reha.de')
const leitung = await login('leitung@rheinblick-reha.de')
const anna = await login('anna.fischer@rheinblick-reha.de')
const okun = await login('okun@okun.de')

/** Eine Anmeldung ohne Anmeldung — so, wie es ein Angreifer täte. */
const anmelden = async (email, passwort) => {
  const r = await fetch(`${BASIS}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: passwort }),
  })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

// ── G2.1 Die Bremse an der Anmeldung ───────────────────────────────────────
console.log('=== G2.1 Schutz gegen Durchprobieren ===')

// Ein Konto, das es gar nicht gibt — so bleibt kein echter Zugang gesperrt
// zurück, wenn diese Prüfung mitten im Lauf abbricht.
const OPFER = `g2-pruefung-${Date.now().toString(36)}@pruefung.test`

const ersterVersuch = await anmelden(OPFER, 'falsch')
check('Eine falsche Anmeldung wird abgewiesen', ersterVersuch.status === 401,
  `HTTP ${ersterVersuch.status}`)
check('Und verrät nicht, ob es die Adresse gibt',
  /E-Mail oder Passwort/.test(ersterVersuch.body.error ?? ''),
  ersterVersuch.body.error)

// Dieselbe Meldung für eine Adresse, die es wirklich gibt.
const echterFehlversuch = await anmelden('anna.fischer@rheinblick-reha.de', 'falsch')
check('Dieselbe Meldung bei einer Adresse, die es gibt',
  echterFehlversuch.body.error === ersterVersuch.body.error,
  `${ersterVersuch.body.error} / ${echterFehlversuch.body.error}`)

// Jetzt bis über die Grenze.
let gesperrtAb = null
for (let i = 2; i <= 14 && !gesperrtAb; i++) {
  const r = await anmelden(OPFER, 'falsch')
  if (r.status === 429) gesperrtAb = { versuch: i, ...r }
}
check('Nach genug Fehlversuchen wird gesperrt', !!gesperrtAb,
  gesperrtAb ? `ab Versuch ${gesperrtAb.versuch}` : 'nie gesperrt — die Bremse greift nicht!')
check('Die Sperre kommt nicht schon beim dritten Vertipper',
  (gesperrtAb?.versuch ?? 0) > 5, `ab Versuch ${gesperrtAb?.versuch}`)
check('Die Meldung nennt die Wartezeit',
  /\d+ Minute/.test(gesperrtAb?.body.error ?? ''), gesperrtAb?.body.error)
check('Und den Weg heraus', /Passwort vergessen/.test(gesperrtAb?.body.error ?? ''),
  gesperrtAb?.body.error)
check('Es wird gesagt, wann man wiederkommen darf',
  !!gesperrtAb?.body.gesperrtBis, gesperrtAb?.body.gesperrtBis)

// Die Gegenprobe, die zählt: Ein anderes Konto darf sich weiter anmelden.
// Wäre das nicht so, hätte diese Prüfung gerade das ganze System gesperrt.
const nebenan = await anmelden('anna.fischer@rheinblick-reha.de', 'Test1234!')
check('Ein anderes Konto bleibt davon unberührt', nebenan.status === 200,
  `HTTP ${nebenan.status}`)

// Und: Ein richtiges Passwort auf dem gesperrten Konto hilft NICHT. Sonst
// wäre die Sperre nur eine Bitte.
const richtigTrotzSperre = await anmelden(OPFER, 'Test1234!')
check('Auf einem gesperrten Konto hilft auch das richtige Passwort nicht',
  richtigTrotzSperre.status === 429, `HTTP ${richtigTrotzSperre.status}`)

// ── G2.2 Wer das Verzeichnis sehen darf ────────────────────────────────────
console.log('\n=== G2.2 Wer das Verzeichnis sieht ===')

const ohneAnmeldung = await fetch(`${BASIS}/api/dsgvo/verzeichnis`)
check('Ohne Anmeldung gar nichts', ohneAnmeldung.status === 401,
  `HTTP ${ohneAnmeldung.status}`)

const alsMitarbeiter = await hole(anna, '/api/dsgvo/verzeichnis')
check('Ein Mitarbeiter sieht es nicht', alsMitarbeiter.status === 403,
  `HTTP ${alsMitarbeiter.status}`)

const alsLeitung = await hole(leitung, '/api/dsgvo/verzeichnis')
check('Eine Standortleitung auch nicht — es ist Sache der Geschäftsführung',
  alsLeitung.status === 403, `HTTP ${alsLeitung.status}`)

const alsUnternehmen = await hole(gf, '/api/dsgvo/verzeichnis')
check('Die Unternehmensebene bekommt ihr Verzeichnis',
  alsUnternehmen.status === 200, `HTTP ${alsUnternehmen.status}`)
check('Und zwar das des Verantwortlichen (Art. 30 Abs. 1)',
  alsUnternehmen.body.art === 'verantwortlicher', alsUnternehmen.body.art)

const alsOkun = await hole(okun, '/api/dsgvo/verzeichnis')
check('OKUN bekommt das des Auftragsverarbeiters (Art. 30 Abs. 2)',
  alsOkun.body.art === 'auftragsverarbeiter', alsOkun.body.art)

// ── G2.3 Was drinsteht ─────────────────────────────────────────────────────
console.log('\n=== G2.3 Der Inhalt ===')

const v = alsUnternehmen.body.verzeichnis ?? {}
check('Es trägt den Namen des Betriebs',
  !!v.verantwortlicher?.name && v.verantwortlicher.name !== 'Unbenannter Betrieb',
  v.verantwortlicher?.name)
check('Es trägt einen Stand', /^\d{4}-\d{2}-\d{2}$/.test(v.stand ?? ''), v.stand)

const t = v.taetigkeiten ?? []
check('Jede Datenart ist als Tätigkeit aufgeführt', t.length > 10,
  `${t.length} Tätigkeiten`)
check('Jede nennt einen Zweck', t.every(x => x.zweck && x.zweck !== '—'),
  t.filter(x => !x.zweck || x.zweck === '—').map(x => x.id).join(', '))
check('Jede nennt eine Rechtsgrundlage mit Fundstelle',
  t.every(x => /Art\.|§/.test(x.rechtsgrundlage ?? '')),
  t.filter(x => !/Art\.|§/.test(x.rechtsgrundlage ?? '')).map(x => x.id).join(', '))
check('Jede sagt, was beim Löschen geschieht',
  t.every(x => (x.loeschung ?? '').length > 5))

const lohn = t.find(x => x.id === 'lohnkonto')
check('Die Lohndaten nennen ihre sechs Jahre', /6 Jahre/.test(lohn?.loeschung ?? ''),
  lohn?.loeschung)
check('Und den Steuerberater als Empfänger',
  (lohn?.empfaenger ?? []).some(e => /Steuerberater/.test(e)),
  (lohn?.empfaenger ?? []).join(', '))

const bem = t.find(x => x.id === 'bem')
check('Gesundheitsdaten stützen sich auf Art. 9',
  /Art\. 9/.test(bem?.rechtsgrundlage ?? ''), bem?.rechtsgrundlage)

check('Es gibt sich nicht für vollständig aus',
  (v.ergaenzen ?? []).length > 0,
  `${(v.ergaenzen ?? []).length} Hinweise`)

// ── G2.4 Die Maßnahmen als Anlage ──────────────────────────────────────────
console.log('\n=== G2.4 Die Maßnahmen (Art. 32) ===')

const m = alsUnternehmen.body.massnahmen ?? {}
const eintraege = m.eintraege ?? []
check('Die Maßnahmen liegen dem Verzeichnis bei', eintraege.length > 10,
  `${eintraege.length} Maßnahmen`)
check('Jede umgesetzte Maßnahme nennt ihren Beleg',
  eintraege.filter(x => x.stand === 'umgesetzt').every(x => !!x.beleg))
check('Jede offene Maßnahme nennt ihre Lücke',
  eintraege.filter(x => x.stand !== 'umgesetzt').every(x => !!x.luecke))
check('Die Anmeldebremse steht darin',
  eintraege.some(x => x.id === 'zugang-bremse' && x.stand === 'umgesetzt'))
check('Und sie behauptet nicht, alles sei erledigt',
  (m.zusammenfassung?.teilweise ?? 0) + (m.zusammenfassung?.offen ?? 0) > 0,
  JSON.stringify(m.zusammenfassung))

// ── G2.5 Das Verzeichnis von OKUN ──────────────────────────────────────────
console.log('\n=== G2.5 Das Verzeichnis des Auftragsverarbeiters ===')

const o = alsOkun.body.verzeichnis ?? {}
check('Es nennt die Kategorien der Verarbeitungen',
  (o.kategorien ?? []).length > 3, `${(o.kategorien ?? []).length} Kategorien`)
check('Es führt die Unterauftragsverarbeiter einzeln auf',
  (o.unterauftraege ?? []).length > 2, `${(o.unterauftraege ?? []).length} Dienstleister`)
check('Jeder nennt Zweck, Ort und Datenkategorien',
  (o.unterauftraege ?? []).every(u => u.zweck && u.ort && u.daten))
check('Drittlandübermittlungen nennen ihre Grundlage',
  (o.drittlaender ?? []).every(d => (d.grundlage ?? '').length > 20),
  `${(o.drittlaender ?? []).length} Drittländer`)
check('Offene Punkte stehen drin, statt verschwiegen zu werden',
  (o.offen ?? []).length > 0, `${(o.offen ?? []).length} offen`)

// ── G2.6 Aufsperren — und wer das darf ─────────────────────────────────────
console.log('\n=== G2.6 Eine Sperre aufheben ===')

const entsperren = async (cookie, pfad) => {
  const r = await fetch(`${BASIS}/api/anmeldeschutz${pfad}`, {
    method: 'DELETE', headers: { cookie },
  })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

const durchLeitung = await entsperren(leitung, `?email=${encodeURIComponent(OPFER)}`)
check('Eine Standortleitung sperrt niemanden auf', durchLeitung.status === 403,
  `HTTP ${durchLeitung.status}`)

const durchMitarbeiter = await entsperren(anna, `?email=${encodeURIComponent(OPFER)}`)
check('Ein Mitarbeiter erst recht nicht', durchMitarbeiter.status === 403,
  `HTTP ${durchMitarbeiter.status}`)

const fremdesKonto = await entsperren(
  gf, '?email=' + encodeURIComponent('susi.sonnenschein@kita-sonnenschein.de'))
check('Die Unternehmensebene sperrt kein fremdes Konto auf',
  fremdesKonto.status === 403, `HTTP ${fremdesKonto.status}`)

const verbindungDurchKunden = await entsperren(gf, '?verbindung=1')
check('Und hebt keine Sperre einer ganzen Verbindung auf',
  verbindungDurchKunden.status === 403, `HTTP ${verbindungDurchKunden.status}`)

// Über OKUN gefragt: Das Prüfkonto gehört bewusst keinem Unternehmen, und
// die Unternehmensebene darf fremde Konten nicht einmal nachschlagen — sonst
// ließe sich über diese Schnittstelle durchprobieren, welche Adressen es gibt.
const standVorher = await hole(okun, `/api/anmeldeschutz?email=${encodeURIComponent(OPFER)}`)
check('Der Stand einer Sperre ist für OKUN abfragbar', standVorher.status === 200,
  `HTTP ${standVorher.status}`)
check('Und zeigt die Sperre, solange sie gilt', standVorher.body.gesperrt === true,
  JSON.stringify(standVorher.body))

// ── Aufräumen ──────────────────────────────────────────────────────────────
//
// Jeder Lauf verbraucht rund vierzehn der vierzig Fehlversuche, die eine
// Verbindung in einer Viertelstunde hat. Drei Läufe hintereinander würden die
// ganze Suite über die Adresse aussperren — also räumt die Prüfung beides
// wieder weg, das Konto UND die Verbindung.
console.log('\n=== Aufräumen ===')

const geraeumt = await entsperren(
  okun, `?email=${encodeURIComponent(OPFER)}&verbindung=1`)
check('OKUN hebt Kontosperre und Verbindungssperre auf', geraeumt.status === 200,
  `Konto ${geraeumt.body.konto}, Verbindung ${geraeumt.body.verbindung}`)

const danach = await anmelden(OPFER, 'falsch')
check('Danach wird wieder normal abgewiesen statt gesperrt',
  danach.status === 401, `HTTP ${danach.status}`)

// Den einen Fehlversuch von eben auch noch weg.
await entsperren(okun, `?email=${encodeURIComponent(OPFER)}&verbindung=1`)

const sauber = await hole(okun, `/api/anmeldeschutz?email=${encodeURIComponent(OPFER)}`)
check('Die Prüfung hinterlässt keine Sperre', sauber.body.gesperrt === false,
  JSON.stringify(sauber.body))

// ── G2.7 Impressum und Datenschutzerklärung ────────────────────────────────
//
// Beide müssen OHNE Anmeldung erreichbar sein. §5 DDG verlangt „leicht
// erkennbar, unmittelbar erreichbar und ständig verfügbar" — hinter einer
// Anmeldung ist ein Impressum keines von dreien.
console.log('\n=== G2.7 Impressum und Datenschutzerklärung ===')

const oeffentlich = async (pfad) => {
  const r = await fetch(`${BASIS}${pfad}`)
  return { status: r.status, text: r.ok ? await r.text() : '' }
}

const imp = await oeffentlich('/impressum')
check('Das Impressum lädt ohne Anmeldung', imp.status === 200, `HTTP ${imp.status}`)
check('Es beruft sich auf §5 DDG', /§5 DDG/.test(imp.text))
check('Es nennt den Anbieter', /OKUN Workforce/.test(imp.text))
check('Und sagt etwas zur Streitbeilegung', /VSBG/.test(imp.text))

const dse = await oeffentlich('/datenschutz')
check('Die Datenschutzerklärung lädt ohne Anmeldung', dse.status === 200,
  `HTTP ${dse.status}`)
check('Sie nennt die Betroffenenrechte', /Art\. 15/.test(dse.text))
check('Und das Beschwerderecht bei der Aufsichtsbehörde',
  /Aufsichtsbehörde/.test(dse.text))
check('Sie trennt die eigene Rolle von der des Arbeitgebers',
  /Art\. 28/.test(dse.text) && /Verantwortliche/.test(dse.text))

// Der Abschnitt, den die meisten Erklärungen auslassen — und der hier
// besonders zählt, weil das Programm Dienstpläne rechnet.
check('Sie erklärt, was automatisch gerechnet wird (Art. 22)',
  /Art\. 22/.test(dse.text) && /Dienstpläne/.test(dse.text))
check('Und dass ein Mensch entscheidet, nicht die Maschine',
  /veröffentlicht/.test(dse.text))

check('Sie führt die Dienstleister namentlich auf',
  /Railway/.test(dse.text) && /Anthropic/.test(dse.text))
check('Und nennt die Aufbewahrungsfristen mit Vorschrift',
  /6 Jahre/.test(dse.text) && /EStG/.test(dse.text))

// Von der Anmeldeseite aus erreichbar — sonst findet sie niemand.
const anmeldeseite = await oeffentlich('/login')
check('Die Anmeldeseite verlinkt beide Seiten',
  /href="\/impressum"/.test(anmeldeseite.text)
  && /href="\/datenschutz"/.test(anmeldeseite.text))

process.exit(bilanz() ? 1 : 0)
