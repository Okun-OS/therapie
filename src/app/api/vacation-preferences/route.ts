import { NextRequest, NextResponse } from 'next/server'
import { getVacationPreference, listAllVacationPreferences, setVacationPreference } from '@/lib/vacation-entities'
import { requireRole } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const employeeId = req.nextUrl.searchParams.get('employeeId')
  if (employeeId) {
    const preference = await getVacationPreference(employeeId)
    return NextResponse.json({ preference })
  }

  const preferences = await listAllVacationPreferences()
  return NextResponse.json({ preferences })
}

export async function PUT(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const body = await req.json()
  if (!body.employeeId) {
    return NextResponse.json({ error: 'employeeId ist erforderlich' }, { status: 400 })
  }

  const preference = await setVacationPreference(body)
  return NextResponse.json({ preference })
}
