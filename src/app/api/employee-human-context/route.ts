import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { upsertHumanContext } from '@/lib/human-context-service'
import { requireRole } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const employeeId = req.nextUrl.searchParams.get('employeeId')
  const contexts = await prisma.employeeHumanContext.findMany({
    where: employeeId ? { employeeId } : undefined,
  })
  return NextResponse.json({ contexts })
}

export async function PATCH(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const { employeeId, strengths, lifeCircumstances, preferredGroups, preferredActivities, shiftPreferences, agreements } = await req.json()
  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId ist erforderlich' }, { status: 400 })
  }

  const context = await upsertHumanContext(employeeId, { strengths, lifeCircumstances, preferredGroups, preferredActivities, shiftPreferences, agreements })
  return NextResponse.json({ context })
}
