// Echte Postgres-Persistenz für Mitarbeiter/Kunden/Standorte (ersetzt die
// EMPLOYEES/LOCATIONS/CUSTOMERS Arrays aus mock-data.ts). Server-only: importiert
// Prisma und darf daher NIE von einer 'use client' Komponente importiert werden –
// Client-Seiten laden diese Daten ausschließlich über die /api/* Routen.
import { prisma } from './prisma'
import type { Employee, Location, Customer, Bereich, EmployeePreferences } from './types'

export function toEmployee(row: any): Employee {
  return {
    id: row.id,
    customerId: row.customerId ?? undefined,
    name: row.name,
    email: row.email,
    role: row.role,
    locationId: row.locationId ?? undefined,
    weeklyHours: row.weeklyHours,
    position: row.position,
    hoursBalance: row.hoursBalance,
    vacationDaysTotal: row.vacationDaysTotal,
    vacationDaysUsed: row.vacationDaysUsed,
    preferences: (row.preferences as EmployeePreferences | null) ?? undefined,
    active: row.active,
    joinedAt: row.joinedAt,
    hasChildren: row.hasChildren ?? undefined,
    phone: row.phone ?? undefined,
    birthDate: row.birthDate ?? undefined,
    roleType: row.roleType ?? undefined,
    employmentType: row.employmentType ?? undefined,
    gruppe: row.gruppe ?? undefined,
    bereich: row.bereich ?? undefined,
    multiGroupCapable: row.multiGroupCapable ?? undefined,
    fixedLocations: row.fixedLocations ?? undefined,
    qualifications: row.qualifications,
    allowedTasks: row.allowedTasks,
    avatarUrl: row.avatarUrl ?? undefined,
    workDaysPerWeek: row.workDaysPerWeek ?? undefined,
    workDays: row.workDays,
    dailyTargetHours: row.dailyTargetHours ?? undefined,
    fixedOffDays: row.fixedOffDays,
  }
}

function toLocation(row: any): Location {
  return {
    id: row.id,
    customerId: row.customerId ?? undefined,
    bereichId: row.bereichId ?? undefined,
    name: row.name,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip ?? undefined,
    street: row.street ?? undefined,
    houseNumber: row.houseNumber ?? undefined,
    country: row.country ?? undefined,
    bundesland: row.bundesland ?? undefined,
    employeeCount: row.employeeCount,
    adminId: row.adminId,
    active: row.active,
    dienstplanungFrei: row.dienstplanungFrei ?? false,
    dienstplanungHinweis: row.dienstplanungHinweis ?? null,
  }
}

function toBereich(row: any): Bereich {
  return {
    id: row.id,
    customerId: row.customerId,
    name: row.name,
    description: row.description ?? undefined,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  }
}

export function toCustomer(row: any): Customer {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    status: row.status,
    plan: row.plan,
    seatsLicensed: row.seatsLicensed,
    seatsUsed: row.seatsUsed,
    locationsCount: row.locationsCount,
    createdAt: row.createdAt,
    renewalDate: row.renewalDate ?? undefined,
    notes: row.notes ?? undefined,
    roles: row.roles ?? [],
    legalContractDate: row.legalContractDate ?? undefined,
    legalContractNotes: row.legalContractNotes ?? undefined,
  }
}

/** customerId scopt auf den Mandanten des anfragenden Nutzers; undefined liefert
 * plattformweit ALLE Mitarbeiter und darf daher nur von der 'okun'-Rolle verwendet
 * werden (siehe requireRole-Aufrufer). */
export async function listEmployees(customerId?: string, locationId?: string): Promise<Employee[]> {
  const where: Record<string, string> = {}
  if (customerId) where.customerId = customerId
  if (locationId) where.locationId = locationId
  const rows = await prisma.employee.findMany({ where })
  return rows.map(toEmployee)
}

/** customerId scopt auf den Mandanten des anfragenden Nutzers; undefined liefert
 * plattformweit ALLE Standorte und darf daher nur von der 'okun'-Rolle verwendet
 * werden (siehe requireRole-Aufrufer). */
export async function listLocations(customerId?: string): Promise<Location[]> {
  const rows = await prisma.location.findMany({ where: customerId ? { customerId } : {} })
  return rows.map(toLocation)
}

export async function listCustomers(includeDeleted = false): Promise<Customer[]> {
  const rows = await prisma.customer.findMany({
    where: includeDeleted ? undefined : { deletedAt: null },
    orderBy: { name: 'asc' },
  })
  return rows.map(toCustomer)
}

export async function getEmployeeById(id: string): Promise<Employee | undefined> {
  const row = await prisma.employee.findUnique({ where: { id } })
  return row ? toEmployee(row) : undefined
}

export async function getLocationById(id: string): Promise<Location | undefined> {
  const row = await prisma.location.findUnique({ where: { id } })
  return row ? toLocation(row) : undefined
}

