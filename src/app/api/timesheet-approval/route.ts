import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveLocationId } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'employee'])
  if (session instanceof NextResponse) return session

  const employeeId = req.nextUrl.searchParams.get('employeeId')
  const yearParam = req.nextUrl.searchParams.get('year')
  const monthParam = req.nextUrl.searchParams.get('month')

  const approvals = await prisma.timesheetApproval.findMany({
    where: {
      ...(employeeId ? { employeeId } : {}),
      ...(yearParam ? { year: parseInt(yearParam) } : {}),
      ...(monthParam ? { month: parseInt(monthParam) } : {}),
    },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  })
  return NextResponse.json({ approvals })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin'])
  if (session instanceof NextResponse) return session

  const locationId = await resolveLocationId(session)
  if (!locationId) return NextResponse.json({ error: 'locationId fehlt' }, { status: 400 })

  const body = await req.json()
  const { employeeId, employeeName, year, month, status, rejectionReason, notes } = body as {
    employeeId: string
    employeeName: string
    year: number
    month: number
    status: string
    rejectionReason?: string
    notes?: string
  }

  const now = new Date().toISOString()

  const approval = await prisma.timesheetApproval.upsert({
    where: {
      employeeId_year_month: { employeeId, year, month },
    } as unknown as Parameters<typeof prisma.timesheetApproval.upsert>[0]['where'],
    create: {
      employeeId,
      employeeName: employeeName ?? null,
      locationId: locationId ?? null,
      year,
      month,
      status,
      approvedBy: status === 'approved' ? (session as { userId: string }).userId : null,
      approvedAt: status === 'approved' ? now : null,
      rejectionReason: rejectionReason ?? null,
      notes: notes ?? null,
    },
    update: {
      status,
      approvedBy: status === 'approved' ? (session as { userId: string }).userId : null,
      approvedAt: status === 'approved' ? now : null,
      rejectionReason: rejectionReason ?? null,
      notes: notes ?? null,
    },
  })

  return NextResponse.json({ approval })
}
