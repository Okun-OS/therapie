import { NextRequest, NextResponse } from 'next/server'
import { setVacationRequestStatus } from '@/lib/vacation-entities'
import { requireRole } from '@/lib/session'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const { status, respondedBy } = await req.json()
  if (!status || !respondedBy?.trim()) {
    return NextResponse.json({ error: 'status und respondedBy sind erforderlich' }, { status: 400 })
  }

  const request = await setVacationRequestStatus(params.id, status, respondedBy)
  return NextResponse.json({ request })
}
