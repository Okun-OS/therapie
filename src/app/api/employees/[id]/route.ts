import { NextRequest, NextResponse } from 'next/server'
import { getEmployeeById, updateEmployee, deleteEmployee } from '@/lib/entities'
import { requireRole } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const employee = await getEmployeeById(params.id)
  if (!employee) return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 })
  return NextResponse.json({ employee })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const body = await req.json()

  // Build a clean fields object, explicitly allowing avatarUrl
  const fields: Record<string, unknown> = { ...body }
  if (typeof body.avatarUrl === 'string') fields.avatarUrl = body.avatarUrl

  try {
    const employee = await updateEmployee(params.id, fields as any)
    if (!employee) return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 })
    logAudit({
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      action: 'update',
      entityType: 'employee',
      entityId: params.id,
      customerId: employee.customerId ?? undefined,
      details: { updatedFields: Object.keys(fields) },
    }).catch(() => {})
    return NextResponse.json({ employee })
  } catch (err: unknown) {
    console.error('employees PATCH', err)
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  try {
    const deleted = await deleteEmployee(params.id)
    if (!deleted) return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 })

    await prisma.adminAuditLog.create({
      data: {
        id: crypto.randomUUID(),
        action: 'DELETE_EMPLOYEE',
        entityType: 'Employee',
        entityId: params.id,
        entityName: deleted.name,
        actorId: session.userId,
        actorName: session.name ?? session.email,
      },
    })

    return NextResponse.json({ deleted: true })
  } catch (err: unknown) {
    console.error('employees DELETE', err)
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
