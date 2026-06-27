import { NextRequest, NextResponse } from 'next/server'
import { getVacationRequestsByLocation, getVacationRequestsByEmployee, listAllVacationRequests, addVacationRequest } from '@/lib/vacation-entities'
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

  const request = await addVacationRequest(body)
  return NextResponse.json({ request })
}
