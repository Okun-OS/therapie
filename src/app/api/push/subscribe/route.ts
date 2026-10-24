import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'

export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const { employeeId, subscription } = await req.json()

  // §111 Der schwerste Fall in diesem Bereich: Hier liess sich das EIGENE Geraet
  // als Empfaenger fuer die Push-Nachrichten einer anderen Person eintragen.
  // Ab dann haette man deren Meldungen mitgelesen. Ein Geraet gehoert genau der
  // Person, die es anmeldet.
  if (!employeeId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: 'employeeId und subscription sind erforderlich' }, { status: 400 })
  }

  const zugriffVerweigert = await assertEmployeeAccess(session, employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: { employeeId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    create: {
      employeeId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  })

  return NextResponse.json({ ok: true })
}
