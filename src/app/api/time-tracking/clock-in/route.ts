import { NextRequest, NextResponse } from 'next/server'
import { recordClockIn } from '@/lib/workforce-score-service'
import { requireRole } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'
import { nutzerText, nutzerStatus } from '@/lib/fachfehler'

export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const { employeeId, date, locationId } = await req.json()
  if (!employeeId || !date || !locationId) {
    return NextResponse.json({ error: 'employeeId, date und locationId sind erforderlich' }, { status: 400 })
  }

  // §109 Zugriffsschutz: Zeitdaten gehören genau einer Person. Ein Mitarbeiter
  // darf nur die eigenen bewegen, die Leitung nur die ihres Standorts.
  const zugriffVerweigert = await assertEmployeeAccess(session, employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  try {
    const entry = await recordClockIn(employeeId, date, locationId, new Date())
    return NextResponse.json({ entry })
  } catch (err) {
    // §234 Nur die eigenen Sätze des Programms gehen hinaus — alles andere
    // würde die Datenbankadresse auf den Bildschirm einer Pflegekraft schreiben.
    return NextResponse.json(
      { error: nutzerText(err, 'Das Einstempeln hat nicht geklappt. Bitte noch einmal versuchen.') },
      { status: nutzerStatus(err) },
    )
  }
}
