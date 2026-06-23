import { NextRequest, NextResponse } from 'next/server'
import { getEmployeeScoreSummary } from '@/lib/workforce-score-service'

export async function GET(req: NextRequest) {
  const employeeId = req.nextUrl.searchParams.get('employeeId')
  if (!employeeId) return NextResponse.json({ error: 'employeeId ist erforderlich' }, { status: 400 })

  const summary = await getEmployeeScoreSummary(employeeId)
  return NextResponse.json({ summary })
}
