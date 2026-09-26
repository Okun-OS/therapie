import { NextRequest, NextResponse } from 'next/server'
import { listTestAccounts, addTestAccount } from '@/lib/okun-platform-entities'
import { requireRole } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  const accounts = await listTestAccounts()
  return NextResponse.json({ accounts })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  const { customerName, contactEmail, durationDays } = await req.json()
  if (!customerName?.trim() || !contactEmail?.trim() || !durationDays) {
    return NextResponse.json({ error: 'customerName, contactEmail und durationDays sind erforderlich' }, { status: 400 })
  }

  const account = await addTestAccount({ customerName, contactEmail, durationDays })
  return NextResponse.json({ account })
}
