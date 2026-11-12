import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'

export const dynamic = 'force-dynamic'

/**
 * §220 Eine Benachrichtigung wegwischen.
 *
 * WAS VORHER FEHLTE
 * Es gab nur „als gelesen markieren". Gelesene Nachrichten blieben für immer
 * in der Liste stehen — nach ein paar Wochen scrollt niemand mehr durch, und
 * damit ist die Glocke als Hinweis wertlos. Eine Liste, aus der nichts
 * verschwindet, ist keine Liste, sondern ein Archiv.
 *
 * WARUM WIRKLICH GELÖSCHT UND NICHT NUR VERSTECKT
 * Eine Benachrichtigung ist eine Kopie: Der Urlaubsantrag, die Krankmeldung,
 * der Dienstplan stehen weiterhin dort, wo sie hingehören. Was hier
 * verschwindet, ist der Hinweis darauf — nicht die Sache. Ein zusätzliches
 * Feld „ausgeblendet" würde dieselbe Zeile für immer aufbewahren, obwohl
 * niemand sie je wieder sehen will; das wäre Datenhaltung ohne Zweck.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  // §111 Dieselbe Prüfung wie beim Lesen: Ohne sie ließe sich eine fremde
  // Benachrichtigung allein über ihre Kennung aus einem fremden Postfach
  // entfernen.
  const nachricht = await prisma.notification.findUnique({
    where: { id: params.id }, select: { employeeId: true },
  })
  if (!nachricht) {
    return NextResponse.json({ error: 'Nachricht nicht gefunden' }, { status: 404 })
  }
  const zugriffVerweigert = await assertEmployeeAccess(session, nachricht.employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  await prisma.notification.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
