import { NextRequest, NextResponse } from 'next/server'
import { notifyEmployee } from '@/lib/notify'
import { requireRole } from '@/lib/session'
import { prisma } from '@/lib/prisma'

interface PublishRequest {
  locationName: string
  periodLabel: string
  assignments: Record<string, Record<string, string>>
  sessionId?: string      // optional — enables publishing gate check
  forcePublish?: boolean  // allow admin override when freigabeEmpfehlung === 'ueberarbeiten'
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  let body: PublishRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { locationName, periodLabel, assignments, sessionId, forcePublish } = body
  if (!assignments || typeof assignments !== 'object') {
    return NextResponse.json({ error: 'assignments sind erforderlich' }, { status: 400 })
  }

  // ── Publishing gate: block plans with critical violations unless forced ────────
  if (sessionId && !forcePublish) {
    const planningSession = await prisma.planningSession.findUnique({
      where: { id: sessionId },
      select: { freigabeEmpfehlung: true, solverDiagnosis: true },
    })
    if (planningSession?.freigabeEmpfehlung === 'ueberarbeiten') {
      return NextResponse.json(
        {
          error: 'Dieser Dienstplan enthält kritische Verletzungen und kann nicht veröffentlicht werden. Bitte den Plan überarbeiten oder die Freigabe erzwingen.',
          code: 'CRITICAL_VIOLATIONS',
          freigabeEmpfehlung: 'ueberarbeiten',
        },
        { status: 422 },
      )
    }
  }

  const employeeIds = Object.keys(assignments)
  await Promise.all(
    employeeIds.map(employeeId =>
      notifyEmployee(employeeId, {
        type: 'schedule_published',
        title: 'Neuer Dienstplan veröffentlicht',
        body: `Dein Dienstplan für ${periodLabel} bei ${locationName ?? 'deinem Standort'} ist jetzt verfügbar.`,
        url: '/employee/schedule',
      }),
    ),
  )

  return NextResponse.json({ notified: employeeIds.length })
}
