'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Play, Square, Coffee, AlertTriangle, Loader2 } from 'lucide-react'

/**
 * §137 Die Stempeluhr.
 *
 * Das ist der Handgriff, für den die App morgens um zehn vor sechs geöffnet
 * wird. Er ist deshalb das Erste und Größte auf dem Bildschirm — kein Scrollen,
 * kein Suchen, ein Daumendruck.
 *
 * Drei Dinge, die hier bewusst so sind:
 *
 *   DER ZUSTAND KOMMT VOM SERVER. Vorher hat die Startseite nur eine Anzeige
 *   umgeschaltet und gar nicht gestempelt. Wer darauf gedrückt hat und
 *   weggegangen ist, war nicht eingestempelt — ein Fehler, der aussieht wie
 *   Erfolg. Jetzt gilt, was der Server sagt, und nichts anderes.
 *
 *   EIN KNOPF ZUR ZEIT. Wer eingestempelt ist, sieht „Ausstempeln" und
 *   „Pause" — nicht beides plus „Einstempeln" ausgegraut. Ein ausgegrauter
 *   Knopf ist eine Frage, die niemand gestellt hat.
 *
 *   DIE LAUFENDE ZEIT STEHT DA. Nicht als Zierde: Wer sie sieht, merkt, dass
 *   er gestern das Ausstempeln vergessen hat — und zwar sofort und nicht erst
 *   beim Monatsabschluss.
 */

interface Zustand {
  laeuft: boolean
  pause: boolean
}

interface Log {
  id: string
  date: string
  clockIn: string
  clockInAt?: string | null
  breakStart?: string | null
  breakMinutes?: number | null
  quelle?: string | null
}

