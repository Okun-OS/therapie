import { NextRequest, NextResponse } from 'next/server'
import { respondToCandidate } from '@/lib/substitution-service'
import { requireRole } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const { employeeId, action } = await req.json()

  if (!employeeId || (action !== 'accept' && action !== 'decline')) {
    return NextResponse.json({ error: 'employeeId und action ("accept"|"decline") sind erforderlich' }, { status: 400 })
  }

  // §111 Hier liess sich im Namen einer anderen Person zu- oder absagen.
  const zugriffVerweigert = await assertEmployeeAccess(session, employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  try {
    const request = await respondToCandidate(params.id, employeeId, action)
    return NextResponse.json({ request })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Fehler bei der Antwort' }, { status: 400 })
  }
}
