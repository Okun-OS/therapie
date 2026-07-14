import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

// DSGVO Art. 20 – Recht auf Datenübertragbarkeit
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  await logAudit({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: 'export',
    entityType: 'user_self',
    entityId: session.userId,
    customerId: session.customerId,
  })

  const user = await prisma.user.findUnique({ where: { id: session.userId } })
  if (!user) return NextResponse.json({ error: 'Nutzer nicht gefunden' }, { status: 404 })

  const [employee, timeEntries, vacationRequests, scheduleEntries] = await Promise.all([
    session.employeeId ? prisma.employee.findUnique({ where: { id: session.employeeId } }) : null,
    session.employeeId ? prisma.timeLog.findMany({ where: { employeeId: session.employeeId }, orderBy: { date: 'desc' }, take: 500 }) : [],
    session.employeeId ? prisma.vacationRequest.findMany({ where: { employeeId: session.employeeId }, orderBy: { startDate: 'desc' } }) : [],
    session.employeeId ? prisma.scheduleEntry.findMany({ where: { employeeId: session.employeeId }, orderBy: { date: 'desc' }, take: 500 }) : [],
  ])

  const exportData = {
    exportedAt: new Date().toISOString(),
    exportedBy: 'DSGVO Art. 20 – Datenübertragbarkeit',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
    employee: employee ? {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      position: employee.position,
      role: employee.role,
      weeklyHours: employee.weeklyHours,
      vacationDaysTotal: employee.vacationDaysTotal,
      vacationDaysUsed: employee.vacationDaysUsed,
      joinedAt: employee.joinedAt,
      phone: employee.phone ?? undefined,
      birthDate: employee.birthDate ?? undefined,
    } : null,
    timeEntries,
    vacationRequests,
    scheduleEntries,
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="okun-datenschutz-export-${new Date().toISOString().split('T')[0]}.json"`,
    },
  })
}
