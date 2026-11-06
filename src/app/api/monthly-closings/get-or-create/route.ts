import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateMonthlyClosing } from '@/lib/time-tracking-entities'
import { requireRole } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'

export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const { employeeId, year, month, employeeInfo } = await req.json()
  // §109 Zugriffsschutz: Zeit- und Abschlussdaten gehoeren genau einer Person.
  const zugriffVerweigert = await assertEmployeeAccess(session, employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  if (!employeeId || !year || !month) {
    return NextResponse.json({ error: 'employeeId, year und month sind erforderlich' }, { status: 400 })
  }

  const closing = await getOrCreateMonthlyClosing(employeeId, year, month, employeeInfo)
  return NextResponse.json({ closing })
}
