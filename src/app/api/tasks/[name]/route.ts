import { NextRequest, NextResponse } from 'next/server'
import { removeTaskType } from '@/lib/mock-data'
import { removeAllowedTaskFromEmployees } from '@/lib/entities'
import { requireRole } from '@/lib/session'

export async function DELETE(req: NextRequest, { params }: { params: { name: string } }) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const name = decodeURIComponent(params.name)
  removeTaskType(name)
  await removeAllowedTaskFromEmployees(name)
  return NextResponse.json({ success: true })
}