export async function getEmployeesByLocation(locationId: string): Promise<Employee[]> {
  const rows = await prisma.employee.findMany({ where: { locationId, active: true } })
  return rows.map(toEmployee)
}

export async function updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee | undefined> {
  const { id: _ignored, ...data } = updates as any
  try {
    const row = await prisma.employee.update({ where: { id }, data })
    return toEmployee(row)
  } catch (err: any) {
    if (err?.code === 'P2025') return undefined
    throw err
  }
}

export async function addLocation(input: {
  name: string
  address: string
  city: string
  state?: string
  zip?: string
  street?: string
  houseNumber?: string
  country?: string
  bundesland?: string
  customerId?: string
}): Promise<Location> {
  const row = await prisma.location.create({
    data: {
      customerId: input.customerId,
      name: input.name,
      address: input.address,
      city: input.city,
      state: input.state || input.bundesland || '',
      zip: input.zip,
      street: input.street,
      houseNumber: input.houseNumber,
      country: input.country || 'Deutschland',
      bundesland: input.bundesland,
      employeeCount: 0,
      adminId: '',
      active: true,
    },
  })
  return toLocation(row)
}

export async function updateLocation(id: string, updates: Partial<Location>): Promise<Location | undefined> {
  const { id: _ignored, ...data } = updates as any
  const row = await prisma.location.update({ where: { id }, data }).catch(() => null)
  return row ? toLocation(row) : undefined
}

/** Geschäftsführung: Standortleitung wechseln – die bisherige Leitung wird
 * wieder Mitarbeiter, die neu ernannte Person wird Standortleitung. */
export async function reassignLocationAdmin(locationId: string, newAdminEmployeeId: string): Promise<void> {
  const location = await prisma.location.findUnique({ where: { id: locationId } })
  if (!location) return
  await prisma.$transaction(async tx => {
    if (location.adminId) {
      await tx.employee.update({ where: { id: location.adminId }, data: { role: 'employee' } }).catch(() => null)
    }
    await tx.employee.update({ where: { id: newAdminEmployeeId }, data: { role: 'admin' } })
    await tx.location.update({ where: { id: locationId }, data: { adminId: newAdminEmployeeId } })
  })
}

export interface UnassignedLocation {
  id: string
  name: string
  city: string
  employeeCount: number
}

export interface UnassignedCompanyUser {
  id: string
  name: string
  email: string
  role: 'company' | 'admin'
}

/** Standorte/Accounts aus der Zeit vor der Mandanten-Trennung (#121-126)
 * haben kein customerId, weil die Beziehung Standort→Unternehmen vorher gar
 * nicht in den Daten existierte. Das betrifft auch admin-Accounts (Standort-
 * leitung), die über die OKUN-Einladungsseite ohne Unternehmens-Zuordnung
 * eingeladen wurden. listUnassigned* macht diese Altlasten für die
 * OKUN-Plattformverwaltung sichtbar, damit sie einmalig zugeordnet werden
 * können (siehe assignLocationToCustomer/assignCompanyUserToCustomer). */
export async function listUnassignedLocations(): Promise<UnassignedLocation[]> {
  const rows = await prisma.location.findMany({ where: { customerId: null }, orderBy: { name: 'asc' } })
  return rows.map(r => ({ id: r.id, name: r.name, city: r.city, employeeCount: r.employeeCount }))
}

export async function listUnassignedCompanyUsers(): Promise<UnassignedCompanyUser[]> {
  const rows = await prisma.user.findMany({ where: { role: { in: ['company', 'admin'] }, customerId: null }, orderBy: { name: 'asc' } })
  return rows.map(r => ({ id: r.id, name: r.name, email: r.email, role: r.role as 'company' | 'admin' }))
}

/** Ordnet einen Altlast-Standort einmalig einem Unternehmen zu und kaskadiert das
 * automatisch auf alle ihre Mitarbeiter und Accounts (Standortleitung,
 * Mitarbeiter-Logins), die noch kein customerId haben – deren Zuordnung lässt
 * sich aus der bestehenden locationId zweifelsfrei ableiten. */
export async function assignLocationToCustomer(locationId: string, customerId: string): Promise<void> {
  await prisma.$transaction([
    prisma.location.update({ where: { id: locationId }, data: { customerId } }),
    prisma.employee.updateMany({ where: { locationId, customerId: null }, data: { customerId } }),
    prisma.user.updateMany({ where: { locationId, customerId: null }, data: { customerId } }),
  ])
}

export async function assignCompanyUserToCustomer(userId: string, customerId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { customerId } })
}

export interface UnassignedAdminUser {
  id: string
  name: string
  email: string
}

/** Standortleitungen, die über die OKUN-Einladungsseite ohne Standort-Zuordnung
 * eingeladen wurden (vor der entsprechenden UI-Erweiterung) und deshalb keine
 * Mitarbeiter anlegen können. Getrennt von listUnassignedCompanyUsers, weil hier
 * ein Standort statt eines Unternehmens fehlt – beides kann unabhängig fehlen. */
