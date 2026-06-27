import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { setSessionCookie, type SessionRole } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const { password, name } = await req.json()

  if (!password || typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'Passwort muss mindestens 8 Zeichen lang sein' }, { status: 400 })
  }

  const invitation = await prisma.invitationToken.findUnique({ where: { token: params.token } })
  if (!invitation) {
    return NextResponse.json({ error: 'Einladung nicht gefunden' }, { status: 404 })
  }
  if (invitation.usedAt) {
    return NextResponse.json({ error: 'Diese Einladung wurde bereits verwendet' }, { status: 410 })
  }
  if (invitation.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Diese Einladung ist abgelaufen' }, { status: 410 })
  }

  const passwordHash = await hashPassword(password)
  const finalName = (name && String(name).trim()) || invitation.name || invitation.customerName || invitation.email

  const user = await prisma.$transaction(async tx => {
    const created = await tx.user.upsert({
      where: { email: invitation.email },
      create: {
        email: invitation.email,
        passwordHash,
        name: finalName,
        role: invitation.role,
        employeeId: invitation.employeeId,
        locationId: invitation.locationId,
        customerName: invitation.customerName,
        customerId: invitation.customerId,
      },
      update: {
        passwordHash,
        name: finalName,
        role: invitation.role,
        employeeId: invitation.employeeId,
        locationId: invitation.locationId,
        customerName: invitation.customerName,
        customerId: invitation.customerId,
      },
    })
    await tx.invitationToken.update({ where: { id: invitation.id }, data: { usedAt: new Date() } })
    return created
  })

  const res = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId ?? undefined,
      locationId: user.locationId ?? undefined,
      customerId: user.customerId ?? undefined,
    },
  })
  setSessionCookie(res, {
    userId: user.id,
    email: user.email,
    role: user.role as SessionRole,
    employeeId: user.employeeId ?? undefined,
    locationId: user.locationId ?? undefined,
    customerId: user.customerId ?? undefined,
  })
  return res
}
