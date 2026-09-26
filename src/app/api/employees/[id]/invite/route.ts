import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { sendPendingEmployeeInvitation } from '@/lib/invitations'
import { getAppOrigin } from '@/lib/app-url'

/** Versendet die Einladung für einen Mitarbeiter, der zuvor inkrementell ohne
 * Einladung angelegt wurde (siehe EmployeeCreationChat: der Mitarbeiter entsteht
 * schon während des Gesprächs, die Einladung geht erst nach der ausdrücklichen
 * Bestätigung der Leitung an die E-Mail-Adresse). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  try {
    const { emailSent } = await sendPendingEmployeeInvitation(params.id, getAppOrigin(req))
    return NextResponse.json({ emailSent })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Mitarbeiter nicht gefunden') {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    console.error('employees invite', err)
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
