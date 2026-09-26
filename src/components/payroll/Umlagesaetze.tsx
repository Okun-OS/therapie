'use client'

import { useState, useEffect, useCallback } from 'react'
import { Percent, AlertTriangle, Check, Trash2, Users } from 'lucide-react'

/**
 * §162 Die Umlagesätze der Krankenkassen pflegen.
 *
 * WARUM DIESE MASKE ZUERST GEBAUT WURDE
 * Weil ohne sie bei JEDEM Lohnlauf eine Warnung steht, die niemand abstellen
 * kann: U1 und U2 stehen nicht im Gesetz, sondern in der Satzung jeder
 * einzelnen Krankenkasse. Das Programm rät sie nicht — eine erfundene Umlage
 * fällt niemandem auf, eine fehlende schon.
 *
 * Die Liste zeigt deshalb von sich aus, welche Kassen bei den eigenen
 * Beschäftigten überhaupt vorkommen und für welche davon noch nichts
 * hinterlegt ist. Eine Einstellung, die man erst suchen muss, wird nicht
 * gepflegt.
 */

interface Satz {
  id: string
  kasse: string
  u1Satz: number | null
  u1Erstattung: number | null
  u2Satz: number | null
  gueltigAb: string
  notiz: string | null
}

interface Groesse {
  zahl: number
  u1Pflichtig: boolean
  hinweis: string
}

const proz = (a: number | null) =>
  a == null ? '—' : `${(a * 100).toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`

const LEER = { kasse: '', u1Satz: '', u1Erstattung: '', u2Satz: '' }

