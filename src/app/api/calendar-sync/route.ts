import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'
import { getAppOrigin } from '@/lib/app-url'

/**
 * §228 Das Kalender-Abo: Adresse und Zugriff.
 *
 * ZWEI BEFUNDE AN EINER ROUTE
 *
 * 1. DIE ADRESSE KAM AUS DEM BROWSERFENSTER
 *    Gemeldet: „Bei dem Google Sync steht noch die alte Domain." Die Maske
 *    baute die Adresse aus `window.location.origin` — also aus dem Fenster, in
 *    dem die Person gerade steht. Wer über `therapie-production.up.railway.app`
 *    angemeldet war, bekam eine Abo-Adresse auf diesen Namen.
 *
 *    Das ist nicht nur das falsche Logo. Ein Kalender-Abo liegt JAHRE im
 *    Telefon: Es wird einmal eingerichtet und nie wieder angesehen. Fällt der
 *    alte Name weg, hört der Dienstplan einfach auf, sich zu aktualisieren —
 *    ohne Fehlermeldung, ohne dass jemand es merkt, bis eine Schicht verpasst
 *    wird. Deshalb kommt die Adresse jetzt vom Server aus `APP_URL`, derselben
 *    Quelle, aus der auch jeder Link in einer E-Mail kommt.
 *
 * 2. ES GAB KEINE ZUGRIFFSPRÜFUNG
 *    `requireRole(req)` ohne Rollenliste lässt jede angemeldete Person herein,
 *    und danach wurde die Kennung aus dem Abfrageteil ungeprüft benutzt. Der
 *    Token ist der SCHLÜSSEL zum Dienstplan: Wer ihn hat, liest über
 *    `/api/calendar-feed/<token>` ohne Anmeldung, wer wann wo arbeitet. Jede
 *    angemeldete Person konnte ihn für jede andere abrufen — und über PATCH
 *    sogar deren Abo ein- und ausschalten.
 *
 *    Gefunden beim Beheben des ersten Punktes, nicht durch eine Meldung.
 */

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const employeeId = req.nextUrl.searchParams.get('employeeId')
  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId ist erforderlich' }, { status: 400 })
  }

  const zugriffVerweigert = await assertEmployeeAccess(session, employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  const sync = await prisma.employeeCalendarSync.findUnique({ where: { employeeId } })
  /*
   * §228 Der rohe Token steht nicht mehr eigens in der Antwort.
   *
   * Die Maske braucht ihn nicht — sie zeigt die Adresse, und darin steckt er.
   * Ein Feld, das niemand liest, ist bei einem Schlüssel kein harmloses Feld:
   * Es landet in jedem Protokoll, das Antworten mitschreibt.
   */
  return NextResponse.json({
    enabled: sync?.enabled ?? false,
    feedUrl: sync?.token ? feedAdresse(req, sync.token) : null,
  })
}

export async function PATCH(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const { employeeId, enabled } = await req.json()
  if (!employeeId || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'employeeId und enabled sind erforderlich' }, { status: 400 })
  }

  const zugriffVerweigert = await assertEmployeeAccess(session, employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  const sync = await prisma.employeeCalendarSync.upsert({
    where: { employeeId },
    update: { enabled },
    create: { employeeId, enabled },
  })
  return NextResponse.json({
    enabled: sync.enabled,
    feedUrl: feedAdresse(req, sync.token),
  })
}

/**
 * Die Adresse, unter der der Kalender liegt.
 *
 * §238 Hier stand: „Auf Railway ist sie gesetzt, und damit steht hier
 * `okun-workforce.com`." Genau diese Annahme war falsch — gesetzt war sie,
 * aber auf den von Railway erzeugten Namen, und der stand dann in jeder
 * Abo-Adresse. Dreimal gemeldet, bis es nachgemessen wurde.
 *
 * `getAppOrigin` fragt jetzt `kanonischeBasis`, und die nimmt `APP_URL` nur,
 * wenn dort auch eine eigene Adresse steht. Die Adresse der Anfrage bleibt
 * der Rückfall für die Entwicklung.
 */
function feedAdresse(req: NextRequest, token: string): string {
  return `${getAppOrigin(req)}/api/calendar-feed/${token}`
}
