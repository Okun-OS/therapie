// Nachweis §247: Stimmt die Zahl im Stundenkonto — und wird nichts doppelt gezählt?
//
//     node pruefungen/r-stundenkonto.mjs
//
// DIE FRAGE
// „Jetzt steht da wieder eine ganz andere Zahl bei dem Stundenkonto. Kannst du
// prüfen, ob da jetzt die richtige geprüfte Zahl steht und nicht irgendwie
// alles irgendwie berücksichtigt."
//
// Die Frage ist berechtigt: §247 hat die Zahl von „freigegebene Monate" auf
// „freigegeben plus alles Offene" umgestellt. Dabei kann man genau zwei Fehler
// machen — etwas vergessen oder etwas zweimal zählen.
//
// WAS DIESE PRÜFUNG MISST
// Nicht, ob die Zahl „plausibel aussieht". Sie stellt einen Zustand her, den
// sie selbst kennt, und rechnet die erwartete Zahl aus denselben Bausteinen
// nach, die auch die Zeiterfassung anzeigt:
//
//     Stundenkonto  =  abgerechnet  +  Σ (Ist + Überstunden − Soll)
//                                      über alle NICHT freigegebenen Monate
//
// Die Summanden holt sie aus `/api/hours-account` — also genau aus der Quelle,
// die auf der Zeiterfassungsseite steht. Damit prüft sie, was gemeldet wurde:
// dass die Kachel und die Aufstellung dieselbe Welt beschreiben.
//
// DREI GEGENPROBEN, OHNE DIE SIE NICHTS WERT WÄRE
//   1. Der abgerechnete Stand muss sich auswirken — sonst wäre „stimmt
//      überein" auch dann grün, wenn er gar nicht einginge.
//   2. Ein freigegebener Monat darf NICHT zusätzlich gezählt werden. Das ist
//      der Doppelzähl-Fehler, nach dem gefragt wurde.
//   3. Ein Monat ohne Abschluss MUSS gezählt werden — sonst wäre „nichts
//      doppelt" trivial dadurch zu erfüllen, dass nichts gezählt wird.

import { pruefer, login, hole } from './helfer.mjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const { check, bilanz } = pruefer()

const anna = await login('anna.fischer@rheinblick-reha.de')
const me = (await hole(anna, '/api/auth/me')).body.user
const annaId = me.employeeId

const jetzt = new Date()
const JAHR = jetzt.getFullYear()
const MONAT = jetzt.getMonth() + 1

// ── Der Ausgangszustand, den diese Prüfung selbst herstellt ───────────────
const vorher = await prisma.employee.findUnique({
  where: { id: annaId }, select: { hoursBalance: true },
})
const abschluesseVorher = await prisma.monthlyClosing.findMany({
  where: { employeeId: annaId },
  select: { id: true, releasedAt: true, releasedBy: true },
})

/*
 * Alle Abschlüsse auf „nicht freigegeben" — damit die laufende Rechnung einen
 * bekannten Ausgangspunkt hat und nicht an Altlasten dieser Datenbank hängt.
 */
await prisma.monthlyClosing.updateMany({
  where: { employeeId: annaId }, data: { releasedAt: null, releasedBy: null },
})
const ABGERECHNET_STUNDEN = 12.5
await prisma.employee.update({
  where: { id: annaId }, data: { hoursBalance: ABGERECHNET_STUNDEN },
})

/** Die Summanden eines Monats — aus derselben Quelle wie die Zeiterfassung. */
async function monat(jahr, m) {
  const r = await hole(anna, `/api/hours-account?employeeId=${annaId}&year=${jahr}&month=${m}`)
  const s = r.body.summary
  return s ? { soll: s.sollMinutes, ist: s.istMinutes, extra: s.overtimeMinutes } : null
}

async function konto() {
  const r = await hole(anna, '/api/hours-account/laufend')
  return r.body.konto
}

// ── §247 Die Zahl setzt sich aus dem zusammen, was dasteht ────────────────
console.log('=== §247 Woraus die Zahl entsteht ===')

