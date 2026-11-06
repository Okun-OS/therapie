import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  // §111 Eine fremde Nachricht liess sich allein ueber ihre ID als gelesen
  // markieren — und damit im Postfach der anderen Person verstecken.
  const nachricht = await prisma.notification.findUnique({
    where: { id: params.id }, select: { employeeId: true },
  })
  if (!nachricht) return NextResponse.json({ error: 'Nachricht nicht gefunden' }, { status: 404 })
  const zugriffVerweigert = await assertEmployeeAccess(session, nachricht.employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  await prisma.notification.update({ where: { id: params.id }, data: { read: true } })
  return NextResponse.json({ ok: true })
}
