import { NextRequest, NextResponse } from 'next/server'
import { updateAbsence } from '@/lib/time-tracking-entities'
import { requireRole } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { assertEmployeeAccess } from '@/lib/scope'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  // §110 Eine Abwesenheit liess sich allein ueber ihre ID aendern — auch die
  // einer Person an einem fremden Standort.
  const vorhanden = await prisma.absence.findUnique({
    where: { id: params.id }, select: { employeeId: true },
  })
  if (!vorhanden) return NextResponse.json({ error: 'Abwesenheit nicht gefunden' }, { status: 404 })
  const zugriffVerweigert = await assertEmployeeAccess(session, vorhanden.employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  const updates = await req.json()
  const absence = await updateAbsence(params.id, updates)
  if (!absence) return NextResponse.json({ error: 'Abwesenheit nicht gefunden' }, { status: 404 })
  return NextResponse.json({ absence })
}
