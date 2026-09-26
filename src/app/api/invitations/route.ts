import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAndSendInvitation } from '@/lib/invitations'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { allowedLocationScope } from '@/lib/scope'
import { getAppOrigin } from '@/lib/app-url'
import type { Role } from '@/lib/types'

export const dynamic = 'force-dynamic'

const VALID_ROLES: Role[] = ['employee', 'admin', 'company', 'okun']

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  // §132 Die Liste war nicht auf den Mandanten eingegrenzt: Eine Standortleitung
  // sah die offenen Einladungen ALLER Kunden — mit Namen und E-Mail-Adressen.
  // Das ist ein Datenschutzvorfall, kein Schoenheitsfehler.
  const customerId = session.role === 'okun' ? undefined : await resolveCustomerId(session)
  if (session.role !== 'okun' && !customerId) {
    return NextResponse.json({ invitations: [] })
  }

  // Die Standortleitung sieht zusaetzlich nur ihren eigenen Standort.
  const scope = await allowedLocationScope(session)

  const invitations = await prisma.invitationToken.findMany({
    where: {
      ...(customerId ? { customerId } : {}),
      ...(scope.kind === 'locations'
        // Einladungen ohne Standort sind Verwaltungszugaenge des Mandanten.
        ? { OR: [{ locationId: { in: scope.ids } }, { locationId: null }] }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
  })

  const origin = getAppOrigin(req)
  return NextResponse.json({
    invitations: invitations.map(inv => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      customerName: inv.customerName,
      status: inv.usedAt ? 'accepted' : inv.expiresAt < new Date() ? 'expired' : 'pending',
      sentAt: inv.createdAt.toISOString().split('T')[0],
      // §132 Der Link gehoert dazu: Wenn die E-Mail nicht ankommt — Spamfilter,
      // Tippfehler, kein Postfach im Betrieb —, muss die Leitung ihn weitergeben
      // koennen. Sonst steht der neue Kollege vor einer Tuer ohne Klinke.
      // Nur solange die Einladung noch offen ist.
      ...(inv.usedAt ? {} : { token: inv.token, link: `${origin}/register/${inv.token}` }),
    })),
  })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { email, role, name, customerName, customerId, employeeId, locationId } = body

  if (!email || typeof email !== 'string' || !email.trim()) {
    return NextResponse.json({ error: 'E-Mail ist erforderlich' }, { status: 400 })
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Ungültige Rolle' }, { status: 400 })
  }

  let resolvedCustomerName = customerName
  if (customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } })
    if (!customer) {
      return NextResponse.json({ error: 'Unternehmen nicht gefunden' }, { status: 400 })
    }
    resolvedCustomerName = customer.name
  }

  const invitation = await createAndSendInvitation(getAppOrigin(req), {
    email,
    role,
    name,
    customerName: resolvedCustomerName,
    customerId,
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
