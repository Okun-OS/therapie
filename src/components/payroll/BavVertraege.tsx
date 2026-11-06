'use client'

import { useState, useEffect, useCallback } from 'react'
import { PiggyBank, Plus, Trash2, AlertTriangle, Ban } from 'lucide-react'

/**
 * §162 Verträge zur betrieblichen Altersvorsorge erfassen.
 *
 * WAS DIE MASKE BEIM EINTRAGEN SCHON SAGT
 * Die beiden Grenzen — 8 % steuerfrei im Jahr, 4 % beitragsfrei im Monat —
 * stehen hier, bevor der Betrag eingetragen ist. Wer erst auf der Abrechnung
 * sieht, dass Beiträge fällig werden, hat den Vertrag schon unterschrieben.
 *
 * Und der Zuschuss steht auf 15 % vorbelegt, weil §1a Abs. 1a BetrAVG ihn in
 * dieser Höhe verlangt. Wer weniger einträgt, bekommt es gesagt — annehmen
 * tut das Programm es trotzdem, denn was vereinbart ist, entscheidet nicht es.
 */

interface Vertrag {
  id: string
  employeeId: string
  personName: string | null
  weg: string
  anbieter: string
  vertragsnummer: string | null
  monatsbetrag: number
  zuschussSatz: number
  zuschussAufGesamt: boolean
  beginn: string
  ende: string | null
  aktiv: boolean
}

interface Grenzen {
  steuerfreiJahr: number
  steuerfreiMonat: number
  svfreiJahr: number
  svfreiMonat: number
}

const eur = (n: number) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

const LEER = {
  employeeId: '', weg: 'direktversicherung', anbieter: '', vertragsnummer: '',
  monatsbetrag: '', beginn: new Date().toISOString().slice(0, 10), zuschussSatz: '15',
}

