import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAndSendInvitation } from '@/lib/invitations'
import { requireRole } from '@/lib/session'
import { getAppOrigin } from '@/lib/app-url'
import type { Role } from '@/lib/types'

export const dynamic = 'force-dynamic'

const VALID_ROLES: Role[] = ['employee', 'admin', 'company', 'okun']

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const invitations = await prisma.invitationToken.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({
    invitations: invitations.map(inv => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      customerName: inv.customerName,
      status: inv.usedAt ? 'accepted' : inv.expiresAt < new Date() ? 'expired' : 'pending',
      sentAt: inv.createdAt.toISOString().split('T')[0],
    })),
  })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { email, role, name, customerName, employeeId, locationId } = body

  if (!email || typeof email !== 'string' || !email.trim()) {
    return NextResponse.json({ error: 'E-Mail ist erforderlich' }, { status: 400 })
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Ungültige Rolle' }, { status: 400 })
  }

  const invitation = await createAndSendInvitation(getAppOrigin(req), {
    email,
    role,
    name,
    customerName,
    employeeId,
    locationId,
  })

  return NextResponse.json({
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      customerName: invitation.customerName,
      status: 'pending',
      sentAt: invitation.createdAt.toISOString().split('T')[0],
    },
  })
}
