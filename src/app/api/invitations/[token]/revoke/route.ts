import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { revokeInvitation } from '@/lib/invitations'

/** Admin-Aktion, daher ist der Routenparameter hier die Einladungs-ID (nicht
 * der geheime Token wie bei den öffentlichen Routen in diesem Ordner). */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  try {
    await revokeInvitation(params.token)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof Error && (err.message === 'Einladung nicht gefunden' || err.message === 'Einladung wurde bereits angenommen')) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('invitations revoke', err)
    return NextResponse.json({ error: 'Unbekannter Fehler' }, { status: 500 })
  }
}
