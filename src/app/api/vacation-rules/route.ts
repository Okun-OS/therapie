import { NextRequest, NextResponse } from 'next/server'
import { getVacationRules, setVacationRules } from '@/lib/vacation-entities'
import { requireRole } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const locationId = req.nextUrl.searchParams.get('locationId')
  if (!locationId) {
    return NextResponse.json({ error: 'locationId ist erforderlich' }, { status: 400 })
  }

  const rules = await getVacationRules(locationId)
  return NextResponse.json({ rules })
}

export async function PUT(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const { locationId, rules } = await req.json()
  if (!locationId || !rules) {
    return NextResponse.json({ error: 'locationId und rules sind erforderlich' }, { status: 400 })
  }

  const updated = await setVacationRules(locationId, rules)
  return NextResponse.json({ rules: updated })
}
