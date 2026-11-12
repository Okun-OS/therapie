import { NextRequest, NextResponse } from 'next/server'
import { getControllingSnapshot } from '@/lib/controlling-service'
import { requireRole, resolveCustomerId } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const scope = req.nextUrl.searchParams.get('scope')
  const locationId = scope === 'organization' ? undefined : req.nextUrl.searchParams.get('locationId') ?? undefined
  const snapshot = await getControllingSnapshot(locationId, await resolveCustomerId(session))
  return NextResponse.json(snapshot)
}
