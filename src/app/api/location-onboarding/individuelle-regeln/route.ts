import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId, resolveLocationId } from '@/lib/session'
import { appendLocationIndividuelleRegeln } from '@/lib/onboarding-service'

/** Hängt dauerhafte Regeln (z.B. aus dem Dienstplan-Planungschat) an die
 * Wissensbasis eines Standorts an, getrennt vom vollen Onboarding-Wizard-Upsert. */
export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const { locationId, rules } = await req.json()
  if (!locationId || !Array.isArray(rules) || rules.length === 0) {
    return NextResponse.json({ error: 'locationId und rules sind erforderlich' }, { status: 400 })
  }

  if (session.role === 'admin') {
    const ownLocationId = await resolveLocationId(session)
    if (!ownLocationId || ownLocationId !== locationId) {
      return NextResponse.json({ error: 'Keine Berechtigung für diesen Standort' }, { status: 403 })
    }
  } else {
    const customerId = await resolveCustomerId(session)
    const location = await prisma.location.findUnique({ where: { id: locationId }, select: { customerId: true } })
    if (!customerId || !location || location.customerId !== customerId) {
      return NextResponse.json({ error: 'Keine Berechtigung für diesen Standort' }, { status: 403 })
    }
  }

  await appendLocationIndividuelleRegeln(locationId, rules.filter((r: unknown) => typeof r === 'string' && r.trim()))
  return NextResponse.json({ ok: true })
}
