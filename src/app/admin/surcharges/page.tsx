'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Euro, Moon, Sun, Star, Calendar } from 'lucide-react'
import { minutesToHours, DEFAULT_SURCHARGE_RATES } from '@/lib/surcharge-engine'
import type { EmployeeSurchargeRow } from '@/lib/surcharge-engine'

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

function SurchargeCell({ minutes, percent, color }: { minutes: number; percent: number; color: string }) {
  if (minutes === 0) return <span className="text-gray-300">–</span>
  return (
    <div>
      <div className={`font-semibold ${color}`}>{minutesToHours(minutes)}</div>
      <div className="text-[10px] text-gray-400">+{percent}%</div>
    </div>
  )
}

export default function SurchargesPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [rows, setRows] = useState<EmployeeSurchargeRow[]>([])
  const [bundesland, setBundesland] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const rates = DEFAULT_SURCHARGE_RATES

  useEffect(() => {
    setLoading(true)
    fetch(`/api/surcharges?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(d => {
        setRows(d.rows ?? [])
        if (d.bundesland) setBundesland(d.bundesland)
      })
      .finally(() => setLoading(false))
  }, [year, month])

  function navigate(dir: -1 | 1) {
    let m = month + dir
    let y = year
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setMonth(m)
    setYear(y)
  }

  const totals = rows.reduce(
    (acc, r) => ({
      night: acc.night + r.nightMinutes,
      saturday: acc.saturday + r.saturdayMinutes,
      sunday: acc.sunday + r.sundayMinutes,
      holiday: acc.holiday + r.holidayMinutes,
    }),
    { night: 0, saturday: 0, sunday: 0, holiday: 0 }
  )

  const hasAny = rows.some(r => r.nightMinutes + r.saturdayMinutes + r.sundayMinutes + r.holidayMinutes > 0)

  return (
    <DashboardLayout requiredRole="admin">
      <Header
        title="Zuschlags-Engine"
        subtitle={`Zuschlagspflichtige Stunden${bundesland ? ` · ${bundesland}` : ''}`}
      />

      <div className="p-4 sm:p-6 space-y-5">
        {/* Month navigation */}
        <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 px-4 py-3 w-fit">
          <button onClick={() => navigate(-1)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            ‹
          </button>
          <span className="font-semibold text-navy min-w-[140px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button onClick={() => navigate(1)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            ›
          </button>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Nachtzuschlag', sublabel: '22:00–06:00', rate: `+${rates.nightPercent}%`, color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-100', icon: Moon, minutes: totals.night },
            { label: 'Samstagszuschlag', sublabel: 'ab 13:00 Uhr', rate: `+${rates.saturdayPercent}%`, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-100', icon: Calendar, minutes: totals.saturday },
            { label: 'Sonntagszuschlag', sublabel: 'ganzer Tag', rate: `+${rates.sundayPercent}%`, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-100', icon: Sun, minutes: totals.sunday },
            { label: 'Feiertagszuschlag', sublabel: 'gesetzl. Feiertage', rate: `+${rates.holidayPercent}%`, color: 'text-red-700', bg: 'bg-red-50 border-red-100', icon: Star, minutes: totals.holiday },
          ].map(c => (
            <div key={c.label} className={`rounded-2xl border p-4 ${c.bg}`}>
              <div className="flex items-center gap-2 mb-1">
                <c.icon className={`w-4 h-4 ${c.color}`} />
                <span className={`text-xs font-bold ${c.color}`}>{c.rate}</span>
              </div>
              <div className={`text-lg font-bold ${c.color}`}>{minutesToHours(c.minutes)}</div>
              <div className="text-xs font-medium text-gray-500">{c.label}</div>
              <div className="text-[10px] text-gray-400">{c.sublabel}</div>
            </div>
          ))}
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
          <Euro className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Die Zuschlagsstunden werden automatisch aus den Zeiterfassungseinträgen berechnet. Kategorien können sich überlappen (z.B. Nacht + Sonntag). Für die Lohnberechnung multiplizieren Sie die Stunden mit dem jeweiligen Prozentsatz und dem Stundengrundlohn.</span>
        </div>

        {/* Table */}
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-semibold text-navy">Mitarbeiter-Übersicht · {MONTH_NAMES[month - 1]} {year}</h3>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-navy border-t-brand rounded-full animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon={Euro} title="Keine Einträge" description="Für diesen Monat gibt es keine Zeiterfassungsdaten." className="py-12" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Mitarbeiter</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Gesamt</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-indigo-600 uppercase tracking-wide">
                      <Moon className="w-3 h-3 inline mr-1" />Nacht
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-amber-600 uppercase tracking-wide">
                      <Calendar className="w-3 h-3 inline mr-1" />Samstag
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-orange-600 uppercase tracking-wide">
                      <Sun className="w-3 h-3 inline mr-1" />Sonntag
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-red-600 uppercase tracking-wide">
                      <Star className="w-3 h-3 inline mr-1" />Feiertag
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.employeeId} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-5 py-3 font-medium text-navy">{row.employeeName}</td>
                      <td className="px-4 py-3 text-right text-gray-500 text-xs">{minutesToHours(row.totalWorkedMinutes)}</td>
                      <td className="px-4 py-3 text-right">
                        <SurchargeCell minutes={row.nightMinutes} percent={rates.nightPercent} color="text-indigo-600" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <SurchargeCell minutes={row.saturdayMinutes} percent={rates.saturdayPercent} color="text-amber-600" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <SurchargeCell minutes={row.sundayMinutes} percent={rates.sundayPercent} color="text-orange-600" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <SurchargeCell minutes={row.holidayMinutes} percent={rates.holidayPercent} color="text-red-600" />
                      </td>
                    </tr>
                  ))}
                </tbody>
                {hasAny && (
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td className="px-5 py-3 text-xs font-bold text-gray-600 uppercase tracking-wide">Gesamt</td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-right font-bold text-indigo-700 text-xs">{minutesToHours(totals.night)}</td>
                      <td className="px-4 py-3 text-right font-bold text-amber-700 text-xs">{minutesToHours(totals.saturday)}</td>
                      <td className="px-4 py-3 text-right font-bold text-orange-700 text-xs">{minutesToHours(totals.sunday)}</td>
                      <td className="px-4 py-3 text-right font-bold text-red-700 text-xs">{minutesToHours(totals.holiday)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </Card>

        <p className="text-xs text-gray-400">
          Grundlage: §§ 3b, 19 EStG · Nachtzuschlag 22–06 Uhr · Samstagszuschlag ab 13 Uhr · Sonntags- und Feiertagszuschlag gelten für den gesamten Tag.
          Feiertage werden nach Bundesland ({bundesland ?? 'nicht ermittelt'}) berechnet.
        </p>
      </div>
    </DashboardLayout>
  )
}
