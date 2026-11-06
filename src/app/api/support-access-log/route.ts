import { NextRequest, NextResponse } from 'next/server'
import { listSupportAccessLog, addSupportAccess } from '@/lib/okun-platform-entities'
import { requireRole } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  const log = await listSupportAccessLog()
  return NextResponse.json({ log })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  const { customerName, requestedBy, reason } = await req.json()
  if (!customerName?.trim() || !requestedBy?.trim() || !reason?.trim()) {
    return NextResponse.json({ error: 'customerName, requestedBy und reason sind erforderlich' }, { status: 400 })
  }

  const entry = await addSupportAccess({ customerName, requestedBy, reason })
  return NextResponse.json({ entry })
}
