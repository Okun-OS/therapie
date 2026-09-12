import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveLocationId, resolveCustomerId } from '@/lib/session'
import { getLocationModel, saveLocationModel, normalizeLocationModel } from '@/lib/company-model-service'
import type { WochentagKuerzel } from '@/lib/company-model-types'
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

    const body = await req.json() as { arbeitstage?: string[]; planungsRegeln?: { hart?: unknown[]; weich?: unknown[] } }

    // §78 wizard: create a minimal DETERMINISTIC model when none exists yet —
    // no LLM involved, just an empty shell so arbeitstage/settings can be saved.
    let model = await getLocationModel(locationId)
    if (!model) {
      const location = await prisma.location.findUnique({ where: { id: locationId } })
      model = normalizeLocationModel({
        locationId,
        locationName: location?.name ?? 'Standort',
        customerId,
        betriebsTyp: 'mon_fri',
        bundesland: location?.bundesland ?? undefined,
        schichtmodell: { arbeitstage: ['Mo', 'Di', 'Mi', 'Do', 'Fr'], schichten: [] },
      })
    }

    if (body.arbeitstage !== undefined) {
      const valid: WochentagKuerzel[] = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
      const cleaned = body.arbeitstage.filter((d): d is WochentagKuerzel => valid.includes(d as WochentagKuerzel))
      if (cleaned.length === 0) {
        return NextResponse.json({ error: 'Mindestens ein Arbeitstag muss ausgewählt sein' }, { status: 400 })
      }
      model.schichtmodell = { ...model.schichtmodell, arbeitstage: cleaned }
      // Keep betriebsTyp in sync so buildRuleModel fallback also works correctly
      const hasSa = cleaned.includes('Sa')
      const hasSo = cleaned.includes('So')
      model.betriebsTyp = hasSa && hasSo ? '7_tage' : hasSa ? 'mon_sat' : 'mon_fri'
    }

    if (body.planungsRegeln !== undefined) {
      model.planungsRegeln = {
        hart: Array.isArray(body.planungsRegeln.hart) ? body.planungsRegeln.hart as typeof model.planungsRegeln.hart : model.planungsRegeln.hart,
        weich: Array.isArray(body.planungsRegeln.weich) ? body.planungsRegeln.weich as typeof model.planungsRegeln.weich : model.planungsRegeln.weich,
      }
    }

    await saveLocationModel(locationId, customerId, model)
    return NextResponse.json({ model })
  } catch (err) {
    console.error('[location-model PATCH]', err)
    return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })
  }
}
