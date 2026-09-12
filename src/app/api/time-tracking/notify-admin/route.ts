import { NextRequest, NextResponse } from 'next/server'
import { notifyEmployee } from '@/lib/notify'
import { listEmployees } from '@/lib/entities'
import { formatDate } from '@/lib/utils'
import { requireRole } from '@/lib/session'
import { allowedLocationScope } from '@/lib/scope'

interface NotifyAdminRequest {
  locationId: string
  kind: 'overtime' | 'absence'
  date?: string
  startDate?: string
  endDate?: string
}

export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  let body: NotifyAdminRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { locationId, kind, date, startDate, endDate } = body
  if (!locationId || !kind) {
    return NextResponse.json({ error: 'locationId und kind sind erforderlich' }, { status: 400 })
  }

  // §109: Der Aufruf trug bisher einen FREI GEWÄHLTEN Namen und eine beliebige
  // Standort-ID — jeder Angemeldete konnte damit fremden Standorten Meldungen
  // im Namen Dritter schicken. Jetzt zählt nur, wer wirklich anfragt.
  const scope = await allowedLocationScope(session)
  if (scope.kind !== 'all' && !scope.ids.includes(locationId)) {
    return NextResponse.json({ error: 'Kein Zugriff auf diesen Standort' }, { status: 403 })
  }

  const allEmployees = await listEmployees()
  const absender = session.employeeId
    ? allEmployees.find(e => e.id === session.employeeId)
    : undefined
  const employeeName = absender?.name ?? session.name ?? 'Ein Mitarbeiter'

  const admin = allEmployees.find(e => e.locationId === locationId && e.role === 'admin')
  if (!admin) {
    return NextResponse.json({ notified: false })
  }

  if (kind === 'overtime') {
    await notifyEmployee(admin.id, {
      type: 'overtime_request_submitted',
      title: 'Neuer Überstundenantrag',
      body: `${employeeName} hat für den ${formatDate(date ?? '')} einen Überstundenantrag eingereicht.`,
      url: '/admin/time-tracking',
    })
  } else {
    await notifyEmployee(admin.id, {
      type: 'absence_reported',
      title: 'Neue Abwesenheit gemeldet',
      body: `${employeeName} hat eine Abwesenheit vom ${formatDate(startDate ?? '')} bis ${formatDate(endDate ?? '')} gemeldet.`,
      url: '/admin/time-tracking',
    })
  }

  return NextResponse.json({ notified: true })
}
