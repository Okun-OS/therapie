import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, setSessionCookie, type SessionRole } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } })
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  const res = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId ?? undefined,
      locationId: user.locationId ?? undefined,
      customerId: user.customerId ?? undefined,
      customerName: user.customerName ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined,
    },
  })

  const driftedFromCookie =
    user.employeeId !== (session.employeeId ?? null) ||
    user.locationId !== (session.locationId ?? null) ||
    user.customerId !== (session.customerId ?? null) ||
    user.role !== session.role
  if (driftedFromCookie) {
    setSessionCookie(res, {
      userId: user.id,
      email: user.email,
      role: user.role as SessionRole,
      employeeId: user.employeeId ?? undefined,
      locationId: user.locationId ?? undefined,
      customerId: user.customerId ?? undefined,
    })
  }

  return res
}

// DSGVO Art. 17 – Recht auf Löschung
/**
 * §140 Das Konto löscht sich nicht mehr selbst.
 *
 * Bis hierher tat dieser Aufruf genau das, was auf dem Knopf stand: Er löschte
 * das Benutzerkonto und überschrieb Name und E-Mail des Mitarbeiters mit
 * „Gelöschter Mitarbeiter" — ohne jede Prüfung.
 *
 * In einem Programm, das Löhne rechnet, ist das aus zwei Richtungen falsch.
 * Gegen das Gesetz: Das Lohnkonto muss sechs Jahre zuordenbar bleiben (§41
 * Abs. 1 EStG, §28f SGB IV), Buchungsbelege zehn (§147 AO, §257 HGB) —
 * danach hätte die Betriebsprüfung Abrechnungen ohne Person vorgefunden. Und
 * gegen den Menschen selbst: Mit dem Namen verschwindet die Grundlage seiner
 * eigenen Lohnsteuerbescheinigung.
 *
 * Der richtige Weg steht seit §128/§139 im Programm: ein Löschantrag mit
 * Vorschau, der löscht, was gelöscht werden darf, und sperrt, was bleiben
 * muss. Dieser Aufruf verweist nur noch dorthin — als Fehler, nicht still,
 * damit es auffällt, falls ihn doch noch jemand ruft.
 */
export async function DELETE(req: NextRequest) {
  const session = getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  return NextResponse.json(
    {
      error: 'Ein Konto lässt sich nicht sofort löschen: Lohnunterlagen '
        + 'unterliegen gesetzlichen Aufbewahrungsfristen. Stellen Sie den '
        + 'Löschantrag unter „Mein Konto → Datenschutz" — er wird geprüft, und '
        + 'was gelöscht werden darf, wird gelöscht.',
      weiter: '/api/dsgvo/loeschantrag',
    },
    { status: 409 },
  )
}
