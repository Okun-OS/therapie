import { NextRequest, NextResponse } from 'next/server'
import { getWishSubmissionsByEmployee, getWishSubmissionsByLocation, addWishSubmission } from '@/lib/schedule-entities'
import { requireRole } from '@/lib/session'
import { prisma } from '@/lib/prisma'

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

  // Enforce request deadline if one is set for this location
  const policy = await prisma.planningPolicy.findUnique({ where: { locationId } })
  if (policy?.requestDeadline && new Date() > policy.requestDeadline) {
    return NextResponse.json({
      error: `Einreichungsfrist abgelaufen. Wünsche konnten nur bis ${policy.requestDeadline.toLocaleDateString('de-DE')} eingereicht werden.`,
    }, { status: 403 })
  }

  const wish = await addWishSubmission({ employeeId, employeeName, locationId, date, preferredShiftType, reason, importance })
  return NextResponse.json({ wish })
}
