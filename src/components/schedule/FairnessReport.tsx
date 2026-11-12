'use client'

import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { AlertTriangle, CheckCircle, TrendingUp, Sun, Moon, Briefcase, CalendarDays } from 'lucide-react'
import type { ShiftFairnessData } from '@/lib/types'
import { fairnessLabel } from '@/lib/fairness'

interface FairnessReportProps {
  data: ShiftFairnessData[]
}

const DAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

export function FairnessReport({ data }: FairnessReportProps) {
  const sorted = [...data].sort((a, b) => a.fairnessScore - b.fairnessScore)
  const avgScore = data.length > 0 ? Math.round(data.reduce((s, d) => s + d.fairnessScore, 0) / data.length) : 0
  const unfairCount = data.filter(d => d.fairnessScore < 60).length
  const { label: avgLabel, color: avgColor } = fairnessLabel(avgScore)

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`rounded-2xl p-4 text-center ${avgColor}`}>
          <p className="text-2xl font-bold">{avgScore}</p>
          <p className="text-xs font-semibold mt-0.5">Ø Fairness-Score</p>
          <p className="text-xs mt-0.5">{avgLabel}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{unfairCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Problematisch</p>
          <p className="text-[10px] text-gray-400">(Score &lt; 60)</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-navy">{data.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Analysierte MA</p>
          <p className="text-[10px] text-gray-400">letzte 4 Wochen</p>
        </div>
      </div>

      {/* Per-employee details */}
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 w-36">Mitarbeiter</th>
                <th className="text-center text-xs font-semibold text-gray-500 px-2 py-3">
                  <div className="flex items-center justify-center gap-1"><Sun size={11} /> Früh</div>
                </th>
                <th className="text-center text-xs font-semibold text-gray-500 px-2 py-3">
                  <div className="flex items-center justify-center gap-1"><Moon size={11} /> Spät</div>
                </th>
                <th className="text-center text-xs font-semibold text-gray-500 px-2 py-3">
                  <div className="flex items-center justify-center gap-1"><Briefcase size={11} /> Mitte</div>
                </th>
                <th className="text-center text-xs font-semibold text-gray-500 px-2 py-3">Fr-Spät</th>
                <th className="text-center text-xs font-semibold text-gray-500 px-2 py-3">Mo-Früh</th>
                <th className="text-center text-xs font-semibold text-gray-500 px-2 py-3">Fr-Früh</th>
                <th className="text-center text-xs font-semibold text-gray-500 px-2 py-3">
                  <div className="flex items-center justify-center gap-1"><CalendarDays size={11} /> WE</div>
                </th>
                <th className="text-center text-xs font-semibold text-gray-500 px-2 py-3">Folgetage</th>
                <th className="text-center text-xs font-semibold text-gray-500 px-2 py-3">Vertretungen</th>
                <th className="text-center text-xs font-semibold text-gray-500 px-3 py-3">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map(emp => {
                const { label, color } = fairnessLabel(emp.fairnessScore)
                const fridayLateWarning = emp.fridayLateCnt >= 2
                const mondayEarlyWarning = emp.mondayEarlyCnt >= 3
                const fridayEarlyWarning = emp.fridayEarlyCnt >= 3
                const weekendWarning = emp.weekendCnt > 2
                const consecutiveWarning = emp.maxConsecutiveDays > 5
                const hasIssues = emp.issues.length > 0

                return (
                  <tr key={emp.employeeId} className={hasIssues ? 'bg-red-50/30' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {hasIssues ? (
                          <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
                        ) : (
                          <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
                        )}
                        <div>
                          <p className="text-xs font-semibold text-navy">{emp.employeeName.split(' ')[0]}</p>
                          <p className="text-[10px] text-gray-400">{emp.weeklyHours}h/Wo</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className={`text-sm font-bold ${emp.earlyDebt < -1 ? 'text-amber-600' : 'text-navy'}`}>
                        {emp.earlyCnt}
                      </span>
                      {emp.earlyDebt !== 0 && (
                        <span className={`text-[10px] ml-1 ${emp.earlyDebt > 0 ? 'text-blue-500' : 'text-orange-500'}`}>
                          {emp.earlyDebt > 0 ? `+${emp.earlyDebt.toFixed(0)}` : emp.earlyDebt.toFixed(0)}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className={`text-sm font-bold ${emp.lateDebt < -1 ? 'text-amber-600' : 'text-navy'}`}>
                        {emp.lateCnt}
                      </span>
                      {emp.lateDebt !== 0 && (
                        <span className={`text-[10px] ml-1 ${emp.lateDebt > 0 ? 'text-blue-500' : 'text-orange-500'}`}>
                          {emp.lateDebt > 0 ? `+${emp.lateDebt.toFixed(0)}` : emp.lateDebt.toFixed(0)}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className="text-sm font-bold text-navy">{emp.midCnt}</span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className={`text-sm font-bold ${fridayLateWarning ? 'text-red-600' : 'text-navy'}`}>
                        {emp.fridayLateCnt}×
                      </span>
                      {fridayLateWarning && <AlertTriangle size={10} className="inline ml-1 text-red-400" />}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className={`text-sm font-bold ${mondayEarlyWarning ? 'text-red-600' : 'text-navy'}`}>
                        {emp.mondayEarlyCnt}×
                      </span>
                      {mondayEarlyWarning && <AlertTriangle size={10} className="inline ml-1 text-red-400" />}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className={`text-sm font-bold ${fridayEarlyWarning ? 'text-red-600' : 'text-navy'}`}>
                        {emp.fridayEarlyCnt}×
                      </span>
                      {fridayEarlyWarning && <AlertTriangle size={10} className="inline ml-1 text-red-400" />}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className={`text-sm font-bold ${weekendWarning ? 'text-red-600' : 'text-navy'}`}>
                        {emp.weekendCnt}×
                      </span>
                      {weekendWarning && <AlertTriangle size={10} className="inline ml-1 text-red-400" />}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className={`text-sm font-bold ${consecutiveWarning ? 'text-red-600' : 'text-navy'}`}>
                        {emp.maxConsecutiveDays}
                      </span>
                      {consecutiveWarning && <AlertTriangle size={10} className="inline ml-1 text-red-400" />}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className="text-sm font-bold text-navy">{emp.substitutionCoverageCnt}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${color}`}>
                        {emp.fairnessScore}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Issues list */}
      {sorted.some(d => d.issues.length > 0) && (
        <Card padding="sm">
          <p className="text-sm font-bold text-navy mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            Erkannte Probleme
          </p>
          <div className="space-y-2">
            {sorted.filter(d => d.issues.length > 0).flatMap(d =>
              d.issues.map((issue, i) => (
                <div key={`${d.employeeId}-${i}`} className="flex items-start gap-3 p-2.5 bg-red-50 rounded-xl">
                  <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-navy">{d.employeeName.split(' ')[0]}:</span>
                    <span className="text-xs text-red-700 ml-1">{issue}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Hinweis: ±-Werte in der Tabelle zeigen die Abweichung vom fairen Zielwert. Positive Werte = zu viele, negative = zu wenige dieser Schicht in den letzten 4 Wochen.
          </p>
        </Card>
      )}
    </div>
  )
}
