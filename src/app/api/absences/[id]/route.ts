import { NextRequest, NextResponse } from 'next/server'
import { updateAbsence } from '@/lib/time-tracking-entities'
import { requireRole } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { assertEmployeeAccess } from '@/lib/scope'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  // §110 Eine Abwesenheit liess sich allein ueber ihre ID aendern — auch die
  // einer Person an einem fremden Standort.
  const vorhanden = await prisma.absence.findUnique({
    where: { id: params.id }, select: { employeeId: true },
  })
  if (!vorhanden) return NextResponse.json({ error: 'Abwesenheit nicht gefunden' }, { status: 404 })
  const zugriffVerweigert = await assertEmployeeAccess(session, vorhanden.employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  const updates = await req.json()
  const absence = await updateAbsence(params.id, updates)
  if (!absence) return NextResponse.json({ error: 'Abwesenheit nicht gefunden' }, { status: 404 })
  return NextResponse.json({ absence })
}

/**
 * §130 DELETE /api/absences/[id] — eine Fehlzeit entfernen.
 *
 * Bisher ließ sich eine versehentlich erfasste Krankmeldung nur umdeuten, nicht
 * löschen: Wer sich im Mitarbeiter vertippt hatte, hinterließ eine Krankheit
 * bei einer Person, die nie krank war — und die fließt in Auswertungen,
 * Fehlzeitenquoten und die Lohnabrechnung ein.
 *
 * Die eingereichten Bescheinigungen werden dabei NICHT gelöscht. Sie gehören
 * in die Personalakte und unterliegen eigenen Aufbewahrungsfristen; sie
 * verlieren nur ihre Zuordnung und lassen sich danach neu zuordnen.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const vorhanden = await prisma.absence.findUnique({
    where: { id: params.id }, select: { employeeId: true },
  })
  if (!vorhanden) return NextResponse.json({ error: 'Abwesenheit nicht gefunden' }, { status: 404 })
  const zugriffVerweigert = await assertEmployeeAccess(session, vorhanden.employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  const geloest = await prisma.storedFile.updateMany({
    where: { absenceId: params.id },
    data: { absenceId: null },
  })
  await prisma.absence.delete({ where: { id: params.id } })

  return NextResponse.json({ ok: true, nachweiseGeloest: geloest.count })
}
