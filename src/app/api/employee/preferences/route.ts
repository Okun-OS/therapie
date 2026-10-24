// Employee self-service endpoint for persistent planning preferences.
// Employees can read and update their own shift preference and planning note.
// Admin-only fields (surchargeMode, maxConsecutiveDays, weekendRule) are
// intentionally excluded — those require admin approval.
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['employee', 'admin', 'company'])
  if (session instanceof NextResponse) return session

  const employeeId = session.employeeId
  if (!employeeId) {
    return NextResponse.json({ error: 'Kein Mitarbeiterprofil verknüpft' }, { status: 403 })
  }

  const profile = await prisma.employeePlanningProfile.findUnique({
    where: { employeeId },
    select: { shiftPreference: true },
  })

  return NextResponse.json({
    shiftPreference: profile?.shiftPreference ?? 'keine',
  })
}

export async function PUT(req: NextRequest) {
  const session = requireRole(req, ['employee', 'admin', 'company'])
  if (session instanceof NextResponse) return session

  const employeeId = session.employeeId
  if (!employeeId) {
    return NextResponse.json({ error: 'Kein Mitarbeiterprofil verknüpft' }, { status: 403 })
  }

  const body = await req.json()
  // §200 Die Planungsnotiz ist entfernt — kein Rechenkern hat sie gelesen.
  const { shiftPreference } = body

  const validPreferences = ['frueh', 'spaet', 'nacht', 'keine']
  if (shiftPreference !== undefined && !validPreferences.includes(shiftPreference)) {
    return NextResponse.json({ error: `Ungültige Schichtpräferenz: ${shiftPreference}` }, { status: 400 })
  }

  const profile = await prisma.employeePlanningProfile.upsert({
    where: { employeeId },
    create: {
      employeeId,
      ...(shiftPreference !== undefined && { shiftPreference }),
    },
    update: {
      ...(shiftPreference !== undefined && { shiftPreference }),
    },
    select: { shiftPreference: true },
  })

  return NextResponse.json(profile)
}
