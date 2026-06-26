import { NextRequest, NextResponse } from 'next/server'
import { notifyEmployee } from '@/lib/notify'
import { formatDate, sanitizeAiText } from '@/lib/utils'
import { EMPLOYEES } from '@/lib/mock-data'
import type { VacationRequest, VacationPlanConflict } from '@/lib/types'

interface PublishRequest {
  requests: VacationRequest[]
  conflicts?: VacationPlanConflict[]
  locationId?: string
}

export async function POST(req: NextRequest) {
  let body: PublishRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { requests, conflicts, locationId } = body
  if (!Array.isArray(requests)) {
    return NextResponse.json({ error: 'requests sind erforderlich' }, { status: 400 })
  }

  await Promise.all(
    requests.map(r =>
      notifyEmployee(r.employeeId, {
        type: 'vacation_plan_published',
        title: 'Urlaubsplan freigegeben',
        body: `Dein Urlaub vom ${formatDate(r.startDate)} bis ${formatDate(r.endDate)} wurde im Rahmen der Jahresurlaubsplanung genehmigt.`,
        requestId: r.id,
        url: '/employee/vacation',
      }),
    ),
  )

  // Konfliktmanagement-Transparenz: Mitarbeiter, deren Urlaubswunsch mit anderen
  // kollidierte, erfahren nachvollziehbar, wie die KI den Konflikt aufgelöst hat –
  // statt dass die Entscheidung intransparent nur im Admin-Bereich sichtbar bleibt.
  if (Array.isArray(conflicts) && conflicts.length > 0) {
    await Promise.all(
      conflicts.flatMap(c => {
        const reasoning = sanitizeAiText(c.reasoning)
        return c.employeeNames
          .map(name => EMPLOYEES.find(e => e.name === name && (!locationId || e.locationId === locationId)))
          .filter((e): e is NonNullable<typeof e> => !!e)
          .map(e =>
            notifyEmployee(e.id, {
              type: 'vacation_plan_conflict',
              title: 'Hinweis zur Urlaubsplanung',
              body: reasoning,
              url: '/employee/vacation',
            }),
          )
      }),
    )
  }

  return NextResponse.json({ notified: requests.length, conflictsNotified: conflicts?.length ?? 0 })
}
