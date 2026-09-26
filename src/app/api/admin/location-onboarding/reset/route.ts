import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId, resolveLocationId } from '@/lib/session'
import { listLocations } from '@/lib/entities'

// Setzt das KI-Onboarding eines Standorts vollständig zurück: Onboarding-Antworten,
// Planungsregeln, Dienste und temporäre Planungshinweise werden gelöscht, damit der
// Standort neu eingerichtet werden kann. Mitarbeiter, Nutzerkonten und der bisherige
// Dienstplanverlauf (ScheduleEntry) bleiben unangetastet.
export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  let body: { locationId?: string; confirm?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  if (body.confirm !== true) {
    return NextResponse.json({ error: 'Bestätigung erforderlich' }, { status: 400 })
  }

  let locationId: string | undefined

  if (session.role === 'admin') {
    locationId = await resolveLocationId(session)
  } else if (session.role === 'okun') {
    locationId = body.locationId
  } else {
    const customerId = await resolveCustomerId(session)
    if (!customerId) {
      return NextResponse.json({ error: 'Kein Unternehmen für diesen Nutzer hinterlegt' }, { status: 400 })
    }
    const scoped = await listLocations(customerId)
    locationId = body.locationId && scoped.some(l => l.id === body.locationId) ? body.locationId : undefined
  }

  if (!locationId) {
    return NextResponse.json({ error: 'Standort nicht gefunden oder keine Berechtigung' }, { status: 400 })
  }

  await prisma.$transaction([
    prisma.locationOnboarding.deleteMany({ where: { locationId } }),
    prisma.locationPlanningRules.deleteMany({ where: { locationId } }),
    prisma.shift.deleteMany({ where: { locationId } }),
    prisma.schedulingPeriodNote.deleteMany({ where: { locationId } }),
    prisma.planningUnit.deleteMany({ where: { locationId } }),
  ])

  return NextResponse.json({ success: true })
}