export async function listAdminUsersWithoutLocation(): Promise<UnassignedAdminUser[]> {
  const rows = await prisma.user.findMany({ where: { role: 'admin', locationId: null }, orderBy: { name: 'asc' } })
  return rows.map(r => ({ id: r.id, name: r.name, email: r.email }))
}

/** Weist einer Standortleitung einmalig einen Standort zu. Übernimmt dabei auch
 * die customerId des Standorts, falls der Nutzer noch keine hat – ein fehlender
 * Standort zieht in der Praxis fast immer eine fehlende Unternehmens-Zuordnung
 * nach sich, da beide über dieselbe Einladungslücke entstehen. */
export async function assignAdminUserToLocation(userId: string, locationId: string): Promise<void> {
  const location = await prisma.location.findUnique({ where: { id: locationId } })
  if (!location) throw new Error('Standort nicht gefunden')
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('Nutzer nicht gefunden')
  await prisma.user.update({
    where: { id: userId },
    data: { locationId, customerId: user.customerId ?? location.customerId },
  })
}

export async function updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer | undefined> {
  const { id: _ignored, ...data } = updates as any
  const row = await prisma.customer.update({ where: { id }, data }).catch(() => null)
  return row ? toCustomer(row) : undefined
}

export async function softDeleteCustomer(id: string): Promise<boolean> {
  const row = await prisma.customer.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'cancelled' },
  }).catch(() => null)
  return !!row
}

export async function hardDeleteCustomer(id: string): Promise<boolean> {
  const row = await prisma.customer.delete({ where: { id } }).catch(() => null)
  return !!row
}

export async function deleteEmployee(id: string): Promise<{ name: string } | null> {
  const row = await prisma.employee.findUnique({ where: { id }, select: { name: true } })
  if (!row) return null
  await prisma.employee.delete({ where: { id } })
  return row
}

export async function deleteLocation(id: string): Promise<{ name: string } | null> {
  const row = await prisma.location.findUnique({ where: { id }, select: { name: true } })
  if (!row) return null
  await prisma.location.delete({ where: { id } })
  return row
}

/** Entfernt einen entfallenen Aufgabentyp aus allowedTasks aller Mitarbeiter. */
export async function removeAllowedTaskFromEmployees(name: string): Promise<void> {
  await prisma.$executeRaw`UPDATE "Employee" SET "allowedTasks" = array_remove("allowedTasks", ${name}) WHERE ${name} = ANY("allowedTasks")`
}

/** Wendet das Saldo eines freigegebenen Monatsabschlusses auf das Stundenkonto an. */
export async function applyHoursBalanceDelta(employeeId: string, deltaHours: number): Promise<void> {
  const row = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!row) return
  const hoursBalance = Math.round((row.hoursBalance + deltaHours) * 10) / 10
  await prisma.employee.update({ where: { id: employeeId }, data: { hoursBalance } })
}

// ─── Bereich CRUD ─────────────────────────────────────────────────────────────

export async function listBereiche(customerId: string): Promise<Bereich[]> {
  const rows = await prisma.bereich.findMany({ where: { customerId }, orderBy: { name: 'asc' } })
  return rows.map(toBereich)
}

export async function getBereichById(id: string): Promise<Bereich | undefined> {
  const row = await prisma.bereich.findUnique({ where: { id } })
  return row ? toBereich(row) : undefined
}

export async function createBereich(input: { customerId: string; name: string; description?: string }): Promise<Bereich> {
  const row = await prisma.bereich.create({ data: input })
  return toBereich(row)
}

export async function updateBereich(id: string, updates: { name?: string; description?: string }): Promise<Bereich | undefined> {
  const row = await prisma.bereich.update({ where: { id }, data: updates }).catch(() => null)
  return row ? toBereich(row) : undefined
}

export async function deleteBereich(id: string): Promise<boolean> {
  // Unlink locations first so no orphan references remain
  await prisma.location.updateMany({ where: { bereichId: id }, data: { bereichId: null } })
  const deleted = await prisma.bereich.delete({ where: { id } }).catch(() => null)
  return !!deleted
}

/** Returns all company-role User rows for a customer, for Bereichsleiter management. */
export async function listCompanyUsers(customerId: string): Promise<{ id: string; name: string; email: string; bereichIds: string[] }[]> {
  const rows = await prisma.user.findMany({
    where: { customerId, role: 'company' },
    select: { id: true, name: true, email: true, bereichIds: true },
    orderBy: { name: 'asc' },
  })
  return rows
}

/** Sets the bereichIds on a User (replaces the whole array). */
export async function setUserBereichIds(userId: string, bereichIds: string[]): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { bereichIds } })
}

/** Filters a list of locationIds to those belonging to the given bereiche. */
export async function locationIdsForBereiche(bereichIds: string[]): Promise<string[]> {
  if (bereichIds.length === 0) return []
  const rows = await prisma.location.findMany({ where: { bereichId: { in: bereichIds } }, select: { id: true } })
  return rows.map(r => r.id)
}
