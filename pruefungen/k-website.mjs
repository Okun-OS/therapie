// Nachweis K: Die öffentliche Website.
//
// WARUM SIE EIGENE NACHWEISE BRAUCHT
// Sie ist die einzige Tür, die ohne Anmeldung offensteht — und das
// Kontaktformular die einzige Stelle, an der jemand ohne Konto etwas in die
// Datenbank schreiben kann. Beides gehört geprüft: dass die Tür offen ist
// (sonst findet niemand hinein) und dass durch sie nichts hereinkommt, was
// nicht soll.
import { pruefer, login, hole, sende } from './helfer.mjs'

const { check, bilanz } = pruefer()
const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'

const ohne = async (pfad) => {
  const r = await fetch(`${BASIS}${pfad}`, { redirect: 'manual' })
  return { status: r.status, text: r.ok ? await r.text() : '' }
}

// ── K1 Die Türen stehen offen ──────────────────────────────────────────────
console.log('=== K1 Ohne Anmeldung erreichbar ===')

for (const [pfad, name] of [
  ['/', 'Startseite'],
  ['/funktionen', 'Funktionen'],
  ['/kontakt', 'Kontakt'],
  ['/impressum', 'Impressum'],
  ['/datenschutz', 'Datenschutz'],
  ['/login', 'Anmeldung'],
]) {
  const r = await ohne(pfad)
  check(`${name} ist ohne Anmeldung erreichbar`, r.status === 200,
    `HTTP ${r.status} für ${pfad}`)
}

const start = await ohne('/')
check('Die Startseite leitet nicht mehr sofort auf die Anmeldung um',
  start.status === 200 && start.text.length > 2000,
  `HTTP ${start.status}, ${start.text.length} Zeichen`)
// §179 Die Startseite positioniert das Produkt als durchgaengiges System
// fuer Personalarbeit — nicht als Dienstplansoftware. Wer nur den Dienstplan
// nennt, verliert jeden, der eine Lohnsoftware sucht.
for (const bereich of [
  'Recruiting', 'Personalplanung', 'Arbeitszeit', 'Lohnabrechnung',
  'Abwesenheiten',
]) {
  check(`Die Startseite nennt „${bereich}"`,
    new RegExp(bereich, 'i').test(start.text),
    'Das Produkt ist mehr als Dienstplanung')
}
check('Und dass es um Unternehmen geht',
  /Unternehmen|Betrieb/i.test(start.text))

// §178 Zwei Gegenproben zu Fehlern der ersten Fassung.
//
// ERSTENS: Keine Kundeninterna. Dort standen sechs Regeln aus dem
// Regelpaket eines echten Betriebs — mit Vornamen und Gruppennummern. Das
// wirkte ueberzeugend und war trotzdem falsch: Wie ein Kunde plant, ist
// sein Betriebsablauf und gehoert ihm.
const startText = start.text.replace(/<[^>]*>/g, ' ')
for (const spur of ['Heike', 'Gruppe 1', 'Gruppe 7', 'Eingewöhnung', 'Springerin']) {
  check(`Keine Kundeninterna auf der Startseite: „${spur}"`,
    !startText.includes(spur),
    'Wie ein Kunde plant, gehoert ihm — nicht ins Schaufenster')
}

// ZWEITENS: Keine Einengung auf eine Branche. OKUN Workforce ist fuer jedes
// Unternehmen mit Personal und Schichten. Wer eine Branche nennt, schliesst
// alle anderen aus — und ein Logistiker liest nicht weiter.
for (const branche of ['Kita', 'Eingliederungshilfe', 'soziale Einrichtung']) {
  check(`Die Startseite engt nicht auf „${branche}" ein`,
    !new RegExp(branche, 'i').test(startText),
    'Das Programm ist fuer alle Unternehmen')
}
check('Ein Weg zur Anmeldung steht auf der Seite',
  /href="\/login"/.test(start.text))
check('Ein Weg zum Kontakt auch', /href="\/kontakt"/.test(start.text))
check('Impressum und Datenschutz sind verlinkt',
  /href="\/impressum"/.test(start.text) && /href="\/datenschutz"/.test(start.text))

