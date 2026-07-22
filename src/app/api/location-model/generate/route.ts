import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveLocationId, resolveCustomerId } from '@/lib/session'
import { generateLocationModelFromOnboarding } from '@/lib/company-model-service'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin'])
  if (session instanceof NextResponse) return session

  const locationId = await resolveLocationId(session)
  if (!locationId) return NextResponse.json({ error: 'Kein Standort zugeordnet' }, { status: 403 })

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kein Mandant' }, { status: 403 })

  const onboarding = await prisma.locationOnboarding.findUnique({
    where: { locationId },
    select: { completed: true },
  })

  if (!onboarding?.completed) {
    return NextResponse.json(
      { error: 'Das Onboarding ist noch nicht abgeschlossen. Bitte führe zuerst das Onboarding durch.' },
      { status: 422 },
    )
  }

  const model = await generateLocationModelFromOnboarding(locationId, customerId)
  if (!model) {
    return NextResponse.json(
      { error: 'Planungsmodell konnte nicht erstellt werden. Bitte das Onboarding prüfen.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ model })
}
