// Nachweis §267: Was ein Diensttausch mit dem Dienstplan macht.
//
//     node pruefungen/t-diensttausch.mjs
//
// DIE MELDUNG
// „Ich glaube, es gibt einen Fehler, wenn man bei dem Dienst tauscht, dass die
//  dann auf einmal gar keinen Dienst mehr haben, obwohl da getauscht wurde
//  quasi und der Diensttausch nicht richtig vonstatten geht."
//
// WAS HIER GEMESSEN WIRD
// Der ganze Weg: anfragen, annehmen, nachzählen. Und zwar NACHZÄHLEN — nicht
// „die Schnittstelle sagt Erfolg". Genau dieser Unterschied ist in §254 und
// §264 teuer geworden.
//
// Nach einem Tausch müssen BEIDE Menschen weiterhin genau einen Dienst haben,
// nur eben den jeweils anderen. Ein Tausch, nach dem jemand keinen Dienst
// mehr hat, ist kein Tausch, sondern ein Verlust — und in einem Betrieb, der
// rund um die Uhr besetzt sein muss, eine unbesetzte Schicht.

import { pruefer, login, hole, sende } from './helfer.mjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const { check, bilanz } = pruefer()

const leitung = await login('leitung@rheinblick-reha.de')
const meLeitung = (await hole(leitung, '/api/auth/me')).body.user
const locationId = meLeitung.locationId

/*
 * Den Ausgangszustand selbst herstellen. Zwei Menschen, zwei Dienste an zwei
 * Tagen, weit in der Zukunft — damit diese Prüfung keiner anderen in die
 * Quere kommt und keine echten Daten anfasst.
 */
const leute = await prisma.employee.findMany({
  where: { locationId, role: 'employee', active: true },
  orderBy: { name: 'asc' },
  take: 2,
  select: { id: true, name: true, email: true },
})
if (leute.length < 2) throw new Error('Weniger als zwei Beschäftigte am Standort.')
const [a, b] = leute

const dienste = await prisma.shift.findMany({
  where: { locationId }, take: 2, select: { id: true, name: true },
})
if (dienste.length < 2) throw new Error('Weniger als zwei Dienstzeiten am Standort.')
const [d1, d2] = dienste

const TAG_A = '2027-03-15'
const TAG_B = '2027-03-16'

async function ausgangszustand() {
  await prisma.swapRequest.deleteMany({
    where: { OR: [{ requesterId: a.id }, { targetEmployeeId: a.id }], requesterDate: { in: [TAG_A, TAG_B] } },
  })
  await prisma.scheduleEntry.deleteMany({
    where: { date: { in: [TAG_A, TAG_B] }, employeeId: { in: [a.id, b.id] } },
  })
  await prisma.scheduleEntry.createMany({
    data: [
      { employeeId: a.id, shiftId: d1.id, date: TAG_A, locationId, status: 'published' },
      { employeeId: b.id, shiftId: d2.id, date: TAG_B, locationId, status: 'published' },
    ],
  })
}

const dienstVon = async (employeeId, datum) => prisma.scheduleEntry.findMany({
  where: { employeeId, date: datum },
  select: { id: true, shiftId: true, employeeId: true },
})

// ── Der gerade Weg ────────────────────────────────────────────────────────
console.log('=== §267 Ein Tausch, der durchgehen muss ===')

await ausgangszustand()
check('Vorher hat jede Person genau einen Dienst',
  (await dienstVon(a.id, TAG_A)).length === 1 && (await dienstVon(b.id, TAG_B)).length === 1)

const anfrage = await sende(leitung, '/api/swap-requests', 'POST', {
  requesterId: a.id, requesterName: a.name, requesterDate: TAG_A, requesterShiftId: d1.id,
  targetEmployeeId: b.id, targetEmployeeName: b.name, targetDate: TAG_B, targetShiftId: d2.id,
  message: 'Nachweis §267', locationId,
})
check('Die Anfrage wird angelegt', anfrage.status === 200 && Boolean(anfrage.body.request?.id),
  `HTTP ${anfrage.status}`)

