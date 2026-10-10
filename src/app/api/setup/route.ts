import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { setSessionCookie } from '@/lib/session'

export const dynamic = 'force-dynamic'

// Bootstraps the very first account on a fresh database. There is no other
// way to create a user without already having one to send an invitation –
// this route is the one-time exception. It only works while the User table
// is still empty, and only with the SETUP_SECRET configured on the server,
// so it cannot be (re)used once a real account exists.
export async function GET() {
  const userCount = await prisma.user.count()
  return NextResponse.json({ needsSetup: userCount === 0, configured: !!process.env.SETUP_SECRET })
}

export async function POST(req: NextRequest) {
  const configuredSecret = process.env.SETUP_SECRET
  if (!configuredSecret) {
    return NextResponse.json({ error: 'Setup ist nicht konfiguriert (SETUP_SECRET fehlt)' }, { status: 503 })
  }

  const userCount = await prisma.user.count()
  if (userCount > 0) {
    return NextResponse.json({ error: 'Setup wurde bereits abgeschlossen' }, { status: 403 })
  }

  const { secret, email, password, name } = await req.json()
  if (secret !== configuredSecret) {
    return NextResponse.json({ error: 'Ungültiger Setup-Schlüssel' }, { status: 401 })
  }
  if (!email || typeof email !== 'string' || !email.trim()) {
    return NextResponse.json({ error: 'E-Mail ist erforderlich' }, { status: 400 })
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'Passwort muss mindestens 8 Zeichen lang sein' }, { status: 400 })
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Name ist erforderlich' }, { status: 400 })
  }

  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({
    data: {
      email: email.trim().toLowerCase(),
      passwordHash,
      name: name.trim(),
      role: 'okun',
    },
  })

  const res = NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  })
  setSessionCookie(res, { userId: user.id, email: user.email, role: 'okun' })
  return res
}
