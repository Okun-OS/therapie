import { NextRequest, NextResponse } from 'next/server'
import { assignLocationToCustomer, assignCompanyUserToCustomer, assignAdminUserToLocation } from '@/lib/entities'
import { requireRole } from '@/lib/session'

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  let body: { type?: 'location' | 'companyUser' | 'adminLocation'; id?: string; customerId?: string; locationId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { type, id, customerId, locationId } = body
  if (!type || !id) {
    return NextResponse.json({ error: 'type und id sind erforderlich' }, { status: 400 })
  }

  if (type === 'location') {
    if (!customerId) return NextResponse.json({ error: 'customerId ist erforderlich' }, { status: 400 })
    await assignLocationToCustomer(id, customerId)
  } else if (type === 'companyUser') {
    if (!customerId) return NextResponse.json({ error: 'customerId ist erforderlich' }, { status: 400 })
    await assignCompanyUserToCustomer(id, customerId)
  } else if (type === 'adminLocation') {
    if (!locationId) return NextResponse.json({ error: 'locationId ist erforderlich' }, { status: 400 })
    try {
      await assignAdminUserToLocation(id, locationId)
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || 'Zuordnung fehlgeschlagen' }, { status: 400 })
    }
  } else {
    return NextResponse.json({ error: 'Unbekannter type' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
