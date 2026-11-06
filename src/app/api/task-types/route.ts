import { NextRequest, NextResponse } from 'next/server'
import { listTaskTypes, addTaskType } from '@/lib/okun-platform-entities'
import { requireRole } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const taskTypes = await listTaskTypes()
  return NextResponse.json({ taskTypes })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const { name } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'name ist erforderlich' }, { status: 400 })
  }

  const taskTypes = await addTaskType(name)
  return NextResponse.json({ taskTypes })
}
