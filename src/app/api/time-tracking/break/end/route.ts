import { NextRequest, NextResponse } from 'next/server'
import { endBreak } from '@/lib/time-tracking-entities'
import { requireRole } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'

export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const { employeeId } = await req.json()
  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId ist erforderlich' }, { status: 400 })
  }

  // §109 Zugriffsschutz: Zeitdaten gehören genau einer Person. Ein Mitarbeiter
  // darf nur die eigenen bewegen, die Leitung nur die ihres Standorts.
  const zugriffVerweigert = await assertEmployeeAccess(session, employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  await endBreak(employeeId)
  return NextResponse.json({ success: true })
}
