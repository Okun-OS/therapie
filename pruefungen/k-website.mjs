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
check('Sie nennt, worum es geht', /Dienstplan/i.test(start.text))
check('Und für wen', /Pflege|Kita|Eingliederungshilfe/i.test(start.text))
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

process.exit(bilanz() ? 1 : 0)
