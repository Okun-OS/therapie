import { NextRequest, NextResponse } from 'next/server'
import { getWishSubmissionsByEmployee, getWishSubmissionsByLocation, addWishSubmission } from '@/lib/schedule-entities'
import { requireRole } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const employeeId = req.nextUrl.searchParams.get('employeeId')
  const locationId = req.nextUrl.searchParams.get('locationId')
  if (!employeeId && !locationId) {
    return NextResponse.json({ error: 'employeeId oder locationId ist erforderlich' }, { status: 400 })
  }

  const wishes = employeeId ? await getWishSubmissionsByEmployee(employeeId) : await getWishSubmissionsByLocation(locationId!)
  return NextResponse.json({ wishes })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { employeeId, employeeName, locationId, date, preferredShiftType, reason, importance } = body
  if (!employeeId || !locationId || !date || !preferredShiftType || !importance) {
    return NextResponse.json({ error: 'Erforderliche Felder fehlen' }, { status: 400 })
  }

  const wish = await addWishSubmission({ employeeId, employeeName, locationId, date, preferredShiftType, reason, importance })
  return NextResponse.json({ wish })
}
