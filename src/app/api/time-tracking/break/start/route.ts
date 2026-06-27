import { NextRequest, NextResponse } from 'next/server'
import { startBreak } from '@/lib/time-tracking-entities'
import { requireRole } from '@/lib/session'

export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const { employeeId } = await req.json()
  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId ist erforderlich' }, { status: 400 })
  }

  await startBreak(employeeId)
  return NextResponse.json({ success: true })
}
