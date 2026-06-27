import { NextRequest, NextResponse } from 'next/server'
import { updateWishSubmission } from '@/lib/schedule-entities'
import { requireRole } from '@/lib/session'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const updates = await req.json()
  await updateWishSubmission(params.id, updates)
  return NextResponse.json({ success: true })
}
