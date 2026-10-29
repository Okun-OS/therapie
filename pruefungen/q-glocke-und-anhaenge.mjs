// Nachweis §239–§242: Glocke mit Ziel, Anhänge, Krankenschein-Regel.
//
//     node pruefungen/q-glocke-und-anhaenge.mjs
//
// VIER MELDUNGEN, VIER ABSCHNITTE
//
//   §239  „Wenn man eine Benachrichtigung hat bei der Glocke, möchte ich, dass
//         man draufklickt und dahin geleitet wird, worum es geht."
//   §240  „Ich konnte eine Nachricht nicht löschen, weil da stand, dass es
//         schon gelesen wurde … obwohl das wurde noch gar nicht gelesen."
//   §241  „Man konnte Bilder und Dokumente zwar auswählen, aber man konnte es
//         nicht hochladen."
//   §242  „Dann wurde behauptet, dass Krankenschein erst am vierten Tag nötig
//         ist, obwohl das gar nicht stimmt."

import { pruefer, login, hole, sende } from './helfer.mjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const { check, bilanz } = pruefer()
const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'

const anna = await login('anna.fischer@rheinblick-reha.de')
const leitung = await login('leitung@rheinblick-reha.de')
const meAnna = (await hole(anna, '/api/auth/me')).body.user
const annaId = meAnna.employeeId

// ── §239 Die Glocke führt irgendwohin ─────────────────────────────────────
console.log('=== §239 Die Benachrichtigung trägt ihr Ziel ===')

/*
 * Der Ausgangszustand, den diese Prüfung selbst herstellt: eine
 * Benachrichtigung MIT Ziel und eine OHNE. Die zweite ist der Fall aller
 * Zeilen, die es heute schon gibt.
 */
await prisma.notification.deleteMany({ where: { employeeId: annaId, type: 'swap_request' } })
const mitZiel = await prisma.notification.create({
  data: {
    employeeId: annaId, type: 'swap_request',
    title: 'Nachweis §239 mit Ziel', body: 'Testeintrag',
    url: '/employee/schedule?tab=swaps',
  },
})
const ohneZiel = await prisma.notification.create({
  data: {
    employeeId: annaId, type: 'swap_request',
    title: 'Nachweis §239 ohne Ziel', body: 'Testeintrag',
  },
})

const liste = await hole(anna, '/api/notifications')
const geladen = (liste.body.notifications ?? [])
check('Die Glocke liefert Benachrichtigungen', liste.status === 200 && geladen.length > 0,
  `HTTP ${liste.status}, ${geladen.length} Einträge`)

const a = geladen.find(n => n.id === mitZiel.id)
const b = geladen.find(n => n.id === ohneZiel.id)
check('Das gespeicherte Ziel kommt mit', a?.url === '/employee/schedule?tab=swaps',
  JSON.stringify(a?.url ?? null))
check('Und die Art steht dabei — daraus wird das Ziel der alten Zeilen',
  b?.type === 'swap_request', JSON.stringify(b?.type ?? null))
/*
 * Die Gegenprobe zum Feld: Ohne sie wäre „das Ziel kommt mit" auch dann grün,
 * wenn die Schnittstelle ALLEN Einträgen dieselbe Adresse gäbe.
 */
check('Eine Benachrichtigung ohne Ziel hat auch keines', b?.url == null,
  JSON.stringify(b?.url ?? null))

// ── §240 Zugestellt ist nicht gelesen ─────────────────────────────────────
console.log('\n=== §240 Zugestellt ist nicht gelesen ===')

const raeume = (await hole(anna, '/api/chat')).body.raeume ?? []
const raum = raeume.find(r => r.art === 'direkt')
check('Ein Gespräch zu zweit ist da', Boolean(raum), `${raeume.length} Gespräche`)