const id = anfrage.body.request?.id
const antwort = await sende(leitung, `/api/swap-requests/${id}`, 'PATCH', { status: 'accepted' })
check('Und angenommen', antwort.status === 200, `HTTP ${antwort.status}`)

const aNachher = await dienstVon(a.id, TAG_B)
const bNachher = await dienstVon(b.id, TAG_A)
const aAlt = await dienstVon(a.id, TAG_A)
const bAlt = await dienstVon(b.id, TAG_B)

check('Die eine Person hat jetzt den Dienst der anderen',
  aNachher.length === 1 && aNachher[0].shiftId === d2.id,
  `${aNachher.length} Einträge am ${TAG_B}`)
check('Und umgekehrt genauso',
  bNachher.length === 1 && bNachher[0].shiftId === d1.id,
  `${bNachher.length} Einträge am ${TAG_A}`)

/*
 * Der Kern der Meldung: Niemand steht hinterher ohne Dienst da. Ohne diese
 * beiden Zeilen wäre „getauscht" auch dann grün, wenn einer der Einträge
 * verschwunden wäre.
 */
check('Niemand hat seinen Dienst ersatzlos verloren',
  aNachher.length + aAlt.length === 1 && bNachher.length + bAlt.length === 1,
  `A: ${aAlt.length} am ${TAG_A} / ${aNachher.length} am ${TAG_B} · `
  + `B: ${bNachher.length} am ${TAG_A} / ${bAlt.length} am ${TAG_B}`)

const gesamt = await prisma.scheduleEntry.count({
  where: { date: { in: [TAG_A, TAG_B] }, employeeId: { in: [a.id, b.id] } },
})
check('Und es sind immer noch zwei Dienste insgesamt', gesamt === 2, `${gesamt}`)

// ── Der Fall, der still schiefgeht ────────────────────────────────────────
console.log('\n=== §267 Und wenn der Dienst gar nicht mehr da ist? ===')

/*
 * Zwei Anfragen auf denselben Dienst. Die erste geht durch — danach gehört
 * der Dienst jemand anderem. Was macht die zweite?
 *
 * Das ist kein erfundener Fall: Wer seinen Dienst loswerden will, fragt
 * mehrere Leute. Und es ist der einzige Weg, auf dem die Annahme auf einen
 * Eintrag trifft, den es so nicht mehr gibt.
 */
await ausgangszustand()

const zweiteAnfrage = await sende(leitung, '/api/swap-requests', 'POST', {
  requesterId: a.id, requesterName: a.name, requesterDate: TAG_A, requesterShiftId: d1.id,
  targetEmployeeId: b.id, targetEmployeeName: b.name, targetDate: TAG_B, targetShiftId: d2.id,
  message: 'Nachweis §267 zweite', locationId,
})
// Den Dienst der anfragenden Person aus dem Weg räumen — so, wie es ein
// erster, schon durchgeführter Tausch getan hätte.
await prisma.scheduleEntry.deleteMany({ where: { employeeId: a.id, date: TAG_A } })

const zweiteAntwort = await sende(leitung, `/api/swap-requests/${zweiteAnfrage.body.request.id}`,
  'PATCH', { status: 'accepted' })

const standDanach = await prisma.swapRequest.findUnique({
  where: { id: zweiteAnfrage.body.request.id }, select: { status: true },
})
const bNochDa = await dienstVon(b.id, TAG_B)

check('Der Dienst der anderen Person bleibt, wo er ist',
  bNochDa.length === 1 && bNochDa[0].employeeId === b.id,
  `${bNochDa.length} Einträge, gehört ${bNochDa[0]?.employeeId === b.id ? 'ihr' : 'jemand anderem'}`)

/*
 * Und die Aussage nach außen muss zur Wirklichkeit passen. Ein Tausch, der
 * als „bestätigt" dasteht, obwohl im Plan nichts passiert ist, ist genau das,
 * was gemeldet wurde: „der Diensttausch geht nicht richtig vonstatten".
 */
check('Ein Tausch, der nicht stattfinden konnte, steht NICHT als bestätigt da',
  standDanach?.status !== 'accepted',
  `HTTP ${zweiteAntwort.status}, Stand „${standDanach?.status}"`)

