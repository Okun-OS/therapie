import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  /**
   * §151 Ohne Angabe: das EIGENE Postfach.
   *
   * Vorher war `employeeId` Pflicht. Beide Aufrufer in der Oberfläche
   * (`Header.tsx`, `CommandRail.tsx`) schickten dafür `user.id` — die Kennung
   * des BENUTZERKONTOS, nicht die des Mitarbeiterdatensatzes. Die beiden sind
   * nie gleich. Folge: Die Glocke bekam auf jeder Seite und in jeder Rolle
   * eine Absage — 403 beim Mitarbeiter, 404 bei der Leitung — und blieb
   * dauerhaft leer. Aufgefallen ist es nie, weil beide Aufrufer den Fehler
   * verschlucken (`.catch(() => {})`) und eine leere Glocke aussieht wie eine
   * Glocke ohne neue Nachrichten.
   *
   * Der Standardfall ist „meine Benachrichtigungen". Genau das ist jetzt die
   * Vorgabe; eine fremde Kennung bleibt möglich und wird weiter geprüft.
   */
  const gefragt = req.nextUrl.searchParams.get('employeeId')
  const employeeId = gefragt ?? session.employeeId

  // Ein Konto ohne Mitarbeiterdatensatz — etwa die Unternehmensebene — hat
  // kein eigenes Postfach. Das ist kein Fehler, sondern eine leere Liste.
  if (!employeeId) return NextResponse.json({ notifications: [] })

  // §111 Ohne diese Prüfung ließ sich das Postfach jeder beliebigen Person lesen.
  const zugriffVerweigert = await assertEmployeeAccess(session, employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  const notifications = await prisma.notification.findMany({
    where: { employeeId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  return NextResponse.json({ notifications })
}