export function Umlagesaetze() {
  const [saetze, setSaetze] = useState<Satz[]>([])
  const [kassen, setKassen] = useState<{ kasse: string; hinterlegt: boolean }[]>([])
  const [groesse, setGroesse] = useState<Groesse | null>(null)
  const [insolvenz, setInsolvenz] = useState<{ satz: number; geprueft: boolean } | null>(null)
  const [neu, setNeu] = useState(LEER)
  const [fehler, setFehler] = useState('')
  const [hinweise, setHinweise] = useState<string[]>([])
  const [laeuft, setLaeuft] = useState(false)

  const laden = useCallback(async () => {
    const res = await fetch('/api/payroll/umlagen')
    const d = await res.json().catch(() => ({}))
    setSaetze(d.saetze ?? [])
    setKassen(d.kassen ?? [])
    setGroesse(d.betriebsgroesse ?? null)
    setInsolvenz(d.insolvenzgeld ?? null)
  }, [])

  useEffect(() => { laden() }, [laden])

  async function speichern(kasse: string, werte: typeof LEER) {
    setFehler(''); setHinweise([])
    if (!kasse.trim()) { setFehler('Bitte die Krankenkasse angeben.'); return }
    setLaeuft(true)
    try {
      const zahl = (s: string) => s.trim() === '' ? null : Number(s.replace(',', '.'))
      const res = await fetch('/api/payroll/umlagen', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kasse: kasse.trim(),
          u1Satz: zahl(werte.u1Satz),
          u1Erstattung: zahl(werte.u1Erstattung),
          u2Satz: zahl(werte.u2Satz),
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setFehler(d.error ?? 'Konnte nicht gespeichert werden.'); return }
      setHinweise(d.hinweise ?? [])
      setNeu(LEER)
      await laden()
    } catch { setFehler('Konnte nicht gespeichert werden.') }
    finally { setLaeuft(false) }
  }

  async function loeschen(id: string) {
    setFehler(''); setHinweise([])
    const res = await fetch(`/api/payroll/umlagen?id=${id}`, { method: 'DELETE' })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setFehler(d.error ?? 'Konnte nicht gelöscht werden.'); return }
    setHinweise(d.hinweis ? [d.hinweis] : [])
    await laden()
  }

  const fehlend = kassen.filter(k => !k.hinterlegt)

  return (
    <div data-test="umlagen" className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-navy">Umlagesätze der Krankenkassen</p>
        <p className="text-xs text-gray-500 mt-0.5">
          U1 (Entgeltfortzahlung) und U2 (Mutterschaft) stehen nicht im Gesetz,
          sondern in der Satzung jeder einzelnen Kasse — bei der U1 wählt der
          Betrieb zusätzlich eine Erstattungsstufe. Was hier fehlt, wird nicht
          geraten: Dann fällt keine Umlage an, und der Lohnlauf sagt es.
        </p>
      </div>

      {groesse && (
        <div className="flex items-start gap-2 rounded-xl bg-gray-50 border border-gray-200 p-2.5">
          <Users size={14} className="text-gray-500 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600">{groesse.hinweis}</p>
        </div>
      )}

      {fehlend.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-2.5">
          <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900">
            Für {fehlend.length === 1 ? 'diese Kasse' : 'diese Kassen'} ist noch
            nichts hinterlegt: <strong>{fehlend.map(k => k.kasse).join(', ')}</strong>.
            Solange das so ist, rechnet der Lohnlauf für die betroffenen
            Beschäftigten keine U1 und keine U2.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-[1.6fr_0.8fr_0.9fr_0.8fr_auto] gap-2">
        <input
          list="umlage-kassen"
          value={neu.kasse}
          onChange={e => setNeu(n => ({ ...n, kasse: e.target.value }))}
          placeholder="Krankenkasse"
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
        <datalist id="umlage-kassen">
          {kassen.map(k => <option key={k.kasse} value={k.kasse} />)}
        </datalist>
        <input
          value={neu.u1Satz}
          onChange={e => setNeu(n => ({ ...n, u1Satz: e.target.value }))}
          placeholder="U1 %" inputMode="decimal"
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
        <input
          value={neu.u1Erstattung}
          onChange={e => setNeu(n => ({ ...n, u1Erstattung: e.target.value }))}
          placeholder="Erstattung %" inputMode="decimal"
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
        <input
          value={neu.u2Satz}
          onChange={e => setNeu(n => ({ ...n, u2Satz: e.target.value }))}
          placeholder="U2 %" inputMode="decimal"
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
        <button
          onClick={() => speichern(neu.kasse, neu)}
          disabled={laeuft}
          className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand px-3 py-2 rounded-lg disabled:opacity-40">
          <Check size={14} /> Speichern
        </button>
      </div>
      <p className="text-[11px] text-gray-400">
        Prozentzahlen eintragen, nicht Anteile: <strong>2,1</strong> für 2,1 %.
        Die Erstattungsstufe der U1 ist der Anteil der fortgezahlten Vergütung,
        den die Kasse zurückzahlt — meist zwischen 40 und 80 %.
      </p>

      {fehler && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3">
          <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900">{fehler}</p>
        </div>
      )}
      {hinweise.map((h, i) => (
        <p key={i} className="text-xs text-teal-700">{h}</p>
      ))}

      {saetze.length > 0 ? (
        <div data-test="umlagen-liste" className="space-y-1">
          {saetze.map(s => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl border border-gray-200 p-2.5">
              <Percent size={14} className="text-gray-400 shrink-0" />
              <span className="text-sm text-navy font-medium flex-1">{s.kasse}</span>
              <span className="text-xs text-gray-500 tabular-nums">
                U1 {proz(s.u1Satz)}
                {s.u1Erstattung != null && ` · Erstattung ${proz(s.u1Erstattung)}`}
              </span>
              <span className="text-xs text-gray-500 tabular-nums">U2 {proz(s.u2Satz)}</span>
              <button onClick={() => loeschen(s.id)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-amber-700 hover:bg-amber-50">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400">Noch keine Kasse hinterlegt.</p>
      )}

      {insolvenz && (
        <p className="text-[11px] text-gray-400">
          Die Insolvenzgeldumlage ist bundeseinheitlich und steht nicht zur
          Wahl: derzeit {proz(insolvenz.satz)} (§358 SGB III).
          {!insolvenz.geprueft && ' Dieser Satz ist noch nicht gegen die Rechtsverordnung abgeglichen.'}
        </p>
      )}
    </div>
  )
}