// §177 Was nicht behauptet werden darf, solange es nicht stimmt.
check('Die Seite verspricht keine Selbstregistrierung',
  !/kostenlos testen|jetzt registrieren|gratis testen/i.test(start.text),
  'Ein Betrieb kann sich nicht selbst anlegen — ein solcher Knopf wäre eine Lüge')
check('Und nennt keine Preise, die nicht feststehen',
  !/€\s*\d|\d+\s*€|Euro\s*\/\s*Monat/i.test(start.text))

// ── K2 Die Funktionsseite ist vollständig ──────────────────────────────────
console.log('\n=== K2 Der Funktionsumfang ===')

const funktionen = await ohne('/funktionen')
for (const bereich of [
  'Dienstplanung', 'Zeiterfassung', 'Abwesenheiten', 'Lohnabrechnung',
  'Nachweise', 'Kommunikation', 'Auswertungen', 'Recruiting',
  'Datenschutz',
]) {
  check(`„${bereich}" steht auf der Funktionsseite`,
    new RegExp(bereich, 'i').test(funktionen.text))
}

// Die Stellen, an denen sich das Produkt von anderen unterscheidet.
for (const [begriff, warum] of [
  ['Pfändung', 'der Lohnteil, nach dem Kunden ausdrücklich fragen'],
  ['Kurzarbeitergeld', 'dasselbe'],
  ['Altersvorsorge', 'dasselbe'],
  ['Eingliederungsmanagement', 'BEM — sonst sucht es jemand vergeblich'],
  ['DATEV', 'der Weg zum Steuerberater'],
  ['SEPA', 'der Weg zur Bank'],
  ['ELStAM', 'die Steuermerkmale'],
]) {
  // Ohne Ruecksicht auf Gross- und Kleinschreibung: Geprueft wird, ob das
  // Thema vorkommt, nicht wie es zufaellig am Satzanfang steht. „Pfaendung"
  // steht im Text als „Lohnpfaendung" — fachlich richtig, und die erste
  // Fassung dieser Pruefung fand es deshalb nicht.
  check(`„${begriff}" wird genannt`,
    new RegExp(begriff, 'i').test(funktionen.text), warum)
}

const funktionenText = funktionen.text.replace(/<[^>]*>/g, ' ')
for (const branche of ['Kita', 'Eingliederungshilfe']) {
  check(`Die Funktionsseite engt nicht auf „${branche}" ein`,
    !new RegExp(branche, 'i').test(funktionenText))
}
check('Sie spricht von Bereichen, nicht von Etagen und Gruppen',
  /Bereich/i.test(funktionenText) && !/\bEtage/i.test(funktionenText),
  'Branchenneutrale Begriffe: ein Pflegeheim liest das eine mit, ein Logistiker das andere')

// ── K3 Das Kontaktformular ─────────────────────────────────────────────────
console.log('\n=== K3 Das Kontaktformular ===')

const MARKE = Date.now().toString(36)
const gut = {
  name: `Pruefung ${MARKE}`,
  email: `pruefung-${MARKE}@example.org`,
  einrichtung: 'Kita Prüfstein',
  nachricht: 'Wir haben zwei Häuser mit je acht Gruppen und suchen etwas, '
    + 'das unsere Regeln kennt.',
}

const gesendet = await sende(null, '/api/kontakt', 'POST', gut)
check('Eine Anfrage wird angenommen', gesendet.status === 200,
  `HTTP ${gesendet.status} ${JSON.stringify(gesendet.body).slice(0, 160)}`)

// §177 Erst ablegen, dann verschicken: Der Versand darf scheitern, die
// Anfrage nicht verlorengehen.
const okun = await login('okun@okun.de')
const liste = await hole(okun, '/api/okun/kontaktanfragen')
const meine = (liste.body?.anfragen ?? []).find(a => a.name === gut.name)
check('Sie steht danach in der Datenbank', !!meine,
  `${(liste.body?.anfragen ?? []).length} Anfragen insgesamt`)
check('Mit der E-Mail-Adresse, unter der man antworten kann',
  meine?.email === gut.email, meine?.email)
check('Und mit dem Text', (meine?.nachricht ?? '').includes('acht Gruppen'),
  meine?.nachricht?.slice(0, 80))

