import { NextRequest, NextResponse } from 'next/server'
import { respondToOvertimeRequest } from '@/lib/time-tracking-entities'
import { requireRole } from '@/lib/session'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const { status, respondedBy, approvedMinutes, adminComment } = await req.json()
  if (!status || !respondedBy) {
    return NextResponse.json({ error: 'status und respondedBy sind erforderlich' }, { status: 400 })
  }

  await respondToOvertimeRequest(params.id, status, respondedBy, approvedMinutes, adminComment)
  return NextResponse.json({ success: true })
}
