// Nachweis §268: Eine gespeicherte Woche überlebt die Planung der nächsten.
//
//     node pruefungen/u-plan-bleibt-bestehen.mjs
//
// DIE SORGE
// „Nee, ich finde das grundsätzlich falsch, dass der alte gelöscht wird und
//  der neue erzeugt wird, weil so ist ja gar nicht diese Fairness-Lösung
//  möglich. … Dafür müsste man dann den Plan speichern über die letzten
//  Wochen, um dann einfach, wenn ich jetzt die Woche vom 1. zum 7. mache,
//  kann ich ja dann, und danach die Woche vom 8. bis zum …, dass die andere
//  Woche trotzdem noch bestehen bleibt."
//
// WAS DARAN ZUTRIFFT UND WAS NICHT
// Beim Speichern wird gelöscht — aber NUR in den Tagen, die gerade gespeichert
// werden. Wer die Woche vom 8. plant, fasst die Woche vom 1. nicht an. Die
// Vorgeschichte, aus der die Fairness rechnet, bleibt also stehen.
//
// Was zutrifft: Wer DIESELBE Woche neu erzeugt und speichert, ersetzt sie
// vollständig — samt aller Tausche, die darin inzwischen vereinbart wurden.
//
// Beides steht hier als Nachweis, weil beides wichtig ist und weil eine
// Zusage ohne Nachweis in diesem Vorhaben schon zu oft falsch war. Die zweite
// Prüfung ist die Gegenprobe zur ersten: Ohne sie wäre „die andere Woche
// bleibt" auch dann grün, wenn überhaupt nie etwas gelöscht würde.

import { pruefer, login, hole, sende } from './helfer.mjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const { check, bilanz } = pruefer()

const leitung = await login('leitung@rheinblick-reha.de')
const me = (await hole(leitung, '/api/auth/me')).body.user
const locationId = me.locationId

const leute = await prisma.employee.findMany({
  where: { locationId, role: 'employee', active: true },
  orderBy: { name: 'asc' }, take: 2, select: { id: true, name: true },
})
const dienste = await prisma.shift.findMany({
  where: { locationId }, take: 1, select: { id: true, name: true },
})
if (leute.length < 2 || dienste.length < 1) throw new Error('Zu wenig Stammdaten am Standort.')
const [p1, p2] = leute
const dienst = dienste[0]

// Zwei Wochen weit in der Zukunft — diese Prüfung fasst nichts Echtes an.
const WOCHE_1 = ['2027-04-05', '2027-04-06', '2027-04-07', '2027-04-08', '2027-04-09']
const WOCHE_2 = ['2027-04-12', '2027-04-13', '2027-04-14', '2027-04-15', '2027-04-16']
const ALLE = [...WOCHE_1, ...WOCHE_2]

await prisma.scheduleEntry.deleteMany({ where: { locationId, date: { in: ALLE } } })

const speichern = (wochentage, zuordnung) => sende(leitung, '/api/schedule-entries/save-week',
  'POST', { locationId, weekDates: wochentage, assignments: zuordnung, status: 'confirmed' })

const zaehlen = (tage) => prisma.scheduleEntry.count({ where: { locationId, date: { in: tage } } })

// ── Die erste Woche ───────────────────────────────────────────────────────
console.log('=== §268 Die Woche vom 5. April ===')

const ersteSpeicherung = await speichern(WOCHE_1, {
  [p1.id]: Object.fromEntries(WOCHE_1.slice(0, 3).map(t => [t, { shiftId: dienst.id }])),
})
check('Die erste Woche lässt sich speichern', ersteSpeicherung.status === 200,
  `HTTP ${ersteSpeicherung.status}`)
check('Und steht danach im Plan', await zaehlen(WOCHE_1) === 3, `${await zaehlen(WOCHE_1)} Dienste`)

// ── Die zweite Woche ──────────────────────────────────────────────────────
console.log('\n=== §268 Und jetzt die Woche vom 12. April ===')

const zweiteSpeicherung = await speichern(WOCHE_2, {
  [p2.id]: Object.fromEntries(WOCHE_2.slice(0, 2).map(t => [t, { shiftId: dienst.id }])),
})
check('Die zweite Woche lässt sich speichern', zweiteSpeicherung.status === 200,
  `HTTP ${zweiteSpeicherung.status}`)

/*
 * Der Kern der Sorge. Ohne diese Zeile bliebe sie eine Behauptung.
 */
const ersteDanach = await zaehlen(WOCHE_1)
check('Die erste Woche steht UNVERÄNDERT weiter da', ersteDanach === 3,
  `${ersteDanach} Dienste (erwartet 3)`)

const wemGehoert = await prisma.scheduleEntry.findMany({
  where: { locationId, date: { in: WOCHE_1 } }, select: { employeeId: true },
})
check('Und sie gehört weiterhin derselben Person',
  wemGehoert.every(e => e.employeeId === p1.id), p1.name)

check('Die zweite Woche steht ebenfalls', await zaehlen(WOCHE_2) === 2,
  `${await zaehlen(WOCHE_2)} Dienste`)

// ── Die Gegenprobe ────────────────────────────────────────────────────────
console.log('\n=== §268 Dieselbe Woche neu erzeugt: dann wird ersetzt ===')

/*
 * Die Gegenprobe. Würde beim Speichern NIE etwas gelöscht, wären die
 * Prüfungen oben auch grün — und eine Neuplanung würde Dienste verdoppeln
 * statt sie zu ersetzen. Das wäre schlimmer als das, worüber wir reden.
 */
const nochmal = await speichern(WOCHE_1, {
  [p2.id]: { [WOCHE_1[0]]: { shiftId: dienst.id } },
})
check('Dieselbe Woche lässt sich neu speichern', nochmal.status === 200, `HTTP ${nochmal.status}`)

const nachNeuplanung = await prisma.scheduleEntry.findMany({
  where: { locationId, date: { in: WOCHE_1 } }, select: { employeeId: true, date: true },
})
check('Sie ist jetzt ERSETZT, nicht ergänzt', nachNeuplanung.length === 1,
  `${nachNeuplanung.length} Dienste (erwartet 1)`)
check('Und zwar durch die neue Zuordnung',
  nachNeuplanung[0]?.employeeId === p2.id, p2.name)

/*
 * Und das ist genau der Punkt, über den zu reden ist: Was in dieser Woche
 * vereinbart war — ein Tausch zum Beispiel —, ist jetzt weg. Die Woche
 * daneben ist unberührt.
 */
check('Die Nachbarwoche bleibt auch davon unberührt', await zaehlen(WOCHE_2) === 2,
  `${await zaehlen(WOCHE_2)} Dienste`)

await prisma.scheduleEntry.deleteMany({ where: { locationId, date: { in: ALLE } } })

const fails = bilanz()
await prisma.$disconnect()
process.exit(fails > 0 ? 1 : 0)
