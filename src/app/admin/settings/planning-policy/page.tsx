'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'

interface Policy {
  minAutoApproveScore: number
  defaultOvertimeHandling: 'reduce' | 'normal' | 'compensate'
  failFastOnInfeasible: boolean
  requestDeadline: string | null
}

const DEFAULTS: Policy = {
  minAutoApproveScore: 80,
  defaultOvertimeHandling: 'normal',
  failFastOnInfeasible: true,
  requestDeadline: null,
}

export default function PlanningPolicyPage() {
  const { user } = useAuth()
  const locationId = user?.locationId
  const [policy, setPolicy] = useState<Policy>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!locationId) return
    fetch(`/api/planning-policy?locationId=${locationId}`)
      .then(r => r.json())
      .then(d => {
        setPolicy({
          minAutoApproveScore: d.minAutoApproveScore ?? DEFAULTS.minAutoApproveScore,
          defaultOvertimeHandling: d.defaultOvertimeHandling ?? DEFAULTS.defaultOvertimeHandling,
          failFastOnInfeasible: d.failFastOnInfeasible ?? DEFAULTS.failFastOnInfeasible,
          requestDeadline: d.requestDeadline ? d.requestDeadline.slice(0, 16) : null,
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [locationId])

  async function save() {
    if (!locationId) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/planning-policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, ...policy }),
      })
      if (!res.ok) throw new Error(await res.text())
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-sm text-gray-500">Lade Einstellungen…</div>

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy">Planungseinstellungen</h1>
        <p className="text-sm text-gray-500 mt-1">
          Legen Sie fest, wie automatisch generierte Dienstpläne bewertet und genehmigt werden.
        </p>
      </div>

      {/* Min. Auto-Approve Score */}
      <section className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-navy">Mindestpunktzahl für Freigabe</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Dienstpläne, die diesen Score unterschreiten, werden nicht automatisch zur Freigabe empfohlen.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={50}
            max={100}
            step={5}
            value={policy.minAutoApproveScore}
            onChange={e => setPolicy(p => ({ ...p, minAutoApproveScore: Number(e.target.value) }))}
            className="flex-1 accent-brand"
          />
          <span className="w-14 text-center text-lg font-bold text-brand">
            {policy.minAutoApproveScore}
          </span>
        </div>
        <div className="flex gap-2 text-xs text-gray-400">
          <span>50 — weniger streng</span>
          <span className="flex-1 text-center">Standard: 80</span>
          <span>100 — sehr streng</span>
        </div>
      </section>

      {/* Default Overtime Handling */}
      <section className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-navy">Stundenkonto-Ausgleich</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Wie soll das System automatisch mit Über- und Unterstunden umgehen?
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {([
            { value: 'reduce', label: 'Überstunden abbauen', desc: 'Mitarbeiter mit Plusstunden werden kürzer eingeplant' },
            { value: 'normal', label: 'Vertragsstunden', desc: 'Immer nach Vertrag planen, unabhängig vom Stundenkonto' },
            { value: 'compensate', label: 'Minusstunden ausgleichen', desc: 'Mitarbeiter mit Minusstunden werden länger eingeplant' },
          ] as const).map(opt => (
            <button
              key={opt.value}
              onClick={() => setPolicy(p => ({ ...p, defaultOvertimeHandling: opt.value }))}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                policy.defaultOvertimeHandling === opt.value
                  ? 'border-brand bg-brand/5'
                  : 'border-gray-100 hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-sm text-navy">{opt.label}</div>
              <div className="text-xs text-gray-500 mt-1">{opt.desc}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Fail Fast on Infeasible */}
      <section className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-navy">Sofort abbrechen wenn kein Plan möglich</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Wenn aktiviert, stoppt das System sofort und zeigt eine Diagnose, statt einen unvollständigen Plan zu erstellen.
            </p>
          </div>
          <button
            onClick={() => setPolicy(p => ({ ...p, failFastOnInfeasible: !p.failFastOnInfeasible }))}
            className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
              policy.failFastOnInfeasible ? 'bg-brand' : 'bg-gray-300'
            }`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              policy.failFastOnInfeasible ? 'translate-x-7' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </section>

      {/* Request Deadline */}
      <section className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-navy">Wunsch-Einreichungsfrist</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Mitarbeiter können bis zu diesem Zeitpunkt Wünsche einreichen. Danach sind Eingaben für den nächsten Planungslauf gesperrt.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="datetime-local"
            value={policy.requestDeadline ?? ''}
            onChange={e => setPolicy(p => ({ ...p, requestDeadline: e.target.value || null }))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-navy"
          />
          {policy.requestDeadline && (
            <button
              onClick={() => setPolicy(p => ({ ...p, requestDeadline: null }))}
              className="text-xs text-red-500 hover:underline"
            >
              Frist entfernen
            </button>
          )}
        </div>
        {policy.requestDeadline && new Date(policy.requestDeadline) < new Date() && (
          <p className="text-xs text-amber-600">Frist ist bereits abgelaufen — neue Wünsche werden für die Planung nicht mehr berücksichtigt.</p>
        )}
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 bg-brand text-white rounded-xl font-medium text-sm disabled:opacity-50"
        >
          {saving ? 'Speichern…' : 'Speichern'}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">Gespeichert ✓</span>}
      </div>
    </div>
  )
}
