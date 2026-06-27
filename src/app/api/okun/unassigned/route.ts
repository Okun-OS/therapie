import { NextRequest, NextResponse } from 'next/server'
import { listUnassignedLocations, listUnassignedCompanyUsers } from '@/lib/entities'
import { requireRole } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  const [locations, companyUsers] = await Promise.all([
    listUnassignedLocations(),
    listUnassignedCompanyUsers(),
  ])
  return NextResponse.json({ locations, companyUsers })
}
