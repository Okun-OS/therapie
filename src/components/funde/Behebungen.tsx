'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Wrench, Check, X, FileCode2, Loader2, ShieldCheck, Rocket, ChevronDown,
} from 'lucide-react'
import { STATUS_TEXT, type BehebungStatus } from '@/lib/behebung'

/**
 * §142 Was der Lauf selbst behoben hat — und was auf dich wartet.
 *
 * ZWEI LISTEN, UND DIE OBERE IST DIE WICHTIGE
 * Oben steht, was fertig ist und wartet. Das ist die einzige Stelle, an der
 * ein Mensch in diesem Ablauf etwas tun muss, und deshalb steht sie zuerst und
 * mit einem Knopf daran.
 *
 * Darunter das Protokoll dessen, was ohne Rückfrage rausgegangen ist. Das ist
 * kein Beiwerk: Eine Automatik, die man nicht nachlesen kann, ist eine
 * Automatik, der man nicht widersprechen kann. Zu jeder Änderung stehen die
 * Dateien da, die Anzahl der Zeilen und was sie geprüft hat.
 *
 * WAS HIER BEWUSST FEHLT
 * Ein Knopf „alles freigeben". Wer zehn Behebungen auf einmal durchwinkt, hat
 * keine davon gelesen — und dann ist das Tor keines.
 */

interface Behebung {
  id: string
  kennung: string | null
  titel: string
  klasse: string
  ausgang: string
  grund: string
  dateien: string[]
  zeilen: number
  begruendung: string | null
  pruefstand: {
    pruefungen?: number; modultests?: number; build?: boolean
  } | null
  zweig: string | null
  commit: string | null
  status: string
  entschiedenVon: string | null
  createdAt: string
}

const ZEIT = (iso: string) => new Date(iso).toLocaleString('de-DE', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
})

export function Behebungen() {
  const [alle, setAlle] = useState<Behebung[]>([])
  const [laedt, setLaedt] = useState(true)
  const [arbeitet, setArbeitet] = useState<string | null>(null)
  const [fehler, setFehler] = useState('')
  const [offen, setOffen] = useState<string | null>(null)

  const laden = useCallback(async () => {
    try {
      const r = await fetch('/api/behebungen')
      if (!r.ok) return
      const d = await r.json()
      setAlle(d.behebungen ?? [])
    } catch { /* ohne Netz bleibt die Liste leer */ }
    finally { setLaedt(false) }
  }, [])

  useEffect(() => { laden() }, [laden])

  async function entscheiden(id: string, status: 'freigegeben' | 'verworfen') {
    setArbeitet(id); setFehler('')
    try {
      const r = await fetch('/api/behebungen', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setFehler(d.error ?? 'Das hat nicht geklappt.'); return }
      await laden()
    } catch { setFehler('Keine Verbindung.') }
    finally { setArbeitet(null) }
  }

  if (laedt) return null

  const wartend = alle.filter(b => b.status === 'wartet')
  const erledigt = alle.filter(b => b.status !== 'wartet').slice(0, 20)

  if (alle.length === 0) return null

  return (
    <div className="space-y-3">
      {fehler && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-900">{fehler}</p>
        </div>
      )}

      {/* ── Wartet auf dich ─────────────────────────────────────────────── */}
      {wartend.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
            <p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
              <Wrench size={15} /> {wartend.length}{' '}
              {wartend.length === 1 ? 'Behebung ist fertig' : 'Behebungen sind fertig'} und
              wartet auf dich
            </p>
            <p className="text-[11px] text-amber-900/70 mt-0.5">
              Gebaut, geprüft, liegt auf einem eigenen Zweig. Gibst du frei, führt der
              nächste Lauf sie zusammen. Verwirfst du, bleibt der Fund offen.
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {wartend.map(b => (
              <Zeile
                key={b.id} b={b}
                offen={offen === b.id}
                aufklappen={() => setOffen(o => o === b.id ? null : b.id)}
                arbeitet={arbeitet === b.id}
                entscheiden={entscheiden}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Protokoll ───────────────────────────────────────────────────── */}
      {erledigt.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-sm font-semibold text-navy flex items-center gap-2">
              <Rocket size={15} className="text-teal-600" /> Was der Lauf gemacht hat
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {erledigt.map(b => (
              <Zeile
                key={b.id} b={b}
                offen={offen === b.id}
                aufklappen={() => setOffen(o => o === b.id ? null : b.id)}
                arbeitet={false}
                entscheiden={entscheiden}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Zeile({ b, offen, aufklappen, arbeitet, entscheiden }: {
  b: Behebung
  offen: boolean
  aufklappen: () => void
  arbeitet: boolean
  entscheiden: (id: string, status: 'freigegeben' | 'verworfen') => void
}) {
  const farbe = b.status === 'ausgerollt' ? 'text-teal-700 bg-teal-50'
    : b.status === 'wartet' ? 'text-amber-800 bg-amber-50'
    : b.status === 'freigegeben' ? 'text-navy bg-gray-100'
    : 'text-gray-500 bg-gray-50'

  return (
    <div className="px-4 py-3">
      <button onClick={aufklappen} className="w-full text-left flex items-start gap-3">
        <FileCode2 size={16} className="text-gray-300 shrink-0 mt-0.5" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-navy truncate">{b.titel}</span>
          <span className="block text-[11px] text-gray-400">
            {b.kennung} · {b.dateien.length}{' '}
            {b.dateien.length === 1 ? 'Datei' : 'Dateien'} · {b.zeilen} Zeilen ·{' '}
            {ZEIT(b.createdAt)}
          </span>
        </span>
        <span className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-lg ${farbe}`}>
          {STATUS_TEXT[b.status as BehebungStatus] ?? b.status}
        </span>
        <ChevronDown size={14} className={`text-gray-300 shrink-0 mt-1 transition-transform ${
          offen ? 'rotate-180' : ''}`} />
      </button>

      {offen && (
        <div className="mt-3 pl-7 space-y-2.5">
          <p className="text-xs text-gray-600">{b.grund}</p>

          {b.begruendung && (
            <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-line">
              {b.begruendung}
            </p>
          )}

          <div className="rounded-xl bg-gray-50 p-2.5 space-y-1">
            {b.dateien.map(d => (
              <p key={d} className="text-[11px] font-mono text-gray-600 break-all">{d}</p>
            ))}
          </div>

          {b.pruefstand && (
            <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-teal-600" />
              {b.pruefstand.pruefungen ?? 0} Nachweise ·{' '}
              {b.pruefstand.modultests ?? 0} Modultests ·{' '}
              Build {b.pruefstand.build ? 'grün' : 'rot'}
            </p>
          )}

          {(b.zweig || b.commit) && (
            <p className="text-[11px] text-gray-400 font-mono break-all">
              {b.zweig}{b.commit ? ` · ${b.commit.slice(0, 7)}` : ''}
            </p>
          )}

          {b.entschiedenVon && (
            <p className="text-[11px] text-gray-400">Entschieden von {b.entschiedenVon}</p>
          )}

          {b.status === 'wartet' && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => entscheiden(b.id, 'freigegeben')}
                disabled={arbeitet}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2
                           rounded-xl bg-brand text-navy disabled:opacity-50"
              >
                {arbeitet ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Freigeben
              </button>
              <button
                onClick={() => entscheiden(b.id, 'verworfen')}
                disabled={arbeitet}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2
                           rounded-xl border border-gray-200 text-gray-600 disabled:opacity-50"
              >
                <X size={13} /> Verwerfen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
