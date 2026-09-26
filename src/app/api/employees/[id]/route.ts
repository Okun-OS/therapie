import { NextRequest, NextResponse } from 'next/server'
import { getEmployeeById, updateEmployee, deleteEmployee } from '@/lib/entities'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { restlosEntfernen } from '@/lib/dsgvo-loeschung'

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

  // Ownership-Check: Nicht-OKUN-Rollen dürfen nur eigene Mitarbeiter bearbeiten
  if (session.role !== 'okun') {
    const customerId = await resolveCustomerId(session)
    const existing = await getEmployeeById(params.id)
    if (!existing) return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 })
    if (existing.customerId !== customerId) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

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
    // §155 Erst alles, was an der Person hängt — dann sie selbst.
    //
    // Vorher entfernte `deleteEmployee` NUR die Zeile in `Employee`.
    // Lohnabrechnungen, Zeitbuchungen, Pfändungen und Dateien blieben liegen:
    // unsichtbar in der Oberfläche, vorhanden in der Datenbank. Ein Mensch,
    // der gelöscht ist und dessen Lohnkonto noch daliegt, ist nicht gelöscht.
    //
    // Das ist bewusst der HARTE Weg, und nur OKUN darf ihn gehen — für Daten,
    // die es nie hätte geben dürfen: ein Testdatensatz, ein doppelt angelegter
    // Mensch, ein falscher Mandant. Die Löschung eines ausgeschiedenen
    // Beschäftigten ist eine andere und läuft über /api/dsgvo/loeschung: Sie
    // sperrt, wo das Gesetz aufbewahren heißt, und hinterlässt einen Bericht.
    const entfernt = await restlosEntfernen(params.id)

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

    return NextResponse.json({
      deleted: true,
      // Was mit entfernt wurde — damit im Protokoll und in der Antwort steht,
      // dass es nicht nur die eine Zeile war.
      entfernt: entfernt.reduce((s2, e) => s2 + e.anzahl, 0),
      tabellen: entfernt.length,
    })

  } catch (err: unknown) {
    console.error('employees DELETE', err)
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
