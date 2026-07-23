import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveLocationId, resolveCustomerId } from '@/lib/session'
import { getLocationModel, saveLocationModel } from '@/lib/company-model-service'
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

export async function PATCH(req: NextRequest) {
  try {
    const session = requireRole(req, ['admin'])
    if (session instanceof NextResponse) return session

    const locationId = await resolveLocationId(session)
    if (!locationId) return NextResponse.json({ error: 'Kein Standort' }, { status: 403 })

    const customerId = await resolveCustomerId(session)
    if (!customerId) return NextResponse.json({ error: 'Kein Mandant' }, { status: 403 })

    const body = await req.json() as { arbeitstage?: string[] }

    const model = await getLocationModel(locationId)
    if (!model) return NextResponse.json({ error: 'Kein Planungsmodell vorhanden' }, { status: 404 })

    if (body.arbeitstage !== undefined) {
      const valid = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
      const cleaned = body.arbeitstage.filter(d => valid.includes(d))
      if (cleaned.length === 0) {
        return NextResponse.json({ error: 'Mindestens ein Arbeitstag muss ausgewählt sein' }, { status: 400 })
      }
      model.schichtmodell = { ...model.schichtmodell, arbeitstage: cleaned }
    }

    await saveLocationModel(locationId, customerId, model)
    return NextResponse.json({ model })
  } catch (err) {
    console.error('[location-model PATCH]', err)
    return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })
  }
}