// ── Gegenproben ────────────────────────────────────────────────────────────
console.log('\n=== Gegenproben ===')

const ohneName = await sende(null, '/api/kontakt', 'POST', { ...gut, name: '' })
check('Ohne Namen wird abgelehnt', ohneName.status === 400, ohneName.body?.error)

const falscheMail = await sende(null, '/api/kontakt', 'POST', { ...gut, email: 'keine-mail' })
check('Eine unbrauchbare E-Mail-Adresse wird abgelehnt',
  falscheMail.status === 400, falscheMail.body?.error)
check('Und es wird gesagt, warum',
  /antworten können/i.test(falscheMail.body?.error ?? ''), falscheMail.body?.error)

const zuKurz = await sende(null, '/api/kontakt', 'POST', { ...gut, nachricht: 'Hallo' })
check('Eine leere Nachricht wird abgelehnt', zuKurz.status === 400, zuKurz.body?.error)

// §177 Das Köderfeld: Wer es ausfüllt, bekommt dieselbe freundliche Antwort
// und wird trotzdem nicht gespeichert.
const bot = {
  ...gut,
  name: `Bot ${MARKE}`,
  email: `bot-${MARKE}@example.org`,
  webseite: 'http://beispiel.invalid',
}
const botAntwort = await sende(null, '/api/kontakt', 'POST', bot)
check('Ein ausgefülltes Köderfeld bekommt dieselbe Antwort',
  botAntwort.status === 200, `HTTP ${botAntwort.status}`)
const nachBot = await hole(okun, '/api/okun/kontaktanfragen')
check('Aber es wird nichts gespeichert',
  !(nachBot.body?.anfragen ?? []).some(a => a.name === bot.name),
  'Der Bot-Eintrag ist in der Liste gelandet')

// Wer darf die Anfragen lesen?
const gf = await login('gf@rheinblick-reha.de')
const fremd = await hole(gf, '/api/okun/kontaktanfragen')
check('Ein Kunde liest die Anfragen NICHT', fremd.status === 403,
  `HTTP ${fremd.status}`)

const ohneAnmeldung = await fetch(`${BASIS}/api/okun/kontaktanfragen`)
check('Und ohne Anmeldung erst recht nicht', ohneAnmeldung.status === 401,
  `HTTP ${ohneAnmeldung.status}`)

// ── K4 Die Marke ───────────────────────────────────────────────────────────
console.log('\n=== K4 Wortmarke und Schrift ===')

// §180 Bis hierher war die Wortmarke auf dunklem Grund nachgebauter Text:
// `font-extrabold uppercase tracking-wide` in Inter. Das ist eine andere
// Schrift als im Logo. Jetzt steht überall dieselbe Datei — und diese
// Prüfungen halten das fest, damit es nicht beim nächsten Umbau zurückfällt.
const kopfSeiten = [['/', 'Startseite'], ['/funktionen', 'Funktionen'],
  ['/kontakt', 'Kontakt'], ['/login', 'Anmeldung']]

for (const [pfad, name] of kopfSeiten) {
  const seite = await ohne(pfad)
  check(`${name} zeigt die Negativfassung des Logos`,
    /logo-(horizontal|full-tagline)-negativ/.test(seite.text),
    'Auf dunklem Grund gehört die Negativfassung hin, kein nachgebauter Text')
  // Gegenprobe: der alte Nachbau ist wirklich weg.
  check(`${name} baut die Wortmarke nicht mehr aus Text nach`,
    !/font-extrabold uppercase tracking-wide/.test(seite.text),
    'Das waren die Klassen der alten HTML-Wortmarke')
}

// Und umgekehrt: auf hellem Grund steht die helle Fassung, nicht das Negativ.
const anwendung = await ohne('/impressum')
check('Das Impressum lädt keine Negativfassung',
  !/negativ/.test(anwendung.text),
  'Weiße Schrift auf weißem Papier wäre unsichtbar')

