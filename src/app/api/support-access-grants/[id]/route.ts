import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const grant = await prisma.supportAccessGrant.findUnique({
    where: { id: params.id },
    include: { ticket: { select: { ticketId: true } } },
  })
  if (!grant) return NextResponse.json({ error: 'Zugriff nicht gefunden' }, { status: 404 })

  // Company can only revoke their own grants
  if (session.role === 'company' && grant.customerId !== session.customerId) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  if (grant.revokedAt) {
    return NextResponse.json({ error: 'Zugriff bereits widerrufen' }, { status: 400 })
  }

  await prisma.supportAccessGrant.update({
    where: { id: params.id },
    data: { revokedAt: new Date() },
  })

  await prisma.supportAccessLog.create({
    data: {
      grantId: grant.id,
      userId: session.userId,
      action: 'REVOKED',
      resource: `ticket:${grant.ticket.ticketId}`,
    },
  })

  return NextResponse.json({ revoked: true })
}
