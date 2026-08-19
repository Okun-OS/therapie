import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { allowedLocationScope } from '@/lib/scope'
import { prisma } from '@/lib/prisma'
import { dienstAnfragen, dienstBesetzen } from '@/lib/ausfall-service'

export const dynamic = 'force-dynamic'

// §101 POST /api/substitutions/[id]/anfragen
//   { employeeId, aktion: 'anfragen' | 'besetzen' }
//
// 'anfragen'  — die Person bekommt eine verbindliche Dienstanfrage
// 'besetzen'  — der Dienst wird ihr zugewiesen und steht wieder im Plan
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const { employeeId, aktion = 'anfragen' } = await req.json().catch(() => ({})) as {
    employeeId?: string
    aktion?: 'anfragen' | 'besetzen'
  }
  if (!employeeId) return NextResponse.json({ error: 'employeeId fehlt' }, { status: 400 })

  const anfrage = await prisma.substitutionRequest.findUnique({
    where: { id: params.id },
    select: { locationId: true },
  })
  if (!anfrage) return NextResponse.json({ error: 'Anfrage nicht gefunden' }, { status: 404 })

  const scope = await allowedLocationScope(session)
  if (scope.kind !== 'all' && !scope.ids.includes(anfrage.locationId)) {
    return NextResponse.json({ error: 'Keine Berechtigung für diesen Standort' }, { status: 403 })
  }

  try {
    const ergebnis = aktion === 'besetzen'
      ? await dienstBesetzen(params.id, employeeId)
      : await dienstAnfragen(params.id, employeeId)
    return NextResponse.json(ergebnis)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Aktion fehlgeschlagen' },
      { status: 400 },
    )
  }
}
