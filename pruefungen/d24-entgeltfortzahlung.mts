// Nachweis §227: Eine Krankheitswoche wird bezahlt — auch bei Stundenlohn.
//
//     node pruefungen/d24-entgeltfortzahlung.mts
//
// DER BEFUND
// „Wenn jemand krank ist, muss er halt die Stunden bekommen, die er sonst auch
// bekommen hätte — bei einer 40-Stunden-Kraft für jeden kranken Tag trotzdem
// acht Stunden."
//
// Nachgemessen stimmte das für ein Monatsgehalt: Da rechnet die Abrechnung mit
// dem Gehalt, und eine Krankheit ändert daran nichts. Bei STUNDENLOHN kam
// `regularPay = stundenlohn × Stunden` heraus, und `regularHours` stand allein
// aus der gestempelten Zeit. Eine Woche Krankheit war damit eine Woche ohne
// Geld — kein Rundungsfehler, sondern ein Verstoß gegen §3 EntgFG.
//
// WAS DIESE PRÜFUNG MISST
// Den Betrag. Sie setzt einen Stundenlöhner auf eine Woche Krankheit ohne jede
// gestempelte Minute und rechnet nach, dass die Abrechnung 40 Stunden zu 20 €
// ergibt. Mit zwei Gegenproben: Ohne Krankmeldung muss dasselbe Monat null
// ergeben, und ein Tag, an dem GESTEMPELT wurde, darf nicht doppelt zählen.

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'

const checks: [string, boolean][] = []
function check(label: string, ok: boolean, extra = '') {
  checks.push([label, ok])
  console.log(`  ${ok ? '✓ PASS' : '✗ FAIL'}  ${label}${extra ? `\n           ${extra}` : ''}`)
}

