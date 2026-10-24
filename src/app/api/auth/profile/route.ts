import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, setSessionCookie, type SessionRole } from '@/lib/session'
import { hashPassword, verifyPassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest) {
  const session = getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  let body: { name?: string; currentPassword?: string; newPassword?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } })
  if (!user) return NextResponse.json({ error: 'Nutzer nicht gefunden' }, { status: 404 })

  const updates: { name?: string; passwordHash?: string } = {}

  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name) return NextResponse.json({ error: 'Name darf nicht leer sein' }, { status: 400 })
    updates.name = name
  }

  if (body.newPassword !== undefined) {
    if (!body.currentPassword) {
      return NextResponse.json({ error: 'Aktuelles Passwort erforderlich' }, { status: 400 })
    }
    const valid = await verifyPassword(body.currentPassword, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'Aktuelles Passwort ist falsch' }, { status: 400 })
    }
    if (body.newPassword.length < 8) {
      return NextResponse.json({ error: 'Neues Passwort muss mindestens 8 Zeichen haben' }, { status: 400 })
    }
    updates.passwordHash = await hashPassword(body.newPassword)
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true })
  }

  const updated = await prisma.user.update({ where: { id: session.userId }, data: updates })

  const res = NextResponse.json({
    ok: true,
    user: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      avatarUrl: updated.avatarUrl ?? undefined,
    },
  })

  // Refresh session cookie if name changed
  if (updates.name) {
    setSessionCookie(res, {
      userId: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role as SessionRole,
      employeeId: updated.employeeId ?? undefined,
      locationId: updated.locationId ?? undefined,
      customerId: updated.customerId ?? undefined,
      customerName: updated.customerName ?? undefined,
      bereichIds: updated.bereichIds,
    })
  }

  return res
}
