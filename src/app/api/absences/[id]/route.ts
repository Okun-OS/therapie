import { NextRequest, NextResponse } from 'next/server'
import { updateAbsence } from '@/lib/time-tracking-entities'
import { requireRole } from '@/lib/session'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const updates = await req.json()
  const absence = await updateAbsence(params.id, updates)
  if (!absence) return NextResponse.json({ error: 'Abwesenheit nicht gefunden' }, { status: 404 })
  return NextResponse.json({ absence })
}
