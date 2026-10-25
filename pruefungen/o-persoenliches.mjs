// Nachweis §235: Das „Persönliche" ist weg — vollständig.
//
//     node pruefungen/o-persoenliches.mjs
//
// DIE MELDUNG
// „Das mit den persönlichen, mit den Stärken und Schwächen, das kann auch
// raus, es braucht kein Mensch mehr. Das hat doch nie Sinn gemacht."
//
// WAS DIESE PRÜFUNG VORHER GEMESSEN HAT
// §232 hatte zwei Schattenfelder entfernt, den falschen Satz („hilft der KI,
// faire Dienstpläne zu erstellen") korrigiert und drei Zugriffslücken
// geschlossen — darunter eine, die ohne Kennung die ganze Tabelle über alle
// Kunden hinweg herausgab. Übrig blieb eine Erhebung, die den Rechendienst
// nicht erreicht.
//
// WARUM SIE JETZT DAS GEGENTEIL MISST
// Eine entfernte Schnittstelle, die weiter antwortet, ist eine, die noch
// jemand benutzt. Und eine gelöschte Tabelle, die noch in der DSGVO-Auskunft
// steht, ist eine Auskunft, die ins Leere zeigt. Beides muss nachprüfbar
// verschwunden sein — sonst bleibt von der Löschung nur die Absicht.

import { pruefer, login, hole, sende } from './helfer.mjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const { check, bilanz } = pruefer()

const leitung = await login('leitung@rheinblick-reha.de')
// Das Verarbeitungsverzeichnis liest die Unternehmensebene, nicht der Standort.
const gf = await login('gf@rheinblick-reha.de')
const anna = await login('anna.fischer@rheinblick-reha.de')

const meAnna = (await hole(anna, '/api/auth/me')).body.user
const meLeitung = (await hole(leitung, '/api/auth/me')).body.user
const annaId = meAnna.employeeId
const locationId = meLeitung.locationId

console.log(`Anna ${annaId?.slice(0, 8)}\n`)

// ── §235 Die Schnittstellen antworten nicht mehr ──────────────────────────
console.log('=== §235 Keine Schnittstelle mehr ===')

for (const [weg, art] of [
  [`/api/employee-human-context?employeeId=${annaId}`, 'Lesen'],
  ['/api/employee-human-context', 'Lesen ohne Kennung'],
]) {
  const r = await hole(anna, weg)
  check(`${art}: die Route gibt es nicht mehr`, r.status === 404 || r.status === 405,
    `HTTP ${r.status}`)
}

const schreiben = await sende(anna, '/api/employee-human-context', 'PATCH', {
  employeeId: annaId, strengths: ['Elternkommunikation'],
})
check('Schreiben: ebenfalls nicht mehr', schreiben.status === 404 || schreiben.status === 405,
  `HTTP ${schreiben.status}`)

const chat = await sende(anna, '/api/ai/human-context-chat', 'POST', {
  employeeId: annaId, messages: [{ role: 'user', content: 'Hallo' }],
})
check('Auch der KI-Chat dazu ist weg', chat.status === 404 || chat.status === 405,
  `HTTP ${chat.status}`)

// ── §235 Die Tabelle ist gelöscht ─────────────────────────────────────────
console.log('\n=== §235 Keine Tabelle mehr ===')

/*
 * Nachgesehen wird im Katalog der Datenbank, nicht über Prisma: Prisma kennt
 * das Modell ohnehin nicht mehr und könnte gar nicht danach fragen. Die Frage
 * ist, ob die TABELLE noch steht — eine ausgeblendete Tabelle wäre weiterhin
 * eine Verarbeitung, nur eine unsichtbare.
 */
const tabellen = await prisma.$queryRawUnsafe(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'EmployeeHumanContext'`,
)
check('Die Tabelle EmployeeHumanContext existiert nicht mehr',
  Array.isArray(tabellen) && tabellen.length === 0,
  `${Array.isArray(tabellen) ? tabellen.length : '?'} gefunden`)

/*
 * Die Gegenprobe: Die Abfrage muss eine Tabelle, die es GIBT, auch finden.
 * Ohne sie wäre „nicht gefunden" auch dann grün, wenn die Abfrage nie etwas
 * findet — etwa weil der Name anders geschrieben werden müsste.
 */
const gegenprobe = await prisma.$queryRawUnsafe(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'Employee'`,
)
check('Und die Abfrage findet eine Tabelle, die es gibt',
  Array.isArray(gegenprobe) && gegenprobe.length === 1,
  `${Array.isArray(gegenprobe) ? gegenprobe.length : '?'} gefunden`)

