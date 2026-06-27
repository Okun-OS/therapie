import { NextRequest, NextResponse } from 'next/server'
import { setShiftMinStaff } from '@/lib/schedule-entities'
import { requireRole } from '@/lib/session'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const { minStaff } = await req.json()
  if (typeof minStaff !== 'number') {
    return NextResponse.json({ error: 'minStaff ist erforderlich' }, { status: 400 })
  }

  await setShiftMinStaff(params.id, minStaff)
  return NextResponse.json({ success: true })
}
