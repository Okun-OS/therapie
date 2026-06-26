import { NextRequest, NextResponse } from 'next/server'
import { listEmployees, addEmployee } from '@/lib/entities'

export const dynamic = 'force-dynamic'

export async function GET() {
  const employees = await listEmployees()
  return NextResponse.json({ employees })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, email, position, weeklyHours, locationId } = body

  if (!name?.trim() || !email?.trim() || !position?.trim() || !weeklyHours || !locationId) {
    return NextResponse.json({ error: 'name, email, position, weeklyHours und locationId sind erforderlich' }, { status: 400 })
  }

  const employee = await addEmployee({
    name,
    email,
    position,
    weeklyHours,
    locationId,
    phone: body.phone,
    birthDate: body.birthDate,
    roleType: body.roleType,
    employmentType: body.employmentType,
    gruppe: body.gruppe,
    bereich: body.bereich,
    multiGroupCapable: body.multiGroupCapable,
    fixedLocations: body.fixedLocations,
    qualifications: body.qualifications,
    allowedTasks: body.allowedTasks,
  })

  return NextResponse.json({ employee })
}
