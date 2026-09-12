import { NextRequest, NextResponse } from 'next/server'
import { backfillTimeLog } from '@/lib/time-tracking-entities'
import { requireRole } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const { employeeId, date, clockIn, clockOut, breakMinutes, note, locationId, createdBy } = await req.json()
  // §109 Zugriffsschutz: Zeit- und Abschlussdaten gehoeren genau einer Person.
  const zugriffVerweigert = await assertEmployeeAccess(session, employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  if (!employeeId || !date || !clockIn || !clockOut || !locationId || !createdBy?.trim()) {
    return NextResponse.json({ error: 'employeeId, date, clockIn, clockOut, locationId und createdBy sind erforderlich' }, { status: 400 })
  }

  try {
    const log = await backfillTimeLog({ employeeId, date, clockIn, clockOut, breakMinutes, note, locationId }, createdBy)
    return NextResponse.json({ log })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