// ── Zwei Zusagen auf denselben Dienst ─────────────────────────────────────
console.log('\n=== §267 Zwei Zusagen auf denselben Dienst ===')

/*
 * Der Fall aus dem Betrieb: Wer kurzfristig ausfällt, fragt nicht eine
 * Person, sondern drei. Die erste Zusage führt den Tausch aus. Was die
 * zweite macht, entscheidet, ob am Ende jemand ohne Dienst dasteht.
 */
const dritte = await prisma.employee.findFirst({
  where: { locationId, role: 'employee', active: true, id: { notIn: [a.id, b.id] } },
  select: { id: true, name: true },
})
if (!dritte) throw new Error('Keine dritte Person am Standort.')

const TAG_C = '2027-03-17'

await prisma.scheduleEntry.deleteMany({
  where: { date: { in: [TAG_A, TAG_B, TAG_C] }, employeeId: { in: [a.id, b.id, dritte.id] } },
})
await prisma.scheduleEntry.createMany({
  data: [
    { employeeId: a.id, shiftId: d1.id, date: TAG_A, locationId, status: 'published' },
    { employeeId: b.id, shiftId: d2.id, date: TAG_B, locationId, status: 'published' },
    { employeeId: dritte.id, shiftId: d2.id, date: TAG_C, locationId, status: 'published' },
  ],
})

const anB = await sende(leitung, '/api/swap-requests', 'POST', {
  requesterId: a.id, requesterName: a.name, requesterDate: TAG_A, requesterShiftId: d1.id,
  targetEmployeeId: b.id, targetEmployeeName: b.name, targetDate: TAG_B, targetShiftId: d2.id,
  message: 'an B', locationId,
})
const anC = await sende(leitung, '/api/swap-requests', 'POST', {
  requesterId: a.id, requesterName: a.name, requesterDate: TAG_A, requesterShiftId: d1.id,
  targetEmployeeId: dritte.id, targetEmployeeName: dritte.name, targetDate: TAG_C, targetShiftId: d2.id,
  message: 'an C', locationId,
})
check('Beide Anfragen stehen', Boolean(anB.body.request?.id && anC.body.request?.id))

const ersteZusage = await sende(leitung, `/api/swap-requests/${anB.body.request.id}`,
  'PATCH', { status: 'accepted' })
check('Die erste Zusage geht durch', ersteZusage.status === 200, `HTTP ${ersteZusage.status}`)

const zweiteZusage = await sende(leitung, `/api/swap-requests/${anC.body.request.id}`,
  'PATCH', { status: 'accepted' })
check('Die zweite wird abgelehnt, statt still nichts zu tun',
  zweiteZusage.status === 409, `HTTP ${zweiteZusage.status} ${zweiteZusage.body.error ?? ''}`)

/*
 * Und das Entscheidende: Am Ende hat jede der drei Personen genau einen
 * Dienst. Die Meldung lautete „dass die dann auf einmal gar keinen Dienst
 * mehr haben" — das muss hier auffallen, wenn es passiert.
 */
for (const [wer, name] of [[a, a.name], [b, b.name], [dritte, dritte.name]]) {
  const zahl = await prisma.scheduleEntry.count({
    where: { employeeId: wer.id, date: { in: [TAG_A, TAG_B, TAG_C] } },
  })
  check(`${name} hat weiterhin genau einen Dienst`, zahl === 1, `${zahl}`)
}

const gesamtDrei = await prisma.scheduleEntry.count({
  where: { date: { in: [TAG_A, TAG_B, TAG_C] }, employeeId: { in: [a.id, b.id, dritte.id] } },
})
check('Und es sind immer noch drei Dienste insgesamt', gesamtDrei === 3, `${gesamtDrei}`)

// ── Aufräumen ─────────────────────────────────────────────────────────────
await prisma.swapRequest.deleteMany({
  where: { requesterId: a.id, requesterDate: { in: [TAG_A, TAG_B] } },
})
await prisma.scheduleEntry.deleteMany({
  where: { date: { in: [TAG_A, TAG_B, TAG_C] } },
})

const fails = bilanz()
await prisma.$disconnect()
process.exit(fails > 0 ? 1 : 0)
