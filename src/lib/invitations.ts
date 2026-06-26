import { prisma } from './prisma'
import { sendEmail } from './email'
import { generateInvitationToken } from './auth'
import type { Role } from './types'

const INVITATION_VALID_DAYS = 7

const ROLE_LABEL: Record<Role, string> = {
  employee: 'Mitarbeiter',
  admin: 'Einrichtungsleitung',
  company: 'Geschäftsführung',
  okun: 'OKUN Administrator',
}

export async function createAndSendInvitation(
  origin: string,
  input: { email: string; role: Role; name?: string; customerName?: string; employeeId?: string; locationId?: string },
) {
  const token = generateInvitationToken()
  const expiresAt = new Date(Date.now() + INVITATION_VALID_DAYS * 24 * 60 * 60 * 1000)

  const invitation = await prisma.invitationToken.create({
    data: {
      token,
      email: input.email.trim().toLowerCase(),
      role: input.role,
      name: input.name,
      customerName: input.customerName,
      employeeId: input.employeeId,
      locationId: input.locationId,
      expiresAt,
    },
  })

  const link = `${origin}/register/${token}`
  const greeting = input.name ? `Hallo ${input.name},` : 'Hallo,'
  const orgLine = input.customerName ? `\nOrganisation: ${input.customerName}` : ''

  await sendEmail(
    invitation.email,
    'Ihre Einladung zu OKUN Workforce',
    `${greeting}\n\nSie wurden zu OKUN Workforce eingeladen (Rolle: ${ROLE_LABEL[input.role]}).${orgLine}\n\nRichten Sie Ihr Konto unter folgendem Link ein:\n${link}\n\nDer Link ist ${INVITATION_VALID_DAYS} Tage gültig.\n\nIhr OKUN Workforce Team`,
  )

  return invitation
}
