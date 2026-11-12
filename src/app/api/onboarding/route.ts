import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { listLocations } from '@/lib/entities'
import { requireRole, resolveCustomerId, resolveLocationId } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  if (session.role === 'okun') {
    const locations = await prisma.locationOnboarding.findMany()
    return NextResponse.json({ organization: null, locations })
  }

  if (session.role === 'admin') {
    const locationId = await resolveLocationId(session)
    if (!locationId) {
      return NextResponse.json({ organization: null, locations: [] })
    }
    const location = await prisma.locationOnboarding.findUnique({ where: { locationId } })
    return NextResponse.json({ organization: null, locations: location ? [location] : [] })
  }

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ organization: null, locations: [] })
  }

  const scopedLocationIds = (await listLocations(customerId)).map(l => l.id)
  const [organization, locations] = await Promise.all([
    prisma.organizationOnboarding.findUnique({ where: { customerId } }),
    prisma.locationOnboarding.findMany({ where: { locationId: { in: scopedLocationIds } } }),
  ])
  return NextResponse.json({ organization, locations })
}