const k1 = await konto()
check('Das laufende Konto antwortet', k1 != null, JSON.stringify(k1 ?? null))
check('Der abgerechnete Stand ist der aus den Stammdaten',
  k1?.freigegebenMinuten === Math.round(ABGERECHNET_STUNDEN * 60),
  `${k1?.freigegebenMinuten} Minuten, erwartet ${Math.round(ABGERECHNET_STUNDEN * 60)}`)

/*
 * Die Summe nachrechnen — über genau die Monate, die das Konto als offen
 * angibt. Die Monatsgrenzen werden NICHT nachgebaut: Sie stehen in der
 * Antwort, und eine Prüfung, die sie selbst herleitet, prüfte ihre eigene
 * Herleitung.
 */
/*
 * §250 Mitgerechnet werden nur Monate, in denen überhaupt gestempelt wurde.
 *
 * Die Prüfung hat das selbst aufgedeckt: Vorher summierte die Rechnung
 * achtzehn Monate zu rund −2700 Stunden auf, bei einem Menschen, der die
 * Stempeluhr nicht benutzt. Ein Monat ohne eine einzige Buchung sagt nicht
 * „es wurde nicht gearbeitet", sondern „es wurde nicht erfasst".
 *
 * Welche Monate das sind, fragt diese Prüfung an der Datenbank nach — sie
 * baut die Regel nicht aus der Antwort nach, die sie prüfen soll.
 */
const buchungsmonate = new Set(
  (await prisma.timeLog.findMany({ where: { employeeId: annaId }, select: { date: true } }))
    .map(b => b.date.slice(0, 7)))

let erwartetOffen = 0
const einzeln = []
let uebersprungen = 0
for (let j = k1.abJahr, m = k1.abMonat; j < JAHR || (j === JAHR && m <= MONAT);) {
  const schluessel = `${j}-${String(m).padStart(2, '0')}`
  if (!buchungsmonate.has(schluessel)) {
    uebersprungen += 1
  } else {
    const s = await monat(j, m)
    if (s) {
      const d = s.ist + s.extra - s.soll
      erwartetOffen += d
      if (d !== 0) einzeln.push(`${schluessel}: ${d}`)
    }
  }
  m += 1
  if (m > 12) { m = 1; j += 1 }
}

check('Monate ohne jede Buchung bleiben außen vor',
  k1.ohneErfassung === uebersprungen,
  `Konto meldet ${k1.ohneErfassung}, nachgezählt ${uebersprungen}`)

check('Das Offene ist genau die Summe der Monatsdifferenzen',
  k1.offenMinuten === erwartetOffen,
  `Konto ${k1.offenMinuten} · nachgerechnet ${erwartetOffen} Minuten`
  + (einzeln.length ? `\n           ${einzeln.join(' · ')}` : ''))

check('Und die Gesamtzahl ist die Summe aus beidem',
  k1.gesamtMinuten === k1.freigegebenMinuten + k1.offenMinuten,
  `${k1.freigegebenMinuten} + ${k1.offenMinuten} = ${k1.gesamtMinuten}`)

// ── §247 Gegenprobe 1: der abgerechnete Stand wirkt sich aus ──────────────
console.log('\n=== §247 Gegenprobe — der abgerechnete Stand geht ein ===')

await prisma.employee.update({ where: { id: annaId }, data: { hoursBalance: -4 } })
const k2 = await konto()
check('Ein anderer abgerechneter Stand ändert die Zahl',
  k2.gesamtMinuten === k1.gesamtMinuten - Math.round((ABGERECHNET_STUNDEN + 4) * 60),
  `vorher ${k1.gesamtMinuten}, jetzt ${k2.gesamtMinuten} Minuten`)
check('Und das Offene bleibt davon unberührt',
  k2.offenMinuten === k1.offenMinuten,
  `${k1.offenMinuten} → ${k2.offenMinuten}`)

// ── §247 Gegenprobe 2: ein freigegebener Monat zählt NICHT doppelt ────────
console.log('\n=== §247 Gegenprobe — wird etwas doppelt gezählt? ===')

/*
 * DER FALL, NACH DEM GEFRAGT WURDE.
 *
 * Ein freigegebener Abschluss steckt bereits im abgerechneten Stand. Würde
 * sein Monat zusätzlich als „offen" gerechnet, stünde er zweimal in der Zahl —
 * und genau das wäre „irgendwie alles irgendwie berücksichtigt".
 */
