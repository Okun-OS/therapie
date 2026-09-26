import { NextRequest, NextResponse } from 'next/server'
import { getSwapRequestsByEmployee, addSwapRequest } from '@/lib/schedule-entities'
import { requireRole } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'
import { notifyEmployee } from '@/lib/notify'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const employeeId = req.nextUrl.searchParams.get('employeeId')
  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId ist erforderlich' }, { status: 400 })
  }

  // §111 Vorher liessen sich die Tauschanfragen jeder Person einsehen.
  const zugriffVerweigert = await assertEmployeeAccess(session, employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  const requests = await getSwapRequestsByEmployee(employeeId)
  return NextResponse.json({ requests })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { requesterId, requesterName, requesterDate, requesterShiftId, targetEmployeeId, targetEmployeeName, targetDate, targetShiftId, message, locationId } = body
  if (!requesterId || !requesterDate || !requesterShiftId || !targetEmployeeId || !targetDate || !targetShiftId || !locationId) {
    return NextResponse.json({ error: 'Erforderliche Felder fehlen' }, { status: 400 })
  }

  // §111 Der Antragsteller kam aus dem Aufruf — damit liess sich eine
  // Tauschanfrage im Namen einer Kollegin stellen.
  const antragVerweigert = await assertEmployeeAccess(session, requesterId)
  if (antragVerweigert) return antragVerweigert

  const request = await addSwapRequest({
    requesterId, requesterName, requesterDate, requesterShiftId,
    targetEmployeeId, targetEmployeeName, targetDate, targetShiftId,
    message, locationId,
  })

  // §73: the target employee gets an actionable notification
  await notifyEmployee(targetEmployeeId, {
    type: 'swap_request',
    title: 'Schichttausch-Anfrage',
    body: `${requesterName} möchte mit dir tauschen: dein Dienst am ${targetDate} gegen ${requesterDate}.${message ? ` Nachricht: „${message}"` : ''} Bitte bestätige oder lehne ab.`,
    requestId: request.id,
    url: '/employee/schedule',
  }).catch(() => {})

  return NextResponse.json({ request })
}
