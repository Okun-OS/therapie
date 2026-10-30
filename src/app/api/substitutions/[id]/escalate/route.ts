import { NextRequest, NextResponse } from 'next/server'
import { escalateRequest } from '@/lib/substitution-service'
import { requireRole } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { locationFilter } from '@/lib/scope'
import { nutzerText, nutzerStatus } from '@/lib/fachfehler'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  // §111 Eskalation war ohne Zustaendigkeitspruefung moeglich.
  const anfrage = await prisma.substitutionRequest.findUnique({
    where: { id: params.id }, select: { locationId: true },
  })
  if (!anfrage) return NextResponse.json({ error: 'Anfrage nicht gefunden' }, { status: 404 })
  const erlaubt = await locationFilter(session, anfrage.locationId)
  if (erlaubt instanceof NextResponse) return erlaubt

  try {
    const request = await escalateRequest(params.id)
    return NextResponse.json({ request })
  } catch (err) {
    return NextResponse.json(
      { error: nutzerText(err, 'Die Anfrage konnte nicht weitergegeben werden.') },
      { status: nutzerStatus(err) },
    )
  }
}
