import { NextRequest, NextResponse } from 'next/server'
import { notifyEmployee } from '@/lib/notify'
import { EMPLOYEES } from '@/lib/mock-data'
import { formatDate } from '@/lib/utils'

interface NotifyAdminRequest {
  employeeName: string
  locationId: string
  kind: 'overtime' | 'absence'
  date?: string
  startDate?: string
  endDate?: string
}

export async function POST(req: NextRequest) {
  let body: NotifyAdminRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { employeeName, locationId, kind, date, startDate, endDate } = body
  if (!employeeName || !locationId || !kind) {
    return NextResponse.json({ error: 'employeeName, locationId und kind sind erforderlich' }, { status: 400 })
  }

  const admin = EMPLOYEES.find(e => e.locationId === locationId && e.role === 'admin')
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
