import { NextRequest, NextResponse } from 'next/server'
import { getActiveTimeLog } from '@/lib/time-tracking-entities'
import { getActiveTimeClockEntry } from '@/lib/workforce-score-service'
import { requireRole } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const employeeId = req.nextUrl.searchParams.get('employeeId')
  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId ist erforderlich' }, { status: 400 })
  }

  const [log, clockEntry] = await Promise.all([
    getActiveTimeLog(employeeId),
    getActiveTimeClockEntry(employeeId),
  ])
  return NextResponse.json({ log: log ?? null, entryId: clockEntry?.id ?? null })
}
