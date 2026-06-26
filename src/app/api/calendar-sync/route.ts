import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const employeeId = req.nextUrl.searchParams.get('employeeId')
  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId ist erforderlich' }, { status: 400 })
  }

  const sync = await prisma.employeeCalendarSync.findUnique({ where: { employeeId } })
  return NextResponse.json({ enabled: sync?.enabled ?? false, token: sync?.token ?? null })
}

export async function PATCH(req: NextRequest) {
  const { employeeId, enabled } = await req.json()
  if (!employeeId || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'employeeId und enabled sind erforderlich' }, { status: 400 })
  }

  const sync = await prisma.employeeCalendarSync.upsert({
    where: { employeeId },
    update: { enabled },
    create: { employeeId, enabled },
  })
  return NextResponse.json({ enabled: sync.enabled, token: sync.token })
}
