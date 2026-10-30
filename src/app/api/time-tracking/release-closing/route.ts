import { NextRequest, NextResponse } from 'next/server'
import { releaseMonthlyClosing } from '@/lib/time-tracking-entities'
import { applyHoursBalanceDelta } from '@/lib/entities'
import { requireRole } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { assertEmployeeAccess } from '@/lib/scope'

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { closingId, releasedBy } = body

  // §109 Freigabe war ohne Zustaendigkeitspruefung moeglich.
  const abschluss = closingId ? await prisma.monthlyClosing.findUnique({
    where: { id: closingId }, select: { employeeId: true },
  }) : null
  if (closingId && !abschluss) {
    return NextResponse.json({ error: 'Abschluss nicht gefunden' }, { status: 404 })
  }
  if (abschluss) {
    const zugriffVerweigert = await assertEmployeeAccess(session, abschluss.employeeId)
    if (zugriffVerweigert) return zugriffVerweigert
  }
  if (!closingId?.trim() || !releasedBy?.trim()) {
    return NextResponse.json({ error: 'closingId und releasedBy sind erforderlich' }, { status: 400 })
  }

  const result = await releaseMonthlyClosing(closingId, releasedBy)
  if (!result) {
    return NextResponse.json({ error: 'Monatsabschluss nicht gefunden oder bereits freigegeben' }, { status: 404 })
  }

  await applyHoursBalanceDelta(result.employeeId, result.deltaHours)
  return NextResponse.json({ success: true })
}
