// §97: App und Rechendienst dürfen nicht unbemerkt auseinanderlaufen.
//
// Vorgeschichte: Eine Regel ("höchstens ein Spätdienst pro Woche") wurde aktiviert
// und der Plan hielt sie trotzdem nicht ein. Ursache war nicht die Regel, sondern
// der Rollout: Nur die App wurde aktualisiert, der Rechendienst nicht. Der
// erzeugte Regel-Code nutzte die Variable `weeks`, die die ältere Solver-Version
// nicht kennt — der Code scheiterte und wurde stillschweigend übersprungen.
// Ergebnis: Regel aktiv, Plan ohne Regel, keinerlei Hinweis.
//
// Deshalb erklärt die App hier, welche Fähigkeiten sie voraussetzt, und gleicht
// sie mit dem ab, was der Rechendienst meldet.

/** Mindestversion, die der Rechendienst haben muss. */
export const REQUIRED_SOLVER_VERSION = 97

/** Fähigkeiten, auf die sich der erzeugte Regel-Code stützt. */
export const REQUIRED_SOLVER_FEATURES = ['weeks', 'regel-report', 'feste-zeiten'] as const

export interface SolverCapabilities {
  solverVersion?: number
  sandboxVars?: string[]
  features?: string[]
}

export interface CapabilityCheck {
  ok: boolean
  /** true, wenn der Dienst gar keine Version meldet — also älter als §97 */
  unbekannt: boolean
  laufendeVersion: number | null
  fehlendeFeatures: string[]
  hinweis: string
}

const AKTUALISIEREN =
  'Der Rechendienst muss neu ausgerollt werden: in Railway den Service "solver" öffnen ' +
  'und das neueste Deployment starten (Redeploy). Danach den Dienstplan neu erzeugen.'

export function checkCapabilities(caps: SolverCapabilities | null | undefined): CapabilityCheck {
  const version = typeof caps?.solverVersion === 'number' ? caps.solverVersion : null

  if (version === null) {
    return {
      ok: false,
      unbekannt: true,
      laufendeVersion: null,
      fehlendeFeatures: [...REQUIRED_SOLVER_FEATURES],
      hinweis:
        'Der Rechendienst meldet keine Version — er läuft also in einer veralteten Fassung. ' +
        'Individuelle Regeln können dabei wirkungslos bleiben, ohne dass es auffällt. ' +
        AKTUALISIEREN,
    }
  }

  const vorhanden = new Set(caps?.features ?? [])
  const fehlend = REQUIRED_SOLVER_FEATURES.filter(f => !vorhanden.has(f))

  if (version < REQUIRED_SOLVER_VERSION || fehlend.length > 0) {
    return {
      ok: false,
      unbekannt: false,
      laufendeVersion: version,
      fehlendeFeatures: fehlend,
      hinweis:
        `Der Rechendienst läuft in Version ${version}, benötigt wird ${REQUIRED_SOLVER_VERSION}` +
        (fehlend.length > 0 ? ` (fehlt: ${fehlend.join(', ')})` : '') +
        '. Individuelle Regeln greifen dadurch möglicherweise nicht. ' +
        AKTUALISIEREN,
    }
  }

  return {
    ok: true,
    unbekannt: false,
    laufendeVersion: version,
    fehlendeFeatures: [],
    hinweis: `Rechendienst aktuell (Version ${version}).`,
  }
}
