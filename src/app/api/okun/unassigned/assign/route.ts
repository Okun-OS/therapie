import { NextRequest, NextResponse } from 'next/server'
import { assignLocationToCustomer, assignCompanyUserToCustomer } from '@/lib/entities'
import { requireRole } from '@/lib/session'

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  let body: { type?: 'location' | 'companyUser'; id?: string; customerId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { type, id, customerId } = body
  if (!type || !id || !customerId) {
    return NextResponse.json({ error: 'type, id und customerId sind erforderlich' }, { status: 400 })
  }

  if (type === 'location') {
    await assignLocationToCustomer(id, customerId)
  } else if (type === 'companyUser') {
    await assignCompanyUserToCustomer(id, customerId)
  } else {
    return NextResponse.json({ error: 'Unbekannter type' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
