import { NextRequest, NextResponse } from 'next/server'
import { respondToOvertimeRequest } from '@/lib/time-tracking-entities'
import { requireRole } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const { status, respondedBy, approvedMinutes, adminComment } = await req.json()
  if (!status || !respondedBy) {
    return NextResponse.json({ error: 'status und respondedBy sind erforderlich' }, { status: 400 })
  }

  // §109: Eine Leitung konnte Antraege FREMDER Standorte genehmigen — es wurde
  // nur die Rolle geprueft, nicht die Zustaendigkeit.
  const antrag = await prisma.overtimeRequest.findUnique({
    where: { id: params.id },
    select: { employeeId: true },
  })
  if (!antrag) return NextResponse.json({ error: 'Antrag nicht gefunden' }, { status: 404 })
  const verweigert = await assertEmployeeAccess(session, antrag.employeeId)
  if (verweigert) return verweigert

  await respondToOvertimeRequest(params.id, status, respondedBy, approvedMinutes, adminComment)
  return NextResponse.json({ success: true })
}
