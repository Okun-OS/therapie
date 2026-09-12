import { NextRequest, NextResponse } from 'next/server'
import { recordClockIn } from '@/lib/workforce-score-service'
import { requireRole } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'

export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const { employeeId, date, locationId } = await req.json()
  if (!employeeId || !date || !locationId) {
    return NextResponse.json({ error: 'employeeId, date und locationId sind erforderlich' }, { status: 400 })
  }

  // §109 Zugriffsschutz: Zeitdaten gehören genau einer Person. Ein Mitarbeiter
  // darf nur die eigenen bewegen, die Leitung nur die ihres Standorts.
  const zugriffVerweigert = await assertEmployeeAccess(session, employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  try {
    const entry = await recordClockIn(employeeId, date, locationId, new Date())
    return NextResponse.json({ entry })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Fehler beim Einstempeln' }, { status: 400 })
  }
}
