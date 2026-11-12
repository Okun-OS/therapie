'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { RISK_LEVEL_LABEL, type RiskLevel } from '@/lib/risk-constants'
import { Flame, UserMinus, CalendarOff, AlertTriangle } from 'lucide-react'

interface EmployeeRisk {
  employeeId: string
  employeeName: string
  score: number
  level: RiskLevel
  reasons: string[]
}

interface UnderstaffingRiskDay {
  date: string
  locationId: string
  locationName: string
  availableStaff: number
  requiredMinStaff: number
  deficit: number
}

interface UnderstaffingInsights {
  windowDays: number
  riskDays: UnderstaffingRiskDay[]
}

interface RiskResponse {
  burnout: EmployeeRisk[]
  fluctuation: EmployeeRisk[]
  understaffing: UnderstaffingInsights
}

function RiskTable({ title, icon: Icon, iconColor, data }: { title: string; icon: React.ElementType; iconColor: string; data: EmployeeRisk[] }) {
  const sorted = [...data].sort((a, b) => b.score - a.score)
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="p-4 pb-0">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <Icon size={16} className={iconColor} />
        </CardHeader>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Keine Mitarbeiter im Bestand</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {sorted.map(emp => {
            const { label, color } = RISK_LEVEL_LABEL[emp.level]
            return (
              <div key={emp.employeeId} className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-navy">{emp.employeeName}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{label} · {emp.score}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{emp.reasons.join(' · ')}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

export function PersonnelRiskDashboard({ fetchUrl }: { fetchUrl: string }) {
  const [data, setData] = useState<RiskResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(fetchUrl)
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [fetchUrl])

  if (loading) return <div className="text-center py-12 text-sm text-gray-400">Wird geladen...</div>
  if (!data) return <p className="text-sm text-gray-400 text-center py-12">Keine Daten verfügbar</p>

  const { burnout, fluctuation, understaffing } = data
  const burnoutHigh = burnout.filter(e => e.level === 'hoch').length
  const fluctuationHigh = fluctuation.filter(e => e.level === 'hoch').length

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          title="Burnout-Risiko hoch"
          value={burnoutHigh}
          subtitle={`von ${burnout.length} Mitarbeitern`}
          icon={Flame}
          iconColor="text-red-600"
          iconBg="bg-red-100"
          alert={burnoutHigh > 0}
        />
        <StatCard
          title="Fluktuationsrisiko hoch"
          value={fluctuationHigh}
          subtitle={`von ${fluctuation.length} Mitarbeitern`}
          icon={UserMinus}
          iconColor="text-amber-600"
          iconBg="bg-amber-100"
          alert={fluctuationHigh > 0}
        />
        <StatCard
          title="Unterbesetzungsrisiko"
          value={understaffing.riskDays.length}
          subtitle={`Tage in den nächsten ${understaffing.windowDays}`}
          icon={CalendarOff}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
          alert={understaffing.riskDays.length > 0}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <RiskTable title="Burnout-Risiko" icon={Flame} iconColor="text-red-500" data={burnout} />
        <RiskTable title="Kündigungs-/Fluktuationsrisiko" icon={UserMinus} iconColor="text-amber-500" data={fluctuation} />
      </div>

      <Card padding="sm">
        <p className="text-sm font-bold text-navy mb-3 flex items-center gap-2">
          <CalendarOff size={16} className="text-blue-500" />
          Voraussichtliche Unterbesetzung (Mindestbesetzung &gt; verfügbare Mitarbeiter)
        </p>
        {understaffing.riskDays.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Keine Unterbesetzung in den nächsten {understaffing.windowDays} Tagen erkennbar</p>
        ) : (
          <div className="space-y-2">
            {understaffing.riskDays.map((d, i) => (
              <div key={`${d.locationId}-${d.date}-${i}`} className="flex items-start gap-3 p-2.5 bg-red-50 rounded-xl">
                <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">
                  <span className="font-bold text-navy">{d.locationName}</span> am {d.date}: nur {d.availableStaff} verfügbar, {d.requiredMinStaff} Mindestbesetzung benötigt (Lücke: {d.deficit})
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
