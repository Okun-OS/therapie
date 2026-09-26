import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveLocationId, resolveCustomerId } from '@/lib/session'
import { generateLocationModelFromOnboarding } from '@/lib/company-model-service'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const session = requireRole(req, ['admin'])
    if (session instanceof NextResponse) return session

    const locationId = await resolveLocationId(session)
    if (!locationId) return NextResponse.json({ error: 'Kein Standort zugeordnet' }, { status: 403 })

    const customerId = await resolveCustomerId(session)
    if (!customerId) return NextResponse.json({ error: 'Kein Mandant' }, { status: 403 })

    // Check that onboarding data exists (completed OR at least partially filled)
    const onboarding = await prisma.locationOnboarding.findUnique({
      where: { locationId },
      select: { completed: true, arbeitszeiten: true, dienstplanlogik: true },
    })

    const hasData = onboarding && (
      onboarding.completed ||
      onboarding.arbeitszeiten !== null ||
      onboarding.dienstplanlogik !== null
    )

    if (!hasData) {
      return NextResponse.json(
        { error: 'Noch keine Onboarding-Daten vorhanden. Bitte führe zuerst das Onboarding durch.' },
        { status: 422 },
      )
    }

    const model = await generateLocationModelFromOnboarding(locationId, customerId)

    if (!model) {
      return NextResponse.json(
        { error: 'Das Planungsmodell konnte nicht erstellt werden. Bitte das Onboarding-Gespräch prüfen.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ model })
  } catch (err) {
    console.error('[location-model/generate] Fehler:', err)
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json(
      { error: `Planungsmodell-Generierung fehlgeschlagen: ${message}` },
      { status: 500 },
    )
  }
}
