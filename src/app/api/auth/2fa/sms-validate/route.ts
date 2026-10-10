import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { setSessionCookie } from '@/lib/session'

export const dynamic = 'force-dynamic'

const MAX_ATTEMPTS = 5

// Called during login: user types the 6-digit SMS code, we issue the session cookie
export async function POST(req: NextRequest) {
  const { userId, code } = await req.json().catch(() => ({ userId: '', code: '' }))
  if (!userId || !code) return NextResponse.json({ error: 'userId und code erforderlich' }, { status: 400 })

  const record = await prisma.smsTotpCode.findFirst({
    where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
  if (!record) {
    return NextResponse.json({ error: 'Code abgelaufen. Bitte neu anfordern.' }, { status: 400 })
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await prisma.smsTotpCode.delete({ where: { id: record.id } })
    return NextResponse.json({ error: 'Konto vorübergehend gesperrt. Bitte neuen Code anfordern.' }, { status: 429 })
  }

  const valid = await bcrypt.compare(code.trim(), record.codeHash)
  if (!valid) {
    await prisma.smsTotpCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } })
    return NextResponse.json({ error: 'Falscher Code.' }, { status: 400 })
  }

  await prisma.smsTotpCode.update({ where: { id: record.id }, data: { usedAt: new Date() } })

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ error: 'Nutzer nicht gefunden' }, { status: 404 })

  const res = NextResponse.json({ ok: true })
  setSessionCookie(res, {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role as 'admin' | 'employee' | 'company' | 'okun',
    employeeId: user.employeeId ?? undefined,
    locationId: user.locationId ?? undefined,
    customerId: user.customerId ?? undefined,
    customerName: user.customerName ?? undefined,
  })
  return res
}
