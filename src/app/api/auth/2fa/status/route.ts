import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { totpEnabled: true },
  })

  return NextResponse.json({ totpEnabled: user?.totpEnabled ?? false })
}
