'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  HeartPulse, Loader2, X, Check, AlertTriangle, Lock, Clock,
} from 'lucide-react'

/**
 * §147 Betriebliches Eingliederungsmanagement.
 *
 * WAS HIER ABSICHTLICH FEHLT
 * Eine Liste aller Mitarbeiter mit ihren Krankheitstagen. Angezeigt wird nur,
 * wer über der Schwelle liegt oder in einem laufenden Verfahren ist — alle
 * anderen tauchen gar nicht auf. Eine Übersicht „wer war wie oft krank" wäre
 * etwas anderes als ein Werkzeug für eine gesetzliche Pflicht, und man kann
 * sie nicht bauen, ohne dass sie irgendwann auch so benutzt wird.
 *
 * KEIN KNOPF, DER VON SELBST ANBIETET
 * Ein BEM-Angebot ist ein Gespräch zwischen Menschen. Eine automatische E-Mail
 * dazu wäre der falsche Ton für den Anlass. Hier wird nur festgehalten, dass
 * angeboten wurde — und genau dieser Vermerk ist später der Nachweis.
 */

interface Eintrag {
  employeeId: string
  personName: string
  vorgangId: string | null
  tage: number
  stand: 'faellig' | 'angeboten' | 'laeuft' | 'abgelehnt' | 'abgeschlossen'
  standText: string
  naechsterSchritt: string
  angebotenAm: string | null
  angebotenVon: string | null
  antwort: string | null
  ergebnis: string | null
  abgeschlossenAm: string | null
}

const FARBE: Record<string, string> = {
  faellig: 'bg-amber-50 text-amber-900 border-amber-200',
  angeboten: 'bg-gray-50 text-gray-700 border-gray-200',
  laeuft: 'bg-teal-50 text-teal-900 border-teal-200',
  abgelehnt: 'bg-gray-50 text-gray-500 border-gray-100',
  abgeschlossen: 'bg-gray-50 text-gray-500 border-gray-100',
}

const datum = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('de-DE') : '—'