const ZEIT = (ms: number) => {
  const min = Math.floor(ms / 60000)
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`
}

export function Stempeluhr({ dienst }: { dienst?: { name: string; von: string; bis: string } | null }) {
  const [zustand, setZustand] = useState<Zustand>({ laeuft: false, pause: false })
  const [log, setLog] = useState<Log | null>(null)
  const [laedt, setLaedt] = useState(true)
  const [arbeitet, setArbeitet] = useState<string | null>(null)
  const [fehler, setFehler] = useState('')
  const [hinweis, setHinweis] = useState('')
  const [jetzt, setJetzt] = useState(() => Date.now())
  const ersterLauf = useRef(true)

  const holen = useCallback(async () => {
    try {
      const r = await fetch('/api/time-tracking/stempeln')
      const d = await r.json()
      setZustand(d.zustand ?? { laeuft: false, pause: false })
      setLog(d.log ?? null)
    } catch {
      if (ersterLauf.current) setFehler('Der Zustand konnte nicht geladen werden.')
    } finally {
      setLaedt(false)
      ersterLauf.current = false
    }
  }, [])

  useEffect(() => { holen() }, [holen])

  // Die laufende Zeit tickt mit. Eine Minute Takt reicht — sekundengenau
  // flackert nur und kostet Strom.
  useEffect(() => {
    if (!zustand.laeuft) return
    const takt = setInterval(() => setJetzt(Date.now()), 30000)
    return () => clearInterval(takt)
  }, [zustand.laeuft])

  async function stempeln(aktion: string) {
    setArbeitet(aktion); setFehler(''); setHinweis('')
    try {
      const r = await fetch('/api/time-tracking/stempeln', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Der Zeitpunkt des Geräts geht mit: Im Funkloch zählt später die Zeit
        // des Stempelns, nicht die des Hochladens.
        body: JSON.stringify({ aktion, zeitpunkt: new Date().toISOString() }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setFehler(d.error ?? 'Das hat nicht geklappt.')
        // Auch im Fehlerfall den echten Zustand übernehmen — nach einem
        // Funkloch ist er oft ein anderer, als das Gerät dachte.
        if (d.zustand) setZustand(d.zustand)
        return
      }
      setZustand(d.zustand); setLog(d.log ?? null)
      setJetzt(Date.now())
      if (d.hinweis) setHinweis(d.hinweis)
    } catch {
      setFehler('Keine Verbindung. Der Stempel wurde nicht gespeichert.')
    } finally {
      setArbeitet(null)
    }
  }

  const seit = log?.clockInAt ? new Date(log.clockInAt).getTime() : null
  const dauer = seit ? ZEIT(jetzt - seit) : null
  // Über acht Stunden ohne Ausstempeln: fast immer ein vergessener Stempel.
  const verdaechtigLang = seit ? (jetzt - seit) / 3600000 > 12 : false

  return (
    <div className="rounded-3xl bg-navy text-white p-5 shadow-lg">
      {/* Kopf: was heute ansteht */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="text-white/60 text-xs font-medium">
            {dienst ? 'Heute' : 'Kein Dienst geplant'}
          </p>
          {dienst && (
            <p className="text-white font-bold text-lg leading-tight">
              {dienst.name}
              <span className="text-white/70 font-normal text-base">
                {' '}· {dienst.von}–{dienst.bis}
              </span>
            </p>
          )}
        </div>
        {zustand.laeuft && (
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1.5 justify-end">
              <span className={`w-2 h-2 rounded-full ${
                zustand.pause ? 'bg-amber-400' : 'bg-green-400 animate-pulse'}`} />
              <span className="text-white/70 text-xs">
                {zustand.pause ? 'Pause' : 'läuft'}
              </span>
            </div>
            <p className="text-white text-2xl font-bold tabular-nums leading-tight">{dauer}</p>
            <p className="text-white/50 text-[11px]">seit {log?.clockIn} Uhr</p>
          </div>
        )}
      </div>

      {verdaechtigLang && (
        <div className="flex items-start gap-2 rounded-2xl bg-amber-400/15 p-3 mb-3">
          <AlertTriangle size={15} className="text-amber-300 shrink-0 mt-0.5" />
          <p className="text-amber-100 text-xs">
            Du bist seit über zwölf Stunden eingestempelt. Hast du gestern das Ausstempeln
            vergessen? Stemple aus — die Standortleitung kann die Zeit danach richtigstellen.
          </p>
        </div>
      )}

      {/* Der Handgriff */}
      {laedt ? (
        <div className="h-16 flex items-center justify-center">
          <Loader2 size={22} className="animate-spin text-white/40" />
        </div>
      ) : !zustand.laeuft ? (
        <button
          onClick={() => stempeln('kommen')}
          disabled={!!arbeitet}
          className="w-full h-16 rounded-2xl bg-brand text-navy font-bold text-lg
                     flex items-center justify-center gap-2.5 active:scale-[0.98]
                     transition-transform disabled:opacity-60"
        >
          {arbeitet === 'kommen'
            ? <Loader2 size={22} className="animate-spin" />
            : <Play size={22} fill="currentColor" />}
          Einstempeln
        </button>
      ) : (
        <div className="flex gap-2.5">
          <button
            onClick={() => stempeln('gehen')}
            disabled={!!arbeitet}
            className="flex-1 h-16 rounded-2xl bg-white text-navy font-bold text-lg
                       flex items-center justify-center gap-2 active:scale-[0.98]
                       transition-transform disabled:opacity-60"
          >
            {arbeitet === 'gehen'
              ? <Loader2 size={22} className="animate-spin" />
              : <Square size={20} fill="currentColor" />}
            Ausstempeln
          </button>
          <button
            onClick={() => stempeln(zustand.pause ? 'pause-ende' : 'pause-start')}
            disabled={!!arbeitet}
            aria-label={zustand.pause ? 'Pause beenden' : 'Pause beginnen'}
            className={`w-20 h-16 rounded-2xl font-semibold text-sm flex flex-col
                        items-center justify-center gap-1 active:scale-[0.98]
                        transition-transform disabled:opacity-60 ${
              zustand.pause ? 'bg-amber-400 text-navy' : 'bg-white/15 text-white'}`}
          >
            <Coffee size={18} />
            {zustand.pause ? 'zurück' : 'Pause'}
          </button>
        </div>
      )}

      {(fehler || hinweis) && (
        <p className={`text-xs mt-3 ${fehler ? 'text-amber-200' : 'text-white/60'}`}>
          {fehler || hinweis}
        </p>
      )}

      {log?.quelle === 'offline' && !fehler && (
        <p className="text-white/50 text-[11px] mt-3">
          Ohne Netz gestempelt — die Zeit des Stempelns zählt, nicht die der Übertragung.
        </p>
      )}
    </div>
  )
}
