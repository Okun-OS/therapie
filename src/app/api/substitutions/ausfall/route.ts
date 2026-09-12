import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { allowedLocationScope } from '@/lib/scope'
import { ausfallMelden } from '@/lib/ausfall-service'

export const dynamic = 'force-dynamic'

// §101 POST /api/substitutions/ausfall
// Ein Dienst fällt aus: Anfrage anlegen, Dienst aus dem Plan nehmen,
// Mitarbeiter benachrichtigen — in einem Schritt.
export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const body = await req.json().catch(() => ({})) as {
    scheduleEntryId?: string
    locationId?: string
    date?: string
    startTime?: string
    endTime?: string
    shiftId?: string
    shiftName?: string
    originalEmployeeId?: string
    grund?: string
    empfaenger?: 'alle' | 'auswahl' | 'niemand'
    empfaengerIds?: string[]
  }

  if (!body.locationId || !body.date || !body.startTime || !body.endTime) {
    return NextResponse.json(
      { error: 'Standort, Datum und Uhrzeiten sind erforderlich' },
      { status: 400 },
    )
  }

  const scope = await allowedLocationScope(session)
  if (scope.kind !== 'all' && !scope.ids.includes(body.locationId)) {
    return NextResponse.json({ error: 'Keine Berechtigung für diesen Standort' }, { status: 403 })
  }

  try {
    const ergebnis = await ausfallMelden({
      scheduleEntryId: body.scheduleEntryId ?? null,
      locationId: body.locationId,
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      shiftId: body.shiftId ?? null,
      shiftName: body.shiftName ?? null,
      originalEmployeeId: body.originalEmployeeId ?? null,
      grund: body.grund ?? null,
      empfaenger: body.empfaenger ?? 'alle',
      empfaengerIds: body.empfaengerIds ?? [],
      createdBy: session.employeeId ?? session.userId,
    })
    return NextResponse.json(ergebnis, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Ausfall konnte nicht gemeldet werden' },
      { status: 400 },
    )
  }
}
