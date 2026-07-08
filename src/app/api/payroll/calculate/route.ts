import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { calculatePayroll } from '@/lib/payroll-engine'
import type { PayrollInput } from '@/lib/payroll-engine'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const body = await req.json() as PayrollInput
  const result = calculatePayroll(body)
  return NextResponse.json(result)
}
