import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'

export const dynamic = 'force-dynamic'

function nextTicketId(): string {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase()
  return `SUP-${ts}-${rand}`
}

// Public submit (any logged-in user) or from BugReport button
export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const body = await req.json()

  const ticket = await prisma.supportTicket.create({
    data: {
      ticketId: nextTicketId(),
      status: 'new',
      priority: (body.priority as string) ?? 'normal',
      category: (body.category as string) ?? null,
      userId: session.userId,
      userName: session.name ?? session.email,
      userRole: session.role,
      customerId: session.customerId ?? null,
      customerName: session.customerName ?? null,
      locationId: session.locationId ?? null,
      currentPage: (body.currentPage as string) ?? null,
      title: (body.title as string) ?? 'Support-Anfrage',
      description: (body.description as string) ?? null,
      browser: (body.browser as string) ?? null,
      os: (body.os as string) ?? null,
      screenSize: (body.screenSize as string) ?? null,
      consoleErrors: (body.consoleErrors as string) ?? null,
      lastActions: (body.lastActions as string) ?? null,
    },
  })

  return NextResponse.json({ ticketId: ticket.ticketId, id: ticket.id })
}

// OKUN admin: list all tickets
export async function GET(req: NextRequest) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  const status = req.nextUrl.searchParams.get('status')
  const priority = req.nextUrl.searchParams.get('priority')
  const category = req.nextUrl.searchParams.get('category')

  const tickets = await prisma.supportTicket.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(category ? { category } : {}),
    },
    orderBy: [{ createdAt: 'desc' }],
    take: 200,
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })

  return NextResponse.json({ tickets })
}

export async function PATCH(req: NextRequest) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { id, status, priority, assignedTo, adminNotes } = body as {
    id: string; status?: string; priority?: string; assignedTo?: string; adminNotes?: string
  }
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const now = new Date()
  const updated = await prisma.supportTicket.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(assignedTo !== undefined ? { assignedTo } : {}),
      ...(adminNotes !== undefined ? { adminNotes } : {}),
      ...(status === 'resolved' ? { resolvedAt: now } : {}),
      ...(status === 'closed' ? { closedAt: now } : {}),
    },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })

  return NextResponse.json({ ticket: updated })
}
