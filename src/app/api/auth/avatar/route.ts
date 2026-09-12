import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'

export const dynamic = 'force-dynamic'

const MAX_SIZE_BYTES = 500_000 // 500 KB base64 limit

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  let body: { dataUrl?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { dataUrl } = body
  if (!dataUrl) return NextResponse.json({ error: 'Kein Bild übermittelt' }, { status: 400 })

  if (!dataUrl.startsWith('data:image/')) {
    return NextResponse.json({ error: 'Nur Bilddateien erlaubt' }, { status: 400 })
  }

  if (dataUrl.length > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'Bild zu groß (max. 375 KB)' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { avatarUrl: dataUrl },
  })

  // Also update linked employee record if present
  if (session.employeeId) {
    await prisma.employee.updateMany({
      where: { id: session.employeeId },
      data: { avatarUrl: dataUrl },
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, avatarUrl: dataUrl })
}

export async function DELETE(req: NextRequest) {
  const session = getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  await prisma.user.update({
    where: { id: session.userId },
    data: { avatarUrl: null },
  })

  if (session.employeeId) {
    await prisma.employee.updateMany({
      where: { id: session.employeeId },
      data: { avatarUrl: null },
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
