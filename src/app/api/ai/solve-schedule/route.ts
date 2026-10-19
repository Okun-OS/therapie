import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { getOrGenerateLocationModel } from '@/lib/company-model-service'
import { runPlanningSession, runPlanningBackground } from '@/lib/planning-orchestrator'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { locationId, von, bis, kontext, overtimeDecisions, async: asyncMode, includeAlternativen } = body

  if (!locationId || !von || !bis) {
    return NextResponse.json({ error: 'locationId, von und bis sind erforderlich' }, { status: 400 })
  }

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  /*
   * §198 Ohne Dienstzeiten gibt es nichts zu verteilen — aber die Auskunft,
   * was zu tun ist, hängt davon ab, wer sie anlegt.
   *
   * Ein Regelpaket ersetzt sie NICHT: Es sagt, wie Dienste besetzt werden,
   * nicht welche es gibt. Die Sperre bleibt also. Der Satz „Schließe das
   * Standort-Onboarding ab" schickt einen Kunden mit Regelpaket aber auf
   * einen Weg, den es für ihn nicht gibt — bei ihm richtet OKUN die
   * Dienstzeiten ein.
   */
  const shiftCount = await prisma.shift.count({ where: { locationId } })
  if (shiftCount === 0) {
    const standort = await prisma.location.findUnique({
      where: { id: locationId },
      select: { rulePackId: true },
    })
    return NextResponse.json(
      {
        error: standort?.rulePackId
          ? 'Dieser Standort hat noch keine Dienstzeiten. Für ihn ist ein Regelpaket '
            + 'hinterlegt — die Dienstzeiten legt OKUN an. Bitte bei OKUN melden.'
          : 'Dieser Standort hat noch keine Dienstzeiten konfiguriert. Bitte schließe '
            + 'zuerst das Standort-Onboarding ab.',
        code: 'NO_SHIFTS',
      },
      { status: 422 },
    )
  }

  // Generate/refresh the per-location model in the background
  getOrGenerateLocationModel(locationId, customerId).catch(err =>
    console.error('[solve-schedule] LocationModel generation failed:', err)
  )

  // ── Async mode: return sessionId immediately, run planning in background ──────
  if (asyncMode) {
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

    return NextResponse.json({ sessionId: planSession.id, status: 'queued' })
  }

  // ── Synchronous mode: run planning and return full results ───────────────────
  let result
  try {
    result = await runPlanningSession(
      locationId, customerId, von, bis,
      kontext, overtimeDecisions, includeAlternativen,
    )
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

  const week: Record<string, Record<string, { shiftId: string; note?: string; status: string; gruppe?: string; funktion?: string; isSubstitution?: boolean; whyAssigned?: string; role?: string; startTime?: string; endTime?: string }>> = {}
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
      // §39: per-entry solver explanation for the admin explain modal
      whyAssigned: eintrag.whyAssigned,
      // §71: 'Springer' when assigned outside the home group
      role: eintrag.role,
      // §72: individual presence window (part-time trims within the shift)
      startTime: eintrag.startzeit,
      endTime: eintrag.endzeit,
    }
  }

  // Build alternativenWeek maps
  const alternativen = result.alternativen?.map(alt => {
    const altWeek: typeof week = {}
    for (const eintrag of alt.plan.eintraege) {
      if (!altWeek[eintrag.mitarbeiterId]) altWeek[eintrag.mitarbeiterId] = {}
      const shift = shiftMap.get(eintrag.schichtId)
      altWeek[eintrag.mitarbeiterId][eintrag.datum] = {
        shiftId: eintrag.schichtId,
        note: eintrag.hinweis ?? shift?.name,
        status: 'planned',
        gruppe: eintrag.einheitId,
        funktion: eintrag.funktion,
        isSubstitution: eintrag.istVertretung,
      }
    }
    return { variante: alt.variante, week: altWeek, bewertung: alt.bewertung }
  })

  return NextResponse.json({
    week,
    decisions: result.finalPlan.decisions,
    bewertung: result.finalBewertung,
    // §169 Die Maßnahmen gehören als Daten in die Oberfläche, nicht nur als
    // Satz in der Verletzungsliste. Erst so kann jemand sie abhaken.
    vorschlag: result.finalPlan.regelpaket?.vorschlag ?? null,
    sessionId: result.sessionId,
    iterationen: result.iterationen,
    gesamtScore: result.gesamtScore,
    alternativen,
  })
}
