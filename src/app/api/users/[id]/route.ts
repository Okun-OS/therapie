import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, email: true, name: true, role: true, customerId: true, customerName: true, locationId: true, createdAt: true },
  })
  if (!user) return NextResponse.json({ error: 'Nutzer nicht gefunden' }, { status: 404 })
  return NextResponse.json({ user })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, email: true },
    })
    if (!user) return NextResponse.json({ error: 'Nutzer nicht gefunden' }, { status: 404 })

    await prisma.user.delete({ where: { id: params.id } })

    await prisma.adminAuditLog.create({
      data: {
        id: crypto.randomUUID(),
        action: 'DELETE_USER',
        entityType: 'User',
        entityId: params.id,
        entityName: user.name || user.email,
        actorId: session.userId,
        actorName: session.name ?? session.email,
      },
    })

    return NextResponse.json({ deleted: true })
  } catch (err: unknown) {
    console.error('users DELETE', err)
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
