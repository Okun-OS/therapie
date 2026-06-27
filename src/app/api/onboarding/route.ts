import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const [organization, locations] = await Promise.all([
    prisma.organizationOnboarding.findUnique({ where: { id: 'singleton' } }),
    prisma.locationOnboarding.findMany(),
  ])
  return NextResponse.json({ organization, locations })
}
