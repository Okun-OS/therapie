import { NextRequest, NextResponse } from 'next/server'
import { listEmployees } from '@/lib/entities'
import { notifyEmployee } from '@/lib/notify'
import { requireRole } from '@/lib/session'

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  let body: { locationId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { locationId } = body
  if (!locationId) {
    return NextResponse.json({ error: 'locationId ist erforderlich' }, { status: 400 })
  }

  const allEmployees = await listEmployees()
  const employees = allEmployees.filter(e => e.locationId === locationId && e.role === 'employee' && e.active)

  await Promise.all(
    employees.map(emp =>
      notifyEmployee(emp.id, {
        type: 'vacation-wishes-campaign',
        title: 'Urlaubswünsche eintragen',
        body: 'Die Jahresurlaubsplanung startet. Bitte trage deine Urlaubswünsche im Mitarbeiterportal ein.',
        url: '/employee/vacation',
      }),
    ),
  )

  return NextResponse.json({ notified: employees.length })
}
