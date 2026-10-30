import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId, resolveLocationId } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const { searchParams } = new URL(req.url)
  const scope = searchParams.get('scope')
  const locationId = searchParams.get('locationId')

  if (scope === 'organization') {
    const customerId = await resolveCustomerId(session)
    if (!customerId) return NextResponse.json({ messages: [], completed: false })
    const row = await prisma.organizationOnboarding.findUnique({ where: { customerId } })
    if (!row) return NextResponse.json({ messages: [], completed: false })
    return NextResponse.json({
      messages: (row.chatMessages as unknown as object[]) ?? [],
      completed: row.completed,
      savedAt: row.updatedAt,
    })
  }

  if (scope === 'location') {
    const resolvedId = locationId || (await resolveLocationId(session))
    if (!resolvedId) return NextResponse.json({ messages: [], completed: false })
    const row = await prisma.locationOnboarding.findUnique({ where: { locationId: resolvedId } })
    if (!row) return NextResponse.json({ messages: [], completed: false })
    return NextResponse.json({
      messages: (row.chatMessages as unknown as object[]) ?? [],
      completed: row.completed,
      savedAt: row.updatedAt,
    })
  }

  return NextResponse.json({ error: 'Unbekannter Scope' }, { status: 400 })
}

export async function DELETE(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  let body: { scope?: string; locationId?: string }
  try { body = await req.json() } catch { body = {} }

  if (body.scope === 'organization') {
    const customerId = await resolveCustomerId(session)
    if (customerId) {
      await prisma.organizationOnboarding.updateMany({
        where: { customerId },
        data: { chatMessages: undefined, completed: false },
      })
    }
  } else if (body.scope === 'location') {
    const locationId = body.locationId || (await resolveLocationId(session))
    if (locationId) {
      await prisma.locationOnboarding.updateMany({
        where: { locationId },
        data: { chatMessages: undefined, completed: false },
      })
    }
  }

  return NextResponse.json({ ok: true })
}
