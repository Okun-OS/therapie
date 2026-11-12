import { NextRequest, NextResponse } from 'next/server'
import { updateTestAccount } from '@/lib/okun-platform-entities'
import { requireRole } from '@/lib/session'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  const updates = await req.json()
  const account = await updateTestAccount(params.id, updates)
  return NextResponse.json({ account })
}
