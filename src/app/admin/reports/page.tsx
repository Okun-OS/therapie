'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/lib/auth-context'
import { Employee, TimeLog, Absence, OvertimeRequest } from '@/lib/types'
import { Download, BarChart3, TrendingUp, Clock, Users, Calendar, Stethoscope, AlertTriangle } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

export default function AdminReports() {
  const { user } = useAuth()
  const locationId = user?.locationId
  const [EMPLOYEES, setEMPLOYEES] = useState<Employee[]>([])
  const [logs, setLogs] = useState<TimeLog[]>([])
  const [absencesByEmployee, setAbsencesByEmployee] = useState<Record<string, Absence[]>>({})
  const [overtimeByEmployee, setOvertimeByEmployee] = useState<Record<string, OvertimeRequest[]>>({})

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => setEMPLOYEES(d.employees))
  }, [])

  useEffect(() => {
    if (!locationId) return
    fetch(`/api/time-logs`).then(r => r.json()).then(d => setLogs((d.logs ?? []).filter((l: TimeLog) => l.locationId === locationId)))
  }, [locationId])

  useEffect(() => {
    if (!locationId) return
    fetch(`/api/absences?locationId=${locationId}`).then(r => r.json()).then(d => {
      const byEmployee: Record<string, Absence[]> = {}
      for (const a of (d.absences ?? []) as Absence[]) {
        (byEmployee[a.employeeId] ??= []).push(a)
      }
      setAbsencesByEmployee(byEmployee)
    })
    fetch(`/api/overtime-requests?locationId=${locationId}`).then(r => r.json()).then(d => {
      const byEmployee: Record<string, OvertimeRequest[]> = {}
      for (const o of (d.requests ?? []) as OvertimeRequest[]) {
        (byEmployee[o.employeeId] ??= []).push(o)
      }
      setOvertimeByEmployee(byEmployee)
    })
  }, [locationId])

  const employees = EMPLOYEES.filter(e => e.locationId === locationId && e.role === 'employee')

  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
  const monthlyHours = months.map((_, i) => {
    const monthLogs = logs.filter(l => new Date(l.date + 'T00:00:00').getMonth() === i)
    return Math.round(monthLogs.reduce((s, l) => s + (l.totalMinutes || 0) - (l.breakMinutes || 0), 0) / 60)
  })
  const maxHours = Math.max(...monthlyHours, 1)

  const employeeHours = employees.map(emp => {
    const empLogs = logs.filter(l => l.employeeId === emp.id)
    const total = empLogs.reduce((s, l) => s + (l.totalMinutes || 0) - (l.breakMinutes || 0), 0)
    return { ...emp, totalHours: Math.round(total / 60) }
  }).sort((a, b) => b.totalHours - a.totalHours)

  const totalMonthlyHours = monthlyHours[3] // April
  const avgPerEmployee = employees.length > 0 ? Math.round(totalMonthlyHours / employees.length) : 0

  const currentYear = new Date().getFullYear()
  const absenceStats = employees.map(emp => {
    const absences = (absencesByEmployee[emp.id] ?? []).filter(a => a.startDate.startsWith(`${currentYear}`))
    const sickDays = absences.filter(a => a.type === 'krankheit').reduce((s, a) => s + a.days, 0)
    const otherDays = absences.filter(a => a.type !== 'krankheit').reduce((s, a) => s + a.days, 0)
    const overtimeMinutes = (overtimeByEmployee[emp.id] ?? [])
      .filter(o => (o.status === 'approved' || o.status === 'partial') && o.date.startsWith(`${currentYear}`))
      .reduce((s, o) => s + (o.approvedMinutes ?? 0), 0)
    return { ...emp, sickDays, otherDays, overtimeHours: Math.round(overtimeMinutes / 6) / 10 }
  })
  const totalSickDays = absenceStats.reduce((s, e) => s + e.sickDays, 0)
  const totalOtherDays = absenceStats.reduce((s, e) => s + e.otherDays, 0)

  if (!locationId) {
    return (
      <>
        <Header title="Berichte" subtitle="Kein Standort zugeordnet" />
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={AlertTriangle}
            title="Dein Account ist noch keinem Standort zugeordnet"
            description="Ein OKUN-Administrator muss deinen Account einmalig einem Standort zuordnen, bevor hier Berichte angezeigt werden können. Bitte wende dich an die OKUN-Plattformverwaltung."
          />
        </div>
      </>
    )
  }

  return (
    <>
      <Header title="Berichte" subtitle="Auswertungen & Analysen" />
      <div className="p-4 sm:p-6 space-y-5">

        {/* Export Buttons */}
        <div className="flex gap-3 flex-wrap">
          <Button variant="ghost" size="sm" className="gap-2 border border-gray-200">
            <Download size={14} />
            PDF Export
          </Button>
          <Button variant="ghost" size="sm" className="gap-2 border border-gray-200">
            <Download size={14} />
            Excel Export
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mx-auto mb-2">
              <Clock size={18} className="text-blue-600" />
            </div>
            <p className="text-xl font-bold text-navy">{totalMonthlyHours}h</p>
            <p className="text-xs text-gray-500">April gesamt</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center mx-auto mb-2">
              <TrendingUp size={18} className="text-green-600" />
            </div>
            <p className="text-xl font-bold text-navy">{avgPerEmployee}h</p>
            <p className="text-xs text-gray-500">Ø pro MA</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center mx-auto mb-2">
              <Users size={18} className="text-purple-600" />
            </div>
            <p className="text-xl font-bold text-navy">{employees.length}</p>
            <p className="text-xs text-gray-500">Mitarbeiter</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-2">
              <Calendar size={18} className="text-amber-600" />
            </div>
            <p className="text-xl font-bold text-navy">{logs.length}</p>
            <p className="text-xs text-gray-500">Zeitbuchungen</p>
          </div>
        </div>

        {/* Monthly Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Stunden pro Monat (2026)</CardTitle>
            <Badge variant="info">Stunden</Badge>
          </CardHeader>
          <div className="flex items-stretch gap-1 h-40">
            {monthlyHours.map((h, i) => {
              const height = maxHours > 0 ? (h / maxHours) * 100 : 0
              const isCurrent = i === 3 // April
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full">
                  <span className="text-[10px] text-gray-500 font-medium h-3">{h > 0 ? `${h}h` : ''}</span>
                  <div className="flex-1 w-full flex items-end">
                    <div
                      className={`w-full rounded-t-lg transition-all ${isCurrent ? 'bg-brand' : 'bg-navy-100'}`}
                      style={{ height: `${Math.max(height, 2)}%`, minHeight: h > 0 ? '4px' : '2px' }}
                    />
                  </div>
                  <span className={`text-[10px] font-medium ${isCurrent ? 'text-navy font-bold' : 'text-gray-400'}`}>{months[i]}</span>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Employee Hours Table */}
        <Card>
          <CardHeader>
            <CardTitle>Stunden je Mitarbeiter (April)</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {employeeHours.map(emp => {
              const target = Math.round(emp.weeklyHours * 4.3)
              const pct = target > 0 ? Math.min((emp.totalHours / target) * 100, 100) : 0
              const over = emp.totalHours > target

              return (
                <div key={emp.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-navy flex items-center justify-center text-brand text-[10px] font-bold">
                        {emp.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="text-sm font-medium text-navy">{emp.name}</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-bold ${over ? 'text-amber-600' : 'text-navy'}`}>{emp.totalHours}h</span>
                      <span className="text-xs text-gray-400"> / {target}h</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${over ? 'bg-amber-400' : 'bg-navy'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Vacation Overview */}
        <Card>
          <CardTitle className="mb-4">Urlaubskonto Übersicht</CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px]">
              <thead>
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-500 py-2">Mitarbeiter</th>
                  <th className="text-center text-xs font-semibold text-gray-500 py-2">Gesamt</th>
                  <th className="text-center text-xs font-semibold text-gray-500 py-2">Verbraucht</th>
                  <th className="text-center text-xs font-semibold text-gray-500 py-2">Rest</th>
                  <th className="text-center text-xs font-semibold text-gray-500 py-2">Konto</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <tr key={emp.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 text-sm font-medium text-navy">{emp.name}</td>
                    <td className="py-3 text-center text-sm text-gray-600">{emp.vacationDaysTotal}</td>
                    <td className="py-3 text-center text-sm text-gray-600">{emp.vacationDaysUsed}</td>
                    <td className="py-3 text-center">
                      <span className="text-sm font-bold text-navy">{emp.vacationDaysTotal - emp.vacationDaysUsed}</span>
                    </td>
                    <td className="py-3 text-center">
                      <Badge variant={emp.hoursBalance >= 0 ? 'success' : 'danger'}>
                        {emp.hoursBalance >= 0 ? '+' : ''}{emp.hoursBalance}h
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        {/* Krankheitstage & Fehlzeiten */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Stethoscope size={16} className="text-navy" />
              <CardTitle>Krankheitstage & Fehlzeiten ({currentYear})</CardTitle>
            </div>
            <Badge variant="info">{totalSickDays + totalOtherDays} Tage gesamt</Badge>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px]">
              <thead>
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-500 py-2">Mitarbeiter</th>
                  <th className="text-center text-xs font-semibold text-gray-500 py-2">Krankheitstage</th>
                  <th className="text-center text-xs font-semibold text-gray-500 py-2">Fehlzeiten</th>
                  <th className="text-center text-xs font-semibold text-gray-500 py-2">Überstunden</th>
                </tr>
              </thead>
              <tbody>
                {absenceStats.map(emp => (
                  <tr key={emp.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 text-sm font-medium text-navy">{emp.name}</td>
                    <td className="py-3 text-center text-sm text-gray-600">{emp.sickDays}</td>
                    <td className="py-3 text-center text-sm text-gray-600">{emp.otherDays}</td>
                    <td className="py-3 text-center text-sm text-gray-600">{emp.overtimeHours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}