export function BemListe() {
  const [eintraege, setEintraege] = useState<Eintrag[]>([])
  const [laedt, setLaedt] = useState(true)
  const [gesperrt, setGesperrt] = useState('')
  const [fehler, setFehler] = useState('')
  const [offen, setOffen] = useState<Eintrag | null>(null)

  const laden = useCallback(async () => {
    try {
      const r = await fetch('/api/bem')
      const d = await r.json().catch(() => ({}))
      if (r.status === 403) { setGesperrt(d.error ?? 'Keine Berechtigung'); return }
      if (!r.ok) { setFehler(d.error ?? 'Konnte nicht geladen werden'); return }
      setEintraege(d.eintraege ?? [])
    } catch { setFehler('Konnte nicht geladen werden') }
    finally { setLaedt(false) }
  }, [])

  useEffect(() => { laden() }, [laden])

  if (laedt) {
    return <div className="flex justify-center py-10">
      <Loader2 size={20} className="animate-spin text-gray-300" />
    </div>
  }

  if (gesperrt) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
        <Lock size={20} className="text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">{gesperrt}</p>
      </div>
    )
  }

  const faellig = eintraege.filter(e => e.stand === 'faellig')

  return (
    <div className="space-y-3">
      {fehler && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-900">{fehler}</p>
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <p className="text-xs text-gray-500 leading-relaxed">
          <strong className="text-navy">§167 Abs. 2 SGB IX:</strong> Wer innerhalb
          eines Jahres länger als sechs Wochen arbeitsunfähig war — ununterbrochen
          oder wiederholt —, dem muss ein Eingliederungsmanagement angeboten werden.
          Die Teilnahme ist freiwillig; eine Ablehnung wird festgehalten, weil sie
          der Nachweis ist, dass angeboten wurde.
        </p>
        <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
          Hier steht nur, wer über der Schwelle liegt oder in einem Verfahren ist.
          Eine Übersicht über die Krankheitstage aller gibt es bewusst nicht.
        </p>
      </div>

      {eintraege.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
          <Check size={20} className="text-teal-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            Zurzeit ist nichts fällig und kein Verfahren offen.
          </p>
        </div>
      ) : (
        <>
          {faellig.length > 0 && (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-200
                            bg-amber-50 p-3">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900">
                {faellig.length === 1
                  ? 'Bei einer Person ist ein Angebot fällig.'
                  : `Bei ${faellig.length} Personen ist ein Angebot fällig.`}
                {' '}Ohne dokumentiertes Angebot ist eine spätere
                krankheitsbedingte Kündigung praktisch nicht haltbar.
              </p>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 divide-y
                          divide-gray-50 overflow-hidden">
            {eintraege.map(e => (
              <button
                key={e.employeeId}
                onClick={() => setOffen(e)}
                className="w-full text-left px-4 py-3 flex items-center gap-3
                           hover:bg-gray-50">
                <HeartPulse size={16} className={`shrink-0 ${
                  e.stand === 'faellig' ? 'text-amber-600' : 'text-gray-300'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-navy truncate">
                    {e.personName}
                  </span>
                  <span className="block text-[11px] text-gray-400 truncate">
                    {e.standText}
                  </span>
                </span>
                <span className={`shrink-0 text-[10px] font-semibold px-2 py-1
                                  rounded-lg border ${FARBE[e.stand]}`}>
                  {e.stand === 'faellig' ? 'Angebot fällig'
                    : e.stand === 'angeboten' ? 'Antwort offen'
                    : e.stand === 'laeuft' ? 'läuft'
                    : e.stand === 'abgelehnt' ? 'abgelehnt' : 'abgeschlossen'}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {offen && (
        <Vorgang
          eintrag={offen}
          schliessen={() => setOffen(null)}
          geaendert={() => { setOffen(null); laden() }}
        />
      )}
    </div>
  )
}

function Vorgang({ eintrag, schliessen, geaendert }: {
  eintrag: Eintrag
  schliessen: () => void
  geaendert: () => void
}) {
  const [ergebnis, setErgebnis] = useState(eintrag.ergebnis ?? '')
  const [arbeitet, setArbeitet] = useState(false)
  const [fehler, setFehler] = useState('')

  async function ruf(methode: 'POST' | 'PATCH', daten: Record<string, unknown>) {
    setArbeitet(true); setFehler('')
    try {
      const r = await fetch('/api/bem', {
        method: methode, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(daten),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setFehler(d.error ?? 'Das hat nicht geklappt.'); return }
      geaendert()
    } catch { setFehler('Keine Verbindung.') }
    finally { setArbeitet(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center
                    justify-center p-0 sm:p-6">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5
                      space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-navy">{eintrag.personName}</p>
            <p className="text-xs text-gray-400">{eintrag.standText}</p>
          </div>
          <button onClick={schliessen} aria-label="Schließen">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {eintrag.naechsterSchritt && (
          <div className={`rounded-xl border p-3 ${FARBE[eintrag.stand]}`}>
            <p className="text-xs leading-relaxed">{eintrag.naechsterSchritt}</p>
          </div>
        )}

        {eintrag.angebotenAm && (
          <p className="text-[11px] text-gray-400">
            Angeboten am {datum(eintrag.angebotenAm)}
            {eintrag.angebotenVon ? ` von ${eintrag.angebotenVon}` : ''}
          </p>
        )}

        {eintrag.stand === 'faellig' && (
          <>
            <p className="text-xs text-gray-500 leading-relaxed">
              Sprich die Person an oder schreib sie an. Sobald das geschehen ist,
              halte es hier fest — dieser Vermerk ist der Nachweis.
            </p>
            <button
              onClick={() => ruf('POST', {
                employeeId: eintrag.employeeId, tage: eintrag.tage,
              })}
              disabled={arbeitet}
              className="w-full h-12 rounded-2xl bg-brand text-navy font-semibold text-sm
                         flex items-center justify-center gap-2 disabled:opacity-50">
              {arbeitet ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Angebot ist erfolgt
            </button>
          </>
        )}

        {eintrag.stand === 'angeboten' && eintrag.vorgangId && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">Was hat die Person geantwortet?</p>
            <div className="flex gap-2">
              <button
                onClick={() => ruf('PATCH', { id: eintrag.vorgangId, antwort: 'zugestimmt' })}
                disabled={arbeitet}
                className="flex-1 h-11 rounded-xl bg-brand text-navy font-semibold text-sm
                           disabled:opacity-50">
                Zugestimmt
              </button>
              <button
                onClick={() => ruf('PATCH', { id: eintrag.vorgangId, antwort: 'abgelehnt' })}
                disabled={arbeitet}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600
                           font-semibold text-sm disabled:opacity-50">
                Abgelehnt
              </button>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Eine Ablehnung braucht keine Begründung — die Teilnahme ist freiwillig.
            </p>
          </div>
        )}

        {(eintrag.stand === 'laeuft' || eintrag.stand === 'abgelehnt')
          && eintrag.vorgangId && (
          <div className="space-y-2 border-t border-gray-100 pt-3">
            <label className="block text-xs font-semibold text-gray-500 uppercase">
              Ergebnis
            </label>
            <textarea
              value={ergebnis} onChange={e => setErgebnis(e.target.value)}
              rows={3}
              placeholder={eintrag.stand === 'abgelehnt'
                ? 'z. B. Angebot am … abgelehnt, Hinweis auf jederzeitige Wiederaufnahme'
                : 'Was wurde vereinbart?'}
              className="w-full text-base border border-gray-200 rounded-xl px-3 py-2.5" />
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Ohne Ergebnis wäre das Verfahren nicht durchgeführt, sondern nur
              abgehakt — und genau das prüft ein Arbeitsgericht später.
            </p>
            <button
              onClick={() => ruf('PATCH', {
                id: eintrag.vorgangId, ergebnis, abschliessen: true,
              })}
              disabled={arbeitet || !ergebnis.trim()}
              className="w-full h-11 rounded-xl bg-navy text-white font-semibold text-sm
                         flex items-center justify-center gap-2 disabled:opacity-50">
              {arbeitet ? <Loader2 size={15} className="animate-spin" /> : <Clock size={15} />}
              Abschließen
            </button>
          </div>
        )}

        {eintrag.stand === 'abgeschlossen' && (
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-600">
              Abgeschlossen am {datum(eintrag.abgeschlossenAm)}
            </p>
            {eintrag.ergebnis && (
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed whitespace-pre-line">
                {eintrag.ergebnis}
              </p>
            )}
          </div>
        )}

        {fehler && <p className="text-xs text-amber-700">{fehler}</p>}
      </div>
    </div>
  )
}
