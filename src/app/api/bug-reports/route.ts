import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'

export const dynamic = 'force-dynamic'

function nextTicketId(): string {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `BUG-${ts}-${rand}`
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { body = {} }

  const entry = await prisma.bugReport.create({
    data: {
      ticketId: nextTicketId(),
      status: 'open',
      priority: (body.priority as string) ?? 'normal',
      severity: (body.severity as string) ?? 'normal',
      userId: (body.userId as string) ?? null,
      userName: (body.userName as string) ?? null,
      userRole: (body.userRole as string) ?? null,
      customerId: (body.customerId as string) ?? null,
      customerName: (body.customerName as string) ?? null,
      title: (body.title as string) ?? 'Kein Titel',
      description: (body.description as string) ?? null,
      page: (body.page as string) ?? null,
      browser: (body.browser as string) ?? null,
      os: (body.os as string) ?? null,
      screenSize: (body.screenSize as string) ?? null,
      consoleErrors: (body.consoleErrors as string) ?? null,
      lastActions: (body.lastActions as string) ?? null,
    },
  })

  return NextResponse.json({ ticketId: entry.ticketId })
}

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  const status = req.nextUrl.searchParams.get('status')
  const reports = await prisma.bugReport.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ reports })
}

export async function PATCH(req: NextRequest) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { id, status, priority, adminNotes } = body as {
    id: string; status?: string; priority?: string; adminNotes?: string
  }
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const updated = await prisma.bugReport.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(adminNotes !== undefined ? { adminNotes } : {}),
    },
  })
  return NextResponse.json({ report: updated })
}
