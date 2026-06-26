import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) {
    return NextResponse.json({ error: 'E-Mail und Passwort sind erforderlich' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email: String(email).trim().toLowerCase() } })
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: 'E-Mail oder Passwort ungültig' }, { status: 401 })
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId ?? undefined,
      locationId: user.locationId ?? undefined,
    },
  })
}
