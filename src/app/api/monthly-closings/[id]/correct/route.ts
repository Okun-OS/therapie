import { NextRequest, NextResponse } from 'next/server'
import { correctMonthlyClosingTimeLog } from '@/lib/time-tracking-entities'
import { requireRole } from '@/lib/session'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const { timeLogId, updates, correctedBy } = await req.json()
  if (!timeLogId || !updates || !correctedBy?.trim()) {
    return NextResponse.json({ error: 'timeLogId, updates und correctedBy sind erforderlich' }, { status: 400 })
  }

  try {
    await correctMonthlyClosingTimeLog(params.id, timeLogId, updates, correctedBy)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
