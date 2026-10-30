import { NextRequest, NextResponse } from 'next/server'
import { updateWishSubmission } from '@/lib/schedule-entities'
import { requireRole } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { assertEmployeeAccess } from '@/lib/scope'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  // §112 Ein Wunsch liess sich allein ueber seine ID bescheiden.
  const wunsch = await prisma.wishSubmission.findUnique({
    where: { id: params.id }, select: { employeeId: true },
  })
  if (!wunsch) return NextResponse.json({ error: 'Wunsch nicht gefunden' }, { status: 404 })
  const zugriffVerweigert = await assertEmployeeAccess(session, wunsch.employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  const updates = await req.json()
  await updateWishSubmission(params.id, updates)
  return NextResponse.json({ success: true })
}
