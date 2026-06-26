import { NextRequest, NextResponse } from 'next/server'
import { updateCustomer } from '@/lib/entities'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const updates = await req.json()
  const customer = await updateCustomer(params.id, updates)
  if (!customer) return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 })
  return NextResponse.json({ customer })
}
