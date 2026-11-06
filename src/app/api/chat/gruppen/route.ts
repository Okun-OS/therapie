import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { allowedLocationScope } from '@/lib/scope'
import { eigeneKennung } from '@/lib/chat'

export const dynamic = 'force-dynamic'

/**
 * §129 GET /api/chat/gruppen — alle Gruppen im Bereich der Leitung.
 *
 * Auch die, in denen sie nicht Mitglied ist. Das ist die Verwaltungssicht: sie
 * zeigt, DASS es eine Gruppe gibt, wie sie heißt und wie viele darin sind —
 * aber keine einzige Nachricht. Zum Mitlesen muss die Leitung beitreten, und
 * das hinterlässt einen Hinweis im Verlauf.
 */
export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const ich = eigeneKennung(session)
  const scope = await allowedLocationScope(session)
  if (scope.kind === 'locations' && scope.ids.length === 0) {
    return NextResponse.json({ gruppen: [] })
  }

  const customerId = await resolveCustomerId(session)
  const raeume = await prisma.chatRaum.findMany({
    where: {
      art: 'gruppe',
      customerId: customerId ?? '—',
      // Gruppen ohne Standort gehoeren dem Unternehmen; sie erscheinen dort,
      // aber nicht in der Sicht einer einzelnen Standortleitung.
      ...(scope.kind === 'all' ? {} : { locationId: { in: scope.ids } }),
    },
    orderBy: { letzteAktivitaet: 'desc' },
    take: 200,
  })
  if (raeume.length === 0) return NextResponse.json({ gruppen: [] })

  const mitglieder = await prisma.chatMitglied.findMany({
    where: { raumId: { in: raeume.map(r => r.id) } },
    select: { raumId: true, userId: true },
  })

  return NextResponse.json({
    gruppen: raeume.map(r => {
      const drin = mitglieder.filter(m => m.raumId === r.id)
      return {
        id: r.id,
        name: r.name,
        beschreibung: r.beschreibung,
        locationId: r.locationId,
        archiviert: !!r.archiviertAm,
        mitgliederAnzahl: drin.length,
        binMitglied: !!ich && drin.some(m => m.userId === ich),
        letzteAktivitaet: r.letzteAktivitaet.toISOString(),
      }
    }),
  })
}
