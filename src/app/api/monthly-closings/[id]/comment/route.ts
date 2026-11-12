import { NextRequest, NextResponse } from 'next/server'
import { addMonthlyClosingComment } from '@/lib/time-tracking-entities'
import { requireRole } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const { author, text } = await req.json()

  // §109 Kommentare an einem Abschluss waren ohne Zustaendigkeitspruefung moeglich.
  const abschluss = await prisma.monthlyClosing.findUnique({
    where: { id: params.id }, select: { employeeId: true },
  })
  if (!abschluss) return NextResponse.json({ error: 'Abschluss nicht gefunden' }, { status: 404 })
  const zugriffVerweigert = await assertEmployeeAccess(session, abschluss.employeeId)
  if (zugriffVerweigert) return zugriffVerweigert
  if (!author?.trim() || !text?.trim()) {
    return NextResponse.json({ error: 'author und text sind erforderlich' }, { status: 400 })
  }

  await addMonthlyClosingComment(params.id, author, text)
  return NextResponse.json({ success: true })
}
