import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, validatePassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const reset = await prisma.passwordResetToken.findUnique({ where: { token: params.token } })

  if (!reset) {
    return NextResponse.json({ error: 'Link nicht gefunden' }, { status: 404 })
  }
  if (reset.usedAt) {
    return NextResponse.json({ error: 'Dieser Link wurde bereits verwendet' }, { status: 410 })
  }
  if (reset.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Dieser Link ist abgelaufen' }, { status: 410 })
  }

  return NextResponse.json({ email: reset.email })
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const { password } = await req.json()

  if (!password || typeof password !== 'string') {
    return NextResponse.json({ error: 'Passwort ist erforderlich' }, { status: 400 })
  }
  const pwResult = validatePassword(password)
  if (!pwResult.valid) {
    return NextResponse.json({ error: pwResult.errors.join(', ') }, { status: 400 })
  }

  const reset = await prisma.passwordResetToken.findUnique({ where: { token: params.token } })
  if (!reset) {
    return NextResponse.json({ error: 'Link nicht gefunden' }, { status: 404 })
  }
  if (reset.usedAt) {
    return NextResponse.json({ error: 'Dieser Link wurde bereits verwendet' }, { status: 410 })
  }
  if (reset.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Dieser Link ist abgelaufen' }, { status: 410 })
  }

  const passwordHash = await hashPassword(password)

  const user = await prisma.$transaction(async tx => {
    const updated = await tx.user.update({ where: { email: reset.email }, data: { passwordHash } })
    await tx.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } })
    return updated
  })

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId ?? undefined,
      locationId: user.locationId ?? undefined,
    },
  })
}
