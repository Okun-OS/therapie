'use client'

import { useState, useEffect, useCallback } from 'react'
import { Lock, Unlock, Package, AlertTriangle, Check } from 'lucide-react'

/**
 * §126/§127 Dienstplanung je Standort einrichten und freischalten.
 *
 * Das Geschäftsmodell: Alles außer der Dienstplanung ist Standard und läuft
 * sofort. Die Dienstplanung wird für jeden Kunden von Hand programmiert — als
 * versioniertes Regelpaket im Rechendienst. Bis das Paket steht, bleibt sie
 * gesperrt.
 *
 * Diese Seite gibt es nur für OKUN. Der Kunde sieht sie nicht und kann weder
 * ein Paket zuordnen noch sich selbst freischalten.
 */

interface Standort {
  id: string
  name: string
  kunde: string | null
  rulePackId: string | null
  dienstplanungFrei: boolean
  dienstplanungFreiSeit: string | null
  dienstplanungFreiVon: string | null
  dienstplanungHinweis: string | null
  paketFehlt: boolean
}

interface Paket {
  id: string
  kunde?: string
  version?: number
  beschreibung?: string
}

export default function DienstplanungVerwalten() {
  const [standorte, setStandorte] = useState<Standort[]>([])
  const [pakete, setPakete] = useState<Paket[]>([])
  const [erreichbar, setErreichbar] = useState(true)
  const [hinweis, setHinweis] = useState('')
  const [fehler, setFehler] = useState('')
  const [laedt, setLaedt] = useState(true)
  const [arbeitet, setArbeitet] = useState<string | null>(null)

  const laden = useCallback(async () => {
    setLaedt(true)
    try {
      const res = await fetch('/api/okun/dienstplanung')
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setFehler(d.error ?? 'Konnte nicht geladen werden'); return }
      setStandorte(d.standorte ?? [])
      setPakete(d.pakete ?? [])
      setErreichbar(d.rechendienstErreichbar !== false)
      setHinweis(d.hinweis ?? '')
    } catch { setFehler('Konnte nicht geladen werden') }
    finally { setLaedt(false) }
  }, [])

  useEffect(() => { laden() }, [laden])

  async function aendern(locationId: string, daten: Record<string, unknown>) {
    setArbeitet(locationId); setFehler('')
    try {
      const res = await fetch('/api/okun/dienstplanung', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, ...daten }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setFehler(d.error ?? 'Änderung fehlgeschlagen'); return }
      await laden()
    } catch { setFehler('Änderung fehlgeschlagen') }
    finally { setArbeitet(null) }
  }

  const frei = standorte.filter(s => s.dienstplanungFrei).length

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-navy">Dienstplanung einrichten</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Die Dienstplanung wird für jeden Kunden von Hand programmiert — als
          Regelpaket im Rechendienst. Bis es steht, bleibt sie beim Kunden gesperrt.
          Er bekommt dann den hinterlegten Hinweis statt eines schlechten Plans.
        </p>
      </div>

      {!erreichbar && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900">
            Der Rechendienst ist nicht erreichbar. Solange lässt sich nicht prüfen,
            welche Regelpakete es gibt — Zuordnungen sind vorübergehend gesperrt.
          </p>
        </div>
      )}

      {fehler && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900">{fehler}</p>
        </div>
      )}

      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span>{frei} von {standorte.length} Standorten freigeschaltet</span>
        <span className="text-gray-300">·</span>
        <span>{hinweis}</span>
      </div>

      {laedt ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-teal-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {standorte.map(s => (
            <div key={s.id} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <div className="flex items-start gap-3 flex-wrap">
                {s.dienstplanungFrei
                  ? <Unlock size={16} className="text-teal-600 shrink-0 mt-0.5" />
                  : <Lock size={16} className="text-gray-400 shrink-0 mt-0.5" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-navy">{s.name}</p>
                  <p className="text-xs text-gray-400">{s.kunde ?? 'ohne Kunde'}</p>
                </div>
                <button
                  onClick={() => aendern(s.id, { dienstplanungFrei: !s.dienstplanungFrei })}
                  disabled={arbeitet === s.id}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl disabled:opacity-40 ${
                    s.dienstplanungFrei
                      ? 'text-gray-600 border border-gray-200 hover:bg-gray-50'
                      : 'text-white bg-brand'}`}>
                  {s.dienstplanungFrei
                    ? <><Lock size={13} /> Sperren</>
                    : <><Unlock size={13} /> Freischalten</>}
                </button>
              </div>

              {s.paketFehlt && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-2.5">
                  <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-900">
                    Das zugeordnete Regelpaket &bdquo;{s.rulePackId}&ldquo; gibt es im Rechendienst
                    nicht mehr. Der Plan läuft dann ohne die Regeln dieses Betriebs.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">
                    Regelpaket
                  </label>
                  <select
                    value={s.rulePackId ?? ''}
                    disabled={!erreichbar || arbeitet === s.id}
                    onChange={e => aendern(s.id, { rulePackId: e.target.value })}
                    className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 disabled:opacity-50">
                    <option value="">— keines (Standardregeln) —</option>
                    {pakete.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.kunde ?? p.id}{p.version ? ` (v${p.version})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">
                    Hinweis für den Kunden, solange gesperrt
                  </label>
                  <input
                    defaultValue={s.dienstplanungHinweis ?? ''}
                    disabled={arbeitet === s.id}
                    placeholder="Standardtext verwenden"
                    onBlur={e => {
                      if (e.target.value !== (s.dienstplanungHinweis ?? '')) {
                        aendern(s.id, { hinweis: e.target.value })
                      }
                    }}
                    className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
                </div>
              </div>

              {s.dienstplanungFrei && s.dienstplanungFreiSeit && (
                <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                  <Check size={12} className="text-teal-600" />
                  Freigeschaltet am {s.dienstplanungFreiSeit.split('-').reverse().join('.')}
                  {s.dienstplanungFreiVon ? ` von ${s.dienstplanungFreiVon}` : ''}
                </p>
              )}
              {s.rulePackId && !s.paketFehlt && (
                <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                  <Package size={12} />
                  {pakete.find(p => p.id === s.rulePackId)?.beschreibung ?? s.rulePackId}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
