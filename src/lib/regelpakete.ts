/**
 * §126 Die Regelpakete, die im Rechendienst liegen.
 *
 * Ein Regelpaket ist die von OKUN für einen Kunden programmierte
 * Dienstplanlogik — versionierter Code im Repo des Rechendienstes, nicht eine
 * Zeile in der Datenbank. Die App muss sie nur kennen, um sie einem Standort
 * zuordnen zu können.
 *
 * Der Unterschied zu den Custom-Constraints (§70): die schreibt der Kunde
 * selbst und sie liegen in der Datenbank. Ein Regelpaket schreiben wir, es
 * läuft als normaler Code und geht durch Review und Test. Beides läuft
 * nebeneinander.
 */

export interface Regelpaket {
  id: string
  kunde?: string
  version?: number
  beschreibung?: string
  aufgenommen?: string
}

/**
 * Die Paketliste beim Rechendienst abfragen.
 *
 * Ist er nicht erreichbar, wird das GEMELDET und nicht als „keine Pakete"
 * ausgelegt. Der Unterschied ist wichtig: im zweiten Fall würde die Oberfläche
 * anbieten, ein zugeordnetes Paket zu entfernen, weil es angeblich nicht mehr
 * existiert.
 */
export async function verfuegbareRegelpakete(): Promise<{
  pakete: Regelpaket[]
  erreichbar: boolean
}> {
  const url = process.env.SOLVER_SERVICE_URL
  if (!url) return { pakete: [], erreichbar: false }

  try {
    const r = await fetch(`${url}/version`, { signal: AbortSignal.timeout(5_000) })
    if (!r.ok) return { pakete: [], erreichbar: false }
    const daten = await r.json() as { rulePacks?: Regelpaket[] }
    // Ein Rechendienst ohne `rulePacks` ist eine ältere Version — erreichbar,
    // aber er kennt noch keine Pakete.
    return { pakete: daten.rulePacks ?? [], erreichbar: true }
  } catch {
    return { pakete: [], erreichbar: false }
  }
}

/** Anzeigename eines Pakets für die Oberfläche. */
export function paketName(p: Regelpaket): string {
  const kunde = p.kunde ?? p.id
  return p.version ? `${kunde} (v${p.version})` : kunde
}
