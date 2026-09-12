// Echte Postgres-Persistenz für die OKUN-Plattformverwaltung (ersetzt
// TASK_CATALOG, TEST_ACCOUNTS, INVITATIONS, SUPPORT_LOG und ORG_SETTINGS aus
// mock-data.ts). Server-only.
import { prisma } from './prisma'
import { removeAllowedTaskFromEmployees } from './entities'
import type { TestAccount, Invitation, SupportAccessLogEntry, OrgSettings, Role } from './types'

function toTestAccount(row: any): TestAccount {
  return {
    id: row.id,
    customerName: row.customerName,
    contactEmail: row.contactEmail,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    converted: row.converted,
  }
}

function toInvitation(row: any): Invitation {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    customerName: row.customerName ?? undefined,
    status: row.status,
    sentAt: row.sentAt,
  }
}

function toSupportAccess(row: any): SupportAccessLogEntry {
  return {
    id: row.id,
    customerName: row.customerName,
    requestedBy: row.requestedBy,
    reason: row.reason,
    grantedAt: row.grantedAt,
    revokedAt: row.revokedAt ?? undefined,
  }
}

const DEFAULT_ORG_SETTINGS: Omit<OrgSettings, never> = {
  organizationName: '',
  defaultWeeklyHours: 38,
  defaultVacationDaysPerYear: 30,
  autoApproveVacationUnderDays: 0,
  notificationEmail: '',
}

function toOrgSettings(row: any): OrgSettings {
  return {
    organizationName: row.organizationName,
    defaultWeeklyHours: row.defaultWeeklyHours,
    defaultVacationDaysPerYear: row.defaultVacationDaysPerYear,
    autoApproveVacationUnderDays: row.autoApproveVacationUnderDays,
    notificationEmail: row.notificationEmail,
    auNachweisAbTag: row.auNachweisAbTag ?? null,
  }
}

// ─── Aufgabenkatalog ─────────────────────────────────────────────────────────

export async function listTaskTypes(): Promise<string[]> {
  const rows = await prisma.taskType.findMany({ orderBy: { name: 'asc' } })
  return rows.map(r => r.name)
}

export async function addTaskType(name: string): Promise<void> {
  await prisma.taskType.upsert({ where: { name }, create: { name }, update: {} })
}

/** Entfernt den Aufgabentyp aus dem Katalog und aus allowedTasks aller Mitarbeiter. */
export async function removeTaskType(name: string): Promise<void> {
  await prisma.taskType.delete({ where: { name } }).catch(() => null)
  await removeAllowedTaskFromEmployees(name)
}

// ─── Testzugänge ─────────────────────────────────────────────────────────────

export async function listTestAccounts(): Promise<TestAccount[]> {
  const rows = await prisma.testAccount.findMany({ orderBy: { createdAt: 'desc' } })
  return rows.map(toTestAccount)
}

export async function addTestAccount(input: { customerName: string; contactEmail: string; durationDays: number }): Promise<TestAccount> {
  const now = new Date()
  const expires = new Date(now.getTime() + input.durationDays * 24 * 60 * 60 * 1000)
  const row = await prisma.testAccount.create({
    data: {
      customerName: input.customerName,
      contactEmail: input.contactEmail,
      createdAt: now.toISOString().split('T')[0],
      expiresAt: expires.toISOString().split('T')[0],
      converted: false,
    },
  })
  return toTestAccount(row)
}

export async function updateTestAccount(id: string, updates: Partial<TestAccount>): Promise<void> {
  const { id: _ignored, ...data } = updates as any
  await prisma.testAccount.update({ where: { id }, data }).catch(() => null)
}

// ─── Plattform-Einladungen (Vertrieb) ────────────────────────────────────────

export async function listPlatformInvitations(): Promise<Invitation[]> {
  const rows = await prisma.platformInvitation.findMany({ orderBy: { sentAt: 'desc' } })
  return rows.map(toInvitation)
}

export async function addPlatformInvitation(input: { email: string; role: Role; customerName?: string }): Promise<Invitation> {
  const row = await prisma.platformInvitation.create({
    data: { email: input.email, role: input.role, customerName: input.customerName, status: 'pending', sentAt: new Date().toISOString().split('T')[0] },
  })
  return toInvitation(row)
}

// ─── Support-Zugriffsprotokoll ───────────────────────────────────────────────

export async function listSupportAccessLog(): Promise<SupportAccessLogEntry[]> {
  const rows = await prisma.supportAccessLogEntry.findMany({ orderBy: { grantedAt: 'desc' } })
  return rows.map(toSupportAccess)
}

export async function addSupportAccess(input: { customerName: string; requestedBy: string; reason: string }): Promise<SupportAccessLogEntry> {
  const row = await prisma.supportAccessLogEntry.create({
    data: { ...input, grantedAt: new Date().toISOString().split('T')[0] },
  })
  return toSupportAccess(row)
}

export async function revokeSupportAccess(id: string): Promise<void> {
  await prisma.supportAccessLogEntry.update({
    where: { id },
    data: { revokedAt: new Date().toISOString().split('T')[0] },
  }).catch(() => null)
}

// ─── Organisationsweite Einstellungen ────────────────────────────────────────

export async function getOrgSettings(customerId: string): Promise<OrgSettings> {
  const row = await prisma.orgSettings.findUnique({ where: { customerId } })
  if (row) return toOrgSettings(row)
  const created = await prisma.orgSettings.create({ data: { customerId, ...DEFAULT_ORG_SETTINGS } })
  return toOrgSettings(created)
}

export async function updateOrgSettings(customerId: string, updates: Partial<OrgSettings>): Promise<OrgSettings> {
  const current = await getOrgSettings(customerId)
  const row = await prisma.orgSettings.upsert({
    where: { customerId },
    create: { customerId, ...current, ...updates },
    update: { ...updates },
  })
  return toOrgSettings(row)
}
