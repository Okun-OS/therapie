import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { ungeleseneGesamt } from '@/lib/chat'

export const dynamic = 'force-dynamic'

/**
 * §129 GET /api/chat/ungelesen — nur die Zahl für das Abzeichen im Kopf.
 *
 * Eigene Schnittstelle, weil sie auf jeder Seite abgefragt wird: die volle
 * Gesprächsliste dafür zu laden wäre bei jedem Seitenwechsel unnötige Arbeit.
 */
export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session
  return NextResponse.json({ ungelesen: await ungeleseneGesamt(session) })
}
