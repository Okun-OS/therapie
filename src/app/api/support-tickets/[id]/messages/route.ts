import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  const { body, internal } = await req.json()
  if (!body?.trim()) return NextResponse.json({ error: 'body fehlt' }, { status: 400 })

  const msg = await prisma.supportTicketMessage.create({
    data: {
      ticketId: params.id,
      authorId: session.userId,
      authorName: session.name ?? session.email,
      authorRole: 'okun',
      body: body.trim(),
      internal: internal === true,
    },
  })

  // Auto-advance status to in_progress when first reply is posted
  const ticket = await prisma.supportTicket.findUnique({ where: { id: params.id }, select: { status: true } })
  if (ticket?.status === 'new' || ticket?.status === 'open') {
    await prisma.supportTicket.update({ where: { id: params.id }, data: { status: 'in_progress' } })
  }

  return NextResponse.json({ message: msg })
}