const diesenMonat = await monat(JAHR, MONAT)
const deltaDiesenMonat = diesenMonat
  ? diesenMonat.ist + diesenMonat.extra - diesenMonat.soll : 0

const abschluss = await prisma.monthlyClosing.upsert({
  where: { employeeId_year_month: { employeeId: annaId, year: JAHR, month: MONAT } },
  create: {
    employeeId: annaId, employeeName: me.name, locationId: me.locationId ?? '',
    year: JAHR, month: MONAT, status: 'freigegeben', arbeitstage: 0,
    sollMinutes: 0, istMinutes: 0, breakMinutes: 0, overtimeMinutes: 0,
    undertimeMinutes: 0, vacationDays: 0, sickDays: 0, otherAbsenceDays: 0,
    approvalsCount: 0, releasedBy: 'Nachweis §247',
    releasedAt: new Date().toISOString(),
  },
  update: { releasedBy: 'Nachweis §247', releasedAt: new Date().toISOString() },
})

const k3 = await konto()
/*
 * §250 Hier stand zuerst die Erwartung, der Betrag dieses EINEN Monats falle
 * weg. Das war falsch gedacht — und der Fehlschlag hat etwas Richtiges
 * aufgedeckt:
 *
 * Vorher begann die Rechnung „nach dem letzten freigegebenen Abschluss". Wird
 * der Oktober freigegeben, der August aber nicht, fing sie im November an —
 * und der offene August fiel heraus, ohne dass irgendwo etwas fehlte.
 * Abschlüsse werden nicht zwingend der Reihe nach freigegeben.
 *
 * Jetzt wird ein fester Zeitraum durchgegangen und darin jeder freigegebene
 * Monat übersprungen. Geprüft wird deshalb genau das: Es fällt der Betrag
 * dieses Monats weg — und sonst nichts.
 */
check('Ein freigegebener Monat wird nicht mehr als offen gezählt',
  k3.offenMinuten === k2.offenMinuten - deltaDiesenMonat,
  `offen ${k2.offenMinuten} → ${k3.offenMinuten}, `
  + `dieser Monat war ${deltaDiesenMonat} Minuten`)
check('Er taucht auch nicht mehr in der Aufstellung auf',
  !(k3.monate ?? []).some(m => m.jahr === JAHR && m.monat === MONAT),
  JSON.stringify(k3.monate ?? []))

// ── §247 Gegenprobe 3: ein offener Monat MUSS gezählt werden ──────────────
console.log('\n=== §247 Gegenprobe — ein offener Monat zählt sehr wohl ===')

await prisma.monthlyClosing.update({
  where: { id: abschluss.id }, data: { releasedAt: null, releasedBy: null },
})
const k4 = await konto()
check('Nimmt man die Freigabe zurück, zählt der Monat wieder',
  k4.offenMinuten === k2.offenMinuten,
  `${k3.offenMinuten} → ${k4.offenMinuten}, erwartet ${k2.offenMinuten}`)
/*
 * Ohne diese Zeile wäre „nichts doppelt" trivial dadurch zu erfüllen, dass
 * gar nichts gezählt wird.
 */
check('Und es ist nicht einfach null',
  deltaDiesenMonat === 0 || k4.offenMinuten !== 0,
  `dieser Monat ${deltaDiesenMonat}, offen gesamt ${k4.offenMinuten} Minuten`)

// ── Aufräumen ─────────────────────────────────────────────────────────────
await prisma.monthlyClosing.deleteMany({
  where: { employeeId: annaId, releasedBy: 'Nachweis §247' },
})
for (const a of abschluesseVorher) {
  await prisma.monthlyClosing.update({
    where: { id: a.id },
    data: { releasedAt: a.releasedAt, releasedBy: a.releasedBy },
  }).catch(() => undefined)
}
await prisma.employee.update({
  where: { id: annaId }, data: { hoursBalance: vorher?.hoursBalance ?? 0 },
})
await prisma.$disconnect()

bilanz()
