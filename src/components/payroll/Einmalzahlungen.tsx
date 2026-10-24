'use client'

import { useState, useEffect, useCallback } from 'react'
import { Gift, Plus, Trash2, AlertTriangle } from 'lucide-react'

/**
 * §120 Einmalzahlungen erfassen.
 *
 * Weihnachtsgeld, Urlaubsgeld, Prämien, Abfindungen. Sie werden hier nur
 * eingetragen — gerechnet werden sie beim nächsten Abrechnungslauf. Dieselbe
 * Reihenfolge wie bei allem anderen: erfassen, rechnen, prüfen, freigeben.
 */

interface Zahlung {
  id: string
  employeeId: string
  employeeName: string | null
  monat: number
  art: string
  bezeichnung: string
  betrag: number
  beitragsfrei: boolean
}

const ARTEN = [
  { wert: 'weihnachtsgeld', label: 'Weihnachtsgeld' },
  { wert: 'urlaubsgeld', label: 'Urlaubsgeld' },
  { wert: 'praemie', label: 'Prämie' },
  { wert: 'abfindung', label: 'Abfindung' },
  { wert: 'sonstiges', label: 'Sonstiges' },
]

const eur = (n: number) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

export function Einmalzahlungen({
  jahr, monat, mitarbeiter, onFertig,
}: {
  jahr: number
  monat: number
  mitarbeiter: { id: string; name: string }[]
  onFertig?: () => void
}) {
  const [zahlungen, setZahlungen] = useState<Zahlung[]>([])
  const [fehler, setFehler] = useState('')
  const [hinweis, setHinweis] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [neu, setNeu] = useState({ employeeId: '', art: 'weihnachtsgeld', bezeichnung: '', betrag: '' })

  const laden = useCallback(async () => {
    const res = await fetch(`/api/payroll/einmalzahlung?jahr=${jahr}&monat=${monat}`)
    const d = await res.json().catch(() => ({}))
    setZahlungen(d.zahlungen ?? [])
  }, [jahr, monat])

  useEffect(() => { laden() }, [laden])

  async function anlegen() {
    setFehler(''); setHinweis('')
    if (!neu.employeeId || !neu.betrag) {
      setFehler('Bitte Mitarbeiter und Betrag angeben.')
      return
    }
    setLaeuft(true)
    try {
      const res = await fetch('/api/payroll/einmalzahlung', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: neu.employeeId, jahr, monat,
          art: neu.art, bezeichnung: neu.bezeichnung || undefined,
          betrag: Number(neu.betrag.replace(',', '.')),
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setFehler(d.error ?? 'Konnte nicht gespeichert werden.'); return }
      setHinweis(d.hinweis ?? 'erfasst')
      setNeu({ employeeId: '', art: 'weihnachtsgeld', bezeichnung: '', betrag: '' })
      await laden()
      onFertig?.()
    } catch { setFehler('Konnte nicht gespeichert werden.') }
    finally { setLaeuft(false) }
  }

  async function loeschen(id: string) {
    setFehler(''); setHinweis('')
    const res = await fetch(`/api/payroll/einmalzahlung?id=${id}`, { method: 'DELETE' })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setFehler(d.error ?? 'Konnte nicht gelöscht werden.'); return }
    await laden()
    onFertig?.()
  }

  const summe = zahlungen.reduce((s, z) => s + z.betrag, 0)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-navy">Einmalzahlungen</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Weihnachtsgeld, Urlaubsgeld, Prämien. Sie werden anders besteuert als
          laufender Lohn und an der anteiligen Jahresgrenze verbeitragt — deshalb
          gehören sie hierher und nicht ins Monatsgehalt. Gerechnet werden sie
          beim nächsten Abrechnungslauf.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr_1.2fr_0.8fr_auto] gap-2">
        <select value={neu.employeeId} onChange={e => setNeu(n => ({ ...n, employeeId: e.target.value }))}
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5">
          <option value="">— Mitarbeiter —</option>
          {mitarbeiter.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={neu.art} onChange={e => setNeu(n => ({ ...n, art: e.target.value }))}
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5">
          {ARTEN.map(a => <option key={a.wert} value={a.wert}>{a.label}</option>)}
        </select>
        <input value={neu.bezeichnung} onChange={e => setNeu(n => ({ ...n, bezeichnung: e.target.value }))}
          placeholder="Bezeichnung (optional)"
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
        <input value={neu.betrag} onChange={e => setNeu(n => ({ ...n, betrag: e.target.value }))}
          placeholder="Betrag" inputMode="decimal"
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
        <button onClick={anlegen} disabled={laeuft}
          className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand px-3 py-2 rounded-lg disabled:opacity-40">
          <Plus size={14} /> Erfassen
        </button>
      </div>

      {neu.art === 'abfindung' && (
        <p className="text-[11px] text-gray-500">
          Eine echte Abfindung ist beitragsfrei — sie entschädigt den Verlust des
          Arbeitsplatzes und ist kein Arbeitsentgelt. Versteuert wird sie trotzdem.
        </p>
      )}

      {fehler && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3">
          <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900">{fehler}</p>
        </div>
      )}
      {hinweis && <p className="text-xs text-teal-700">{hinweis}</p>}

      {zahlungen.length > 0 ? (
        <div className="space-y-1">
          {zahlungen.map(z => (
            <div key={z.id} className="flex items-center gap-2 rounded-xl border border-gray-200 p-2.5">
              <Gift size={14} className="text-gray-400 shrink-0" />
              <span className="text-sm text-navy font-medium">{z.employeeName}</span>
              <span className="text-xs text-gray-500">{z.bezeichnung}</span>
              {z.beitragsfrei && (
                <span className="text-[10px] text-gray-400">beitragsfrei</span>
              )}
              <div className="flex-1" />
              <span className="text-sm font-semibold text-navy tabular-nums">{eur(z.betrag)}</span>
              <button onClick={() => loeschen(z.id)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-amber-700 hover:bg-amber-50">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <p className="text-xs text-gray-500 pt-1">
            {zahlungen.length} Einmalzahlungen in diesem Monat · zusammen {eur(summe)}
          </p>
        </div>
      ) : (
        <p className="text-xs text-gray-400">In diesem Monat sind keine Einmalzahlungen erfasst.</p>
      )}
    </div>
  )
}
