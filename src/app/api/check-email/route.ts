import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase()
  if (!email) return NextResponse.json({ available: false, error: 'email fehlt' }, { status: 400 })

  const [emp, user] = await Promise.all([
    prisma.employee.findUnique({ where: { email }, select: { id: true } }),
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
  ])

  return NextResponse.json({ available: !emp && !user })
}