// Die Schrift des Logos — nicht nur angefordert, sondern auch definiert.
/*
 * §185 Das Stilblatt holen — und warum das zwei Anläufe braucht.
 *
 * Der Entwicklungsserver hängt an die Adresse des Stilblatts einen
 * Zeitstempel (`?v=…`) und erneuert ihn laufend. Zwischen dem Abruf der Seite
 * und dem Abruf des Stilblatts ist er mitunter schon veraltet; dann kommt
 * nicht die CSS-Datei zurück, sondern die Fehlerseite — und die enthält
 * natürlich nicht die Überschriftenschrift. Die Prüfung meldete damit einen
 * Schriftfehler, wo
 * keiner war.
 *
 * Deshalb: Seite und Stilblatt im selben Atemzug holen, und wenn trotzdem
 * etwas anderes als CSS zurückkommt, einmal von vorn. Was dann immer noch
 * keine CSS-Datei ist, ist ein echter Befund.
 */
async function stilblattHolen() {
  for (let versuch = 0; versuch < 3; versuch++) {
    const seite = await ohne('/')
    const adressen = [...seite.text.matchAll(/href="([^"]*\.css[^"]*)"/g)].map(m => m[1])
    if (adressen.length === 0) continue
    let inhalt = ''
    let allesCss = true
    for (const pfad of adressen) {
      const r = await fetch(pfad.startsWith('http') ? pfad : `${BASIS}${pfad}`)
      const typ = r.headers.get('content-type') ?? ''
      if (!r.ok || !typ.includes('css')) { allesCss = false; break }
      inhalt += await r.text()
    }
    if (allesCss && inhalt) return { adressen, inhalt }
  }
  return { adressen: [], inhalt: '' }
}

const { adressen: stilblatt, inhalt: stil } = await stilblattHolen()
check('Die Seite bindet ein Stilblatt ein', stilblatt.length > 0)
check('Das Stilblatt lädt die Überschriftenschrift',
  /Manrope/.test(stil),
  'Ohne sie fällt die Website auf Inter zurück und spricht wieder zwei Sprachen')
check('Und definiert dafür eine eigene Familie',
  /\.font-display\s*\{[^}]*Manrope/.test(stil),
  'Die Klasse `font-display` muss es wirklich geben, nicht nur im Quelltext stehen')
check('Inter bleibt für den Fließtext',
  /Inter/.test(stil),
  'Manrope ist die Überschriftenschrift, nicht die Textschrift')

for (const [pfad, name] of [['/', 'Startseite'], ['/funktionen', 'Funktionen'],
  ['/kontakt', 'Kontakt']]) {
  const seite = await ohne(pfad)
  check(`Die Überschrift der ${name} steht in der Schrift des Logos`,
    /<h1[^>]*font-display/.test(seite.text),
    'Sonst trägt die Marke oben links eine andere Schrift als die Seite darunter')
}

// ── §189 Die Hintergrundbilder ─────────────────────────────────────────────
//
// WAS DIESE PRÜFUNG KANN UND WAS NICHT
// Sie sieht, DASS das Bild angefordert wird und dass die Datei wirklich
// ausgeliefert wird. Ob der Text darauf noch lesbar ist, sieht sie nicht —
// das misst die Browserprüfung in `browser/marke.mjs`, indem sie den Text
// ausblendet und die Helligkeit darunter nachrechnet.
//
// Beides zusammen, weil keines allein reicht: Eine fehlende Datei bestünde
// die Helligkeitsmessung glänzend (schwarz ist dunkel), und ein zu helles
// Bild bestünde diese hier.
console.log('\n=== §189 Die Hintergrundbilder ===')

for (const [pfad, name, datei] of [
  ['/', 'Startseite', 'start-aufmacher'],
  ['/funktionen', 'Funktionen', 'funktionen-aufmacher'],
]) {
  const seite = await ohne(pfad)
  check(`${name}: der Aufmacher fordert sein Hintergrundbild an`,
    seite.text.includes(`${datei}.webp`),
    'Ohne Bild bleibt oben eine schwarze Fläche — die Seite sieht dann aus wie ein Fehler')
  check(`${name}: und auch den Kasten ganz unten`,
    seite.text.includes('band-verbunden.webp'),
    'Der Kasten „Wie viele Programme…" steht auf beiden Seiten und trägt dasselbe Bild')
}

