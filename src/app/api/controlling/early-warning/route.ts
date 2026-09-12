import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyEmployee } from '@/lib/notify'
import { getEarlyWarnings } from '@/lib/controlling-service'
import { requireRole, resolveCustomerId } from '@/lib/session'

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  let body: { employeeId?: string; locationId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { employeeId, locationId } = body
  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId ist erforderlich' }, { status: 400 })
  }

  const warnings = await getEarlyWarnings(locationId, await resolveCustomerId(session))
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  let created = 0
  for (const warning of warnings) {
    const existing = await prisma.notification.findFirst({
      where: { employeeId, type: warning.type, createdAt: { gte: startOfDay } },
    })
    if (existing) continue
    await notifyEmployee(employeeId, {
      type: warning.type,
      title: warning.title,
      body: warning.body,
      url: '/admin/auswertungen',
    })
    created++
  }

  return NextResponse.json({ created })
}
