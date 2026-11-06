'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { LEVEL_LABEL, type WorkforceLevel } from '@/lib/workforce-score-constants'
import { ESCALATION_LABEL, type EscalationStage } from '@/lib/substitution-constants'
import { Trophy, UserPlus, Palmtree, TrendingUp, Clock, AlertTriangle } from 'lucide-react'

interface PunctualityInsights {
  employeeCount: number
  averagePoints: number
  punctualClockInRate: number
  levelDistribution: Record<WorkforceLevel, number>
}

interface SubstitutionInsights {
  totalRequests: number
  filledRequests: number
  openRequests: number
  unresolvedRequests: number
  fillRate: number
  avgTimeToFillHours: number | null
  escalationDistribution: Record<EscalationStage, number>
}

interface AbsenceInsights {
  totalRequests: number
  pendingRequests: number
  approvedRequests: number
  deniedRequests: number
  approvalRate: number
  approvedDaysTotal: number
}

interface OvertimeHotspot {
  employeeId: string
  employeeName: string
  overtimeMinutes: number
}

interface WorkloadInsights {
  avgWeeklyHoursTarget: number
  avgLoggedHoursTotal: number
  overtimeHotspots: OvertimeHotspot[]
  understaffedShiftSlots: number
  totalShiftSlots: number
}

interface InsightsResponse {
  punctuality: PunctualityInsights
  substitutions: SubstitutionInsights
  absence: AbsenceInsights
  workload: WorkloadInsights
}

export function WorkforceInsightsDashboard({ fetchUrl }: { fetchUrl: string }) {
  const [data, setData] = useState<InsightsResponse | null>(null)
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

  const { punctuality, substitutions, absence, workload } = data

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Ø Workforce Score"
          value={punctuality.averagePoints}
          subtitle={`${punctuality.employeeCount} Mitarbeiter`}
          icon={Trophy}
          iconColor="text-amber-600"
          iconBg="bg-amber-100"
        />
        <StatCard
          title="Pünktlichkeit"
          value={`${punctuality.punctualClockInRate}%`}
          subtitle="pünktliche Einstempelungen"
          icon={Clock}
          iconColor="text-green-600"
          iconBg="bg-green-100"
        />
        <StatCard
          title="Vertretungs-Erfolgsquote"
          value={`${substitutions.fillRate}%`}
          subtitle={`${substitutions.filledRequests}/${substitutions.totalRequests} besetzt`}
          icon={UserPlus}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
        />
        <StatCard
          title="Unterbesetzte Schichten"
          value={workload.understaffedShiftSlots}
          subtitle={`von ${workload.totalShiftSlots} Schichten`}
          icon={AlertTriangle}
          iconColor="text-red-600"
          iconBg="bg-red-100"
          alert={workload.understaffedShiftSlots > 0}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Workforce Score – Level-Verteilung</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {(Object.entries(punctuality.levelDistribution) as [WorkforceLevel, number][]).map(([level, count]) => (
              <div key={level} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{LEVEL_LABEL[level]}</span>
                <span className="font-semibold text-navy">{count}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vertretungen – Eskalationsstufen</CardTitle>
          </CardHeader>
          <div className="space-y-2 mb-3">
            {(Object.entries(substitutions.escalationDistribution) as [EscalationStage, number][]).map(([stage, count]) => (
              <div key={stage} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{ESCALATION_LABEL[stage]}</span>
                <span className="font-semibold text-navy">{count}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            Ø Zeit bis Besetzung: {substitutions.avgTimeToFillHours !== null ? `${substitutions.avgTimeToFillHours} h` : 'k. A.'}
            {' · '}offen: {substitutions.openRequests} · ungelöst: {substitutions.unresolvedRequests}
          </p>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Abwesenheit & Urlaub</CardTitle>
            <Palmtree size={16} className="text-amber-500" />
          </CardHeader>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-500">Offene Anträge</p>
              <p className="font-bold text-navy text-lg">{absence.pendingRequests}</p>
            </div>
            <div>
              <p className="text-gray-500">Genehmigungsquote</p>
              <p className="font-bold text-navy text-lg">{absence.approvalRate}%</p>
            </div>
            <div>
              <p className="text-gray-500">Genehmigte Tage</p>
              <p className="font-bold text-navy text-lg">{absence.approvedDaysTotal}</p>
            </div>
            <div>
              <p className="text-gray-500">Abgelehnt</p>
              <p className="font-bold text-navy text-lg">{absence.deniedRequests}</p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Auslastung & Überstunden</CardTitle>
            <TrendingUp size={16} className="text-blue-500" />
          </CardHeader>
          <div className="grid grid-cols-2 gap-3 text-sm mb-3">
            <div>
              <p className="text-gray-500">Ø Soll-Stunden/Woche</p>
              <p className="font-bold text-navy text-lg">{workload.avgWeeklyHoursTarget}h</p>
            </div>
            <div>
              <p className="text-gray-500">Ø erfasste Stunden</p>
              <p className="font-bold text-navy text-lg">{workload.avgLoggedHoursTotal}h</p>
            </div>
          </div>
          {workload.overtimeHotspots.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">Überstunden-Hotspots</p>
              <div className="space-y-1">
                {workload.overtimeHotspots.map(h => (
                  <div key={h.employeeId} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">{h.employeeName}</span>
                    <span className="font-semibold text-amber-600">+{Math.round(h.overtimeMinutes / 60 * 10) / 10}h</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
