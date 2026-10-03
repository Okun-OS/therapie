import { NextRequest, NextResponse } from 'next/server'
import { listBereiche, createBereich } from '@/lib/entities'
import { requireRole, resolveCustomerId } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ bereiche: [] })

  const bereiche = await listBereiche(customerId)
  return NextResponse.json({ bereiche })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kein Mandant' }, { status: 403 })

  const { name, description } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name ist erforderlich' }, { status: 400 })

  const bereich = await createBereich({ customerId, name: name.trim(), description: description?.trim() || undefined })
  return NextResponse.json({ bereich }, { status: 201 })
}
