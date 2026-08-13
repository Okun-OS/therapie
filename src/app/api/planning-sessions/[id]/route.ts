import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const planningSession = await prisma.planningSession.findUnique({
    where: { id: params.id },
    include: { iterationen: { orderBy: { nummer: 'asc' } } },
  })

  if (!planningSession) {
    return NextResponse.json({ error: 'Planungssitzung nicht gefunden' }, { status: 404 })
  }

  if (planningSession.customerId !== customerId) {
    return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 })
  }

  const response: Record<string, unknown> = {
    id: planningSession.id,
    status: planningSession.status,
    locationId: planningSession.locationId,
    zeitraumVon: planningSession.zeitraumVon,
    zeitraumBis: planningSession.zeitraumBis,
    createdAt: planningSession.createdAt,
    completedAt: planningSession.completedAt,
    finalScore: planningSession.finalScore,
    freigabeEmpfehlung: planningSession.freigabeEmpfehlung,
    solverDiagnosis: planningSession.solverDiagnosis,
  }

  if (planningSession.status === 'completed' && planningSession.finalPlan) {
    // Return full bewertung from bewertungSnap (includes alternativen if requested)
    const snap = planningSession.bewertungSnap as { bewertung?: unknown; alternativen?: unknown } | null
    response.bewertung = snap?.bewertung ?? null
    response.alternativen = snap?.alternativen ?? null

    // Build week map for UI
    const finalPlan = planningSession.finalPlan as { eintraege: Array<{ mitarbeiterId: string; datum: string; schichtId: string; einheitId?: string; funktion?: string; istVertretung?: boolean; hinweis?: string }> }
    const shifts = await prisma.shift.findMany({ where: { locationId: planningSession.locationId } })
    const shiftMap = new Map(shifts.map(s => [s.id, s]))

    const week: Record<string, Record<string, unknown>> = {}
    for (const eintrag of finalPlan.eintraege) {
      if (!week[eintrag.mitarbeiterId]) week[eintrag.mitarbeiterId] = {}
      const shift = shiftMap.get(eintrag.schichtId)
      week[eintrag.mitarbeiterId][eintrag.datum] = {
        shiftId: eintrag.schichtId,
        note: eintrag.hinweis ?? shift?.name,
        status: 'planned',
        gruppe: eintrag.einheitId,
        funktion: eintrag.funktion,
        isSubstitution: eintrag.istVertretung,
      }
    }
    response.week = week
  }

  if (['no_feasible_solution', 'failed'].includes(planningSession.status)) {
    response.diagnosis = planningSession.solverDiagnosis
  }

  return NextResponse.json(response)
}
