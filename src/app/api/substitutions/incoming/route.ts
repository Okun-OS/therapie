import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const employeeId = req.nextUrl.searchParams.get('employeeId')
  if (employeeId) {
    // §111 Vorher liessen sich die Vertretungsanfragen jeder Person einsehen.
    const zugriffVerweigert = await assertEmployeeAccess(session, employeeId)
    if (zugriffVerweigert) return zugriffVerweigert
  }
  if (!employeeId) return NextResponse.json({ error: 'employeeId ist erforderlich' }, { status: 400 })

  const candidates = await prisma.substitutionCandidate.findMany({
    where: { employeeId, responseStatus: 'pending' },
    include: { request: true },
    orderBy: { createdAt: 'desc' },
  })

  const incoming = candidates.filter(c => c.request.status === 'open')
  return NextResponse.json({ incoming })
}
