import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'

// §88: Diagnose für den Rechendienst. Zeigt, ob und wie er erreichbar ist —
// damit bei "HTTP 502" nicht geraten werden muss, woran es liegt.
export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const url = process.env.SOLVER_SERVICE_URL
  if (!url) {
    return NextResponse.json({
      ok: false,
      configured: false,
      hinweis: 'SOLVER_SERVICE_URL ist nicht gesetzt. In Railway beim App-Service als Variable eintragen, z.B. http://solver.railway.internal:8080',
    })
  }

  // Host/Port anzeigen (ohne evtl. enthaltene Zugangsdaten)
  let ziel = url
  try {
    const u = new URL(url)
    ziel = `${u.protocol}//${u.hostname}${u.port ? ':' + u.port : ''}`
  } catch { /* unveränderte Anzeige */ }

  const t0 = Date.now()
  try {
    const resp = await fetch(`${url}/health`, { signal: AbortSignal.timeout(8_000) })
    const dauer = Date.now() - t0
    if (resp.ok) {
      return NextResponse.json({ ok: true, configured: true, ziel, status: resp.status, dauerMs: dauer,
        hinweis: 'Der Rechendienst antwortet. Die Dienstplanung sollte funktionieren.' })
    }
    return NextResponse.json({
      ok: false, configured: true, ziel, status: resp.status, dauerMs: dauer,
      hinweis: resp.status === 502 || resp.status === 503
        ? 'Der Dienst läuft gerade nicht (Gateway meldet ihn als nicht verfügbar). In Railway den Service "solver" öffnen: Läuft das neueste Deployment? Steht im Log ein Absturz (z.B. "Out of memory")?'
        : `Unerwartete Antwort (HTTP ${resp.status}). Bitte das Log des Solver-Service in Railway prüfen.`,
    })
  } catch (err) {
    return NextResponse.json({
      ok: false, configured: true, ziel, dauerMs: Date.now() - t0,
      fehler: err instanceof Error ? err.message : String(err),
      hinweis: 'Keine Verbindung möglich. Prüfe, ob SOLVER_SERVICE_URL auf den richtigen internen Host und Port zeigt (der Dienst lauscht auf $PORT, Standard 8080) und ob der Service in Railway läuft.',
    })
  }
}
