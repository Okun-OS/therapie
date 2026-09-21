import { NextRequest, NextResponse } from 'next/server'
import { getOrgSettings, updateOrgSettings } from '@/lib/okun-platform-entities'
import { requireRole, resolveCustomerId } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ settings: null })
  }
  const settings = await getOrgSettings(customerId)
  return NextResponse.json({ settings })
}

export async function PATCH(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Mandant für diesen Nutzer hinterlegt' }, { status: 400 })
  }
  const updates = await req.json()

  // §147 Die BEM-Freigabe kann sich eine Standortleitung nicht selbst
  // erteilen. Der Schalter entscheidet darüber, wer Gesundheitsdaten nach
  // Art. 9 DSGVO sieht — eine Entscheidung des Unternehmens, nicht des
  // Standorts. Ohne diese Sperre wäre die Sichtbarkeitsregel eine Bitte.
  if (session.role === 'admin' && 'bemSichtbarLeitung' in updates) {
    return NextResponse.json(
      {
        error: 'Die Freigabe für das Eingliederungsmanagement kann nur die '
          + 'Unternehmensebene erteilen.',
      },
      { status: 403 },
    )
  }

  const settings = await updateOrgSettings(customerId, updates)
  return NextResponse.json({ settings })
}
