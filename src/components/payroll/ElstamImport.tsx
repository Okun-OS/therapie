'use client'

import { useState } from 'react'
import { Upload, Check, AlertTriangle, X, FileText } from 'lucide-react'

/**
 * §117 ELStAM-Änderungsliste einlesen.
 *
 * Der Ablauf ist bewusst zweistufig: erst zeigen, was sich ändern würde, dann
 * bestätigen. Eine Steuerklasse still zu überschreiben, weil eine Datei das so
 * sagt, wäre genau die Art Änderung, die später niemand mehr erklären kann —
 * und für zu wenig einbehaltene Lohnsteuer haftet der Arbeitgeber.
 *
 * Vorausgewählt sind nur Zeilen, die sicher zugeordnet werden konnten. Was über
 * den Namen gefunden wurde, muss jemand bewusst anhaken.
 */

interface Aenderung { feld: string; bisher: string; neu: string }
interface Abgleich {
  employeeId: string | null
  name: string
  zuordnung: 'steuerId' | 'personalnummer' | 'name' | 'keine'
  aenderungen: Aenderung[]
  hinweis?: string
}

const FELD_NAMEN: Record<string, string> = {
  steuerklasse: 'Steuerklasse',
  kinderfreibetraege: 'Kinderfreibeträge',
  konfession: 'Konfession',
  freibetragMonat: 'Freibetrag',
  hinzurechnungMonat: 'Hinzurechnungsbetrag',
  faktor: 'Faktor',
}

const ZUORDNUNG_TEXT: Record<Abgleich['zuordnung'], string> = {
  steuerId: 'über Steuer-ID',
  personalnummer: 'über Personalnummer',
  name: 'über den Namen — bitte prüfen',
  keine: 'nicht zugeordnet',
}

