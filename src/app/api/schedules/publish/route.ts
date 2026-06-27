import { NextRequest, NextResponse } from 'next/server'
import { notifyEmployee } from '@/lib/notify'
import { requireRole } from '@/lib/session'

interface PublishRequest {
  locationName: string
  periodLabel: string
  assignments: Record<string, Record<string, string>>
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

  const { locationName, periodLabel, assignments } = body
  if (!assignments || typeof assignments !== 'object') {
    return NextResponse.json({ error: 'assignments sind erforderlich' }, { status: 400 })
  }

  const employeeIds = Object.keys(assignments)
  await Promise.all(
    employeeIds.map(employeeId =>
      notifyEmployee(employeeId, {
        type: 'schedule_published',
        title: 'Neuer Dienstplan veröffentlicht',
        body: `Dein Dienstplan für ${periodLabel} bei ${locationName ?? 'deiner Einrichtung'} ist jetzt verfügbar.`,
        url: '/employee/schedule',
      }),
    ),
  )

  return NextResponse.json({ notified: employeeIds.length })
}
