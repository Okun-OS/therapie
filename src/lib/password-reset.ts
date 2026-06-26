import { prisma } from './prisma'
import { sendEmail } from './email'
import { generateSecureToken } from './auth'

const RESET_VALID_MINUTES = 60

export async function createAndSendPasswordReset(origin: string, email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase()
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (!user) return

  const token = generateSecureToken()
  const expiresAt = new Date(Date.now() + RESET_VALID_MINUTES * 60 * 1000)

  await prisma.passwordResetToken.create({
    data: { token, email: normalizedEmail, expiresAt },
  })

  const link = `${origin}/reset-password/${token}`
  await sendEmail(
    normalizedEmail,
    'Passwort zurücksetzen – OKUN Workforce',
    `Hallo ${user.name},\n\nSie haben angefordert, Ihr Passwort zurückzusetzen. Klicken Sie auf folgenden Link, um ein neues Passwort zu vergeben:\n${link}\n\nDer Link ist ${RESET_VALID_MINUTES} Minuten gültig. Falls Sie das nicht angefordert haben, ignorieren Sie diese E-Mail.\n\nIhr OKUN Workforce Team`,
  )
}