if (raum) {
  // Der Ausgangszustand: Beide Lesestände zurück auf nichts.
  await prisma.chatMitglied.updateMany({
    where: { raumId: raum.id }, data: { gelesenBis: null, zugestelltBis: null },
  })

  const geschickt = await sende(anna, `/api/chat/${raum.id}`, 'POST', {
    text: `Nachweis §240 ${Date.now()}`,
  })
  check('Eine Nachricht lässt sich schicken',
    geschickt.status === 200 || geschickt.status === 201,
    geschickt.body.error ?? `HTTP ${geschickt.status}`)

  const neu = (await hole(anna, `/api/chat/${raum.id}`)).body.nachrichten ?? []
  const meine = neu[neu.length - 1]
  check('Sie steht erst auf „gesendet"', meine?.status === 'gesendet',
    JSON.stringify(meine?.status ?? null))
  check('Und lässt sich zurückziehen', meine?.zurueckziehbar === true,
    JSON.stringify(meine?.zurueckziehbar ?? null))

  /*
   * Jetzt der gemeldete Fall: Der andere BEKOMMT sie, sieht aber nicht hin.
   * Genau das hat der Zehn-Sekunden-Takt vorher als „gelesen" eingetragen.
   */
  const andere = await prisma.chatMitglied.findFirst({
    where: { raumId: raum.id, userId: { not: meAnna.id } },
  })
  await prisma.chatMitglied.update({
    where: { id: andere.id }, data: { zugestelltBis: new Date() },
  })

  const nachZustellung = (await hole(anna, `/api/chat/${raum.id}`)).body.nachrichten ?? []
  const m2 = nachZustellung.find(n => n.id === meine?.id)
  check('Zugestellt heißt zugestellt — zwei Haken', m2?.status === 'zugestellt',
    JSON.stringify(m2?.status ?? null))
  check('UND sie lässt sich weiterhin zurückziehen — der gemeldete Fall',
    m2?.zurueckziehbar === true, JSON.stringify(m2?.zurueckziehbar ?? null))

  /*
   * Die Gegenprobe: Wenn jemand WIRKLICH gelesen hat, muss die Sperre greifen.
   * Ohne sie wäre „lässt sich zurückziehen" auch dann grün, wenn §221 ganz
   * ausgefallen wäre.
   */
  await prisma.chatMitglied.update({
    where: { id: andere.id }, data: { gelesenBis: new Date() },
  })
  const nachLesen = (await hole(anna, `/api/chat/${raum.id}`)).body.nachrichten ?? []
  const m3 = nachLesen.find(n => n.id === meine?.id)
  check('Erst Lesen färbt die Haken', m3?.status === 'gelesen',
    JSON.stringify(m3?.status ?? null))
  check('Und erst dann ist Zurückziehen gesperrt', m3?.zurueckziehbar === false,
    JSON.stringify(m3?.zurueckziehbar ?? null))
}

// ── §241 Dateien ohne gemeldeten Typ ──────────────────────────────────────
console.log('\n=== §241 Eine Datei, für die der Browser keinen Typ meldet ===')

/** Eine echte PDF, so klein wie möglich. */
function pdfDatei(name) {
  const inhalt = new TextEncoder().encode('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n')
  // Genau der Fall vom Telefon: Der Browser meldet keinen Typ.
  return new File([inhalt], name, { type: '' })
}

if (raum) {
  const form = new FormData()
  form.append('datei', pdfDatei('Krankenschein.pdf'))
  const r = await fetch(`${BASIS}/api/chat/${raum.id}/datei`, {
    method: 'POST', headers: { Cookie: anna }, body: form,
  })
  const d = await r.json().catch(() => ({}))
  check('Ein Anhang ohne gemeldeten Typ geht durch', r.status === 200,
    d.error ?? `HTTP ${r.status}`)
  check('Und wird als PDF erkannt', d.nachricht?.datei?.mimeType === 'application/pdf',
    JSON.stringify(d.nachricht?.datei?.mimeType ?? null))
}

const formAkte = new FormData()
formAkte.append('datei', pdfDatei('Bescheinigung.pdf'))
formAkte.append('ownerType', 'employee')
formAkte.append('ownerId', annaId)
formAkte.append('kategorie', 'krankenschein')
const rAkte = await fetch(`${BASIS}/api/files`, {
  method: 'POST', headers: { Cookie: anna }, body: formAkte,
})
const dAkte = await rAkte.json().catch(() => ({}))
check('Eine Bescheinigung ohne gemeldeten Typ geht durch',
  rAkte.status === 200 || rAkte.status === 201, dAkte.error ?? `HTTP ${rAkte.status}`)

/*
 * Die Gegenprobe, ohne die der neue Weg eine Lücke wäre: Was NICHT ist, was es
 * vorgibt, muss abgewiesen werden — und zwar strenger als vorher, denn vorher
 * wurde dem gemeldeten Typ blind geglaubt.
 */
if (raum) {
  const inhalt = new TextEncoder().encode('%PDF-1.4\nich bin eine PDF\n')
  const form = new FormData()
  form.append('datei', new File([inhalt], 'harmlos.png', { type: 'image/png' }))
  const r = await fetch(`${BASIS}/api/chat/${raum.id}/datei`, {
    method: 'POST', headers: { Cookie: anna }, body: form,
  })
  check('Eine PDF, die sich „harmlos.png" nennt, wird abgewiesen', r.status === 400,
    `HTTP ${r.status}`)

  const exe = new FormData()
  exe.append('datei', new File([new Uint8Array([0x4d, 0x5a, 0x90, 0])], 'setup.exe', { type: '' }))
  const rExe = await fetch(`${BASIS}/api/chat/${raum.id}/datei`, {
    method: 'POST', headers: { Cookie: anna }, body: exe,
  })
  check('Und eine Art, die es nicht geben soll, auch', rExe.status === 400,
    `HTTP ${rExe.status}`)
}

