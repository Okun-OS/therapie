'use client'

import { useState, useEffect, useCallback } from 'react'
import { Scale, Plus, Trash2, AlertTriangle, Lock, Check } from 'lucide-react'

/**
 * §162 Lohnpfändungen erfassen.
 *
 * WARUM DIESE MASKE ANDERS AUSSIEHT ALS DIE ÜBRIGEN
 * Weil es hier keine harmlose Richtung gibt. Zu viel einbehalten heißt, dass
 * jemandem das Existenzminimum fehlt. Zu wenig einbehalten heißt, dass der
 * Arbeitgeber dem Gläubiger persönlich haftet (§840 ZPO).
 *
 * Deshalb steht hier mehr Text als sonst: der Tag der Zustellung entscheidet
 * über den Rang, nicht der Tag der Eingabe; bei einer Unterhaltspfändung
 * fehlt ohne den notwendigen Unterhalt aus dem Beschluss die Grundlage, und
 * dann wird NICHTS einbehalten statt etwas Geratenes.
 *
 * Und deshalb sieht diese Maske nur die Unternehmensebene. Eine Pfändung sagt
 * etwas über die wirtschaftliche Lage eines Menschen, das mit seiner Arbeit
 * nichts zu tun hat.
 */

interface Abzug {
  jahr: number
  monat: number
  betrag: number
  hinweis: string | null
}

interface Pfaendung {
  id: string
  employeeId: string
  personName: string | null
  art: string
  glaeubiger: string
  aktenzeichen: string | null
  zugestelltAm: string
  forderung: number | null
  getilgt: number
  notwendigerUnterhalt: number | null
  unterhaltspflichten: number | null
  aktiv: boolean
  abzuege: Abzug[]
}

const eur = (n: number) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

const LEER = {
  employeeId: '', art: 'normal', glaeubiger: '', aktenzeichen: '',
  zugestelltAm: new Date().toISOString().slice(0, 10),
  forderung: '', notwendigerUnterhalt: '', unterhaltspflichten: '',
}

