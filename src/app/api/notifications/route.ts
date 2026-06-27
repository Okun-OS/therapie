import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const employeeId = req.nextUrl.searchParams.get('employeeId')
  if (!employeeId) return NextResponse.json({ error: 'employeeId ist erforderlich' }, { status: 400 })

  const notifications = await prisma.notification.findMany({
    where: { employeeId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  return NextResponse.json({ notifications })
}
