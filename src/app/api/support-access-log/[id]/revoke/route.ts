import { NextRequest, NextResponse } from 'next/server'
import { revokeSupportAccess } from '@/lib/okun-platform-entities'
import { requireRole } from '@/lib/session'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  const entry = await revokeSupportAccess(params.id)
  return NextResponse.json({ entry })
}
