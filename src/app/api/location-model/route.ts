import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveLocationId } from '@/lib/session'
import { getLocationModel } from '@/lib/company-model-service'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin'])
  if (session instanceof NextResponse) return session

  const locationId = await resolveLocationId(session)
  if (!locationId) return NextResponse.json({ error: 'Kein Standort zugeordnet' }, { status: 403 })

  const [model, onboarding] = await Promise.all([
    getLocationModel(locationId),
    prisma.locationOnboarding.findUnique({ where: { locationId }, select: { completed: true } }),
  ])

  return NextResponse.json({
    model,
    onboardingCompleted: onboarding?.completed ?? false,
    needsMigration: !model && (onboarding?.completed ?? false),
  })
}
