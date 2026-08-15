import { NextRequest, NextResponse } from 'next/server'
import { getVacationPreference, listAllVacationPreferences, setVacationPreference } from '@/lib/vacation-entities'
import { requireRole } from '@/lib/session'
import { allowedLocationScope, assertEmployeeAccess } from '@/lib/scope'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const employeeId = req.nextUrl.searchParams.get('employeeId')
  if (employeeId) {
    const denied = await assertEmployeeAccess(session, employeeId)
    if (denied) return denied
    const preference = await getVacationPreference(employeeId)
    return NextResponse.json({ preference })
  }

  // §81 scope guard — only preferences of employees at accessible locations
  const scope = await allowedLocationScope(session)
  if (scope.kind === 'all') {
    return NextResponse.json({ preferences: await listAllVacationPreferences() })
  }
  const employees = await prisma.employee.findMany({
    where: { locationId: { in: scope.ids } },
    select: { id: true },
  })
  const preferences = await prisma.vacationPlanPreference.findMany({
    where: { employeeId: { in: employees.map(e => e.id) } },
  })
  return NextResponse.json({ preferences })
}

export async function PUT(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const body = await req.json()
  if (!body.employeeId) {
    return NextResponse.json({ error: 'employeeId ist erforderlich' }, { status: 400 })
  }
  const denied = await assertEmployeeAccess(session, body.employeeId)
  if (denied) return denied

  const preference = await setVacationPreference(body)
  return NextResponse.json({ preference })
}
