import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
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

  return NextResponse.json({
    invitation: {
      email: invitation.email,
      role: invitation.role,
      name: invitation.name,
      customerName: invitation.customerName,
    },
  })
}
