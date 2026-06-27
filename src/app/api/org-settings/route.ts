import { NextRequest, NextResponse } from 'next/server'
import { getOrgSettings, updateOrgSettings } from '@/lib/okun-platform-entities'
import { requireRole } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  if (!session.customerId) {
    return NextResponse.json({ settings: null })
  }
  const settings = await getOrgSettings(session.customerId)
  return NextResponse.json({ settings })
}

export async function PATCH(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  if (!session.customerId) {
    return NextResponse.json({ error: 'Kein Mandant für diesen Nutzer hinterlegt' }, { status: 400 })
  }
  const updates = await req.json()
  const settings = await updateOrgSettings(session.customerId, updates)
  return NextResponse.json({ settings })
}
