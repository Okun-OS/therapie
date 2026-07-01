import { NextRequest, NextResponse } from 'next/server'
import { listEmployees } from '@/lib/entities'
import { addEmployeeWithInvitation, LocationCustomerMismatchError } from '@/lib/invitations'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { getAppOrigin } from '@/lib/app-url'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const customerId = session.role === 'okun' ? undefined : await resolveCustomerId(session)
  if (session.role !== 'okun' && !customerId) {
    return NextResponse.json({ employees: [] })
  }
  const employees = await listEmployees(customerId)
  return NextResponse.json({ employees })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { name, email, position, weeklyHours, locationId } = body

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!EMAIL_RE.test(email?.trim() ?? '')) return NextResponse.json({ error: 'Ungültige E-Mail-Adresse' }, { status: 400 })

  if (!name?.trim() || !email?.trim() || !position?.trim() || !weeklyHours || !locationId) {
    return NextResponse.json({ error: 'name, email, position, weeklyHours und locationId sind erforderlich' }, { status: 400 })
  }

  const expectedCustomerId = session.role === 'okun' ? undefined : await resolveCustomerId(session)
  if (session.role !== 'okun' && !expectedCustomerId) {
    return NextResponse.json({ error: 'Kein Mandant für diesen Nutzer hinterlegt' }, { status: 403 })
  }

  try {
    const { employee, emailSent } = await addEmployeeWithInvitation(
      {
        name,
        email,
        position,
        weeklyHours,
        workDaysPerWeek: body.workDaysPerWeek,
        workDays: body.workDays,
        dailyTargetHours: body.dailyTargetHours,
        fixedOffDays: body.fixedOffDays,
        locationId,
        expectedCustomerId,
        phone: body.phone,
        birthDate: body.birthDate,
        roleType: body.roleType,
        employmentType: body.employmentType,
        gruppe: body.gruppe,
        bereich: body.bereich,
        multiGroupCapable: body.multiGroupCapable,
        fixedLocations: body.fixedLocations,
        qualifications: body.qualifications,
        allowedTasks: body.allowedTasks,
      },
      getAppOrigin(req),
      { sendInvitation: body.sendInvitation !== false },
    )

    return NextResponse.json({ employee, emailSent })
  } catch (err: unknown) {
    if (err instanceof LocationCustomerMismatchError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    if (err instanceof Error && err.message === 'Standort nicht gefunden') {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    console.error('employees POST', err)
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
