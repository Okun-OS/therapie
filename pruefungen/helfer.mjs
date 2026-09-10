/**
 * §123 Gemeinsame Helfer für die Nachweise gegen das laufende System.
 *
 * Diese Prüfungen sprechen über dieselben Schnittstellen wie der Browser —
 * mit echter Anmeldung, echter Datenbank und mehreren Mandanten. Nur so fällt
 * auf, wenn eine fremde Leitung an fremde Daten kommt.
 */
export const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'

export function pruefer() {
  const checks = []
  const check = (label, ok, extra = '') => {
    checks.push([label, ok])
    console.log(`  ${ok ? '✓ PASS' : '✗ FAIL'}  ${label}${extra ? `\n           ${extra}` : ''}`)
  }
  const bilanz = () => {
    const fails = checks.filter(([, ok]) => !ok).length
    console.log(`\n${checks.length - fails}/${checks.length} Checks bestanden`)
    return fails
  }
  return { check, bilanz, checks }
}

export async function login(email, passwort = 'Test1234!') {
  const r = await fetch(`${BASIS}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: passwort }),
  })
  if (!r.ok) throw new Error(`Login ${email} fehlgeschlagen: HTTP ${r.status}`)
  return r.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')
}

export const hole = async (cookie, pfad) => {
  const r = await fetch(`${BASIS}${pfad}`, { headers: { cookie } })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

export const sende = async (cookie, pfad, methode, daten) => {
  const r = await fetch(`${BASIS}${pfad}`, {
    method: methode,
    headers: { cookie, 'Content-Type': 'application/json' },
    body: daten === undefined ? undefined : JSON.stringify(daten),
  })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

/**
 * §123 Ausgangszustand für eine Lohn-Prüfung herstellen.
 *
 * Prüfungen, die nur einzeln bestehen, sind kein Sicherheitsnetz. Beim ersten
 * Lauf aller Nachweise hintereinander sind drei von zwölf fehlgeschlagen —
 * nicht weil das Programm falsch war, sondern weil sie sich gegenseitig
 * Zustand hinterlassen haben.
 *
 * Die Reihenfolge ist wichtig: erst die Abrechnungen auf Entwurf, denn ein
 * freigegebener Monat lässt weder Einmalzahlungen löschen noch neu rechnen.
 */
export async function zuruecksetzen(cookie, monate) {
  for (const [jahr, monat] of monate) {
    // 1. Abrechnungen auf Entwurf — sonst ist alles Weitere gesperrt
    const eintraege = (await hole(cookie, `/api/payroll?year=${jahr}&month=${monat}`)).body.entries ?? []
    for (const e of eintraege) {
      if (e.status !== 'draft') {
        await sende(cookie, '/api/payroll', 'PATCH', { id: e.id, status: 'draft', notes: '' })
      }
    }

    // 2. Einmalzahlungen löschen
    const zahlungen = (await hole(cookie, `/api/payroll/einmalzahlung?jahr=${jahr}&monat=${monat}`))
      .body.zahlungen ?? []
    for (const z of zahlungen) {
      await fetch(`${BASIS}/api/payroll/einmalzahlung?id=${z.id}`, {
        method: 'DELETE', headers: { cookie },
      })
    }

    // 3. Offene Korrekturen verwerfen
    const korrekturen = (await hole(cookie, `/api/payroll/aufrollen?jahr=${jahr}&monat=${monat}`))
      .body.korrekturen ?? []
    for (const k of korrekturen.filter(x => x.status === 'offen')) {
      await sende(cookie, '/api/payroll/aufrollen', 'PATCH', { id: k.id, status: 'verworfen' })
    }
  }
}

/** Die Monate, die eine Lohn-Prüfung anfassen kann: Vor-, aktueller und Folgemonat. */
export function pruefMonate(jahr, monat) {
  const vor = monat === 1 ? [jahr - 1, 12] : [jahr, monat - 1]
  const folge = monat === 12 ? [jahr + 1, 1] : [jahr, monat + 1]
  return [vor, [jahr, monat], folge]
}

/** Eindeutige Test-E-Mail, damit Wiederholungen nicht kollidieren. */
export const testMail = (praefix) =>
  `${praefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}@pruefung.test`
