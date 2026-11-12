import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'
import { zugangNeuEinladen, zugangsStand, ZugangKonflikt } from '@/lib/invitations'
import { logAudit } from '@/lib/audit'
import { getAppOrigin } from '@/lib/app-url'

export const dynamic = 'force-dynamic'

/**
 * Der Zugang eines Mitarbeiters: Einladung senden, neu senden, an eine
 * andere Adresse senden.
 *
 * Ursprünglich nur für den Mitarbeiter, der im Gespräch schrittweise ohne
 * Einladung angelegt wurde (EmployeeCreationChat): Die Einladung geht erst
 * nach der ausdrücklichen Bestätigung der Leitung hinaus, an die — ggf. noch
 * im Gespräch korrigierte — Adresse.
 *
 * §200 Jetzt auch für alle anderen: GET sagt, wie es um den Zugang steht,
 * POST mit `{ email }` tauscht die Adresse und lädt neu ein, POST ohne lädt
 * an die bisherige Adresse neu ein. Was dabei mit alten Links und einem
 * bestehenden Konto geschieht, steht bei `zugangNeuEinladen`.
 *
 * §200 Vorher prüfte diese Route nur die Rolle. Jede Leitung konnte damit für
 * JEDEN Mitarbeiter eine Einladung auslösen, auch beim Wettbewerber — und mit
 * dem neuen Adresstausch wäre daraus eine Kontoübernahme geworden.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session
  const verwehrt = await assertEmployeeAccess(session, params.id)
  if (verwehrt) return verwehrt

  const stand = await zugangsStand(params.id)
  if (!stand) return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 })
  return NextResponse.json(stand)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session
  const verwehrt = await assertEmployeeAccess(session, params.id)
  if (verwehrt) return verwehrt

  const body = await req.json().catch(() => ({})) as { email?: unknown }
  const neueEmail = typeof body.email === 'string' && body.email.trim() ? body.email : undefined

  try {
    const ergebnis = await zugangNeuEinladen(params.id, neueEmail, getAppOrigin(req))
    logAudit({
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      action: 'update',
      entityType: 'employee',
      entityId: params.id,
      details: {
        zugang: ergebnis.adresseGeaendert ? 'adresse-geaendert-neu-eingeladen' : 'neu-eingeladen',
        kontoUmgestellt: ergebnis.kontoUmgestellt,
        emailSent: ergebnis.emailSent,
      },
    }).catch(() => {})
    return NextResponse.json({ ...ergebnis, stand: await zugangsStand(params.id) })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Mitarbeiter nicht gefunden') {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    if (err instanceof ZugangKonflikt) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('employees invite', err)
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