async function login(email: string, passwort = 'Test1234!') {
  const r = await fetch(`${BASIS}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: passwort }),
  })
  if (!r.ok) throw new Error(`Login ${email}: HTTP ${r.status}`)
  return r.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')
}

const jetzt = new Date()
const jahr = jetzt.getFullYear()
const monat = jetzt.getMonth() + 1
const mm = String(monat).padStart(2, '0')
const tag = (t: number) => `${jahr}-${mm}-${String(t).padStart(2, '0')}`

const kunde = await prisma.customer.findFirst({ where: { name: { contains: 'Reha' } } })
if (!kunde) throw new Error('Testkunde fehlt — bitte npm run seed')

/*
 * Eine eigene Kraft für diese Prüfung, kein geteilter Mitarbeiter.
 *
 * 40 Stunden auf fünf Tage ist der Fall aus der Meldung: acht Stunden je
 * Krankheitstag. Und sie gehört niemandem sonst — eine Prüfung, die den
 * Mitarbeiter einer anderen Prüfung umstellt, macht beide unzuverlässig.
 */
const standort = await prisma.location.findFirst({ where: { customerId: kunde.id } })
const EMAIL = 'entgeltfortzahlung.nachweis@rheinblick-reha.de'
const kraft = await prisma.employee.upsert({
  where: { email: EMAIL },
  create: {
    customerId: kunde.id, locationId: standort?.id, name: 'Fortzahlung Nachweis',
    email: EMAIL, role: 'employee', position: 'Pflegekraft',
    weeklyHours: 40, workDaysPerWeek: 5, fixedOffDays: [],
    joinedAt: `${jahr - 1}-01-01`, active: true,
  },
  update: { weeklyHours: 40, workDaysPerWeek: 5, fixedOffDays: [], active: true },
})

const STUNDENLOHN = 20
await prisma.employeePayrollProfile.upsert({
  where: { employeeId: kraft.id },
  create: {
    employeeId: kraft.id, customerId: kunde.id,
    personalnummer: '9227', steuerklasse: 1, kinderfreibetraege: 0, konfession: 'keine',
    bundesland: 'Nordrhein-Westfalen', versicherungsart: 'GKV', zusatzbeitrag: 1.7,
    lohnart: 'stunde', stundenlohn: STUNDENLOHN,
    iban: 'DE02120300000000202051', kontoinhaber: kraft.name,
  },
  update: { lohnart: 'stunde', stundenlohn: STUNDENLOHN, steuerklasse: 1 },
})

/** Der erste Montag im Monat, damit die Krankwoche in diesen Monat fällt. */
function ersterMontag(): number {
  for (let t = 1; t <= 7; t++) {
    if (new Date(Date.UTC(jahr, monat - 1, t)).getUTCDay() === 1) return t
  }
  throw new Error('kein Montag gefunden')
}
const mo = ersterMontag()
const krankVon = tag(mo), krankBis = tag(mo + 4)

console.log(`Abrechnungszeitraum ${mm}.${jahr} · ${kraft.name} · `
  + `${kraft.weeklyHours} Std. auf ${kraft.workDaysPerWeek} Tage · ${STUNDENLOHN} €/Std.`)
console.log(`Krankwoche ${krankVon} bis ${krankBis}\n`)

const gf = await login('gf@rheinblick-reha.de')

/** Ausgangszustand herstellen und die Abrechnung des Monats neu rechnen. */
async function rechnen(): Promise<{
  brutto: number; regularHours: number; ausfallHours: number; sickDays: number
} | null> {
  await prisma.payrollEntry.updateMany({
    where: { employeeId: kraft.id, year: jahr, status: { not: 'draft' } },
    data: { status: 'draft', approvedBy: null, approvedAt: null },
  })
  const abschluss = await fetch(`${BASIS}/api/monthly-closings/get-or-create`, {
    method: 'POST', headers: { cookie: gf, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      employeeId: kraft.id, year: jahr, month: monat,
      employeeInfo: { employeeName: kraft.name },
    }),
  })
  const daten = await abschluss.json()
  if (daten.closing?.id && daten.closing.status !== 'freigegeben') {
    await fetch(`${BASIS}/api/time-tracking/release-closing`, {
      method: 'POST', headers: { cookie: gf, 'Content-Type': 'application/json' },
      body: JSON.stringify({ closingId: daten.closing.id, releasedBy: 'Prüfung' }),
    })
  }
  await fetch(`${BASIS}/api/payroll/vorbereiten`, {
    method: 'POST', headers: { cookie: gf, 'Content-Type': 'application/json' },
    body: JSON.stringify({ year: jahr, month: monat }),
  })
  const eintrag = await prisma.payrollEntry.findFirst({
    where: { employeeId: kraft.id, year: jahr, month: monat },
  })
  return eintrag
    ? {
        brutto: eintrag.brutto,
        regularHours: eintrag.regularHours,
        ausfallHours: eintrag.ausfallHours,
        sickDays: eintrag.sickDays,
      }
    : null
}

// ── Gegenprobe: ohne Krankmeldung und ohne Zeiten ist nichts zu zahlen ────
console.log('=== §227 Gegenprobe: ohne Krankmeldung ===')

await prisma.absence.deleteMany({ where: { employeeId: kraft.id } })
await prisma.timeLog.deleteMany({ where: { employeeId: kraft.id } })

const leer = await rechnen()
check('Die Abrechnung entsteht', !!leer, leer ? `Brutto ${leer.brutto} €` : 'keine Abrechnung')
check('Ohne gestempelte Zeit und ohne Krankheit ist das Brutto null',
  leer?.brutto === 0 && leer?.regularHours === 0,
  `${leer?.regularHours} Std., ${leer?.brutto} €`)

// ── Die Krankwoche ────────────────────────────────────────────────────────
console.log('\n=== §227 Eine Woche krank, keine Minute gestempelt ===')

await prisma.absence.create({
  data: {
    employeeId: kraft.id, employeeName: kraft.name, locationId: standort!.id,
    type: 'krankheit', startDate: krankVon, endDate: krankBis, days: 5,
    submittedAt: new Date().toISOString(), proofProvided: false,
  },
})

const krank = await rechnen()
check('Die Woche zählt fünf Krankheitstage', krank?.sickDays === 5, `${krank?.sickDays} Tage`)
check('Vierzig Stunden sind fortgezahlt', krank?.ausfallHours === 40,
  `${krank?.ausfallHours} Std.`)
check('Sie stehen in den abgerechneten Stunden', krank?.regularHours === 40,
  `${krank?.regularHours} Std.`)
/*
 * Der Kern: 40 Stunden × 20 € = 800 €. Vorher stand hier null.
 *
 * Gemessen wird der Betrag und nicht nur die Stundenzahl — an der Stundenzahl
 * allein hätte sich nicht gezeigt, ob sie bis in die Bezahlung durchkommt.
 */
check('Und das Brutto ist 800 €, nicht null', krank?.brutto === 800,
  `${krank?.brutto} € (40 Std. × ${STUNDENLOHN} €)`)

// ── Gegenprobe: ein gestempelter Tag zählt nicht doppelt ──────────────────
console.log('\n=== §227 Gegenprobe: gestempelte Zeit schlägt die Gutschrift ===')

/*
 * Wer sich für den Nachmittag krankmeldet, hat am selben Tag gestempelt. Würde
 * der Tag zusätzlich voll gutgeschrieben, bekäme er ihn doppelt bezahlt.
 */
await prisma.timeLog.create({
  data: {
    employeeId: kraft.id, locationId: standort!.id, date: krankVon,
    clockIn: '08:00', clockOut: '12:00', totalMinutes: 240, breakMinutes: 0,
  },
})

const gemischt = await rechnen()
check('Der gestempelte Tag wird nicht zusätzlich gutgeschrieben',
  gemischt?.ausfallHours === 32, `${gemischt?.ausfallHours} Std. fortgezahlt (vier Tage × 8)`)
check('Gezahlt werden die vier gestempelten plus 32 fortgezahlte Stunden',
  gemischt?.regularHours === 36, `${gemischt?.regularHours} Std.`)
check('Also 720 € — und nicht 800 für einen Tag, der halb gearbeitet wurde',
  gemischt?.brutto === 720, `${gemischt?.brutto} €`)

// ── Aufräumen ─────────────────────────────────────────────────────────────
await prisma.absence.deleteMany({ where: { employeeId: kraft.id } })
await prisma.timeLog.deleteMany({ where: { employeeId: kraft.id } })

const bestanden = checks.filter(([, ok]) => ok).length
console.log(`\n${bestanden}/${checks.length} Checks bestanden`)
await prisma.$disconnect()
process.exit(bestanden === checks.length ? 0 : 1)
