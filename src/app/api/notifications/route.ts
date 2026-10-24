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

/**
 * §220 Aufräumen: alles Gelesene weg — oder alles.
 *
 *   DELETE /api/notifications            nur die gelesenen
 *   DELETE /api/notifications?alle=1     auch die ungelesenen
 *
 * WARUM ZWEI STUFEN
 * „Alles weg" ist der Knopf, den man drückt, wenn man den Überblick verloren
 * hat — und danach hat man ihn immer noch nicht, denn das Ungelesene ist
 * mitgegangen. Deshalb räumt der Knopf standardmäßig nur auf, was man schon
 * gesehen hat. Wer wirklich alles loswerden will, sagt es ausdrücklich.
 *
 * WARUM DAS ÜBERHAUPT GEBRAUCHT WIRD
 * Bis hierher ließ sich eine Benachrichtigung nur als gelesen markieren.
 * Nichts verschwand je wieder. Nach ein paar Wochen steht in der Glocke
 * alles, was je passiert ist — und damit sieht niemand mehr, was neu ist.
 */
export async function DELETE(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const gefragt = req.nextUrl.searchParams.get('employeeId')
  const employeeId = gefragt ?? session.employeeId
  if (!employeeId) return NextResponse.json({ geloescht: 0 })

  const zugriffVerweigert = await assertEmployeeAccess(session, employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  const alle = req.nextUrl.searchParams.get('alle') === '1'
  const { count } = await prisma.notification.deleteMany({
    where: { employeeId, ...(alle ? {} : { read: true }) },
  })
  return NextResponse.json({ geloescht: count, umfang: alle ? 'alle' : 'gelesene' })
}

/**
 * §220 Alles auf einmal als gelesen markieren.
 *
 * Der Weg für den Fall, der im Alltag am häufigsten vorkommt: Man war drei
 * Tage nicht in der App, oben steht eine Zahl, und man will nicht siebzehnmal
 * tippen. Ohne diesen Weg bleibt die Zahl stehen, bis jeder Eintrag einzeln
 * angefasst wurde — und dann wird sie irgendwann ignoriert.
 */
export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const gefragt = req.nextUrl.searchParams.get('employeeId')
  const employeeId = gefragt ?? session.employeeId
  if (!employeeId) return NextResponse.json({ gelesen: 0 })

  const zugriffVerweigert = await assertEmployeeAccess(session, employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  const { count } = await prisma.notification.updateMany({
    where: { employeeId, read: false }, data: { read: true },
  })
  return NextResponse.json({ gelesen: count })
}
