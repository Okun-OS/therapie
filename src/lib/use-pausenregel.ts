'use client'

import { useState, useEffect } from 'react'
import { GESETZLICHE_PAUSE, pausenregelAus, type Pausenregel } from './dienstzeit'

/**
 * §284 Die Pausenregel des eigenen Standorts, für die Ansichten des
 * Mitarbeiters.
 *
 * Beide — Dienstplan und Zeiterfassung — zeigen geplante Stunden an und
 * brauchen dieselbe Regel. Zweimal dasselbe `fetch` mit zweimal derselben
 * Umrechnung wäre genau die Doppelung, aus der §266 und §284 entstanden
 * sind.
 *
 * Solange nichts geladen ist, gilt die gesetzliche Vorgabe (ab 6 h 30 min).
 * Das ist derselbe Wert, den die Datenbankspalte vorgibt — eine Zahl, die
 * kurz nach dem Öffnen umspringt, wäre schlimmer als eine, die von Anfang an
 * stimmt.
 */
export function usePausenregel(locationId: string | null | undefined): Pausenregel {
  const [regel, setRegel] = useState<Pausenregel>(GESETZLICHE_PAUSE)

  useEffect(() => {
    if (!locationId) return
    let abgebrochen = false
    fetch(`/api/planning-rules?locationId=${encodeURIComponent(locationId)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        // Ohne Netz oder ohne Berechtigung bleibt die gesetzliche Vorgabe
        // stehen. Sie ist die richtige Annahme, nicht „keine Pause".
        if (!abgebrochen && d?.rules) setRegel(pausenregelAus(d.rules))
      })
      .catch(() => undefined)
    return () => { abgebrochen = true }
  }, [locationId])

  return regel
}