for (const datei of ['start-aufmacher', 'funktionen-aufmacher', 'band-verbunden']) {
  const r = await fetch(`${BASIS}/hintergrund/${datei}.webp`)
  const roh = Buffer.from(await r.arrayBuffer())
  check(`Die Datei ${datei}.webp wird ausgeliefert`, r.status === 200, `HTTP ${r.status}`)
  // Die Kennung im Dateikopf, nicht die Endung: Eine umbenannte PNG-Datei
  // hieße auch .webp und wäre zwanzigmal so groß.
  check(`Und ist wirklich WebP, nicht nur so benannt`,
    roh.toString('ascii', 0, 4) === 'RIFF' && roh.toString('ascii', 8, 12) === 'WEBP',
    `Dateikopf: ${JSON.stringify(roh.toString('ascii', 0, 12))}`)
  // §189 Die Vorlagen wiegen 1,4 bis 2 MB. Käme eine davon versehentlich in
  // den Ordner, merkte das niemand außer am Ladebalken.
  check(`Und klein genug für ein Telefon im Zug (${(roh.length / 1024).toFixed(0)} kB)`,
    roh.length < 300 * 1024,
    'Über 300 kB ist für ein Bild, das nur Stimmung macht, zu viel')
}

// ── K5 Die Bildschirmfotos ─────────────────────────────────────────────────
console.log('\n=== K5 Was die Startseite zeigt ===')

// §184 Drei Bildschirmfotos aus dem laufenden Programm — Dienstplan,
// Stempeluhr, Lohnabrechnung. Sie belegen den einen Satz, der dieses Produkt
// von anderen unterscheidet: Was geplant und gestempelt wird, steht am
// Monatsende in der Abrechnung, ohne dass jemand eine Stunde überträgt.
const start2 = await ohne('/')
for (const [datei, was] of [
  ['dienstplan', 'der Dienstplan'],
  ['stempeluhr', 'die Stempeluhr'],
  ['lohnabrechnung', 'die Lohnabrechnung'],
]) {
  check(`Die Startseite zeigt ${was}`,
    new RegExp(`schaufenster(%2F|/)${datei}\\.png`).test(start2.text),
    'Das Bild wird nicht eingebunden')

  const bild = await fetch(`${BASIS}/schaufenster/${datei}.png`)
  check(`Und ${was} ist auch wirklich da`,
    bild.status === 200 && (bild.headers.get('content-type') ?? '').includes('image'),
    `HTTP ${bild.status}, ${bild.headers.get('content-type')}`)
  const groesse = Number(bild.headers.get('content-length') ?? 0)
  check(`${was} ist kein leeres Bild`, groesse > 20_000, `${groesse} Bytes`)
}

// §184 Die Gegenproben. Bildschirmfotos sind der bequemste Weg, genau das auf
// die Website zu bringen, was dort nie stehen darf: echte Menschen und eine
// Branche, die alle anderen ausschließt. Prüfen lässt sich das Bild selbst
// nicht — wohl aber, dass der Betrieb darauf ein erfundener ist.
const schaufensterText = start2.text.replace(/<[^>]*>/g, ' ')
check('Die Bilder zeigen einen Beispielbetrieb, und das steht auch da',
  /Beispielbetrieb/i.test(schaufensterText),
  'Wer ein Bildschirmfoto zeigt, muss sagen, wessen Daten darauf stehen')
for (const branche of ['Kita', 'Pflegeheim', 'Reha']) {
  check(`Der Abschnitt engt nicht auf „${branche}" ein`,
    !new RegExp(branche, 'i').test(schaufensterText))
}

// ── §201 Die Verkaufsseite blitzt Angemeldeten nicht mehr auf ──────────────
console.log('\n=== §201 Wer angemeldet ist, sieht die Verkaufsseite nicht ===')

