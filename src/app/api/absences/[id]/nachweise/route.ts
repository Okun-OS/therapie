import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'
import { prisma } from '@/lib/prisma'
import {
  nachweiseZu, nachweisLage, NACHWEIS_AB_TAG_STANDARD,
} from '@/lib/krankmeldung'

export const dynamic = 'force-dynamic'

/**
 * §130 GET /api/absences/[id]/nachweise
 *
 * Zu einer Fehlzeit: welche Bescheinigungen vorliegen, ob sie den Zeitraum
 * decken und was gegebenenfalls fehlt.
 *
 * Der Mitarbeiter darf das zu seiner eigenen Fehlzeit sehen — es ist seine
 * Krankheit und seine Pflicht, den Schein einzureichen. Wer ihn daran hindert,
 * ihn nachzuhalten, macht die Sache nicht sicherer, sondern nur mühsamer.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const abwesenheit = await prisma.absence.findUnique({ where: { id: params.id } })
  if (!abwesenheit) {
    return NextResponse.json({ error: 'Abwesenheit nicht gefunden' }, { status: 404 })
  }
  const verweigert = await assertEmployeeAccess(session, abwesenheit.employeeId)
  if (verweigert) return verweigert

  const customerId = await resolveCustomerId(session)
  const einstellungen = customerId
    ? await prisma.orgSettings.findUnique({
      where: { customerId }, select: { auNachweisAbTag: true },
    })
    : null
  const abTag = einstellungen?.auNachweisAbTag ?? NACHWEIS_AB_TAG_STANDARD

  const nachweise = await nachweiseZu(params.id)
  const lage = nachweisLage(abwesenheit, nachweise, abTag)

  return NextResponse.json({
    abwesenheit: {
      id: abwesenheit.id,
      employeeId: abwesenheit.employeeId,
      employeeName: abwesenheit.employeeName,
      type: abwesenheit.type,
      startDate: abwesenheit.startDate,
      endDate: abwesenheit.endDate,
      days: abwesenheit.days,
      proofProvided: abwesenheit.proofProvided,
      verificationStatus: abwesenheit.verificationStatus,
    },
    nachweise,
    lage,
    abTag,
  })
}
