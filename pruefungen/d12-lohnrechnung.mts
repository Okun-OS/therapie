// Nachweis D1/D2: Lohnberechnung und Zuschlagsregeln gegen echte Zeiterfassung.
//
// Der Nachweis für Anna (Monatsgehalt) sagt nichts über Stundenlöhner mit
// Nacht- und Sonntagsdiensten aus — genau dort entscheidet sich, ob die
// Abrechnung stimmt. Deshalb werden hier Zeiten gesetzt und nachgerechnet.
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

// Einen Stundenlöhner suchen, der nicht Anna ist
const kunde = await prisma.customer.findFirst({ where: { name: { contains: 'Reha' } } })
if (!kunde) throw new Error('Testkunde fehlt — bitte npm run seed')
const mitarbeiter = await prisma.employee.findFirst({
  where: { customerId: kunde.id, active: true, NOT: { email: 'anna.fischer@rheinblick-reha.de' } },
  orderBy: { name: 'asc' },
})
if (!mitarbeiter) throw new Error('Kein zweiter Mitarbeiter gefunden')

console.log(`Abrechnungszeitraum ${mm}.${jahr} · Mitarbeiter ${mitarbeiter.name}\n`)

const STUNDENLOHN = 20
await prisma.employeePayrollProfile.upsert({
  where: { employeeId: mitarbeiter.id },
  create: {
    employeeId: mitarbeiter.id, customerId: kunde.id,
    personalnummer: '2001', steuerklasse: 1, kinderfreibetraege: 0, konfession: 'keine',
    bundesland: 'Nordrhein-Westfalen', versicherungsart: 'GKV', zusatzbeitrag: 1.7,
    lohnart: 'stunde', stundenlohn: STUNDENLOHN,
    iban: 'DE02120300000000202051', kontoinhaber: mitarbeiter.name,
  },
  update: {
    lohnart: 'stunde', stundenlohn: STUNDENLOHN, steuerklasse: 1, kinderfreibetraege: 0,
    konfession: 'keine', bundesland: 'Nordrhein-Westfalen',
    versicherungsart: 'GKV', zusatzbeitrag: 1.7, personalnummer: '2001',
    iban: 'DE02120300000000202051', kontoinhaber: mitarbeiter.name,
  },
})

// Drei aussagekräftige Tage: ein Frühdienst, ein Nachtdienst, ein Sonntag
function tagImMonat(wunschWochentag: number): string {
  for (let t = 1; t <= 28; t++) {
    const d = new Date(Date.UTC(jahr, monat - 1, t))
    if (d.getUTCDay() === wunschWochentag) return `${jahr}-${mm}-${String(t).padStart(2, '0')}`
  }
  throw new Error('Wochentag nicht gefunden')
}
const montag = tagImMonat(1)
const dienstag = tagImMonat(2)
const sonntag = tagImMonat(0)

await prisma.timeLog.deleteMany({
  where: { employeeId: mitarbeiter.id, date: { in: [montag, dienstag, sonntag] } },
})
const zeiten = [
  { date: montag, clockIn: '08:00', clockOut: '16:00', totalMinutes: 480 },   // 8 h, kein Zuschlag
  { date: dienstag, clockIn: '22:00', clockOut: '06:00', totalMinutes: 480 }, // 8 h Nacht
  { date: sonntag, clockIn: '08:00', clockOut: '16:00', totalMinutes: 480 },  // 8 h Sonntag
]
for (const z of zeiten) {
  await prisma.timeLog.create({
    data: { ...z, employeeId: mitarbeiter.id, locationId: mitarbeiter.locationId!, breakMinutes: 0 },
  })
}

// §123 Ausgangszustand herstellen — sonst besteht die Prüfung nur einzeln.
// Hier über Prisma, weil dieses Skript ohnehin direkt an der Datenbank arbeitet.
await prisma.payrollCorrection.updateMany({
  where: { employeeId: mitarbeiter.id, status: 'offen' },
  data: { status: 'verworfen' },
})
await prisma.payrollEntry.updateMany({
  where: { employeeId: mitarbeiter.id, year: jahr, status: { not: 'draft' } },
  data: { status: 'draft', approvedBy: null, approvedAt: null },
})
await prisma.payrollBonus.deleteMany({
  where: { employeeId: mitarbeiter.id, jahr },
})

const gf = await login('gf@rheinblick-reha.de')
const vorbereitet = await fetch(`${BASIS}/api/payroll/vorbereiten`, {
  method: 'POST', headers: { cookie: gf, 'Content-Type': 'application/json' },
  body: JSON.stringify({ year: jahr, month: monat }),
})
check('Abrechnungslauf läuft durch', vorbereitet.status === 200,
  (await vorbereitet.json()).hinweis)

