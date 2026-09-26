import { NextRequest, NextResponse } from 'next/server'
import { setVacationRequestStatus } from '@/lib/vacation-entities'
import { requireRole } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { assertEmployeeAccess } from '@/lib/scope'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  // §110 Eine Leitung konnte Urlaubsantraege FREMDER Standorte bescheiden.
  const antrag = await prisma.vacationRequest.findUnique({
    where: { id: params.id }, select: { employeeId: true },
  })
  if (!antrag) return NextResponse.json({ error: 'Antrag nicht gefunden' }, { status: 404 })
  const zugriffVerweigert = await assertEmployeeAccess(session, antrag.employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  const { status, respondedBy } = await req.json()
  if (!status || !respondedBy?.trim()) {
    return NextResponse.json({ error: 'status und respondedBy sind erforderlich' }, { status: 400 })
  }

  const request = await setVacationRequestStatus(params.id, status, respondedBy)
  if (!request) {
    return NextResponse.json({ error: 'Antrag nicht gefunden' }, { status: 404 })
  }
  return NextResponse.json({ request })
}
