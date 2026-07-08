import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'customerId fehlt' }, { status: 400 })

  const yearParam = req.nextUrl.searchParams.get('year')
  const monthParam = req.nextUrl.searchParams.get('month')
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear()
  const month = monthParam ? parseInt(monthParam) : new Date().getMonth() + 1

  const entries = await prisma.payrollEntry.findMany({
    where: { customerId, year, month },
    orderBy: { employeeName: 'asc' },
  })

  return NextResponse.json({ entries, year, month })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'customerId fehlt' }, { status: 400 })

  const body = await req.json()

  const entry = await prisma.payrollEntry.upsert({
    where: {
      employeeId_year_month: {
        employeeId: body.employeeId as string,
        year: body.year as number,
        month: body.month as number,
      },
    } as unknown as Parameters<typeof prisma.payrollEntry.upsert>[0]['where'],
    create: { ...body, customerId },
    update: { ...body },
  })

  return NextResponse.json({ entry })
}

export async function PATCH(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { id, status, notes, approvedBy, approvedAt } = body as {
    id: string; status?: string; notes?: string; approvedBy?: string; approvedAt?: string
  }
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const updated = await prisma.payrollEntry.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(approvedBy ? { approvedBy } : {}),
      ...(approvedAt ? { approvedAt } : {}),
    },
  })
  return NextResponse.json({ entry: updated })
}