const a = await prisma.payrollEntry.findUnique({
  where: { employeeId_year_month: { employeeId: mitarbeiter.id, year: jahr, month: monat } },
})
if (!a) throw new Error('Keine Abrechnung angelegt')

console.log('\n=== D1 Lohnberechnung ===')
check('Die geleisteten Stunden stehen in der Abrechnung',
  Math.abs(a.regularHours + a.overtimeHours - 24) < 0.05,
  `${a.regularHours} regulär + ${a.overtimeHours} Überstunden`)

// §3b EStG: Nacht 25 % von 22–06 Uhr, Sonntag 50 %
const erwarteterNacht = 8 * STUNDENLOHN * 0.25   // 40,00
const erwarteterSonntag = 8 * STUNDENLOHN * 0.50 // 80,00
const erwarteteZuschlaege = erwarteterNacht + erwarteterSonntag
check('Nacht- und Sonntagszuschlag sind gerechnet',
  Math.abs(a.surchargesTotal - erwarteteZuschlaege) < 0.02,
  `${a.surchargesTotal.toFixed(2)} EUR (erwartet ${erwarteteZuschlaege.toFixed(2)})`)

const erwartetesBrutto = 24 * STUNDENLOHN + erwarteteZuschlaege
check('Das Brutto ist Stundenlohn mal Stunden plus Zuschläge',
  Math.abs(a.brutto - erwartetesBrutto) < 0.02,
  `${a.brutto.toFixed(2)} EUR (erwartet ${erwartetesBrutto.toFixed(2)})`)

console.log('\n=== D2 Steuerfreiheit der Zuschläge (§3b EStG) ===')
check('Nacht- und Sonntagszuschlag sind steuerfrei gestellt',
  Math.abs(a.steuerfreieZuschlaege - erwarteteZuschlaege) < 0.02,
  `${a.steuerfreieZuschlaege.toFixed(2)} EUR steuerfrei`)
check('Das steuerpflichtige Brutto ist um sie kleiner',
  Math.abs(a.steuerBrutto - (a.brutto - erwarteteZuschlaege)) < 0.02,
  `${a.steuerBrutto.toFixed(2)} EUR`)
check('Bei 20 EUR Grundlohn sind sie auch beitragsfrei',
  Math.abs(a.svBrutto - a.steuerBrutto) < 0.02, `${a.svBrutto.toFixed(2)} EUR`)

console.log('\n=== D2 Abzüge und Auszahlung ===')
check('Rentenversicherung sind 9,3 Prozent vom beitragspflichtigen Brutto',
  Math.abs(a.rvAN - a.svBrutto * 0.093) < 0.02, `${a.rvAN.toFixed(2)} EUR`)
check('Krankenversicherung nutzt den Zusatzbeitrag der Kasse (1,7 %)',
  Math.abs(a.kvAN - a.svBrutto * 0.0815) < 0.02, `${a.kvAN.toFixed(2)} EUR`)
check('Pflegeversicherung enthält den Zuschlag für Kinderlose',
  Math.abs(a.pvAN - a.svBrutto * 0.024) < 0.02, `${a.pvAN.toFixed(2)} EUR`)
check('Ohne Konfession fällt keine Kirchensteuer an', a.kirchensteuer === 0)
check('Die Abzüge sind die Summe ihrer Teile',
  Math.abs(a.totalDeductions - (a.rvAN + a.kvAN + a.pvAN + a.avAN + a.lohnsteuer + a.kirchensteuer + a.soli)) < 0.02)
check('Netto ist Brutto minus Abzüge',
  Math.abs(a.netto - (a.brutto - a.totalDeductions)) < 0.02, `${a.netto.toFixed(2)} EUR`)
check('Die Arbeitgeberkosten liegen über dem Brutto',
  a.totalAgCost > a.brutto, `${a.totalAgCost.toFixed(2)} EUR`)

console.log('\n=== Ein zweiter Lauf ändert nichts Freigegebenes ===')
await prisma.payrollEntry.update({ where: { id: a.id }, data: { status: 'approved' } })
await fetch(`${BASIS}/api/payroll/vorbereiten`, {
  method: 'POST', headers: { cookie: gf, 'Content-Type': 'application/json' },
  body: JSON.stringify({ year: jahr, month: monat }),
})
const danach = await prisma.payrollEntry.findUnique({ where: { id: a.id } })
check('Eine freigegebene Abrechnung wird nicht stillschweigend neu gerechnet',
  danach?.netto === a.netto && danach?.status === 'approved')
await prisma.payrollEntry.update({ where: { id: a.id }, data: { status: 'draft' } })

const fails = checks.filter(([, ok]) => !ok).length
console.log(`\n${checks.length - fails}/${checks.length} Checks bestanden`)
await prisma.$disconnect()
process.exit(fails ? 1 : 0)
