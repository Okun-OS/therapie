import { NextRequest, NextResponse } from 'next/server'
import { updateBereich, deleteBereich } from '@/lib/entities'
import { requireRole } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const { name, description } = await req.json()
  const updates: { name?: string; description?: string } = {}
  if (name !== undefined) updates.name = name.trim()
  if (description !== undefined) updates.description = description?.trim() || undefined

  const bereich = await updateBereich(params.id, updates)
  if (!bereich) return NextResponse.json({ error: 'Bereich nicht gefunden' }, { status: 404 })
  return NextResponse.json({ bereich })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const ok = await deleteBereich(params.id)
  if (!ok) return NextResponse.json({ error: 'Bereich nicht gefunden' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
