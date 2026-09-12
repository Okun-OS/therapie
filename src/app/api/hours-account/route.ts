import { NextRequest, NextResponse } from 'next/server'
import { getHoursAccountSummary } from '@/lib/time-tracking-entities'
import { requireRole } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const employeeId = req.nextUrl.searchParams.get('employeeId')
  const year = req.nextUrl.searchParams.get('year')
  const month = req.nextUrl.searchParams.get('month')
  const weeklyHours = req.nextUrl.searchParams.get('weeklyHours')
  if (!employeeId || !year || !month) {
    return NextResponse.json({ error: 'employeeId, year und month sind erforderlich' }, { status: 400 })
  }

  // §109 Zugriffsschutz: Zeitdaten gehören genau einer Person. Ein Mitarbeiter
  // darf nur die eigenen bewegen, die Leitung nur die ihres Standorts.
  const zugriffVerweigert = await assertEmployeeAccess(session, employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  const summary = await getHoursAccountSummary(employeeId, Number(year), Number(month), weeklyHours ? Number(weeklyHours) : undefined)
  return NextResponse.json({ summary })
}
