import { NextRequest, NextResponse } from 'next/server'
import { notifyEmployee } from '@/lib/notify'
import { formatDate, sanitizeAiText } from '@/lib/utils'
import { listEmployees } from '@/lib/entities'
import type { VacationRequest, VacationPlanConflict } from '@/lib/types'
import { requireRole } from '@/lib/session'
import { locationFilter } from '@/lib/scope'

interface PublishRequest {
  requests: VacationRequest[]
  conflicts?: VacationPlanConflict[]
  locationId?: string
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

  const { requests, conflicts, locationId } = body
  // §110 Standortprüfung: Die Rolle allein genügt nicht — eine Leitung darf nur
  // den EIGENEN Standort verändern, nicht den eines fremden Kunden.
  const erlaubt = await locationFilter(session, locationId)
  if (erlaubt instanceof NextResponse) return erlaubt

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
    const allEmployees = await listEmployees()
    await Promise.all(
      conflicts.flatMap(c => {
        const reasoning = sanitizeAiText(c.reasoning)
        return c.employeeNames
          .map(name => allEmployees.find(e => e.name === name && (!locationId || e.locationId === locationId)))
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
