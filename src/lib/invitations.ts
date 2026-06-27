import { prisma } from './prisma'
import { sendEmail } from './email'
import { generateSecureToken } from './secure-token'
import { invitationExpiry, INVITATION_VALID_DAYS } from './invitation-expiry'
import { toEmployee, toCustomer } from './entities'
import type { Role, Employee, Customer } from './types'

export { invitationExpiry }

const ROLE_LABEL: Record<Role, string> = {
  employee: 'Mitarbeiter',
  admin: 'Einrichtungsleitung',
  company: 'Geschäftsführung',
  okun: 'OKUN Administrator',
}

export async function sendInvitationEmail(
  origin: string,
  invitation: { token: string; email: string; role: string; name?: string | null; customerName?: string | null },
) {
  const link = `${origin}/register/${invitation.token}`
  const greeting = invitation.name ? `Hallo ${invitation.name},` : 'Hallo,'
  const orgLine = invitation.customerName ? `\nOrganisation: ${invitation.customerName}` : ''
  const roleLabel = ROLE_LABEL[invitation.role as Role] ?? invitation.role

  await sendEmail(
    invitation.email,
    'Ihre Einladung zu OKUN Workforce',
    `${greeting}\n\nSie wurden zu OKUN Workforce eingeladen (Rolle: ${roleLabel}).${orgLine}\n\nRichten Sie Ihr Konto über den folgenden Button ein. Der Link ist ${INVITATION_VALID_DAYS} Tage gültig.\n\nIhr OKUN Workforce Team`,
    { ctaUrl: link, ctaLabel: 'Konto einrichten' },
  )
}

export async function createAndSendInvitation(
  origin: string,
  input: { email: string; role: Role; name?: string; customerName?: string; customerId?: string; employeeId?: string; locationId?: string },
) {
  const invitation = await prisma.invitationToken.create({
    data: {
      token: generateSecureToken(),
      email: input.email.trim().toLowerCase(),
      role: input.role,
      name: input.name,
      customerName: input.customerName,
      customerId: input.customerId,
      employeeId: input.employeeId,
      locationId: input.locationId,
      expiresAt: invitationExpiry(),
    },
  })

  await sendInvitationEmail(origin, invitation)
  return invitation
}

/** Legt Mitarbeiter und Einladung atomar in einer Transaktion an, damit nie ein
 * Mitarbeiter ohne zugehörige Einladung entsteht (oder umgekehrt). Lebt bewusst in
 * invitations.ts statt entities.ts: entities.ts wird auch von 'use client'-Seiten aus
 * über fairness.ts für reine Lesefunktionen importiert, und der E-Mail-/Krypto-Code
 * hier (Resend, crypto.randomBytes) darf nicht ins Client-Bundle gelangen. */
export async function addEmployeeWithInvitation(
  input: {
    name: string
    email: string
    position: string
    weeklyHours: number
    locationId: string
    phone?: string
    birthDate?: string
    roleType?: string
    employmentType?: string
    gruppe?: string
    bereich?: string
    multiGroupCapable?: boolean
    fixedLocations?: string
    qualifications?: string[]
    allowedTasks?: string[]
  },
  origin: string,
): Promise<{ employee: Employee; emailSent: boolean }> {
  const { employeeRow, invitation } = await prisma.$transaction(async tx => {
    const location = await tx.location.findUnique({ where: { id: input.locationId } })
    const customerId = location?.customerId ?? undefined
    const employeeRow = await tx.employee.create({
      data: {
        customerId,
        name: input.name,
        email: input.email,
        role: 'employee',
        locationId: input.locationId,
        weeklyHours: input.weeklyHours,
        position: input.position,
        hoursBalance: 0,
        vacationDaysTotal: 30,
        vacationDaysUsed: 0,
        active: true,
        joinedAt: new Date().toISOString().split('T')[0],
        phone: input.phone,
        birthDate: input.birthDate,
        roleType: input.roleType,
        employmentType: input.employmentType,
        gruppe: input.gruppe,
        bereich: input.bereich,
        multiGroupCapable: input.multiGroupCapable,
        fixedLocations: input.fixedLocations,
        qualifications: input.qualifications ?? [],
        allowedTasks: input.allowedTasks ?? [],
      },
    })
    const invitation = await tx.invitationToken.create({
      data: {
        token: generateSecureToken(),
        email: input.email.trim().toLowerCase(),
        role: 'employee',
        name: input.name,
        customerId,
        employeeId: employeeRow.id,
        locationId: input.locationId,
        expiresAt: invitationExpiry(),
      },
    })
    return { employeeRow, invitation }
  })

  let emailSent = true
  try {
    await sendInvitationEmail(origin, invitation)
  } catch {
    emailSent = false
  }

  return { employee: toEmployee(employeeRow), emailSent }
}

/** Legt Kunde und Einladung atomar in einer Transaktion an, damit nie ein Kunde
 * ohne zugehörige Einladung entsteht (oder umgekehrt). Siehe Kommentar bei
 * addEmployeeWithInvitation zur Begründung, warum dies in invitations.ts liegt. */
export async function addCustomerWithInvitation(
  input: { name: string; contactName: string; contactEmail: string; plan: string; seatsLicensed: number },
  origin: string,
): Promise<{ customer: Customer; emailSent: boolean }> {
  const { customerRow, invitation } = await prisma.$transaction(async tx => {
    const customerRow = await tx.customer.create({
      data: {
        name: input.name,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        status: 'trial',
        plan: input.plan,
        seatsLicensed: input.seatsLicensed,
        seatsUsed: 0,
        locationsCount: 0,
        createdAt: new Date().toISOString().split('T')[0],
      },
    })
    const invitation = await tx.invitationToken.create({
      data: {
        token: generateSecureToken(),
        email: input.contactEmail.trim().toLowerCase(),
        role: 'company',
        name: input.contactName,
        customerName: input.name,
        customerId: customerRow.id,
        expiresAt: invitationExpiry(),
      },
    })
    return { customerRow, invitation }
  })

  let emailSent = true
  try {
    await sendInvitationEmail(origin, invitation)
  } catch {
    emailSent = false
  }

  return { customer: toCustomer(customerRow), emailSent }
}
