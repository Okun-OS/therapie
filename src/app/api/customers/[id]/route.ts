import { NextRequest, NextResponse } from 'next/server'
import { updateCustomer, softDeleteCustomer, hardDeleteCustomer } from '@/lib/entities'
import { requireRole } from '@/lib/session'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  const updates = await req.json()
  const customer = await updateCustomer(params.id, updates)
  if (!customer) return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 })
  return NextResponse.json({ customer })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  const { mode, confirmName } = await req.json().catch(() => ({ mode: 'soft', confirmName: '' }))

  if (mode === 'hard') {
    if (!confirmName) return NextResponse.json({ error: 'confirmName fehlt' }, { status: 400 })
    const ok = await hardDeleteCustomer(params.id)
    if (!ok) return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 })
    return NextResponse.json({ deleted: true, mode: 'hard' })
  }

  const ok = await softDeleteCustomer(params.id)
  if (!ok) return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 })
  return NextResponse.json({ deleted: true, mode: 'soft' })
}