export function ElstamImport({ onFertig }: { onFertig?: () => void }) {
  const [inhalt, setInhalt] = useState<string | null>(null)
  const [dateiname, setDateiname] = useState('')
  const [abgleich, setAbgleich] = useState<Abgleich[] | null>(null)
  const [hinweis, setHinweis] = useState('')
  const [fehler, setFehler] = useState('')
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set())
  const [stand, setStand] = useState(new Date().toISOString().slice(0, 10))
  const [laeuft, setLaeuft] = useState(false)
  const [ergebnis, setErgebnis] = useState<string | null>(null)

  async function dateiWaehlen(datei: File) {
    setFehler(''); setErgebnis(null)
    const text = await datei.text()
    setInhalt(text)
    setDateiname(datei.name)
    await vorschau(text)
  }

  async function vorschau(text: string) {
    setLaeuft(true)
    try {
      const res = await fetch('/api/payroll/elstam', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inhalt: text }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setFehler(d.error ?? 'Die Datei konnte nicht gelesen werden.'); setAbgleich(null); return }
      setAbgleich(d.abgleich)
      setHinweis(d.hinweis ?? '')
      // Sicher zugeordnete Änderungen sind vorausgewählt; alles über den Namen
      // Gefundene bewusst nicht.
      setGewaehlt(new Set(
        (d.abgleich as Abgleich[])
          .filter(a => a.employeeId && a.zuordnung !== 'name')
          .map(a => a.employeeId as string),
      ))
    } catch {
      setFehler('Die Datei konnte nicht gelesen werden.')
    } finally { setLaeuft(false) }
  }

  async function uebernehmen() {
    if (!inhalt || gewaehlt.size === 0) return
    setLaeuft(true)
    try {
      const res = await fetch('/api/payroll/elstam?uebernehmen=1', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inhalt, stand,
          quelle: dateiname || 'Änderungsliste',
          uebernehmenFuer: Array.from(gewaehlt),
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setFehler(d.error ?? 'Übernahme fehlgeschlagen.'); return }
      setErgebnis(d.hinweis ?? 'übernommen')
      setAbgleich(null); setInhalt(null); setDateiname('')
      onFertig?.()
    } catch {
      setFehler('Übernahme fehlgeschlagen.')
    } finally { setLaeuft(false) }
  }

  function umschalten(id: string) {
    setGewaehlt(g => {
      const n = new Set(g)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const mitAenderung = abgleich?.filter(a => a.aenderungen.length > 0) ?? []
  const ohneAenderung = abgleich?.filter(a => a.employeeId && a.aenderungen.length === 0) ?? []
  const ohneZuordnung = abgleich?.filter(a => !a.employeeId) ?? []

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-navy">ELStAM-Änderungsliste einlesen</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Steuerklasse, Kinderfreibeträge und Freibeträge kommen vom Finanzamt. Die
          monatliche Liste holt der Arbeitgeber oder sein Steuerberater ab — hier
          wird sie eingelesen. Nichts wird ohne Bestätigung geändert.
        </p>
      </div>

      {!abgleich && (
        <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-6 cursor-pointer hover:border-brand/40 transition-colors">
          <Upload size={16} className="text-gray-400" />
          <span className="text-sm text-gray-500">
            {laeuft ? 'wird gelesen …' : 'Datei wählen (CSV oder Textdatei)'}
          </span>
          <input type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) dateiWaehlen(f) }} />
        </label>
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

      {abgleich && (
        <>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <FileText size={13} /> {dateiname} · {hinweis}
          </div>

          {mitAenderung.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Änderungen</p>
              {mitAenderung.map(a => (
                <label key={a.employeeId ?? a.name}
                  className={`flex items-start gap-2.5 rounded-xl border p-2.5 ${
                    a.employeeId ? 'border-gray-200 cursor-pointer hover:bg-gray-50' : 'border-amber-200 bg-amber-50'}`}>
                  {a.employeeId && (
                    <input type="checkbox" checked={gewaehlt.has(a.employeeId)}
                      onChange={() => umschalten(a.employeeId!)}
                      className="mt-0.5 rounded border-gray-300" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-medium text-navy">{a.name}</span>
                      <span className={`text-[10px] ${a.zuordnung === 'name' ? 'text-amber-700' : 'text-gray-400'}`}>
                        {ZUORDNUNG_TEXT[a.zuordnung]}
                      </span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {a.aenderungen.map((ae, i) => (
                        <p key={i} className="text-xs text-gray-600">
                          {FELD_NAMEN[ae.feld] ?? ae.feld}:{' '}
                          <span className="text-gray-400 line-through">{ae.bisher}</span>
                          {' → '}
                          <span className="font-semibold text-navy">{ae.neu}</span>
                        </p>
                      ))}
                    </div>
                    {a.hinweis && <p className="text-[11px] text-amber-700 mt-1">{a.hinweis}</p>}
                  </div>
                </label>
              ))}
            </div>
          )}

          {ohneAenderung.length > 0 && (
            <p className="text-xs text-gray-400">
              {ohneAenderung.length} Mitarbeiter unverändert — sie bekommen den neuen Stand,
              weil sie gegen die Liste geprüft wurden.
            </p>
          )}

          {ohneZuordnung.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 space-y-1">
              <p className="text-xs font-semibold text-amber-900">
                {ohneZuordnung.length} Sätze ohne Zuordnung
              </p>
              {ohneZuordnung.map((a, i) => (
                <p key={i} className="text-[11px] text-amber-800">{a.name} — {a.hinweis}</p>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1 flex-wrap">
            <label className="text-xs text-gray-500">
              Stand der Liste{' '}
              <input type="date" value={stand} onChange={e => setStand(e.target.value)}
                className="ml-1 text-sm border border-gray-200 rounded-lg px-2 py-1" />
            </label>
            <div className="flex-1" />
            <button onClick={() => { setAbgleich(null); setInhalt(null); setFehler('') }}
              className="flex items-center gap-1.5 text-xs text-gray-500 px-3 py-2 rounded-xl hover:bg-gray-100">
              <X size={13} /> Abbrechen
            </button>
            <button onClick={uebernehmen} disabled={laeuft || gewaehlt.size === 0}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand px-4 py-2 rounded-xl disabled:opacity-40">
              <Check size={13} /> {gewaehlt.size} übernehmen
            </button>
          </div>
        </>
      )}
    </div>
  )
}
