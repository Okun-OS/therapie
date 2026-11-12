'use client'

import { useState } from 'react'
import { RotateCcw, Check, AlertTriangle, X } from 'lucide-react'

/**
 * §119 Freigegebene Monate mit den heutigen Daten nachrechnen.
 *
 * Wie beim ELStAM-Import: erst zeigen, was abweicht, dann bestätigen. Eine
 * freigegebene Abrechnung wird nie überschrieben — sie bleibt, wie sie
 * unterschrieben wurde. Was entsteht, ist eine Korrektur daneben, die im
 * nächsten offenen Monat ausgezahlt wird.
 *
 * Geprüft wird das ganze Jahr, nicht nur der angezeigte Monat: wenn ein
 * Krankenschein zwei Monate zu spät kommt, weiß niemand vorher, welcher Monat
 * betroffen ist.
 */

interface Posten { feld: string; bezeichnung: string; alt: number; neu: number; differenz: number }
interface Abweichung {
  employeeId: string
  name: string
  jahr: number
  monat: number
  ausgleichJahr: number
  ausgleichMonat: number
  differenz: { brutto: number; netto: number; lohnsteuer: number; svAN: number; svAG: number; posten: Posten[] }
  bereitsOffen: boolean
}

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

const eur = (n: number) =>
  `${n >= 0 ? '+' : '−'}${Math.abs(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

export function Aufrollung({ jahr, onFertig }: { jahr: number; onFertig?: () => void }) {
  const [abweichungen, setAbweichungen] = useState<Abweichung[] | null>(null)
  const [nichtRechenbar, setNichtRechenbar] = useState<{ name: string; monat: number; grund: string }[]>([])
  const [hinweis, setHinweis] = useState('')
  const [fehler, setFehler] = useState('')
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set())
  const [grund, setGrund] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [ergebnis, setErgebnis] = useState<string | null>(null)

  async function pruefen() {
    setLaeuft(true); setFehler(''); setErgebnis(null)
    try {
      const res = await fetch('/api/payroll/aufrollen', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jahr }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setFehler(d.error ?? 'Prüfung fehlgeschlagen'); return }
      setAbweichungen(d.abweichungen ?? [])
      setNichtRechenbar(d.nichtRechenbar ?? [])
      setHinweis(d.hinweis ?? '')
      setGewaehlt(new Set(
        (d.abweichungen as Abweichung[])
          .filter(a => !a.bereitsOffen)
          .map(a => `${a.employeeId}|${a.monat}`),
      ))
    } catch { setFehler('Prüfung fehlgeschlagen') }
    finally { setLaeuft(false) }
  }

  async function uebernehmen() {
    if (gewaehlt.size === 0) return
    setLaeuft(true)
    try {
      const res = await fetch('/api/payroll/aufrollen?uebernehmen=1', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jahr, grund: grund.trim() || undefined, fuer: Array.from(gewaehlt) }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setFehler(d.error ?? 'Übernahme fehlgeschlagen'); return }
      setErgebnis(d.hinweis ?? 'angelegt')
      setAbweichungen(null)
      onFertig?.()
    } catch { setFehler('Übernahme fehlgeschlagen') }
    finally { setLaeuft(false) }
  }

  function umschalten(key: string) {
    setGewaehlt(g => {
      const n = new Set(g)
      if (n.has(key)) n.delete(key); else n.add(key)
      return n
    })
  }

  const summe = (abweichungen ?? [])
    .filter(a => gewaehlt.has(`${a.employeeId}|${a.monat}`))
    .reduce((s, a) => s + a.differenz.netto, 0)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-navy">Freigegebene Abrechnungen prüfen</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Rechnet alle freigegebenen Monate des Jahres {jahr} mit den heutigen Daten
          noch einmal — nachgereichte Krankenscheine, korrigierte Zeiten,
          rückwirkende Steuerklassen. Die freigegebene Abrechnung bleibt unverändert;
          der Unterschied wird als Korrektur im nächsten offenen Monat ausgezahlt.
        </p>
      </div>

      {!abweichungen && (
        <button onClick={pruefen} disabled={laeuft}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          <RotateCcw size={15} /> {laeuft ? 'wird geprüft …' : `${jahr} prüfen`}
        </button>
      )}

      {fehler && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3">
          <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900">{fehler}</p>
        </div>
      )}

      {ergebnis && (
        <div className="flex items-start gap-2 rounded-xl bg-teal-50 border border-teal-200 p-3">
          <Check size={14} className="text-teal-600 shrink-0 mt-0.5" />
          <p className="text-xs text-teal-900">{ergebnis}</p>
        </div>
      )}

      {abweichungen && (
        <>
          <p className="text-xs text-gray-500">{hinweis}</p>

          {abweichungen.map(a => {
            const key = `${a.employeeId}|${a.monat}`
            return (
              <label key={key}
                className={`flex items-start gap-2.5 rounded-xl border p-2.5 ${
                  a.bereitsOffen ? 'border-gray-200 bg-gray-50' : 'border-gray-200 cursor-pointer hover:bg-gray-50'}`}>
                <input type="checkbox" checked={gewaehlt.has(key)} disabled={a.bereitsOffen}
                  onChange={() => umschalten(key)} className="mt-0.5 rounded border-gray-300" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-medium text-navy">{a.name}</span>
                    <span className="text-[11px] text-gray-400">
                      {MONATE[a.monat - 1]} {a.jahr}
                    </span>
                    <span className={`text-xs font-semibold ${
                      a.differenz.netto >= 0 ? 'text-teal-700' : 'text-amber-700'}`}>
                      {eur(a.differenz.netto)} netto
                    </span>
                    {a.bereitsOffen && (
                      <span className="text-[10px] text-gray-400">bereits als Korrektur offen</span>
                    )}
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {a.differenz.posten.slice(0, 6).map((p, i) => (
                      <p key={i} className="text-xs text-gray-600">
                        {p.bezeichnung}:{' '}
                        <span className="text-gray-400">{p.alt.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                        {' → '}
                        <span className="font-semibold text-navy">{p.neu.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                      </p>
                    ))}
                    {a.differenz.posten.length > 6 && (
                      <p className="text-[11px] text-gray-400">
                        … und {a.differenz.posten.length - 6} weitere Posten
                      </p>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Ausgleich in {MONATE[a.ausgleichMonat - 1]} {a.ausgleichJahr}
                  </p>
                </div>
              </label>
            )
          })}

          {nichtRechenbar.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 space-y-1">
              <p className="text-xs font-semibold text-amber-900">Nicht nachgerechnet</p>
              {nichtRechenbar.map((n, i) => (
                <p key={i} className="text-[11px] text-amber-800">
                  {n.name}, {MONATE[n.monat - 1]} — {n.grund}
                </p>
              ))}
            </div>
          )}

          {abweichungen.length > 0 && (
            <div className="space-y-2 pt-1">
              <input value={grund} onChange={e => setGrund(e.target.value)}
                placeholder="Grund der Aufrollung (steht in der Akte)"
                className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-gray-500">
                  Gewählt: {gewaehlt.size} · Summe {eur(summe)} netto
                </span>
                <div className="flex-1" />
                <button onClick={() => { setAbweichungen(null); setFehler('') }}
                  className="flex items-center gap-1.5 text-xs text-gray-500 px-3 py-2 rounded-xl hover:bg-gray-100">
                  <X size={13} /> Abbrechen
                </button>
                <button onClick={uebernehmen} disabled={laeuft || gewaehlt.size === 0}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand px-4 py-2 rounded-xl disabled:opacity-40">
                  <Check size={13} /> Korrekturen anlegen
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
