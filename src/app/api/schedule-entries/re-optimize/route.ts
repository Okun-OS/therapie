/**
 * §25: Late request re-optimization — freeze confirmed past assignments,
 * re-run the solver for the remaining future window, and return a minimal-change
 * diff summary.
 *
 * POST /api/schedule-entries/re-optimize
 * Body: { locationId, von, bis, reason? }
 *
 * The endpoint freezes all entries whose date < today (confirmed past) and
 * re-solves the remaining open window with change-minimization weights.
 * It returns the new plan plus a diff (changed / added / removed) rather than
 * automatically committing it so the dispatcher can review first.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { buildRuleModel } from '@/lib/rule-model-service'
import { solvePlan } from '@/lib/planning-solver'
import { verifyPlan } from '@/lib/plan-verifier'

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kein Mandant' }, { status: 403 })

  const body = await req.json()
  const { locationId, von, bis, reason } = body as {
    locationId: string
    von: string
    bis: string
    reason?: string
  }

  if (!locationId || !von || !bis) {
    return NextResponse.json({ error: 'locationId, von und bis sind erforderlich' }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10)

  // Load existing schedule for the period
  const existingEntries = await prisma.scheduleEntry.findMany({
    where: { locationId, date: { gte: von, lte: bis } },
    select: { employeeId: true, date: true, shiftId: true },
  })

  const existingSchedule = existingEntries.map(e => ({
    mitarbeiterId: e.employeeId,
    datum: e.date,
    schichtId: e.shiftId,
  }))

  // Freeze all dates up to (but not including) today — these are confirmed
  const frozenDates = Array.from(new Set(existingEntries.map(e => e.date).filter(d => d < today)))

  // Create a transient session record to track this run
  const planSession = await prisma.planningSession.create({
    data: {
      locationId,
      customerId,
      zeitraumVon: von,
      zeitraumBis: bis,
      status: 'running',
      ruleModelSnap: {},
    },
  })

  try {
    const ruleModel = await buildRuleModel(
      locationId, customerId, von, bis,
      planSession.id,
      reason ? `Re-Optimierung: ${reason}` : 'Kurzfristige Re-Optimierung',
      undefined, undefined,
      existingSchedule, frozenDates,
    )

    const plan = await solvePlan(ruleModel)

    if (plan.eintraege.length === 0) {
      await prisma.planningSession.update({
        where: { id: planSession.id },
        data: { status: 'no_feasible_solution', solverDiagnosis: 'Re-Optimierung: kein gültiger Plan gefunden' },
      })
      return NextResponse.json({ error: 'Kein gültiger Plan gefunden' }, { status: 422 })
    }

    const bewertung = verifyPlan(plan, ruleModel)

    // Build diff: compare new plan against existing
    const oldByKey = new Map(existingSchedule.map(e => [`${e.mitarbeiterId}|${e.datum}`, e.schichtId]))
    const newByKey = new Map(plan.eintraege.map(e => [`${e.mitarbeiterId}|${e.datum}`, e.schichtId]))

    const changed: Array<{ employeeId: string; date: string; oldShiftId: string; newShiftId: string }> = []
    const added: Array<{ employeeId: string; date: string; shiftId: string }> = []
    const removed: Array<{ employeeId: string; date: string; shiftId: string }> = []

    Array.from(newByKey.entries()).forEach(([key, newShiftId]) => {
      const [empId, date] = key.split('|')
      if (date < today) return
      const oldShiftId = oldByKey.get(key)
      if (!oldShiftId) {
        added.push({ employeeId: empId, date, shiftId: newShiftId })
      } else if (oldShiftId !== newShiftId) {
        changed.push({ employeeId: empId, date, oldShiftId, newShiftId })
      }
    })
    Array.from(oldByKey.entries()).forEach(([key, oldShiftId]) => {
      const [empId, date] = key.split('|')
      if (date < today) return
      if (!newByKey.has(key)) {
        removed.push({ employeeId: empId, date, shiftId: oldShiftId })
      }
    })

    await prisma.planningSession.update({
      where: { id: planSession.id },
      data: {
        status: 'completed',
        finalPlan: plan as object,
        finalScore: bewertung.gesamtScore,
        freigabeEmpfehlung: bewertung.freigabeEmpfehlung,
        bewertungSnap: { bewertung } as object,
        completedAt: new Date(),
      },
    })

    return NextResponse.json({
      sessionId: planSession.id,
      bewertung,
      diff: { changed, added, removed },
      totalChanges: changed.length + added.length + removed.length,
      plan: plan.eintraege,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await prisma.planningSession.update({
      where: { id: planSession.id },
      data: { status: 'failed', solverDiagnosis: message },
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
