'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ShieldAlert, Check, Clock, AlertTriangle, Ban, Loader2, X, CalendarClock, Search,
  Send,
} from 'lucide-react'

/**
 * §146 Wer braucht was, und wie dringend.
 *
 * DIE SORTIERUNG IST DIE EIGENTLICHE FUNKTION
 * Eine alphabetische Liste von zweihundert Nachweisen liest niemand. Oben
 * steht, was abgelaufen ist, darunter was fehlt, dann was bald abläuft. Der
 * Rest ist Beiwerk und steht hinter einem Schalter.
 *
 * WAS „GESPERRT" HEISST
 * Manche Nachweise verbieten den Einsatz, solange sie fehlen — eine abgelaufene
 * Belehrung nach §43 IfSG heißt: nicht am Essen. Das steht als Merkmal an der
 * Zeile, damit die Leitung beim Planen nicht erst nachschlagen muss.
 *
 * WAS HIER NICHT STEHT
 * Was die Rolle nicht sehen darf, kommt gar nicht erst in der Antwort vor —
 * weder Name noch Zahl. Ein „3 weitere (nicht sichtbar)" verriete schon, dass
 * es etwas gibt.
 */

interface Eintrag {
  id: string
  employeeId: string
  personName: string
  bezeichnung: string
  gattung: string
  erfuelltAm: string | null
  faelligAm: string | null
  befreitAm: string | null
  befreitGrund: string | null
  notiz: string | null
  stand: 'gueltig' | 'laeuft_ab' | 'abgelaufen' | 'fehlt' | 'befreit'
  standText: string
  tageBis: number | null
  folge: string
  grundlage: string | null
  nachweisNoetig: boolean
}

const FARBE: Record<string, string> = {
  abgelaufen: 'bg-red-50 text-red-800 border-red-200',
  fehlt: 'bg-amber-50 text-amber-900 border-amber-200',
  laeuft_ab: 'bg-amber-50/60 text-amber-800 border-amber-100',
  gueltig: 'bg-gray-50 text-gray-600 border-gray-100',
  befreit: 'bg-gray-50 text-gray-500 border-gray-100',
}

const SYMBOL: Record<string, React.ReactNode> = {
  abgelaufen: <AlertTriangle size={14} className="text-red-600 shrink-0" />,
  fehlt: <ShieldAlert size={14} className="text-amber-600 shrink-0" />,
  laeuft_ab: <Clock size={14} className="text-amber-500 shrink-0" />,
  gueltig: <Check size={14} className="text-teal-600 shrink-0" />,
  befreit: <Ban size={14} className="text-gray-400 shrink-0" />,
}

const datum = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('de-DE') : '—'

