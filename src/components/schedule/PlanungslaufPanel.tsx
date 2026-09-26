'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { Employee } from '@/lib/types'

interface PlanungslaufPanelProps {
  locationId: string
  onConfirm: (context: PlanContext) => void
  onCancel: () => void
}

export interface PlanContext {
  overtimeDecisions: Record<string, 'reduce' | 'normal' | 'compensate'>
  sondernotiz: string
}

type Decision = 'reduce' | 'normal' | 'compensate'

export function PlanungslaufPanel({ locationId, onConfirm, onCancel }: PlanungslaufPanelProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})
  const [sondernotiz, setSondernotiz] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/employees')
      .then(r => r.json())
      .then(d => {
        const filtered = (d.employees ?? []).filter(
          (e: Employee) => e.locationId === locationId && e.role === 'employee'
        )
        setEmployees(filtered)
        const auto: Record<string, Decision> = {}
        for (const e of filtered) {
          if ((e.hoursBalance ?? 0) >= 8) auto[e.id] = 'reduce'
          else if ((e.hoursBalance ?? 0) <= -8) auto[e.id] = 'compensate'
          else auto[e.id] = 'normal'
        }
        setDecisions(auto)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [locationId])

  function setDecision(empId: string, d: Decision) {
    setDecisions(prev => ({ ...prev, [empId]: d }))
  }

  const adjustCount = Object.values(decisions).filter(v => v !== 'normal').length

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Stundenkonto-Check vor dem Planungslauf. Wähle pro Mitarbeiter, wie die KI das Konto berücksichtigen soll.
      </p>

      {loading ? (
        <div className="text-sm text-gray-400 text-center py-4">Lade Mitarbeiter…</div>
      ) : (
        <div className="space-y-1">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-2 pb-1 border-b border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Mitarbeiter</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Konto</span>
            <div className="flex gap-1 items-center">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">ÜSt↓</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">±0</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">MSt↓</span>
            </div>
          </div>

          {employees.map(emp => {
            const balance = emp.hoursBalance ?? 0
            const isOvertime = balance > 0
            const isUndertime = balance < 0
            const significant = Math.abs(balance) >= 8
            const decision = decisions[emp.id] ?? 'normal'
            const noBalance = Math.abs(balance) < 0.1

            return (
              <div
                key={emp.id}
                className={`grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-2 py-2 rounded-lg ${
                  significant ? 'bg-amber-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {significant
                    ? <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
                    : <CheckCircle size={12} className="text-green-400 flex-shrink-0" />}
                  <span className="text-sm font-medium text-gray-800 truncate">{emp.name}</span>
                </div>

                <div className="flex items-center gap-1 text-xs font-mono whitespace-nowrap">
                  {isOvertime
                    ? <TrendingUp size={11} className="text-red-500" />
                    : isUndertime
                    ? <TrendingDown size={11} className="text-blue-500" />
                    : <Minus size={11} className="text-gray-300" />}
                  <span className={isOvertime ? 'text-red-600' : isUndertime ? 'text-blue-600' : 'text-gray-400'}>
                    {balance > 0 ? '+' : ''}{balance.toFixed(1)}h
                  </span>
                </div>

                <div className="flex gap-1">
                  <button
                    onClick={() => !noBalance && setDecision(emp.id, 'reduce')}
                    disabled={noBalance}
                    title="Überstunden abbauen (1 Dienst weniger)"
                    className={`w-8 h-7 rounded flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed ${
                      decision === 'reduce'
                        ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
                        : 'bg-white border border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                    }`}
                  >
                    <TrendingDown size={12} />
                  </button>
                  <button
                    onClick={() => setDecision(emp.id, 'normal')}
                    title="Planmäßig (keine Anpassung)"
                    className={`w-8 h-7 rounded flex items-center justify-center transition-all ${
                      decision === 'normal'
                        ? 'bg-gray-200 text-gray-700 ring-1 ring-gray-300'
                        : 'bg-white border border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                    }`}
                  >
                    <Minus size={12} />
                  </button>
                  <button
                    onClick={() => !noBalance && setDecision(emp.id, 'compensate')}
                    disabled={noBalance}
                    title="Minusstunden abbauen (1 Dienst mehr)"
                    className={`w-8 h-7 rounded flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed ${
                      decision === 'compensate'
                        ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                        : 'bg-white border border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                    }`}
                  >
                    <TrendingUp size={12} />
                  </button>
                </div>
              </div>
            )
          })}

          <div className="flex gap-4 px-2 pt-2 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><TrendingDown size={10} className="text-red-400" /> Überstunden abbauen</span>
            <span className="flex items-center gap-1"><Minus size={10} /> Planmäßig</span>
            <span className="flex items-center gap-1"><TrendingUp size={10} className="text-blue-400" /> Minusstunden abbauen</span>
          </div>
        </div>
      )}

      {!loading && adjustCount > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          {adjustCount} {adjustCount === 1 ? 'Mitarbeiter wird' : 'Mitarbeiter werden'} angepasst — die KI plant entsprechend mehr oder weniger Dienste.
        </p>
      )}

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Sondernotiz (optional)</p>
        <textarea
          value={sondernotiz}
          onChange={e => setSondernotiz(e.target.value)}
          placeholder="z.B. Donnerstag Veranstaltung, bitte Verstärkung einplanen"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-navy/20"
          rows={2}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="ghost" onClick={onCancel} className="flex-1">Abbrechen</Button>
        <Button onClick={() => onConfirm({ overtimeDecisions: decisions, sondernotiz })} className="flex-1">
          Plan erstellen
        </Button>
      </div>
    </div>
  )
}
