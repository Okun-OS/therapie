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
  overtimeDecisions: Record<string, 'reduce' | 'ignore' | 'normal'>
  sondernotiz: string
}

export function PlanungslaufPanel({ locationId, onConfirm, onCancel }: PlanungslaufPanelProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [decisions, setDecisions] = useState<Record<string, 'reduce' | 'normal'>>({})
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
        // Pre-select "reduce" for employees with significant imbalance
        const auto: Record<string, 'reduce' | 'normal'> = {}
        for (const e of filtered) {
          if (Math.abs(e.hoursBalance) >= 8) auto[e.id] = 'reduce'
        }
        setDecisions(auto)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [locationId])

  function toggle(empId: string, current: 'reduce' | 'normal') {
    setDecisions(prev => ({ ...prev, [empId]: current === 'reduce' ? 'normal' : 'reduce' }))
  }

  const adjustCount = Object.values(decisions).filter(v => v === 'reduce').length

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Stundenkonto-Check vor dem Planungslauf. Hake Mitarbeiter an, deren Konto die KI aktiv ausgleichen soll.
      </p>

      {loading ? (
        <div className="text-sm text-gray-400 text-center py-4">Lade Mitarbeiter…</div>
      ) : (
        <div className="space-y-1">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-2 pb-1 border-b border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Mitarbeiter</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Konto</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Ausgleichen</span>
          </div>
          {employees.map(emp => {
            const balance = emp.hoursBalance ?? 0
            const isOvertime = balance > 0
            const isUndertime = balance < 0
            const significant = Math.abs(balance) >= 8
            const decision = decisions[emp.id] ?? 'normal'
            const label = isOvertime ? '1 Dienst weniger' : isUndertime ? '1 Dienst mehr' : '±0'
            return (
              <div key={emp.id} className={`grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-2 py-2 rounded-lg ${significant ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                <div className="flex items-center gap-2 min-w-0">
                  {significant
                    ? <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
                    : <CheckCircle size={12} className="text-green-400 flex-shrink-0" />}
                  <span className="text-sm font-medium text-gray-800 truncate">{emp.name}</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-mono whitespace-nowrap">
                  {isOvertime ? <TrendingUp size={11} className="text-red-500" />
                    : isUndertime ? <TrendingDown size={11} className="text-blue-500" />
                    : <Minus size={11} className="text-gray-300" />}
                  <span className={isOvertime ? 'text-red-600' : isUndertime ? 'text-blue-600' : 'text-gray-400'}>
                    {balance > 0 ? '+' : ''}{balance.toFixed(1)}h
                  </span>
                </div>
                <button
                  onClick={() => toggle(emp.id, decision)}
                  disabled={Math.abs(balance) < 0.1}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all whitespace-nowrap disabled:opacity-30 disabled:cursor-not-allowed ${
                    decision === 'reduce'
                      ? 'bg-navy text-white'
                      : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'
                  }`}
                  title={decision === 'reduce' ? label : 'Kein Ausgleich'}
                >
                  {decision === 'reduce' ? `✓ ${label}` : 'Planmäßig'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {!loading && adjustCount > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          {adjustCount} Mitarbeiter werden angepasst — die KI plant entsprechend mehr oder weniger Dienste.
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
