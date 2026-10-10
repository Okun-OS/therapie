'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { CloudOff, RefreshCw, AlertTriangle, Check } from 'lucide-react'
import {
  alle, entfernen, aktualisieren, beurteilen, schlangenText, type Vorgang,
} from '@/lib/warteschlange'

/**
 * §138 Der Treiber, der die Warteschlange leert — und die Leiste, die zeigt,
 * was noch wartet.
 *
 * WARUM KEIN HINTERGRUND-DIENST
 * Der übliche Weg wäre „Background Sync" im Service Worker. Den gibt es auf
 * iPhones nicht, und genau dorthin soll die App. Also wird nachgereicht, wenn
 * die App offen ist: beim Start, sobald das Netz zurückkommt, und alle halbe
 * Minute. Das genügt — der Weg aus dem Keller nach oben dauert länger.
 *
 * DIE SCHLANGE HÄLT AN, WENN ETWAS HAKT
 * Nachgereicht wird strikt der Reihe nach, und beim ersten Vorgang, der nicht
 * durchgeht, ist Schluss für diesen Durchlauf. Sonst käme „gehen" vor „kommen"
 * an, der Server lehnte es zu Recht ab, und die Zeit wäre trotzdem verloren.
 *
 * WAS VERWORFEN WIRD, WIRD GESAGT
 * Bei etwas, das über Lohn entscheidet, ist „ist wohl nicht durchgegangen"
 * keine zulässige Antwort. Jeder verworfene Vorgang bleibt als Meldung stehen,
 * bis jemand sie wegklickt.
 */

/** Ereignis, mit dem andere Teile der App auf Änderungen reagieren. */
export const SCHLANGE_EREIGNIS = 'okun:warteschlange'

export function schlangeGeaendert() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SCHLANGE_EREIGNIS))
  }
}

export function Warteschlange() {
  const [wartend, setWartend] = useState<Vorgang[]>([])
  const [online, setOnline] = useState(true)
  const [uebertraegt, setUebertraegt] = useState(false)
  const [verworfen, setVerworfen] = useState<{ id: string; text: string }[]>([])
  const [gerade, setGerade] = useState(0)
  const laeuft = useRef(false)

  const lesen = useCallback(() => setWartend(alle()), [])

  const senden = useCallback(async () => {
    // Nur ein Durchlauf gleichzeitig — sonst schickt jeder Takt dasselbe
    // noch einmal und der Server bekommt Stempel doppelt.
    if (laeuft.current) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return

    const schlange = alle()
    if (schlange.length === 0) return

    laeuft.current = true
    setUebertraegt(true)
    let erledigt = 0

    for (const vorgang of schlange) {
      let status: number | null = null
      let fehlertext: string | undefined
      try {
        const r = await fetch(vorgang.pfad, {
          method: vorgang.methode,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(vorgang.daten),
        })
        status = r.status
        if (!r.ok) {
          const d = await r.json().catch(() => ({}))
          fehlertext = d.error
        }
      } catch {
        status = null
      }

      const urteil = beurteilen(status, fehlertext, vorgang.versuche)

      if (urteil.ausgang === 'erledigt') {
        entfernen(vorgang.id)
        erledigt++
        continue
      }
      if (urteil.ausgang === 'verworfen') {
        entfernen(vorgang.id)
        setVerworfen(v => [...v, { id: vorgang.id, text: urteil.text ?? 'Nicht übernommen.' }])
        continue
      }
      // Wiederholen: Zähler hoch und ABBRECHEN — die Reihenfolge muss halten.
      aktualisieren(vorgang.id, {
        versuche: vorgang.versuche + 1,
        letzterFehler: fehlertext ?? 'keine Verbindung',
      })
      break
    }

    laeuft.current = false
    setUebertraegt(false)
    setGerade(g => g + erledigt)
    lesen()
    if (erledigt > 0) schlangeGeaendert()
  }, [lesen])

  useEffect(() => {
    lesen()
    senden()

    const wiederDa = () => { setOnline(true); senden() }
    const weg = () => setOnline(false)
    window.addEventListener('online', wiederDa)
    window.addEventListener('offline', weg)
    window.addEventListener(SCHLANGE_EREIGNIS, lesen)
    setOnline(navigator.onLine !== false)

    const takt = setInterval(senden, 30000)
    return () => {
      window.removeEventListener('online', wiederDa)
      window.removeEventListener('offline', weg)
      window.removeEventListener(SCHLANGE_EREIGNIS, lesen)
      clearInterval(takt)
    }
  }, [lesen, senden])

  // Die Meldung über Erfolg verschwindet von selbst — die über Verworfenes nicht.
  useEffect(() => {
    if (gerade === 0) return
    const t = setTimeout(() => setGerade(0), 4000)
    return () => clearTimeout(t)
  }, [gerade])

  if (wartend.length === 0 && verworfen.length === 0 && online && gerade === 0) return null

  return (
    <div className="px-4 pt-3 space-y-2">
      {!online && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-gray-800 text-white px-4 py-3">
          <CloudOff size={17} className="shrink-0" />
          <p className="text-xs flex-1">
            Kein Netz. Was du jetzt tust, wird gemerkt und später übertragen —
            mit der Uhrzeit von jetzt.
          </p>
        </div>
      )}

      {wartend.length > 0 && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
          <RefreshCw size={16} className={`text-amber-600 shrink-0 ${
            uebertraegt ? 'animate-spin' : ''}`} />
          <p className="text-xs text-amber-900 flex-1">{schlangenText(wartend)}</p>
          {online && !uebertraegt && (
            <button onClick={senden} className="text-xs font-semibold text-amber-900 shrink-0">
              Jetzt
            </button>
          )}
        </div>
      )}

      {gerade > 0 && wartend.length === 0 && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-green-50 border border-green-200 px-4 py-3">
          <Check size={16} className="text-green-600 shrink-0" />
          <p className="text-xs text-green-900">
            {gerade === 1 ? 'Eintrag übertragen.' : `${gerade} Einträge übertragen.`}
          </p>
        </div>
      )}

      {verworfen.map(v => (
        <div key={v.id}
          className="flex items-start gap-2.5 rounded-2xl bg-red-50 border border-red-200 px-4 py-3">
          <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs text-red-900 flex-1">{v.text}</p>
          <button
            onClick={() => setVerworfen(x => x.filter(y => y.id !== v.id))}
            className="text-xs font-semibold text-red-900 shrink-0"
          >
            OK
          </button>
        </div>
      ))}
    </div>
  )
}