export function BavVertraege({ mitarbeiter }: {
  mitarbeiter: { id: string; name: string }[]
}) {
  const [vertraege, setVertraege] = useState<Vertrag[]>([])
  const [wege, setWege] = useState<Record<string, string>>({})
  const [grenzen, setGrenzen] = useState<Grenzen | null>(null)
  const [neu, setNeu] = useState(LEER)
  const [fehler, setFehler] = useState('')
  const [hinweise, setHinweise] = useState<string[]>([])
  const [laeuft, setLaeuft] = useState(false)

  const laden = useCallback(async () => {
    const res = await fetch('/api/payroll/bav')
    const d = await res.json().catch(() => ({}))
    setVertraege(d.vertraege ?? [])
    setWege(d.wege ?? {})
    setGrenzen(d.grenzen ?? null)
  }, [])

  useEffect(() => { laden() }, [laden])

  async function anlegen() {
    setFehler(''); setHinweise([])
    if (!neu.employeeId || !neu.monatsbetrag) {
      setFehler('Bitte Mitarbeiter und Monatsbetrag angeben.')
      return
    }
    setLaeuft(true)
    try {
      const res = await fetch('/api/payroll/bav', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: neu.employeeId, weg: neu.weg,
          anbieter: neu.anbieter, vertragsnummer: neu.vertragsnummer || undefined,
          monatsbetrag: Number(neu.monatsbetrag.replace(',', '.')),
          beginn: neu.beginn,
          zuschussSatz: neu.zuschussSatz.trim() === ''
            ? undefined : Number(neu.zuschussSatz.replace(',', '.')) / 100,
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

  async function beenden(id: string) {
    setFehler(''); setHinweise([])
    const res = await fetch('/api/payroll/bav', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, aktiv: false, ende: new Date().toISOString().slice(0, 10) }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setFehler(d.error ?? 'Konnte nicht beendet werden.')
      return
    }
    await laden()
  }

  async function loeschen(id: string) {
    setFehler(''); setHinweise([])
    const res = await fetch(`/api/payroll/bav?id=${id}`, { method: 'DELETE' })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setFehler(d.error ?? 'Konnte nicht gelöscht werden.'); return }
    await laden()
  }

  // Was der eingetragene Betrag auslöst — bevor er gespeichert ist.
  const betrag = Number((neu.monatsbetrag || '0').replace(',', '.'))
  const vorschau = grenzen && betrag > 0
    ? betrag <= grenzen.svfreiMonat
      ? { ton: 'gut' as const, text: `${eur(betrag)} bleiben ganz frei — steuerfrei und beitragsfrei.` }
      : { ton: 'warn' as const, text:
          `${eur(betrag)} liegen über der monatlichen Beitragsgrenze von `
          + `${eur(grenzen.svfreiMonat)}. Beitragsfrei bleiben davon `
          + `${eur(grenzen.svfreiMonat)}, der Rest ist steuerfrei, aber `
          + 'beitragspflichtig (§1 Abs. 1 Satz 1 Nr. 9 SvEV).' }
    : null

  const laufende = vertraege.filter(v => v.aktiv)
  const beendete = vertraege.filter(v => !v.aktiv)

  return (
    <div data-test="bav" className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-navy">Betriebliche Altersvorsorge</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Entgeltumwandlung nach §1a BetrAVG. Der Betrag mindert das Brutto —
          Steuer und Beiträge aber unterschiedlich stark, weil die Grenzen
          verschieden hoch sind und für verschiedene Zeiträume gelten.
        </p>
      </div>

      {grenzen && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-2.5">
            <p className="text-gray-500">Steuerfrei (§3 Nr. 63 EStG)</p>
            <p className="text-navy font-semibold tabular-nums">
              {eur(grenzen.steuerfreiJahr)} <span className="font-normal text-gray-500">im Jahr</span>
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-2.5">
            <p className="text-gray-500">Beitragsfrei (SvEV)</p>
            <p className="text-navy font-semibold tabular-nums">
              {eur(grenzen.svfreiMonat)} <span className="font-normal text-gray-500">im Monat</span>
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1.1fr_1.1fr_0.8fr_0.8fr_auto] gap-2">
        <select value={neu.employeeId} onChange={e => setNeu(n => ({ ...n, employeeId: e.target.value }))}
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5">
          <option value="">— Mitarbeiter —</option>
          {mitarbeiter.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={neu.weg} onChange={e => setNeu(n => ({ ...n, weg: e.target.value }))}
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5">
          {Object.entries(wege).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input value={neu.anbieter} onChange={e => setNeu(n => ({ ...n, anbieter: e.target.value }))}
          placeholder="Anbieter"
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
        <input value={neu.monatsbetrag} onChange={e => setNeu(n => ({ ...n, monatsbetrag: e.target.value }))}
          placeholder="€ / Monat" inputMode="decimal"
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
        <input value={neu.zuschussSatz} onChange={e => setNeu(n => ({ ...n, zuschussSatz: e.target.value }))}
          placeholder="Zuschuss %" inputMode="decimal"
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
        <button onClick={anlegen} disabled={laeuft}
          className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand px-3 py-2 rounded-lg disabled:opacity-40">
          <Plus size={14} /> Anlegen
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input value={neu.vertragsnummer} onChange={e => setNeu(n => ({ ...n, vertragsnummer: e.target.value }))}
          placeholder="Vertragsnummer (optional)"
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
        <input type="date" value={neu.beginn} onChange={e => setNeu(n => ({ ...n, beginn: e.target.value }))}
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
      </div>

      {vorschau && (
        <p className={`text-[11px] ${vorschau.ton === 'gut' ? 'text-teal-700' : 'text-amber-800'}`}>
          {vorschau.text}
        </p>
      )}
      {neu.weg === 'altvertrag_40b' && (
        <p className="text-[11px] text-amber-800">
          Ein Altvertrag nach §40b EStG in der Fassung bis 2004 läuft nach
          eigenen Regeln. Das Programm rechnet ihn NICHT — Beiträge und
          Pauschsteuer gehören von Hand erfasst.
        </p>
      )}

      {fehler && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3">
          <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900">{fehler}</p>
        </div>
      )}
      {hinweise.map((h, i) => (
        <div key={i} className="flex items-start gap-2 rounded-xl bg-sky-50 border border-sky-200 p-2.5">
          <AlertTriangle size={14} className="text-sky-600 shrink-0 mt-0.5" />
          <p className="text-xs text-sky-900">{h}</p>
        </div>
      ))}

      {laufende.length > 0 ? (
        <div data-test="bav-liste" className="space-y-1">
          {laufende.map(v => (
            <div key={v.id} className="flex items-center gap-2 rounded-xl border border-gray-200 p-2.5">
              <PiggyBank size={14} className="text-gray-400 shrink-0" />
              <span className="text-sm text-navy font-medium">{v.personName}</span>
              <span className="text-xs text-gray-500">
                {wege[v.weg] ?? v.weg} · {v.anbieter}
              </span>
              <div className="flex-1" />
              <span className="text-xs text-gray-500 tabular-nums">
                Zuschuss {(v.zuschussSatz * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %
              </span>
              <span className="text-sm font-semibold text-navy tabular-nums">
                {eur(v.monatsbetrag)}
              </span>
              <button onClick={() => beenden(v.id)} title="Vertrag beenden"
                className="p-1.5 rounded-lg text-gray-400 hover:text-navy hover:bg-gray-50">
                <Ban size={14} />
              </button>
              <button onClick={() => loeschen(v.id)} title="Löschen (nur solange nichts abgerechnet ist)"
                className="p-1.5 rounded-lg text-gray-400 hover:text-amber-700 hover:bg-amber-50">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400">Kein laufender Vertrag.</p>
      )}

      {beendete.length > 0 && (
        <p className="text-[11px] text-gray-400">
          {beendete.length} beendete {beendete.length === 1 ? 'Vertrag' : 'Verträge'} —
          sie bleiben stehen, weil an ihnen abgerechnete Monate hängen.
        </p>
      )}
    </div>
  )
}
