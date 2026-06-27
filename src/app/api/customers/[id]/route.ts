import { NextRequest, NextResponse } from 'next/server'
import { updateCustomer } from '@/lib/entities'
import { requireRole } from '@/lib/session'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  const updates = await req.json()
  const customer = await updateCustomer(params.id, updates)
  if (!customer) return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 })
  return NextResponse.json({ customer })
}
