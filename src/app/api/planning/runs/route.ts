/**
 * §49: /api/planning/runs — canonical planning run list/create endpoint.
 * GET  → list recent planning sessions for the caller's location
 * POST → start a new planning run (delegates to /api/ai/solve-schedule logic)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { locationFilter } from '@/lib/scope'
import { prisma } from '@/lib/prisma'
import { runPlanningBackground } from '@/lib/planning-orchestrator'

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kein Mandant' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const locationId = searchParams.get('locationId') ?? session.locationId

  if (locationId) {
    const standortErlaubt = await locationFilter(session, locationId)
    if (standortErlaubt instanceof NextResponse) return standortErlaubt
  }
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50)

  const runs = await prisma.planningSession.findMany({
    where: { customerId, ...(locationId ? { locationId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      locationId: true,
      zeitraumVon: true,
      zeitraumBis: true,
      status: true,
      finalScore: true,
      freigabeEmpfehlung: true,
      solverDiagnosis: true,
      solverSeed: true,
      createdAt: true,
      completedAt: true,
    },
  })

  return NextResponse.json({ runs })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kein Mandant' }, { status: 403 })

  const body = await req.json()
  const { locationId, von, bis, kontext, overtimeDecisions, includeAlternativen } = body

  if (!locationId || !von || !bis) {
    return NextResponse.json({ error: 'locationId, von und bis sind erforderlich' }, { status: 400 })
  }

  // §112: Der Lauf wurde bisher fuer JEDEN angegebenen Standort gestartet — eine
  // fremde Leitung konnte damit beim Wettbewerber einen Dienstplan rechnen
  // lassen und ueber die Sitzungs-ID an dessen Personaldaten kommen.
  const standortErlaubt = await locationFilter(session, locationId)
  if (standortErlaubt instanceof NextResponse) return standortErlaubt

  // §127 Die Dienstplanung wird je Kunde von Hand gebaut. Bis das Regelpaket
  // steht, bleibt sie gesperrt — ein Kunde, der ungebaute Dienstplanung
  // ausprobiert, bekommt einen schlechten Plan und ein falsches Bild vom
  // Produkt. Genau das ist im August passiert.
  const standort = await prisma.location.findUnique({
    where: { id: locationId },
    select: { name: true, dienstplanungFrei: true, dienstplanungHinweis: true },
  })
  if (!standort) {
    return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })
  }
  if (!standort.dienstplanungFrei && session.role !== 'okun') {
    return NextResponse.json({
      error: standort.dienstplanungHinweis
        || `Die Dienstplanung für „${standort.name}" ist noch nicht freigeschaltet. `
          + 'Sie wird von OKUN für Ihren Betrieb eingerichtet — melden Sie sich bei uns, '
          + 'sobald Sie loslegen möchten.',
      gesperrt: true,
    }, { status: 423 })
  }

  const planSession = await prisma.planningSession.create({
    data: {
      locationId,
      customerId,
      zeitraumVon: von,
      zeitraumBis: bis,
      status: 'queued',
      ruleModelSnap: {},
    },
  })

  void runPlanningBackground(
    planSession.id, locationId, customerId, von, bis,
    kontext, overtimeDecisions, includeAlternativen,
  )

  return NextResponse.json({ sessionId: planSession.id, status: 'queued' }, { status: 202 })
}
