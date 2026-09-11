import { NextRequest, NextResponse } from 'next/server'
import { getAbsencesByLocation, getAbsencesByEmployee, addAbsence } from '@/lib/time-tracking-entities'
import { requireRole, resolveCustomerId } from '@/lib/session'
import type { SessionPayload } from '@/lib/session'
import { locationFilter, assertEmployeeAccess } from '@/lib/scope'
import { prisma } from '@/lib/prisma'
import { nachweisLage, NACHWEIS_AB_TAG_STANDARD } from '@/lib/krankmeldung'

/**
 * §130 Zu jeder Fehlzeit dazusagen, wie es um den Nachweis steht.
 *
 * Bisher stand an einer Abwesenheit nur „Nachweis vorhanden: ja/nein" — von
 * Hand gesetzt und damit irgendwann falsch. Jetzt wird es aus den verknüpften
 * Bescheinigungen abgeleitet, samt der Frage, ob sie den Zeitraum überhaupt
 * abdecken. Eine dreiwöchige Krankheit mit einer Bescheinigung über eine Woche
 * sah vorher genauso aus wie eine vollständig belegte.
 *
 * Eine Abfrage für alle Fehlzeiten der Liste, nicht eine je Zeile.
 */
async function mitNachweisLage(
  absences: { id: string; type: string; startDate: string; endDate: string }[],
  abTag: number,
) {
  if (absences.length === 0) return absences
  const dateien = await prisma.storedFile.findMany({
    where: { absenceId: { in: absences.map(a => a.id) }, deletedAt: null },
    select: { absenceId: true, gueltigVon: true, gueltigBis: true },
  })
  return absences.map(a => ({
    ...a,
    nachweisLage: nachweisLage(a, dateien.filter(d => d.absenceId === a.id), abTag),
  }))
}

async function nachweisAbTag(session: SessionPayload): Promise<number> {
  const customerId = await resolveCustomerId(session)
  if (!customerId) return NACHWEIS_AB_TAG_STANDARD
  const einstellungen = await prisma.orgSettings.findUnique({
    where: { customerId }, select: { auNachweisAbTag: true },
  })
  return einstellungen?.auNachweisAbTag ?? NACHWEIS_AB_TAG_STANDARD
}

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const locationId = req.nextUrl.searchParams.get('locationId')
  const employeeId = req.nextUrl.searchParams.get('employeeId')
  const abTag = await nachweisAbTag(session)

  // §81 scope guard
  if (employeeId) {
    const denied = await assertEmployeeAccess(session, employeeId)
    if (denied) return denied
    return NextResponse.json({
      absences: await mitNachweisLage(await getAbsencesByEmployee(employeeId), abTag),
    })
  }
  const allowed = await locationFilter(session, locationId)
  if (allowed instanceof NextResponse) return allowed
  if (locationId) {
    return NextResponse.json({
      absences: await mitNachweisLage(await getAbsencesByLocation(locationId), abTag),
    })
  }
  const rows = await prisma.absence.findMany({
    where: allowed ? { locationId: { in: allowed } } : {},
  })
  return NextResponse.json({ absences: await mitNachweisLage(rows, abTag) })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { employeeId, employeeName, locationId, type, startDate, endDate, days, note, proofProvided } = body
  if (!employeeId || !locationId || !type || !startDate || !endDate || typeof days !== 'number') {
    return NextResponse.json({ error: 'Erforderliche Felder fehlen' }, { status: 400 })
  }

  // §110: Die Zugriffspruefung stand nur im GET. Ein Mitarbeiter konnte damit
  // eine Krankmeldung auf den Namen einer Kollegin erfassen.
  const zugriffVerweigert = await assertEmployeeAccess(session, employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  const absence = await addAbsence({ employeeId, employeeName, locationId, type, startDate, endDate, days, note, proofProvided: !!proofProvided })
  return NextResponse.json({ absence })
}