/*
 * Die Weiterleitung lief bisher im Browser, und im Kommentar dazu stand
 * ehrlich: „Die Verkaufsseite ist dabei kurz sichtbar. Das ist gewollt." Im
 * Desktop-Programm blitzte damit bei jedem Öffnen die Werbeseite auf, bevor
 * die Anmeldung kam. Jetzt entscheidet die Schicht davor.
 *
 * Die Gegenprobe ist hier die wichtigere Hälfte: Eine Weiche, die auch
 * Unangemeldete umleitet, hätte die Website von einem Tag auf den anderen
 * aus Google genommen.
 *
 * §254 DIESE PRÜFUNG HAT DAS FALSCHE GEMESSEN — UND ES FÄLLT ERST JETZT AUF
 *
 * Sie verlangte eine Umleitung: HTTP 307 mit Ziel. Genau das war der Fehler,
 * über den der Eigentümer dreimal geschrieben hat: „Ich sehe immer noch die
 * Webseite, wenn ich auf die App gehe."
 *
 * Eine Umleitung ZEICHNET NICHTS. iOS behält von jeder Adresse das letzte
 * gezeichnete Bild — und für `/` war das die Verkaufsseite, von irgendwann
 * vorher. Beim Öffnen zeigt das Telefon dieses Bild, während die Umleitung
 * läuft. Die Messung war grün und die Beschwerde blieb, weil ich geprüft
 * habe, OB umgeleitet wird, und nicht, WAS man sieht.
 *
 * Seit §254 wird nicht mehr umgeleitet, sondern `/start` an derselben Adresse
 * ausgeliefert: dunkelblau, Wappen, und von dort geht es weiter. Damit ist das
 * letzte Bild von `/` für einen Angemeldeten der Startbildschirm und nicht die
 * Werbung.
 *
 * Geprüft wird deshalb ab hier, WAS AUSGELIEFERT WIRD. Ein Status allein
 * beweist hier nichts.
 */
const startseite = async (cookie) => {
  const r = await fetch(`${BASIS}/`, {
    redirect: 'manual', headers: cookie ? { cookie } : {},
  })
  return {
    status: r.status,
    ziel: r.headers.get('location') ?? '',
    text: await r.text().catch(() => ''),
  }
}

const anonym = await startseite(null)
check('Ohne Anmeldung kommt die Verkaufsseite — unverändert',
  anonym.status === 200 && /Beispielbetrieb/i.test(anonym.text),
  `HTTP ${anonym.status}, ${anonym.text.length} Zeichen`)

for (const [wer, pfad] of [
  ['gf@rheinblick-reha.de', '/company'],
  ['anna.fischer@rheinblick-reha.de', '/employee'],
  ['okun@okun.de', '/okun'],
]) {
  const angemeldet = await startseite(await login(wer))

  check(`Angemeldet kommt an derselben Adresse der Startbildschirm, keine Umleitung`,
    angemeldet.status === 200 && angemeldet.ziel === '',
    `HTTP ${angemeldet.status} → ${angemeldet.ziel}`)

  /*
   * Die Zeile, auf die es ankommt: Auf dem Bildschirm steht nicht die Werbung.
   * Daran wäre der gemeldete Fehler aufgefallen, an einem Status nicht.
   */
  check(`Und darauf steht NICHT die Verkaufsseite (${pfad})`,
    !/Beispielbetrieb/i.test(angemeldet.text),
    `${angemeldet.text.length} Zeichen, Verkaufsseite hat ${anonym.text.length}`)

  check(`Von dort geht es nach ${pfad} weiter`,
    angemeldet.text.includes(pfad), pfad)
}

/*
 * §254 Ein erfundener Keks — und warum hier jetzt etwas anderes erwartet wird.
 *
 * Diese Zeile verlangte vorher die Verkaufsseite: Wer kein echtes Cookie hat,
 * sollte die Website sehen. Seit §254 hängt die Weiche nicht mehr an der
 * Unterschrift, sondern nur daran, OB ein Cookie da ist — der Grund steht in
 * `middleware.ts`: Eine Weiche, die an einer Bedingung hängt, deren Scheitern
 * sich nicht nachstellen lässt, ist die falsche Bauform.
 *
 * Ein erfundenes Cookie landet damit auf dem Startbildschirm und von dort auf
 * der Anmeldung. Das ist die Absicht und keine Lücke: Die Berechtigung trifft
 * weiterhin `requireRole` in der Anwendung, hier wird nur gelenkt.
 *
 * Die Sorge, die hinter der alten Zeile stand, bleibt geprüft — eine Zeile
 * weiter oben: Ohne Cookie kommt die Verkaufsseite. Das ist der Fall, der für
 * Google zählt, denn ein Suchroboter schickt keine Cookies.
 */
