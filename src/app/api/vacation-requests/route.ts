import { NextRequest, NextResponse } from 'next/server'
import { getVacationRequestsByLocation, getVacationRequestsByEmployee, listAllVacationRequests, addVacationRequest } from '@/lib/vacation-entities'
import { getEmployeeById, getLocationById } from '@/lib/entities'
import { notifyEmployee } from '@/lib/notify'
import { requireRole } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const locationId = req.nextUrl.searchParams.get('locationId')
  const employeeId = req.nextUrl.searchParams.get('employeeId')

  const requests = employeeId
    ? await getVacationRequestsByEmployee(employeeId)
    : locationId
      ? await getVacationRequestsByLocation(locationId)
      : await listAllVacationRequests()
  return NextResponse.json({ requests })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { employeeId, locationId, startDate, endDate } = body
  if (!employeeId || !locationId || !startDate || !endDate) {
    return NextResponse.json({ error: 'employeeId, locationId, startDate und endDate sind erforderlich' }, { status: 400 })
  }

  const [employee, location] = await Promise.all([getEmployeeById(employeeId), getLocationById(locationId)])

  const request = await addVacationRequest(body, employee, location?.state)

  if (location?.adminId) {
    await notifyEmployee(location.adminId, {
      type: 'vacation_request_submitted',
      title: 'Neuer Urlaubsantrag',
      body: `${request.employeeName} hat einen Urlaubsantrag vom ${request.startDate} bis ${request.endDate} eingereicht.`,
      requestId: request.id,
      url: '/admin/vacation-requests',
    }).catch(() => null)
  }

  return NextResponse.json({ request })
}
