import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'

export const dynamic = 'force-dynamic'

/**
 * §177 Die Anfragen von der Website — nur für OKUN.
 *
 * WARUM ES DIESE ROUTE ÜBERHAUPT GIBT
 * Weil die Benachrichtigung per E-Mail scheitern kann. Landet sie im Spam
 * oder ist kein Versanddienst eingerichtet, steht die Anfrage trotzdem in
 * der Tabelle — und jemand muss sie dort sehen können. `zugestellt: false`
 * heißt: Diese Anfrage hat niemand als Mail bekommen.
 *
 * WARUM NUR OKUN
 * Es sind Kontaktdaten von Interessenten. Sie gehen keinen Kunden etwas an,
 * auch keine Standortleitung — deshalb ausschließlich die Rolle `okun`.
 */
export async function GET(req: NextRequest) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  const anfragen = await prisma.kontaktanfrage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true, name: true, email: true, einrichtung: true, telefon: true,
      nachricht: true, zugestellt: true, createdAt: true,
      // `fehler` bleibt draußen: Dort steht zwischenzeitlich die
      // IP-Adresse für die Bremse, und die hat in einer Liste nichts zu
      // suchen. Wer den Versandfehler braucht, sieht `zugestellt`.
    },
  })

  return NextResponse.json({
    anfragen,
    nichtZugestellt: anfragen.filter(a => !a.zugestellt).length,
  })
}
