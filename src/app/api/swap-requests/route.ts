import { NextRequest, NextResponse } from 'next/server'
import { getSwapRequestsByEmployee, addSwapRequest } from '@/lib/schedule-entities'
import { requireRole } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const employeeId = req.nextUrl.searchParams.get('employeeId')
  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId ist erforderlich' }, { status: 400 })
  }

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

  const request = await addSwapRequest({
    requesterId, requesterName, requesterDate, requesterShiftId,
    targetEmployeeId, targetEmployeeName, targetDate, targetShiftId,
    message, locationId,
  })
  return NextResponse.json({ request })
}
