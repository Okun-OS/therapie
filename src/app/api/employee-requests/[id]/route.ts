import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { prisma } from '@/lib/prisma'

// PATCH /api/employee-requests/[id]  – admin updates status / priority
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const existing = await prisma.employeeRequest.findUnique({ where: { id: params.id } })
  if (!existing || existing.customerId !== customerId) {
    return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  }

  const body = await req.json()
  const { status, priority, respondedBy } = body

  const validStatuses = ['pending', 'approved', 'rejected', 'expired']
  if (status !== undefined && !validStatuses.includes(status)) {
    return NextResponse.json({ error: `Unbekannter Status: ${status}` }, { status: 400 })
  }

  const updated = await prisma.employeeRequest.update({
    where: { id: params.id },
    data: {
      ...(status !== undefined && { status }),
      ...(priority !== undefined && { priority }),
      ...(status !== undefined && status !== 'pending' && {
        respondedAt: new Date(),
        respondedBy: respondedBy ?? session.userId,
      }),
    },
  })

  return NextResponse.json({ request: updated })
}

// DELETE /api/employee-requests/[id]  – employee can withdraw pending requests
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company', 'employee'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const existing = await prisma.employeeRequest.findUnique({ where: { id: params.id } })
  if (!existing || existing.customerId !== customerId) {
    return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  }

  if (existing.status !== 'pending') {
    return NextResponse.json({ error: 'Nur ausstehende Anträge können zurückgezogen werden' }, { status: 422 })
  }

  await prisma.employeeRequest.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