export function Fristenliste({ employeeId }: { employeeId?: string }) {
  const [eintraege, setEintraege] = useState<Eintrag[]>([])
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState('')
  const [suche, setSuche] = useState('')
  const [alleZeigen, setAlleZeigen] = useState(false)
  const [offen, setOffen] = useState<Eintrag | null>(null)

  const laden = useCallback(async () => {
    try {
      const r = await fetch(`/api/fristen${employeeId ? `?employeeId=${employeeId}` : ''}`)
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setFehler(d.error ?? 'Konnte nicht geladen werden'); return }
      setEintraege(d.eintraege ?? [])
    } catch { setFehler('Konnte nicht geladen werden') }
    finally { setLaedt(false) }
  }, [employeeId])

  useEffect(() => { laden() }, [laden])

  const begriffe = suche.toLowerCase().split(/\s+/).filter(Boolean)
  const passt = (e: Eintrag) => {
    const heu = `${e.personName} ${e.bezeichnung}`.toLowerCase()
    return begriffe.every(b => heu.includes(b))
  }

  const offeneStaende = ['abgelaufen', 'fehlt', 'laeuft_ab']
  const gefiltert = eintraege
    .filter(passt)
    .filter(e => alleZeigen || offeneStaende.includes(e.stand))

  const zahl = (s: string) => eintraege.filter(e => e.stand === s).length

  if (laedt) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 size={20} className="animate-spin text-gray-300" />
      </div>
    )
  }

  if (eintraege.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
        <p className="text-sm text-gray-500">
          Hier steht noch nichts.
        </p>
        <p className="text-xs text-gray-400 mt-1.5 max-w-md mx-auto leading-relaxed">
          Die Unternehmensebene legt unter <strong>Nachweise</strong> fest, welche
          Schulungen, Belehrungen und Fristen der Betrieb führt. Danach erscheint
          hier, wer was bis wann braucht.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {fehler && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-900">{fehler}</p>
        </div>
      )}

      {/* Die drei Zahlen, auf die es ankommt */}
      <div className="grid grid-cols-3 gap-2">
        {([
          ['abgelaufen', 'Abgelaufen'],
          ['fehlt', 'Fehlt'],
          ['laeuft_ab', 'Läuft bald ab'],
        ] as const).map(([stand, text]) => (
          <div key={stand} className={`rounded-2xl border p-3 ${FARBE[stand]}`}>
            <p className="text-2xl font-bold tabular-nums">{zahl(stand)}</p>
            <p className="text-[11px] leading-tight">{text}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
          <input
            value={suche} onChange={e => setSuche(e.target.value)}
            placeholder="Nach Person oder Nachweis suchen"
            className="w-full text-sm border border-gray-200 rounded-lg pl-8 pr-2.5 py-1.5" />
        </div>
        <button
          onClick={() => setAlleZeigen(v => !v)}
          className="text-xs font-semibold px-3 py-2 rounded-xl border border-gray-200 text-navy">
          {alleZeigen ? 'Nur Offenes' : `Alle ${eintraege.length} zeigen`}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50
                      overflow-hidden">
        {gefiltert.map(e => (
          <button
            key={e.id}
            onClick={() => setOffen(e)}
            className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
            {SYMBOL[e.stand]}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-navy truncate">
                {employeeId ? e.bezeichnung : e.personName}
              </span>
              <span className="block text-[11px] text-gray-400 truncate">
                {employeeId ? e.standText : `${e.bezeichnung} · ${e.standText}`}
              </span>
            </span>
            {e.folge === 'sperren' && (e.stand === 'abgelaufen' || e.stand === 'fehlt') && (
              <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg
                               bg-red-100 text-red-800">
                kein Einsatz
              </span>
            )}
            <span className="shrink-0 text-[11px] text-gray-400 tabular-nums hidden sm:block">
              {datum(e.faelligAm)}
            </span>
          </button>
        ))}
        {gefiltert.length === 0 && (
          <p className="text-xs text-gray-400 px-4 py-6 text-center">
            {suche.trim()
              ? `Nichts gefunden für „${suche}".`
              : 'Nichts offen — alle Nachweise sind gültig.'}
          </p>
        )}
      </div>

      {offen && (
        <Einzelheit
          eintrag={offen}
          schliessen={() => setOffen(null)}
          geaendert={() => { setOffen(null); laden() }}
        />
      )}
    </div>
  )
}

function Einzelheit({ eintrag, schliessen, geaendert }: {
  eintrag: Eintrag
  schliessen: () => void
  geaendert: () => void
}) {
  const [erfuelltAm, setErfuelltAm] = useState(
    eintrag.erfuelltAm ? eintrag.erfuelltAm.slice(0, 10) : '')
  const [grund, setGrund] = useState(eintrag.befreitGrund ?? '')
  const [angefordert, setAngefordert] = useState(false)
  const [arbeitet, setArbeitet] = useState(false)
  const [fehler, setFehler] = useState('')

  async function speichern(daten: Record<string, unknown>) {
    setArbeitet(true); setFehler('')
    try {
      const r = await fetch('/api/fristen', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: eintrag.id, ...daten }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setFehler(d.error ?? 'Das hat nicht geklappt.'); return }
      geaendert()
    } catch { setFehler('Keine Verbindung.') }
    finally { setArbeitet(false) }
  }

  /**
   * §149 Den Nachweis bei der Person anfordern.
   *
   * Die Frist wird mitgegeben — nimmt der Betrieb die Einreichung später ab,
   * trägt das System sie selbst als erfüllt ein. Ohne diese Verbindung gäbe es
   * zwei Wahrheiten: eine abgenommene Bescheinigung und eine Frist auf Rot.
   */
  async function anfordern() {
    setArbeitet(true); setFehler('')
    const res = await fetch('/api/anforderungen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titel: eintrag.bezeichnung,
        employeeId: eintrag.employeeId,
        fristId: eintrag.id,
        hinweis: eintrag.grundlage
          ? `Grundlage: ${eintrag.grundlage}` : undefined,
      }),
    })
    const d = await res.json().catch(() => ({}))
    setArbeitet(false)
    if (!res.ok) { setFehler(d.error ?? 'Das hat nicht geklappt.'); return }
    setAngefordert(true)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center
                    justify-center p-0 sm:p-6">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4
                      max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-navy">{eintrag.bezeichnung}</p>
            <p className="text-xs text-gray-400">{eintrag.personName}</p>
          </div>
          <button onClick={schliessen} aria-label="Schließen">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className={`rounded-xl border p-3 ${FARBE[eintrag.stand]}`}>
          <p className="text-xs font-semibold">{eintrag.standText}</p>
          {eintrag.folge === 'sperren' && (
            <p className="text-[11px] mt-1 leading-relaxed">
              Ohne gültigen Nachweis ist ein Einsatz nicht zulässig.
            </p>
          )}
        </div>

        {eintrag.grundlage && (
          <p className="text-[11px] text-gray-400 leading-relaxed">
            <strong className="text-gray-500">Grundlage:</strong> {eintrag.grundlage}
          </p>
        )}

        {/* §149 Der direkte Weg von der Lücke zur Aufforderung. Vorher musste
            man sich merken, wer was schuldig ist, und es auf einer anderen
            Seite noch einmal eintippen — das tat niemand. */}
        {['fehlt', 'abgelaufen', 'laeuft_ab'].includes(eintrag.stand)
          && eintrag.nachweisNoetig && (
          <div className="space-y-2">
            {angefordert ? (
              <p className="text-xs text-teal-700 bg-teal-50 rounded-xl px-3 py-2.5">
                Angefordert. {eintrag.personName.split(' ')[0]} bekommt eine
                Nachricht und kann es direkt in der App hochladen.
              </p>
            ) : (
              <>
                <button
                  onClick={anfordern}
                  disabled={arbeitet}
                  className="w-full h-11 rounded-xl bg-navy text-white font-semibold
                             text-sm flex items-center justify-center gap-2
                             disabled:opacity-50">
                  {arbeitet ? <Loader2 size={15} className="animate-spin" />
                    : <Send size={15} />}
                  Bei {eintrag.personName.split(' ')[0]} anfordern
                </button>
                <p className="text-[11px] text-gray-400">
                  Sie bekommt eine Nachricht, lädt den Nachweis hoch, und ihr
                  nehmt ihn hier ab — dann ist die Frist erfüllt.
                </p>
              </>
            )}
          </div>
        )}

        {eintrag.stand !== 'befreit' && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase">
              Zuletzt erfüllt am
            </label>
            <input
              type="date" value={erfuelltAm}
              onChange={e => setErfuelltAm(e.target.value)}
              className="w-full h-11 text-base border border-gray-200 rounded-xl px-3" />
            <p className="text-[11px] text-gray-400">
              Das nächste Ablaufdatum rechnet das System daraus selbst aus.
            </p>
            <button
              onClick={() => speichern({ erfuelltAm: erfuelltAm || null })}
              disabled={arbeitet || !erfuelltAm}
              className="w-full h-11 rounded-xl bg-brand text-navy font-semibold text-sm
                         flex items-center justify-center gap-2 disabled:opacity-50">
              {arbeitet ? <Loader2 size={15} className="animate-spin" /> : <CalendarClock size={15} />}
              Als erfüllt eintragen
            </button>
          </div>
        )}

        <div className="border-t border-gray-100 pt-3 space-y-2">
          {eintrag.befreitAm ? (
            <>
              <p className="text-xs text-gray-500">
                Befreit{eintrag.befreitGrund ? `: ${eintrag.befreitGrund}` : ''}
              </p>
              <button
                onClick={() => speichern({ befreien: false })}
                disabled={arbeitet}
                className="w-full h-11 rounded-xl border border-gray-200 text-navy
                           font-semibold text-sm disabled:opacity-50">
                Befreiung aufheben
              </button>
            </>
          ) : (
            <>
              <label className="block text-xs font-semibold text-gray-500 uppercase">
                Oder befreien — mit Grund
              </label>
              <input
                value={grund} onChange={e => setGrund(e.target.value)}
                placeholder="z. B. in Elternzeit, Nachweis nicht erforderlich"
                className="w-full h-11 text-base border border-gray-200 rounded-xl px-3" />
              <p className="text-[11px] text-gray-400">
                Ohne Grund geht es nicht — sonst weiß in einem Jahr niemand mehr,
                ob es Absicht war oder vergessen.
              </p>
              <button
                onClick={() => speichern({ befreien: true, befreitGrund: grund })}
                disabled={arbeitet || !grund.trim()}
                className="w-full h-11 rounded-xl border border-gray-200 text-gray-600
                           font-semibold text-sm disabled:opacity-50">
                Befreien
              </button>
            </>
          )}
        </div>

        {fehler && <p className="text-xs text-amber-700">{fehler}</p>}
      </div>
    </div>
  )
}
