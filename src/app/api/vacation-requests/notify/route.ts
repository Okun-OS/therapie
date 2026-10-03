import { NextRequest, NextResponse } from 'next/server'
import { notifyEmployee } from '@/lib/notify'
import { formatDate } from '@/lib/utils'
import { requireRole } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'

interface NotifyRequest {
  employeeId: string
  requestId: string
  status: 'approved' | 'denied'
  startDate: string
  endDate: string
  reason?: string
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  let body: NotifyRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { employeeId, requestId, status, startDate, endDate, reason } = body

  // §110 Benachrichtigungen liessen sich fuer beliebige Personen ausloesen.
  if (employeeId) {
    const verweigert = await assertEmployeeAccess(session, employeeId)
    if (verweigert) return verweigert
  }
  if (!employeeId || !requestId || !status) {
    return NextResponse.json({ error: 'employeeId, requestId und status sind erforderlich' }, { status: 400 })
  }

  const period = `${formatDate(startDate)} bis ${formatDate(endDate)}`
  await notifyEmployee(employeeId, {
    type: status === 'approved' ? 'vacation_request_approved' : 'vacation_request_denied',
    title: status === 'approved' ? 'Urlaubsantrag genehmigt' : 'Urlaubsantrag abgelehnt',
    body: status === 'approved'
      ? `Dein Urlaubsantrag vom ${period} wurde genehmigt.`
      : `Dein Urlaubsantrag vom ${period} wurde abgelehnt.${reason ? ` Grund: ${reason}` : ''}`,
    requestId,
    url: '/employee/vacation',
  })

  return NextResponse.json({ notified: true })
}
