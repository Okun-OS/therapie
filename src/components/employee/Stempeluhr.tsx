'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Play, Square, Coffee, AlertTriangle, Loader2, CloudOff } from 'lucide-react'
import {
  einreihen, alle, zustandMitWarteschlange, type Uhrzustand,
} from '@/lib/warteschlange'
import { schlangeGeaendert, SCHLANGE_EREIGNIS } from '@/components/offline/Warteschlange'

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

type Zustand = Uhrzustand

/**
 * §138 Der zuletzt bekannte Stand des Servers, damit die Uhr auch ohne Netz
 * etwas anzeigen kann. Ohne ihn stünde nach einem Neuladen im Funkloch
 * „nicht eingestempelt", obwohl die Person längst arbeitet.
 */
const LETZTER_STAND = 'okun_stempel_stand'

function standLesen(): Zustand | null {
  try {
    const roh = window.localStorage.getItem(LETZTER_STAND)
    return roh ? JSON.parse(roh) : null
  } catch { return null }
}

function standSchreiben(z: Zustand) {
  try { window.localStorage.setItem(LETZTER_STAND, JSON.stringify(z)) } catch { /* egal */ }
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
  const [offline, setOffline] = useState(false)
  const ersterLauf = useRef(true)

  const holen = useCallback(async () => {
    try {
      const r = await fetch('/api/time-tracking/stempeln')
      if (!r.ok) throw new Error('offline')
      // §138 Der Service Worker liefert im Funkloch den zuletzt gespeicherten
      // Stand aus und sagt das im Kopf der Antwort. Das ist ein Stand von
      // vorhin, kein Stand von jetzt — und muss auch so angezeigt werden.
      const gespeichert = r.headers.get('X-Okun-Stand') === 'gespeichert'
      const d = await r.json()
      const vomServer: Zustand = d.zustand ?? { laeuft: false, pause: false }
      if (!gespeichert) standSchreiben(vomServer)
      // §138 Was noch in der Warteschlange liegt, kennt der Server nicht —
      // angezeigt wird der Stand INKLUSIVE dieser Vorgänge.
      setZustand(zustandMitWarteschlange(vomServer, alle()))
      setLog(d.log ?? null)
      setOffline(gespeichert)
    } catch {
      // Ohne Netz: der letzte bekannte Stand plus das, was seither gemerkt wurde.
      const gespeichert = standLesen() ?? { laeuft: false, pause: false }
      setZustand(zustandMitWarteschlange(gespeichert, alle()))
      setOffline(true)
    } finally {
      setLaedt(false)
      ersterLauf.current = false
    }
  }, [])

  useEffect(() => {
    holen()
    // Sobald die Warteschlange etwas losgeworden ist, gilt wieder der Server.
    window.addEventListener(SCHLANGE_EREIGNIS, holen)
    window.addEventListener('online', holen)
    return () => {
      window.removeEventListener(SCHLANGE_EREIGNIS, holen)
      window.removeEventListener('online', holen)
    }
  }, [holen])

  // Die laufende Zeit tickt mit. Eine Minute Takt reicht — sekundengenau
  // flackert nur und kostet Strom.
  useEffect(() => {
    if (!zustand.laeuft) return
    const takt = setInterval(() => setJetzt(Date.now()), 30000)
    return () => clearInterval(takt)
  }, [zustand.laeuft])

  async function stempeln(aktion: string) {
    setArbeitet(aktion); setFehler(''); setHinweis('')
    // Der Zeitpunkt entsteht HIER, nicht beim Absenden: Im Funkloch zählt
    // später die Zeit des Stempelns, nicht die des Hochladens.
    const zeitpunkt = new Date().toISOString()
    const daten = { aktion, zeitpunkt }

    try {
      const r = await fetch('/api/time-tracking/stempeln', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(daten),
      })

      // §138 503 heißt: nicht erreichbar (Netz weg, Server gerade nicht da).
      // Das ist keine Ablehnung — der Stempel ist nie angekommen und gehört
      // in die Warteschlange, nicht in eine Fehlermeldung.
      if (r.status === 503) throw new Error('offline')

      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setFehler(d.error ?? 'Das hat nicht geklappt.')
        if (d.zustand) setZustand(d.zustand)
        return
      }
      standSchreiben(d.zustand)
      setZustand(d.zustand); setLog(d.log ?? null)
      setJetzt(Date.now())
      setOffline(false)
      if (d.hinweis) setHinweis(d.hinweis)
    } catch {
      // §138 Kein Netz: merken statt verlieren. Die angezeigte Uhr geht
      // trotzdem weiter — für den Menschen hat der Handgriff stattgefunden.
      const { ok } = einreihen('stempeln', '/api/time-tracking/stempeln', daten)
      if (!ok) {
        setFehler('Kein Netz — und der Stempel ließ sich auch nicht merken. '
          + 'Bitte der Standortleitung Bescheid geben.')
        return
      }
      setZustand(z => zustandMitWarteschlange(z, [{
        id: '', art: 'stempeln', pfad: '', methode: 'POST',
        daten, erzeugtAm: zeitpunkt, versuche: 0,
      }]))
      setOffline(true)
      setHinweis('Kein Netz — gemerkt und wird übertragen, sobald es wieder geht.')
      schlangeGeaendert()
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

      {offline && !fehler && (
        <p className="text-white/50 text-[11px] mt-3 flex items-center gap-1.5">
          <CloudOff size={12} /> Ohne Netz — zu sehen ist der letzte bekannte Stand.
          Was du jetzt stempelst, wird gemerkt und geht raus, sobald wieder Empfang da ist.
        </p>
      )}

      {log?.quelle === 'offline' && !fehler && !offline && (
        <p className="text-white/50 text-[11px] mt-3">
          Ohne Netz gestempelt — die Zeit des Stempelns zählt, nicht die der Übertragung.
        </p>
      )}
    </div>
  )
}