export function Pfaendungen({ mitarbeiter }: {
  mitarbeiter: { id: string; name: string }[]
}) {
  const [pfaendungen, setPfaendungen] = useState<Pfaendung[]>([])
  const [arten, setArten] = useState<Record<string, string>>({})
  const [tabelleVorhanden, setTabelleVorhanden] = useState(true)
  const [neu, setNeu] = useState(LEER)
  const [fehler, setFehler] = useState('')
  const [hinweise, setHinweise] = useState<string[]>([])
  const [laeuft, setLaeuft] = useState(false)

  const laden = useCallback(async () => {
    const res = await fetch('/api/payroll/pfaendung')
    const d = await res.json().catch(() => ({}))
    setPfaendungen(d.pfaendungen ?? [])
    setArten(d.arten ?? {})
    setTabelleVorhanden(d.tabelleVorhanden !== false)
  }, [])

  useEffect(() => { laden() }, [laden])

  async function anlegen() {
    setFehler(''); setHinweise([])
    setLaeuft(true)
    try {
      const zahl = (s: string) => s.trim() === '' ? undefined : Number(s.replace(',', '.'))
      const res = await fetch('/api/payroll/pfaendung', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: neu.employeeId, art: neu.art,
          glaeubiger: neu.glaeubiger, aktenzeichen: neu.aktenzeichen || undefined,
          zugestelltAm: neu.zugestelltAm,
          forderung: zahl(neu.forderung),
          notwendigerUnterhalt: zahl(neu.notwendigerUnterhalt),
          unterhaltspflichten: zahl(neu.unterhaltspflichten),
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

  async function erledigen(id: string) {
    setFehler(''); setHinweise([])
    const res = await fetch('/api/payroll/pfaendung', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, aktiv: false }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setFehler(d.error ?? 'Konnte nicht erledigt werden.')
      return
    }
    await laden()
  }

  async function loeschen(id: string) {
    setFehler(''); setHinweise([])
    const res = await fetch(`/api/payroll/pfaendung?id=${id}`, { method: 'DELETE' })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setFehler(d.error ?? 'Konnte nicht gelöscht werden.'); return }
    await laden()
  }

  const laufende = pfaendungen.filter(p => p.aktiv)
  const erledigte = pfaendungen.filter(p => !p.aktiv)

  return (
    <div data-test="pfaendung" className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Lock size={14} className="text-gray-400 shrink-0 mt-1" />
        <div>
          <p className="text-sm font-semibold text-navy">Lohnpfändungen</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Nur auf Unternehmensebene sichtbar — die Standortleitung sieht sie
            nicht. Eine Pfändung sagt etwas über die wirtschaftliche Lage eines
            Menschen, das mit seiner Arbeit nichts zu tun hat.
          </p>
        </div>
      </div>

      {!tabelleVorhanden && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-2.5">
          <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900">
            Für den laufenden Zeitraum ist keine Pfändungstabelle hinterlegt.
            Die Freigrenzen werden zum 1. Juli angepasst (§850c Abs. 4 ZPO).
            Bis der Eintrag da ist, wird nichts einbehalten — mit veralteten
            Zahlen zu rechnen wäre schlimmer.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-[1.3fr_1fr_1.3fr_1fr] gap-2">
        <select value={neu.employeeId} onChange={e => setNeu(n => ({ ...n, employeeId: e.target.value }))}
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5">
          <option value="">— Mitarbeiter —</option>
          {mitarbeiter.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={neu.art} onChange={e => setNeu(n => ({ ...n, art: e.target.value }))}
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5">
          {Object.entries(arten).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input value={neu.glaeubiger} onChange={e => setNeu(n => ({ ...n, glaeubiger: e.target.value }))}
          placeholder="Gläubiger"
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
        <input value={neu.aktenzeichen} onChange={e => setNeu(n => ({ ...n, aktenzeichen: e.target.value }))}
          placeholder="Aktenzeichen"
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2">
        <div>
          <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">
            Zugestellt am
          </label>
          <input type="date" value={neu.zugestelltAm}
            onChange={e => setNeu(n => ({ ...n, zugestelltAm: e.target.value }))}
            className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">
            Forderung
          </label>
          <input value={neu.forderung} onChange={e => setNeu(n => ({ ...n, forderung: e.target.value }))}
            placeholder="€ (leer bei Unterhalt)" inputMode="decimal"
            className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">
            Unterhaltspflichten lt. Beschluss
          </label>
          <input value={neu.unterhaltspflichten}
            onChange={e => setNeu(n => ({ ...n, unterhaltspflichten: e.target.value }))}
            placeholder="Anzahl" inputMode="numeric"
            className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
        </div>
        <div className="flex items-end">
          <button onClick={anlegen} disabled={laeuft}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand px-3 py-2 rounded-lg disabled:opacity-40">
            <Plus size={14} /> Erfassen
          </button>
        </div>
      </div>

      {neu.art === 'unterhalt' && (
        <div>
          <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">
            Notwendiger Unterhalt lt. Beschluss (§850d Abs. 1 Satz 2 ZPO)
          </label>
          <input value={neu.notwendigerUnterhalt}
            onChange={e => setNeu(n => ({ ...n, notwendigerUnterhalt: e.target.value }))}
            placeholder="€ im Monat" inputMode="decimal"
            className="w-full sm:w-64 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
          <p className="text-[11px] text-amber-800 mt-1">
            Das Gericht setzt diesen Betrag fest — das Programm darf ihn nicht
            raten. Fehlt er, wird nichts einbehalten.
          </p>
        </div>
      )}

      <p className="text-[11px] text-gray-400">
        Der Tag der <strong>Zustellung</strong> entscheidet über den Rang
        gegenüber anderen Pfändungen (§804 Abs. 3 ZPO) — nicht der Tag, an dem
        hier jemand etwas einträgt.
      </p>

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
        <div data-test="pfaendung-liste" className="space-y-1">
          {laufende.map(p => (
            <div key={p.id} className="rounded-xl border border-gray-200 p-2.5 space-y-1">
              <div className="flex items-center gap-2">
                <Scale size={14} className="text-gray-400 shrink-0" />
                <span className="text-sm text-navy font-medium">{p.personName}</span>
                <span className="text-xs text-gray-500">
                  {arten[p.art] ?? p.art} · {p.glaeubiger}
                  {p.aktenzeichen ? ` · ${p.aktenzeichen}` : ''}
                </span>
                <div className="flex-1" />
                {p.forderung != null && (
                  <span className="text-xs text-gray-500 tabular-nums">
                    {eur(p.getilgt)} von {eur(p.forderung)} getilgt
                  </span>
                )}
                <button onClick={() => erledigen(p.id)} title="Als erledigt kennzeichnen"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-teal-700 hover:bg-teal-50">
                  <Check size={14} />
                </button>
                <button onClick={() => loeschen(p.id)} title="Löschen (nur solange nichts einbehalten wurde)"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-amber-700 hover:bg-amber-50">
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="text-[11px] text-gray-400 pl-6">
                zugestellt am {p.zugestelltAm.split('-').reverse().join('.')}
                {p.abzuege.length > 0
                  ? ` · ${p.abzuege.length} Monate einbehalten, zuletzt `
                    + `${eur(p.abzuege[0].betrag)} in ${p.abzuege[0].monat}/${p.abzuege[0].jahr}`
                  : ' · noch nichts einbehalten'}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400">Keine laufende Pfändung.</p>
      )}

      {erledigte.length > 0 && (
        <p className="text-[11px] text-gray-400">
          {erledigte.length} erledigte {erledigte.length === 1 ? 'Pfändung' : 'Pfändungen'} —
          sie bleiben stehen, weil die Abzüge gegenüber dem Gläubiger belegbar
          sein müssen (§840 ZPO).
        </p>
      )}
    </div>
  )
}
