import { NextRequest, NextResponse } from 'next/server'
import { getOrgSettings, updateOrgSettings } from '@/lib/okun-platform-entities'
import { requireRole } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const settings = await getOrgSettings()
  return NextResponse.json({ settings })
}

export async function PATCH(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const updates = await req.json()
  const settings = await updateOrgSettings(updates)
  return NextResponse.json({ settings })
}