// ── §235 Das DSGVO-Verzeichnis zeigt nicht ins Leere ──────────────────────
console.log('\n=== §235 Die Auskunft bleibt vollständig ===')

/*
 * Eine gelöschte Tabelle, die noch im Verzeichnis steht, ist schlimmer als
 * keine: Die Auskunft verspricht dann Daten, die niemand mehr herausgeben
 * kann, und der Löschbericht zählt eine Tabelle, die es nicht gibt.
 */
/*
 * Geprüft wird, dass die beiden Wege DURCHLAUFEN — nicht, ob sie den
 * Tabellennamen nennen.
 *
 * Beim ersten Versuch stand hier „das Verzeichnis nennt EmployeeHumanContext
 * nicht mehr". Das war grün und bedeutungslos: Weder das
 * Verarbeitungsverzeichnis noch die Löschvorschau geben Modellnamen heraus —
 * sie sprechen fachlich, und das ist richtig so. Nachgemessen: 42 855 bzw.
 * 11 179 Zeichen, kein einziger Prisma-Name darin.
 *
 * Aussagekräftig ist etwas anderes: Beide Wege gehen den Katalog durch und
 * zählen je Modell. Stünde dort eine Tabelle, die es nicht mehr gibt, würde
 * die Zählung scheitern. Dass sie durchlaufen, IST der Nachweis. Dass der
 * Katalog nur Modelle nennt, die es gibt, prüft `dsgvo-katalog.test.ts` am
 * Schema selbst.
 */
const vorschau = await hole(gf, `/api/dsgvo/loeschung?employeeId=${annaId}`)
check('Die Löschvorschau läuft durch', vorschau.status === 200,
  vorschau.body.error ?? `${JSON.stringify(vorschau.body ?? {}).length} Zeichen`)

const auskunft = await hole(leitung, `/api/dsgvo/auskunft?employeeId=${annaId}`)
check('Die Auskunft läuft weiterhin durch', auskunft.status === 200,
  auskunft.body.error ?? `HTTP ${auskunft.status}`)
check('Und liefert etwas — eine leere Auskunft wäre keine',
  JSON.stringify(auskunft.body ?? {}).length > 200,
  `${JSON.stringify(auskunft.body ?? {}).length} Zeichen`)

// ── §235 Die Masken zeigen es nicht mehr ──────────────────────────────────
console.log('\n=== §235 Was an seine Stelle tritt ===')

/*
 * Die Gegenprobe zum Löschen: Was WIRKLICH plant, muss weiter da sein. Ohne
 * sie wäre „alles weg" grün, auch wenn versehentlich die Dienstvorliebe
 * mitgegangen wäre — und die ist seit §229 die eine Angabe, die der
 * Rechendienst beachtet.
 */
const vorliebe = await sende(leitung, '/api/employee-planning-profile', 'PUT', {
  employeeId: annaId, shiftPreference: 'frueh',
})
check('Die Dienstvorliebe gibt es weiter — sie plant',
  vorliebe.status === 200 && vorliebe.body.profile?.shiftPreference === 'frueh',
  vorliebe.body.error ?? vorliebe.body.profile?.shiftPreference)

const stammdaten = ((await hole(leitung, '/api/employees')).body.employees ?? [])
  .find(e => e.id === annaId)
check('Und die festen freien Tage stehen an den Stammdaten',
  Array.isArray(stammdaten?.fixedOffDays),
  JSON.stringify(stammdaten?.fixedOffDays ?? null))

// ── Aufräumen ─────────────────────────────────────────────────────────────
await sende(leitung, '/api/employee-planning-profile', 'PUT', {
  employeeId: annaId, shiftPreference: 'keine',
})
await prisma.$disconnect()
void locationId

bilanz()
