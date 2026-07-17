'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import type { Employee } from '@/lib/types'

interface PlanungslaufPanelProps {
  locationId: string
  onConfirm: (context: PlanContext) => void
  onCancel: () => void
}

export interface PlanContext {
  overtimeDecisions: Record<string, 'reduce' | 'ignore'>  // employeeId → decision
  sondernotiz: string
}

export function PlanungslaufPanel({ locationId, onConfirm, onCancel }: PlanungslaufPanelProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [decisions, setDecisions] = useState<Record<string, 'reduce' | 'ignore'>>({})
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
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [locationId])

  // Only employees with significant imbalance
  const hints = employees.filter(e => Math.abs(e.hoursBalance) >= 8)

  function setDecision(empId: string, val: 'reduce' | 'ignore') {
    setDecisions(prev => ({ ...prev, [empId]: val }))
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Kurze Durchsicht vor dem Planungslauf — dauert 30 Sekunden.</p>

      {!loading && hints.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Stundenkonto-Hinweise</p>
          {hints.map(emp => (
            <div key={emp.id} className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-500" />
                <span className="text-sm font-medium text-gray-800">{emp.name}</span>
                <span className={`text-xs font-mono ${emp.hoursBalance > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                  {emp.hoursBalance > 0 ? '+' : ''}{emp.hoursBalance.toFixed(1)}h
                </span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setDecision(emp.id, 'reduce')}
                  className={`text-xs px-2 py-1 rounded ${decisions[emp.id] === 'reduce' ? 'bg-amber-500 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
                >
                  {emp.hoursBalance > 0 ? '1 Dienst weniger' : '1 Dienst mehr'}
                </button>
                <button
                  onClick={() => setDecision(emp.id, 'ignore')}
                  className={`text-xs px-2 py-1 rounded ${decisions[emp.id] === 'ignore' ? 'bg-gray-400 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
                >
                  Ignorieren
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && hints.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
          <CheckCircle size={14} />
          Alle Stundenkonten ausgeglichen — keine besonderen Hinweise.
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Sondernotiz (optional)</p>
        <textarea
          value={sondernotiz}
          onChange={e => setSondernotiz(e.target.value)}
          placeholder="z. B. Donnerstag Veranstaltung, bitte Verstärkung einplanen"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
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