// ── §242 Die betriebliche Regel zum Krankenschein ─────────────────────────
console.log('\n=== §242 Ab dem wievielten Tag eine Bescheinigung nötig ist ===')

const vorher = (await hole(leitung, '/api/org-settings')).body.settings?.auNachweisAbTag ?? null

check('Ein Mitarbeiter darf die Regel lesen',
  (await hole(anna, '/api/org-settings')).status === 200)

const gesetzt = await sende(leitung, '/api/org-settings', 'PATCH', { auNachweisAbTag: 1 })
check('Die Leitung darf sie setzen', gesetzt.status === 200,
  gesetzt.body.error ?? `HTTP ${gesetzt.status}`)

const gelesen = (await hole(anna, '/api/org-settings')).body.settings?.auNachweisAbTag
check('Und der Mitarbeiter liest genau das', gelesen === 1, `${gelesen}`)

/*
 * Die Sache selbst: Bei EINEM Tag Krankheit muss der Server jetzt eine
 * Bescheinigung verlangen. Vorher sagte er bis drei Tage „nicht nötig" — und
 * genau das war die falsche Auskunft.
 */
const jahr = new Date().getFullYear() + 4
await prisma.absence.deleteMany({
  where: { employeeId: annaId, startDate: { gte: `${jahr}-01-01` } },
})
const eintagig = await sende(anna, '/api/absences', 'POST', {
  employeeId: annaId, employeeName: meAnna.name, locationId: meAnna.locationId,
  type: 'krankheit', startDate: `${jahr}-03-02`, endDate: `${jahr}-03-02`,
  days: 1, reason: 'Nachweis §242',
})
check('Eine eintägige Krankmeldung lässt sich abgeben',
  eintagig.status === 200 || eintagig.status === 201,
  eintagig.body.error ?? `HTTP ${eintagig.status}`)

/*
 * Die Nachweislage holt die Seite getrennt — die Meldung selbst antwortet nur
 * mit der Fehlzeit. Beim ersten Versuch stand hier `eintagig.body.lage`, und
 * das war schlicht erfunden: Die Prüfung las `null` und meldete einen Fehler,
 * den es nicht gab. Jetzt wird derselbe Weg gegangen wie in der Oberfläche.
 */
const lage1 = await hole(anna, `/api/absences/${eintagig.body.absence?.id}/nachweise`)
check('Und sie ist nachweispflichtig — ab dem ersten Tag',
  lage1.body.lage?.pflicht?.pflichtig === true,
  JSON.stringify(lage1.body.lage?.pflicht ?? null))

/*
 * Die Gegenprobe: Mit der gesetzlichen Grenze ist dieselbe Meldung NICHT
 * pflichtig. Ohne sie wäre „pflichtig" auch dann grün, wenn die Einstellung
 * gar nicht gelesen würde und immer „ja" herauskäme.
 */
await sende(leitung, '/api/org-settings', 'PATCH', { auNachweisAbTag: 4 })
await prisma.absence.deleteMany({
  where: { employeeId: annaId, startDate: { gte: `${jahr}-01-01` } },
})
const mitVier = await sende(anna, '/api/absences', 'POST', {
  employeeId: annaId, employeeName: meAnna.name, locationId: meAnna.locationId,
  type: 'krankheit', startDate: `${jahr}-03-02`, endDate: `${jahr}-03-02`,
  days: 1, reason: 'Nachweis §242 Gegenprobe',
})
const lage2 = await hole(anna, `/api/absences/${mitVier.body.absence?.id}/nachweise`)
check('Mit der gesetzlichen Grenze ist dieselbe Meldung NICHT pflichtig',
  lage2.body.lage?.pflicht?.pflichtig === false,
  JSON.stringify(lage2.body.lage?.pflicht ?? null))

// ── Aufräumen ─────────────────────────────────────────────────────────────
await prisma.absence.deleteMany({
  where: { employeeId: annaId, startDate: { gte: `${jahr}-01-01` } },
})
await prisma.notification.deleteMany({
  where: { id: { in: [mitZiel.id, ohneZiel.id] } },
})
if (vorher !== null) {
  await sende(leitung, '/api/org-settings', 'PATCH', { auNachweisAbTag: vorher })
}
await prisma.$disconnect()

bilanz()
