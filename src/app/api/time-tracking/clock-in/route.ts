import { NextRequest, NextResponse } from 'next/server'
import { recordClockIn } from '@/lib/workforce-score-service'

export async function POST(req: NextRequest) {
  const { employeeId, date, locationId } = await req.json()
  if (!employeeId || !date || !locationId) {
    return NextResponse.json({ error: 'employeeId, date und locationId sind erforderlich' }, { status: 400 })
  }

  try {
    const entry = await recordClockIn(employeeId, date, locationId, new Date())
    return NextResponse.json({ entry })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Fehler beim Einstempeln' }, { status: 400 })
  }
}
