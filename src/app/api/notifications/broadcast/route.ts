import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { locationFilter } from '@/lib/scope'
import { prisma } from '@/lib/prisma'
import { notifyEmployee } from '@/lib/notify'

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const { title, body, url, locationId: bodyLocationId } = await req.json()

  // §111 Ein Rundruf ging an jeden angegebenen Standort — auch an den eines
  // fremden Kunden.
  if (bodyLocationId) {
    const erlaubt = await locationFilter(session, bodyLocationId)
    if (erlaubt instanceof NextResponse) return erlaubt
  }

  if (!title?.trim() || !body?.trim()) {
    return NextResponse.json({ error: 'title und body sind erforderlich' }, { status: 400 })
  }

  // Admins may only broadcast to their own location; company/okun may pass an explicit locationId
  const effectiveLocationId = session.role === 'admin' ? session.locationId : (bodyLocationId ?? session.locationId)

  if (!effectiveLocationId) {
    return NextResponse.json({ error: 'locationId fehlt' }, { status: 400 })
  }

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const employees = await prisma.employee.findMany({
    where: { locationId: effectiveLocationId, active: true, role: 'employee' },
    select: { id: true },
  })

  // Fire & forget — log individual failures but don't abort the whole broadcast
  let sent = 0
  let failed = 0
  await Promise.allSettled(
    employees.map(async emp => {
      try {
        await notifyEmployee(emp.id, {
          type: 'announcement',
          title: title.trim(),
          body: body.trim(),
          url: url ?? '/employee/schedule',
        })
        sent++
      } catch {
        failed++
      }
    })
  )

  return NextResponse.json({ sent, failed, total: employees.length })
}
