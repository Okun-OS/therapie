import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { getOrGenerateCompanyModel } from '@/lib/company-model-service'
import { runPlanningSession } from '@/lib/planning-orchestrator'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { locationId, von, bis, kontext } = body

  if (!locationId || !von || !bis) {
    return NextResponse.json({ error: 'locationId, von und bis sind erforderlich' }, { status: 400 })
  }

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  let companyModel
  try {
    companyModel = await getOrGenerateCompanyModel(customerId)
  } catch (err) {
    console.error('[solve-schedule] CompanyModel generation failed:', err)
    return NextResponse.json(
      { error: 'Das Unternehmens-Modell konnte nicht generiert werden. Bitte versuche es erneut.', code: 'COMPANY_MODEL_ERROR' },
      { status: 500 },
    )
  }

  if (!companyModel) {
    return NextResponse.json(
      { error: 'Das Unternehmens-Onboarding ist noch nicht abgeschlossen. Bitte schließe zuerst das KI-Onboarding ab.', code: 'NO_COMPANY_MODEL' },
      { status: 422 },
    )
  }

  let result
  try {
    result = await runPlanningSession(locationId, customerId, von, bis, kontext)
  } catch (err) {
    console.error('[solve-schedule] Planning session failed:', err)
    const message = err instanceof Error ? err.message : 'Unbekannter Planungsfehler'
    return NextResponse.json(
      { error: `Dienstplan-Generierung fehlgeschlagen: ${message}`, code: 'PLANNING_ERROR' },
      { status: 500 },
    )
  }

  const shifts = await prisma.shift.findMany({ where: { locationId } })
  const shiftMap = new Map(shifts.map(s => [s.id, s]))

  const week: Record<string, Record<string, { shiftId: string; note?: string; status: string; gruppe?: string; funktion?: string; isSubstitution?: boolean }>> = {}
  for (const eintrag of result.finalPlan.eintraege) {
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

  return NextResponse.json({
    week,
    decisions: result.finalPlan.decisions,
    bewertung: result.finalBewertung,
    sessionId: result.sessionId,
    iterationen: result.iterationen,
    gesamtScore: result.gesamtScore,
  })
}
