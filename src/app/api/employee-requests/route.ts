import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { prisma } from '@/lib/prisma'

// GET /api/employee-requests?employeeId=xxx&locationId=xxx&status=pending
export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'employee'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const params = req.nextUrl.searchParams
  const employeeId = params.get('employeeId')
  const locationId = params.get('locationId')
  const status = params.get('status')

  const requests = await prisma.employeeRequest.findMany({
    where: {
      customerId,
      ...(employeeId && { employeeId }),
      ...(locationId && { locationId }),
      ...(status && { status }),
    },
    orderBy: { submittedAt: 'desc' },
  })

  return NextResponse.json({ requests })
}

// POST /api/employee-requests
export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'employee'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const body = await req.json()
  const { employeeId, locationId, type, priority, date, dateFrom, dateTo, shiftId, reason } = body

  if (!employeeId || !locationId || !type) {
    return NextResponse.json({ error: 'employeeId, locationId und type sind erforderlich' }, { status: 400 })
  }

  const validTypes = ['shift_wish', 'day_off_wish', 'vacation', 'absence', 'overtime_reduce', 'overtime_compensate']
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: `Unbekannter Antragstyp: ${type}` }, { status: 400 })
  }

  const request = await prisma.employeeRequest.create({
    data: {
      employeeId,
      locationId,
      customerId,
      type,
      priority: priority ?? 'normal',
      date: date ?? null,
      dateFrom: dateFrom ?? null,
      dateTo: dateTo ?? null,
      shiftId: shiftId ?? null,
      reason: reason ?? null,
    },
  })

  return NextResponse.json({ request }, { status: 201 })
}
