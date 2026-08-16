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

  // §89: Öffentliche Railway-Adresse ist die häufigste Ursache für 502 bei
  // langen Berechnungen — der Edge-Proxy kappt die Verbindung, obwohl der
  // Dienst läuft. Intern (…​.railway.internal) gibt es diese Grenze nicht.
  const istOeffentlich = /\.up\.railway\.app/i.test(url)
  const proxyHinweis = istOeffentlich
    ? 'Achtung: Es wird die ÖFFENTLICHE Adresse verwendet. Anfragen laufen dann über den Railway-Proxy, der längere Berechnungen abbricht (Ergebnis: HTTP 502, obwohl der Dienst läuft). Besser die interne Adresse eintragen: http://<service-name>.railway.internal:8080'
    : ''

  const t0 = Date.now()
  try {
    const resp = await fetch(`${url}/health`, { signal: AbortSignal.timeout(8_000) })
    const dauer = Date.now() - t0
    if (resp.ok) {
      return NextResponse.json({
        ok: !istOeffentlich, configured: true, ziel, status: resp.status, dauerMs: dauer, oeffentlich: istOeffentlich,
        hinweis: istOeffentlich
          ? `Der Dienst antwortet (${dauer} ms), aber ${proxyHinweis}`
          : 'Der Rechendienst antwortet. Die Dienstplanung sollte funktionieren.',
      })
    }
    return NextResponse.json({
      ok: false, configured: true, ziel, status: resp.status, dauerMs: dauer,
      hinweis: resp.status === 502 || resp.status === 503
        ? 'Der Dienst läuft gerade nicht (Gateway meldet ihn als nicht verfügbar). In Railway den Service "solver" öffnen: Läuft das neueste Deployment? Steht im Log ein Absturz (z.B. "Out of memory")?'
        : `Unerwartete Antwort (HTTP ${resp.status}). Bitte das Log des Solver-Service in Railway prüfen.`,
    })
  } catch (err) {
    // §91: Wenn die konfigurierte Adresse tot ist, gleich mitprüfen, welche
    // Alternative erreichbar wäre — sonst rät der Nutzer im Dunkeln.
    const alternativen = await probiereAlternativen(url)
    return NextResponse.json({
      ok: false, configured: true, ziel, dauerMs: Date.now() - t0,
      fehler: err instanceof Error ? err.message : String(err),
      alternativen,
      hinweis: alternativen.find(a => a.ok)
        ? `Die eingetragene Adresse antwortet nicht — ABER ${alternativen.find(a => a.ok)!.url} ist erreichbar. Trage genau diese als SOLVER_SERVICE_URL beim App-Service ein.`
        : 'Keine Verbindung möglich — auch nicht über die interne Adresse. Das deutet darauf hin, dass der Solver-Service in Railway gerade kein laufendes Deployment hat. Dort prüfen: Gibt es ein Deployment mit Status ACTIVE? Falls das neueste FAILED ist, das letzte erfolgreiche erneut ausrollen.',
    })
  }
}

// §91: Kandidaten für die Solver-Adresse durchprobieren.
async function probiereAlternativen(configured: string): Promise<{ url: string; ok: boolean; info: string }[]> {
  const kandidaten = new Set<string>()

  // Aus öffentlicher Railway-Adresse die interne ableiten:
  // https://<name>-production.up.railway.app → http://<name>.railway.internal:8080
  const m = configured.match(/https?:\/\/([a-z0-9-]+?)(?:-production)?\.up\.railway\.app/i)
  if (m) kandidaten.add(`http://${m[1]}.railway.internal:8080`)

  // Umgekehrt: aus interner Adresse die öffentliche ableiten
  const mi = configured.match(/https?:\/\/([a-z0-9-]+)\.railway\.internal/i)
  if (mi) kandidaten.add(`https://${mi[1]}-production.up.railway.app`)

  const ergebnisse: { url: string; ok: boolean; info: string }[] = []
  for (const kandidat of Array.from(kandidaten)) {
    if (kandidat === configured) continue
    try {
      const r = await fetch(`${kandidat}/health`, { signal: AbortSignal.timeout(6_000) })
      ergebnisse.push({ url: kandidat, ok: r.ok, info: r.ok ? 'erreichbar' : `HTTP ${r.status}` })
    } catch (e) {
      ergebnisse.push({ url: kandidat, ok: false, info: e instanceof Error ? e.message : 'nicht erreichbar' })
    }
  }
  return ergebnisse
}
