import { NextRequest, NextResponse } from 'next/server'
import { listPlatformInvitations, addPlatformInvitation } from '@/lib/okun-platform-entities'
import { requireRole } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  const invitations = await listPlatformInvitations()
  return NextResponse.json({ invitations })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  const { email, role, customerName } = await req.json()
  if (!email?.trim() || !role) {
    return NextResponse.json({ error: 'email und role sind erforderlich' }, { status: 400 })
  }

  const invitation = await addPlatformInvitation({ email, role, customerName })
  return NextResponse.json({ invitation })
}
