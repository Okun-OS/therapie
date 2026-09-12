import { NextRequest, NextResponse } from 'next/server'
import { reassignLocationAdmin } from '@/lib/entities'
import { requireRole } from '@/lib/session'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { newAdminEmployeeId } = body
  if (!newAdminEmployeeId?.trim()) {
    return NextResponse.json({ error: 'newAdminEmployeeId ist erforderlich' }, { status: 400 })
  }

  await reassignLocationAdmin(params.id, newAdminEmployeeId)
  return NextResponse.json({ success: true })
}
