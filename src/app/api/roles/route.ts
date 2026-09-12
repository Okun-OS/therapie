import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ roles: [] })

  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { roles: true } })
  return NextResponse.json({ roles: customer?.roles ?? [] })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kein Mandant für diesen Nutzer hinterlegt' }, { status: 400 })

  const { role } = await req.json()
  if (!role || typeof role !== 'string' || !role.trim()) {
    return NextResponse.json({ error: 'role ist erforderlich' }, { status: 400 })
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { roles: true } })
  const existing = customer?.roles ?? []
  const trimmed = role.trim()
  const roles = existing.some(r => r.toLowerCase() === trimmed.toLowerCase()) ? existing : [...existing, trimmed]

  const updated = await prisma.customer.update({ where: { id: customerId }, data: { roles } })
  return NextResponse.json({ roles: updated.roles })
}
