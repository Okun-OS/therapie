import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'

const MAX_DATA_URL_LENGTH = 500 * 1024 // 500 KB

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company', 'okun', 'employee'])
  if (session instanceof NextResponse) return session

  let body: { avatarDataUrl?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 })
  }

  const { avatarDataUrl } = body

  if (typeof avatarDataUrl !== 'string') {
    return NextResponse.json({ error: 'avatarDataUrl wird als String erwartet' }, { status: 400 })
  }

  if (!avatarDataUrl.startsWith('data:image/')) {
    return NextResponse.json({ error: 'Nur Bild-Daten-URLs (data:image/...) sind erlaubt' }, { status: 400 })
  }

  if (avatarDataUrl.length > MAX_DATA_URL_LENGTH) {
    return NextResponse.json({ error: 'Bild zu groß – maximal 500 KB erlaubt' }, { status: 413 })
  }

  const existing = await prisma.employee.findUnique({ where: { id: params.id } })
  if (!existing) {
    return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated = await (prisma.employee as any).update({
    where: { id: params.id },
    data: { avatarUrl: avatarDataUrl },
  })

  return NextResponse.json({ employee: { id: updated.id as string, avatarUrl: updated.avatarUrl as string } })
}
