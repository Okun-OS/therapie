import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const { searchParams } = new URL(req.url)
  const ticketId = searchParams.get('ticketId')

  const where: Record<string, unknown> = { revokedAt: null }
  if (session.role === 'company') {
    where.customerId = session.customerId
  }
  if (ticketId) {
    where.ticketId = ticketId
  }

  const grants = await prisma.supportAccessGrant.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { ticket: { select: { ticketId: true, title: true } } },
  })

  return NextResponse.json({ grants })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['company'])
  if (session instanceof NextResponse) return session

  if (!session.customerId) {
    return NextResponse.json({ error: 'Kein Mandant verknüpft' }, { status: 403 })
  }

  const body = await req.json()
  const { ticketId, scope, expiresInHours } = body

  if (!ticketId) return NextResponse.json({ error: 'ticketId fehlt' }, { status: 400 })
  if (!expiresInHours || expiresInHours < 1) return NextResponse.json({ error: 'Gültigkeitsdauer fehlt' }, { status: 400 })

  // Verify ticket belongs to this customer
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, customerId: session.customerId },
  })
  if (!ticket) return NextResponse.json({ error: 'Ticket nicht gefunden' }, { status: 404 })

  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000)

  const grant = await prisma.supportAccessGrant.create({
    data: {
      ticketId,
      customerId: session.customerId,
      grantedBy: session.userId,
      scope: scope ?? 'readonly',
      expiresAt,
    },
  })

  // Log the grant creation
  await prisma.supportAccessLog.create({
    data: {
      grantId: grant.id,
      userId: session.userId,
      action: 'GRANTED',
      resource: `ticket:${ticket.ticketId}`,
    },
  })

  return NextResponse.json({ grant })
}
