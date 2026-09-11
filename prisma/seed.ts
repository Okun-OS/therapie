/**
 * §107 Testdaten für Entwicklung und Nachweis-Tests.
 *
 * Warum das hier liegt und nicht in einem Ablageordner: Die Testumgebung ging
 * schon zweimal verloren (Container-Neustart), und damit auch die Grundlage
 * jeder Prüfung. Ein Seed im Repository lässt sich in einer Minute wieder
 * herstellen.
 *
 * Aufbau — bewusst ZWEI Kunden, damit sich die Mandantentrennung überhaupt
 * prüfen lässt. Ein einzelner Kunde beweist gar nichts:
 *
 *   Reha-Zentrum Köln-Süd   Unternehmen + Leitung + 12 Mitarbeiter, 3 Dienste
 *   Kita Sonnenschein       Leitung + 8 Erzieher, 2 Etagen à 2 Gruppen
 *
 * Aufruf:  npm run seed
 * Das Skript ist wiederholbar — vorhandene Datensätze werden aktualisiert,
 * nicht verdoppelt.
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const PASSWORT = 'Test1234!'

async function main() {
  const hash = await bcrypt.hash(PASSWORT, 10)

  // ── Kunde 1: Reha-Zentrum ────────────────────────────────────────────────
  const reha = await prisma.customer.upsert({
    where: { id: 'seed-kunde-reha' },
    create: {
      id: 'seed-kunde-reha', name: 'Reha-Zentrum Köln GmbH',
      contactName: 'Geschäftsführung', contactEmail: 'kontakt@rheinblick-reha.de',
      status: 'active', plan: 'professional', seatsLicensed: 50,
      createdAt: '2024-01-01',
    },
    update: { name: 'Reha-Zentrum Köln GmbH' },
  })

  // ── Kunde 2: Kita (für die Mandantentrennung unverzichtbar) ─────────────
  const kitaKunde = await prisma.customer.upsert({
    where: { id: 'seed-kunde-kita' },
    create: {
      id: 'seed-kunde-kita', name: 'Kita Sonnenschein e.V.',
      contactName: 'Vorstand', contactEmail: 'kontakt@kita-sonnenschein.de',
      status: 'active', plan: 'starter', seatsLicensed: 20,
      createdAt: '2024-02-01',
    },
    update: { name: 'Kita Sonnenschein e.V.' },
  })

  // Zugänge zuerst: ein Standort verlangt eine verantwortliche Leitung (adminId).
  const zugaenge = [
    { email: 'gf@rheinblick-reha.de',        name: 'Geschäftsführung Reha', role: 'company', customerId: reha.id },
    { email: 'leitung@rheinblick-reha.de',   name: 'Leitung Reha',          role: 'admin',   customerId: reha.id },
    { email: 'leitung@kita-sonnenschein.de', name: 'Leitung Kita',          role: 'admin',   customerId: kitaKunde.id },
    // §127 Nur OKUN schaltet die Dienstplanung frei und ordnet Regelpakete zu.
    // Ohne diesen Zugang lässt sich das gar nicht nachweisen.
    { email: 'okun@okun.de',                 name: 'OKUN Plattform',        role: 'okun',    customerId: null },
  ]
  const nutzer: Record<string, string> = {}
  for (const z of zugaenge) {
    const u = await prisma.user.upsert({
      where: { email: z.email },
      create: { ...z, passwordHash: hash },
      update: { role: z.role, customerId: z.customerId, passwordHash: hash },
    })
    nutzer[z.email] = u.id
  }

  const rehaStandort = await prisma.location.upsert({
    where: { id: 'seed-standort-reha' },
    create: {
      id: 'seed-standort-reha', customerId: reha.id, name: 'Reha-Zentrum Köln-Süd',
      address: 'Bonner Straße 210', city: 'Köln', state: 'Nordrhein-Westfalen', zip: '50968',
      adminId: nutzer['leitung@rheinblick-reha.de'],
    },
    update: { name: 'Reha-Zentrum Köln-Süd', adminId: nutzer['leitung@rheinblick-reha.de'] },
  })

  const kitaStandort = await prisma.location.upsert({
    where: { id: 'seed-standort-kita' },
    create: {
      id: 'seed-standort-kita', customerId: kitaKunde.id, name: 'Kita Sonnenschein',
      address: 'Lindenweg 4', city: 'Köln', state: 'Nordrhein-Westfalen', zip: '50733',
      adminId: nutzer['leitung@kita-sonnenschein.de'],
    },
    update: { name: 'Kita Sonnenschein', adminId: nutzer['leitung@kita-sonnenschein.de'] },
  })

  // Standortzuordnung der Leitungen nachtragen
  await prisma.user.update({
    where: { email: 'leitung@rheinblick-reha.de' },
    data: { locationId: rehaStandort.id },
  })
  await prisma.user.update({
    where: { email: 'leitung@kita-sonnenschein.de' },
    data: { locationId: kitaStandort.id },
  })

  // ── Dienste ──────────────────────────────────────────────────────────────
  const dienste = [
    { id: 'seed-reha-frueh', locationId: rehaStandort.id, name: 'Frühdienst', type: 'early',    startTime: '06:00', endTime: '14:30', minStaff: 2, color: '#0B6E72', bgColor: '#DBF4F4' },
    { id: 'seed-reha-tag',   locationId: rehaStandort.id, name: 'Tagdienst',  type: 'mid',      startTime: '07:00', endTime: '15:30', minStaff: 4, color: '#8A5A08', bgColor: '#FCEFD6' },
    { id: 'seed-reha-spaet', locationId: rehaStandort.id, name: 'Spätdienst', type: 'late',     startTime: '08:30', endTime: '17:00', minStaff: 2, color: '#4B3B96', bgColor: '#E9E4FB' },
    { id: 'seed-kita-frueh', locationId: kitaStandort.id, name: 'Frühdienst', type: 'early',    startTime: '07:00', endTime: '15:30', minStaff: 1, color: '#0B6E72', bgColor: '#DBF4F4' },
    { id: 'seed-kita-spaet', locationId: kitaStandort.id, name: 'Spätdienst', type: 'late',     startTime: '08:30', endTime: '17:00', minStaff: 1, color: '#4B3B96', bgColor: '#E9E4FB' },
  ]
  for (const d of dienste) {
    await prisma.shift.upsert({ where: { id: d.id }, create: d, update: d })
  }

  // ── Struktur der Kita: zwei Etagen, je zwei Gruppen ─────────────────────
  const etagen = [
    { id: 'seed-etage-og', name: 'Obergeschoss', type: 'etage', parentId: null, minStaff: 1 },
    { id: 'seed-etage-eg', name: 'Erdgeschoss',  type: 'etage', parentId: null, minStaff: 1 },
  ]
  const gruppen = [
    { id: 'seed-gruppe-baeren',  name: 'Bärenbande',   type: 'gruppe', parentId: 'seed-etage-og', minStaff: 2 },
    { id: 'seed-gruppe-igel',    name: 'Igelgruppe',   type: 'gruppe', parentId: 'seed-etage-og', minStaff: 2 },
    { id: 'seed-gruppe-sonne',   name: 'Sonnenblumen', type: 'gruppe', parentId: 'seed-etage-eg', minStaff: 2 },
    { id: 'seed-gruppe-kruemel', name: 'Krümelzwerge', type: 'gruppe', parentId: 'seed-etage-eg', minStaff: 2 },
  ]
  for (const u of [...etagen, ...gruppen]) {
    await prisma.planningUnit.upsert({
      where: { id: u.id },
      create: { ...u, locationId: kitaStandort.id },
      update: { name: u.name, minStaff: u.minStaff, parentId: u.parentId },
    })
  }

  // ── Mitarbeiter ──────────────────────────────────────────────────────────
  const rehaNamen = [
    ['Maria Schneider', 40], ['Thomas Weber', 40], ['Anna Fischer', 35], ['Michael Braun', 40],
    ['Sabine Klein', 30], ['Jens Hoffmann', 40], ['Petra Wolf', 24], ['Daniel Krüger', 40],
    ['Nicole Schulz', 32], ['Markus Lange', 40], ['Julia Neumann', 35], ['Stefan Richter', 40],
  ] as const

  for (const [name, stunden] of rehaNamen) {
    const email = `${name.toLowerCase().replace(/ /g, '.').replace(/ü/g, 'ue').replace(/ö/g, 'oe').replace(/ä/g, 'ae')}@rheinblick-reha.de`
    await prisma.employee.upsert({
      where: { email },
      create: {
        customerId: reha.id, locationId: rehaStandort.id, name, email,
        role: 'employee', position: 'Pflegefachkraft', roleType: 'Pflegefachkraft',
        weeklyHours: stunden, workDaysPerWeek: stunden >= 35 ? 5 : 4,
        joinedAt: '2024-01-15', vacationDaysTotal: 30, active: true,
      },
      update: { weeklyHours: stunden, locationId: rehaStandort.id, active: true },
    })
  }

  const kitaNamen = [
    ['Susi Sonnenschein', 40, 'seed-gruppe-baeren'], ['Tim Wagner', 35, 'seed-gruppe-baeren'],
    ['Sophia Meyer', 40, 'seed-gruppe-igel'],        ['Steffanie Koch', 30, 'seed-gruppe-igel'],
    ['Christina Berg', 40, 'seed-gruppe-sonne'],     ['Felix Dorn', 32, 'seed-gruppe-sonne'],
    ['Corinna Lieb', 40, 'seed-gruppe-kruemel'],     ['Heike Stern', 24, 'seed-gruppe-kruemel'],
  ] as const

  for (const [name, stunden, gruppenId] of kitaNamen) {
    const email = `${name.toLowerCase().replace(/ /g, '.').replace(/ü/g, 'ue').replace(/ö/g, 'oe').replace(/ä/g, 'ae')}@kita-sonnenschein.de`
    const gruppe = gruppen.find(g => g.id === gruppenId)!
    await prisma.employee.upsert({
      where: { email },
      create: {
        customerId: kitaKunde.id, locationId: kitaStandort.id, name, email,
        role: 'employee', position: 'Erzieher', roleType: 'Erzieher',
        weeklyHours: stunden, workDaysPerWeek: stunden >= 35 ? 5 : 4,
        gruppe: gruppe.name, joinedAt: '2024-03-01', vacationDaysTotal: 30, active: true,
      },
      update: { weeklyHours: stunden, gruppe: gruppe.name, locationId: kitaStandort.id, active: true },
    })
  }

  // Ein Mitarbeiter mit eigenem Zugang — sonst lassen sich Rollenrechte
  // und die Mitarbeiter-App gar nicht prüfen.
  const anna = await prisma.employee.findUnique({ where: { email: 'anna.fischer@rheinblick-reha.de' } })
  if (anna) {
    await prisma.user.upsert({
      where: { email: anna.email },
      create: {
        email: anna.email, name: anna.name, role: 'employee', passwordHash: hash,
        customerId: reha.id, locationId: rehaStandort.id, employeeId: anna.id,
      },
      update: { role: 'employee', employeeId: anna.id, locationId: rehaStandort.id, passwordHash: hash },
    })
  }

  // ── Basisregeln je Standort ──────────────────────────────────────────────
  for (const standortId of [rehaStandort.id, kitaStandort.id]) {
    await prisma.locationPlanningRules.upsert({
      where: { locationId: standortId },
      create: {
        locationId: standortId, maxWeeklyHours: 40, restHours: 11, maxConsecutiveDays: 5,
        breakThresholdMinutes: 360, breakDeductionMinutes: 30,
      },
      update: { maxWeeklyHours: 40, restHours: 11, maxConsecutiveDays: 5 },
    })
  }

  const anzahl = await prisma.employee.count()
  console.log(`Testdaten bereit: 2 Kunden, 2 Standorte, ${anzahl} Mitarbeiter, ${dienste.length} Dienste`)
  console.log(`Zugänge (Passwort ${PASSWORT}):`)
  for (const z of zugaenge) console.log(`  ${z.role.padEnd(8)} ${z.email}`)
  if (anna) console.log(`  employee ${anna.email}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
