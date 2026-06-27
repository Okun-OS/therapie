import { NextRequest, NextResponse } from 'next/server'
import { updateTimeLog } from '@/lib/time-tracking-entities'
import { requireRole } from '@/lib/session'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const updates = await req.json()
  const log = await updateTimeLog(params.id, updates)
  if (!log) return NextResponse.json({ error: 'Zeiteintrag nicht gefunden' }, { status: 404 })
  return NextResponse.json({ log })
}
