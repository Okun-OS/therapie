import { NextRequest, NextResponse } from 'next/server'
import { respondToSwapRequest } from '@/lib/schedule-entities'
import { requireRole } from '@/lib/session'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const { status } = await req.json()
  if (status !== 'accepted' && status !== 'declined') {
    return NextResponse.json({ error: 'status muss accepted oder declined sein' }, { status: 400 })
  }

  await respondToSwapRequest(params.id, status)
  return NextResponse.json({ success: true })
}
