import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { resendInvitation } from '@/lib/invitations'
import { getAppOrigin } from '@/lib/app-url'

/** Admin-Aktion, daher ist der Routenparameter hier die Einladungs-ID (nicht
 * der geheime Token wie bei den öffentlichen Routen in diesem Ordner). */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  try {
    const { emailSent } = await resendInvitation(params.token, getAppOrigin(req))
    return NextResponse.json({ emailSent })
  } catch (err: unknown) {
    if (err instanceof Error && (err.message === 'Einladung nicht gefunden' || err.message === 'Einladung wurde bereits angenommen')) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('invitations resend', err)
    return NextResponse.json({ error: 'Unbekannter Fehler' }, { status: 500 })
  }
}
