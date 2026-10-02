import { NextRequest, NextResponse } from 'next/server'
import { getEmployeeById, updateEmployee, deleteEmployee } from '@/lib/entities'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { restlosEntfernen } from '@/lib/dsgvo-loeschung'
import { pruefeTagesmuster, musterText } from '@/lib/tagesmuster'

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

  /*
   * §181 Stunden und Tagesmuster dürfen nicht auseinanderlaufen.
   *
   * WAS PASSIERT, WENN SIE ES DOCH TUN
   * Das Tagesmuster sagt „fünfmal sieben Stunden", die Maske sagt „28 Stunden
   * in der Woche". Für den Rechendienst sind das zwei harte Bedingungen, die
   * einander ausschließen — und er findet dann nicht etwa für diese Person
   * keinen Dienst, sondern FÜR DEN GANZEN STANDORT keinen Plan. Gemeldet hat
   * er dabei Urlaube, Ruhezeiten und das Stundenlimit: drei Ursachen, von
   * denen keine zutraf.
   *
   * Nachgemessen am 02.10.2026 im Demo-Betrieb, einmal in jede Richtung:
   * 35 → Plan, 28 → kein Plan, 40 → kein Plan, 35 → Plan.
   *
   * WARUM DIE PRÜFUNG HIER STEHT UND NICHT NUR BEIM MUSTER
   * Es gibt zwei Türen in denselben Widerspruch. Die eine ist das Muster
   * (dort wird seit §181 geprüft), die andere ist diese: die Stundenzahl.
   * Eine Leitung, die nur die Stunden ändert, hätte den Betrieb sonst
   * genauso lahmgelegt — und hätte nicht einmal gewusst, dass es ein Muster
   * gibt.
   *
   * Abgelehnt wird mit beiden Zahlen im Satz und dem Hinweis, was zu tun ist.
   */
  if (body.weeklyHours !== undefined && body.weeklyHours !== null) {
    const neueStunden = Number(body.weeklyHours)
    if (Number.isFinite(neueStunden)) {
      const profil = await prisma.employeePlanningProfile.findUnique({
        where: { employeeId: params.id },
        select: { tagesmuster: true, planungsStundenSoll: true },
      })
      const gelesen = pruefeTagesmuster(profil?.tagesmuster)
      // Gibt es Planstunden, hängt das Muster an ihnen und nicht an den
      // Vertragsstunden — dann ändert diese Zahl am Dienstplan nichts.
      const massgeblich = profil?.planungsStundenSoll ?? neueStunden
      if (gelesen.muster && Math.abs(gelesen.wochenstunden - massgeblich) > 0.001) {
        return NextResponse.json({
          error: `Für diese Person ist ein Tagesmuster hinterlegt `
            + `(${musterText(gelesen.muster)} = ${gelesen.wochenstunden} Std. je Woche). `
            + `${massgeblich} Wochenstunden passen nicht dazu. Bitte das Muster im `
            + `Planungsprofil mit ändern — sonst lässt sich für diesen Standort `
            + `kein Dienstplan mehr rechnen.`,
          code: 'TAGESMUSTER_PASST_NICHT',
        }, { status: 400 })
      }
    }
  }

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
