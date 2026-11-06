import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { locationFilter } from '@/lib/scope'
import { prisma } from '@/lib/prisma'

// GET /api/planning-policy?locationId=xxx
export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const locationId = req.nextUrl.searchParams.get('locationId')

  if (locationId) {
    const standortErlaubtGet = await locationFilter(session, locationId)
    if (standortErlaubtGet instanceof NextResponse) return standortErlaubtGet
  }
  if (!locationId) {
    return NextResponse.json({ error: 'locationId fehlt' }, { status: 400 })
  }

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const policy = await prisma.planningPolicy.findUnique({ where: { locationId } })

  if (!policy || policy.customerId !== customerId) {
    // Return default policy if none exists yet
    return NextResponse.json({
      locationId,
      customerId,
      defaultOvertimeHandling: 'normal',
      minAutoApproveScore: 80,
      failFastOnInfeasible: true,
      requestDeadline: null,
    })
  }

  return NextResponse.json(policy)
}

// PUT /api/planning-policy
export async function PUT(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const body = await req.json()
  const { locationId, defaultOvertimeHandling, minAutoApproveScore, failFastOnInfeasible, requestDeadline } = body

  // §112 Standortprüfung — die Rolle allein sagt nichts über die Zuständigkeit.
  const standortErlaubt = await locationFilter(session, locationId)
  if (standortErlaubt instanceof NextResponse) return standortErlaubt

  if (!locationId) {
    return NextResponse.json({ error: 'locationId fehlt' }, { status: 400 })
  }

  const deadlineDate = requestDeadline ? new Date(requestDeadline) : undefined

  const policy = await prisma.planningPolicy.upsert({
    where: { locationId },
    create: {
      locationId,
      customerId,
      defaultOvertimeHandling: defaultOvertimeHandling ?? 'normal',
      minAutoApproveScore: minAutoApproveScore ?? 80,
      failFastOnInfeasible: failFastOnInfeasible ?? true,
      requestDeadline: deadlineDate ?? null,
    },
    update: {
      ...(defaultOvertimeHandling !== undefined && { defaultOvertimeHandling }),
      ...(minAutoApproveScore !== undefined && { minAutoApproveScore }),
      ...(failFastOnInfeasible !== undefined && { failFastOnInfeasible }),
      ...(requestDeadline !== undefined && { requestDeadline: deadlineDate ?? null }),
    },
  })

  return NextResponse.json(policy)
}
