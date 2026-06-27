import { NextRequest, NextResponse } from 'next/server'
import { recordClockOut } from '@/lib/workforce-score-service'
import { requireRole } from '@/lib/session'

export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const { timeClockEntryId } = await req.json()
  if (!timeClockEntryId) {
    return NextResponse.json({ error: 'timeClockEntryId ist erforderlich' }, { status: 400 })
  }

  try {
    const entry = await recordClockOut(timeClockEntryId, new Date())
    return NextResponse.json({ entry })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Fehler beim Ausstempeln' }, { status: 400 })
  }
}
