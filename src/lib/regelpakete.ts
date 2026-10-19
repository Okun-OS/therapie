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
  /**
   * §161 Ein Musterpaket ist eine Vorlage, kein Kundenpaket.
   *
   * Es kennt den Betrieb nicht und überspringt, was nicht passt, statt laut
   * zu scheitern. Das ist für den Anfang richtig und auf Dauer zu wenig —
   * deshalb muss in der Oberfläche zu sehen sein, dass hier noch ein
   * Gespräch aussteht.
   */
  muster?: boolean
  /**
   * §202 Was das Paket an einem Standort einrichtet: Arbeitstage,
   * Dienstzeiten, Etagen und Gruppen, Basiswerte. Angelegt wird davon nur,
   * was am Standort fehlt (`src/lib/paket-einrichtung.ts`). Geprüft hat es
   * der Rechendienst schon — eine fehlerhafte Einrichtung meldet er gar nicht,
   * sondern `einrichtungFehler`.
   */
  einrichtung?: PaketEinrichtung
  einrichtungFehler?: string[]
}

export interface PaketEinrichtung {
  arbeitstage: string[]
  dienstzeiten: Array<{
    name: string
    art: 'frueh' | 'spaet' | 'mittel' | 'nacht'
    von: string
    bis: string
    mindestbesetzung?: number
  }>
  struktur: Array<{
    name: string
    typ: 'etage' | 'gruppe'
    etage?: string
    mindestbesetzung?: number
  }>
  basiswerte: { maxWochenstunden?: number; ruhezeitStunden?: number; maxFolgetage?: number }
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
  const name = p.version ? `${kunde} (v${p.version})` : kunde
  return p.muster ? `${name} — Vorlage` : name
}

/**
 * §161 Was zu einem zugeordneten Musterpaket gesagt werden muss.
 *
 * Ein Musterpaket ist ein Ausgangspunkt. Wer es zuordnet und dann vergisst,
 * plant dauerhaft mit Regeln, die für niemanden gemacht wurden — und merkt es
 * nicht, weil der Plan ja entsteht.
 */
export function musterHinweis(p: Regelpaket | undefined): string | null {
  if (!p?.muster) return null
  return 'Das ist eine Vorlage, kein Kundenpaket. Sie deckt ab, was in fast '
    + 'jeder Einrichtung gilt, und überspringt alles, was zu diesem Betrieb '
    + 'nicht passt — im Plan steht dann, was übersprungen wurde. Diese Liste '
    + 'ist die Tagesordnung für das Gespräch, aus dem das eigene Paket wird.'
}