/*
 * §263 `/app` ist die Startadresse der INSTALLIERTEN App (`start_url` im
 * Manifest). Wer sie vom Startbildschirm öffnet, kommt dort an — und dort
 * stand bis zum 29.10.2026 dieselbe reine Weiterleitung, die §254 unter `/`
 * als Ursache entlarvt hat. Eine Adresse, auf der nie etwas gezeichnet wird,
 * friert ihr altes Standbild ein.
 */
const appStart = await (async () => {
  const r = await fetch(`${BASIS}/app`, {
    redirect: 'manual', headers: { cookie: await login('anna.fischer@rheinblick-reha.de') },
  })
  return { status: r.status, ziel: r.headers.get('location') ?? '', text: await r.text() }
})()
check('Auch /app leitet nicht weiter, sondern zeichnet den Startbildschirm',
  appStart.status === 200 && appStart.ziel === '',
  `HTTP ${appStart.status} → ${appStart.ziel}`)
check('Und von dort geht es nach /employee weiter',
  appStart.text.includes('/employee') && !/Beispielbetrieb/i.test(appStart.text),
  `${appStart.text.length} Zeichen`)

const erfunden = await startseite('okun_session=ausgedacht.unterschrift')
check('Ein erfundener Keks führt NICHT in die Anwendung, sondern zur Anmeldung',
  erfunden.status === 200
  && !/Beispielbetrieb/i.test(erfunden.text)
  && erfunden.text.includes('/login'),
  `HTTP ${erfunden.status}, ${erfunden.text.length} Zeichen`)

const angemeldeterKeks = await login('gf@rheinblick-reha.de')
for (const seite of ['/funktionen', '/kontakt', '/impressum', '/datenschutz']) {
  const r = await fetch(`${BASIS}${seite}`, {
    redirect: 'manual', headers: { cookie: angemeldeterKeks },
  })
  check(`${seite} bleibt auch für Angemeldete erreichbar`, r.status === 200,
    `HTTP ${r.status}`)
}

// ── §210 Die Adresse, unter der das Programm liegt ─────────────────────────
console.log('\n=== §210 /programm — der Ausgabeort des Desktop-Programms ===')

/*
 * Diese Adresse wird in JEDES ausgelieferte Windows-Programm eingebacken.
 * Was heute installiert wird, schaut in zwei Jahren noch genau hier nach —
 * deshalb muss sie ohne Anmeldung erreichbar sein und darf nirgendwo
 * hinführen, wo sie nicht hinsoll.
 */
const programm = async (pfad) => {
  const r = await fetch(`${BASIS}/programm/${pfad}`, { redirect: 'manual' })
  return {
    status: r.status,
    ziel: r.headers.get('location') ?? '',
    body: await r.json().catch(() => ({})),
  }
}

const yml = await programm('latest.yml')
check('Ohne Anmeldung wird nicht abgewiesen',
  yml.status !== 401 && yml.status !== 403,
  `HTTP ${yml.status} — das Programm aktualisiert sich, bevor sich jemand `
  + 'angemeldet hat. Eine Anmeldepflicht hier hieße: nie eine Aktualisierung.')

check('Ohne eingerichteten Speicher sagt sie das ehrlich',
  yml.status === 503 && /nicht eingerichtet/i.test(JSON.stringify(yml.body)),
  `HTTP ${yml.status} ${JSON.stringify(yml.body).slice(0, 140)} — 404 hieße `
  + '„gibt es nicht", 503 heißt „noch nicht eingerichtet". Das ist etwas anderes.')

// Die Gegenproben: Der Pfad aus der Anfrage wird zum Schlüssel im Speicher.
for (const [versuch, was] of [
  ['..%2F..%2Fetc%2Fpasswd', 'ein Ausbruch aus dem Verzeichnis'],
  ['unterordner/datei.exe', 'ein Pfad mit Schrägstrich'],
  ['boese.sh', 'eine fremde Dateiendung'],
  ['.versteckt.yml', 'ein Name, der mit einem Punkt beginnt'],
]) {
  const r = await programm(versuch)
  check(`Abgewiesen: ${was}`, r.status === 404,
    `HTTP ${r.status} für „${versuch}"`)
}


process.exit(bilanz() ? 1 : 0)
