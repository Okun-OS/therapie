import { NextRequest, NextResponse } from 'next/server'
import { recordClockOut } from '@/lib/workforce-score-service'
import { requireRole } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const { timeClockEntryId } = await req.json()
  if (!timeClockEntryId) {
    return NextResponse.json({ error: 'timeClockEntryId ist erforderlich' }, { status: 400 })
  }

  // §109: Bisher genügte eine Eintrags-ID, um irgendjemanden auszustempeln.
  // Erst den Eigentümer ermitteln, dann prüfen, ob der Aufrufer ihn bewegen darf.
  const eintrag = await prisma.timeClockEntry.findUnique({
    where: { id: timeClockEntryId },
    select: { employeeId: true },
  })
  if (!eintrag) {
    return NextResponse.json({ error: 'Zeiterfassung nicht gefunden' }, { status: 404 })
  }
  const zugriffVerweigert = await assertEmployeeAccess(session, eintrag.employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  try {
    const entry = await recordClockOut(timeClockEntryId, new Date())
    return NextResponse.json({ entry })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Fehler beim Ausstempeln' }, { status: 400 })
  }
}
