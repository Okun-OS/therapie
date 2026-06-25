import { NextRequest, NextResponse } from 'next/server'
import { getControllingSnapshot } from '@/lib/controlling-service'

export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get('scope')
  const locationId = scope === 'organization' ? undefined : req.nextUrl.searchParams.get('locationId') ?? undefined
  const snapshot = await getControllingSnapshot(locationId)
  return NextResponse.json(snapshot)
}
