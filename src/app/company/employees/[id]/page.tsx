'use client'

import { useState, useMemo, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  SHIFTS, SCHEDULE_ENTRIES, VACATION_REQUESTS, TIME_LOGS,
  getTimeLogsByMonth,
} from '@/lib/mock-data'
import type { Employee, Location } from '@/lib/types'
import { formatDate, formatHours } from '@/lib/utils'
import {
  ArrowLeft, Clock, TrendingUp, Palmtree, Calendar, Baby, Download,
  CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight,
} from 'lucide-react'

type Tab = 'overview' | 'timelogs' | 'shifts' | 'vacation'

const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

interface EmployeeHumanContext {
  strengths: string[]
  lifeCircumstances: string[]
  preferredGroups: string[]
  preferredActivities: string[]
  shiftPreferences: string[]
  agreements: string | null
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [EMPLOYEES, setEMPLOYEES] = useState<Employee[]>([])
  const [LOCATIONS, setLOCATIONS] = useState<Location[]>([])

  const employee = EMPLOYEES.find(e => e.id === id)
  const location = LOCATIONS.find(l => l.id === employee?.locationId)
  const locationShifts = SHIFTS.filter(s => s.locationId === employee?.locationId)

  const today = new Date()
  const [tab, setTab] = useState<Tab>('overview')
  const [logYear, setLogYear] = useState(today.getFullYear())
  const [logMonth, setLogMonth] = useState(today.getMonth() + 1)
  const [humanContext, setHumanContext] = useState<EmployeeHumanContext | null>(null)

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => setEMPLOYEES(d.employees))
    fetch('/api/locations').then(r => r.json()).then(d => setLOCATIONS(d.locations))
  }, [])

  useEffect(() => {
    if (!employee) return
    fetch(`/api/employee-human-context?employeeId=${employee.id}`)
      .then(res => res.json())
      .then(data => setHumanContext(data.contexts?.[0] ?? null))
      .catch(() => setHumanContext(null))
  }, [employee?.id])

  const monthLogs = useMemo(
    () => employee ? getTimeLogsByMonth(employee.id, logYear, logMonth) : [],
    [employee, logYear, logMonth]
  )

  const allLogs = useMemo(
    () => employee ? TIME_LOGS.filter(t => t.employeeId === employee.id).sort((a, b) => b.date.localeCompare(a.date)) : [],
    [employee]
  )

  const scheduleEntries = useMemo(
    () => SCHEDULE_ENTRIES.filter(e => e.employeeId === id).sort((a, b) => b.date.localeCompare(a.date)),
    [id]
  )

  const vacationRequests = useMemo(
    () => VACATION_REQUESTS.filter(v => v.employeeId === id).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    [id]
  )

  if (!employee) {
    return (
      <div className="p-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-navy mb-4">
          <ArrowLeft size={16} /> Zurück
        </button>
        <p className="text-gray-500">Mitarbeiter nicht gefunden.</p>
      </div>
    )
  }

  const balanceColor = employee.hoursBalance < 0 ? 'text-red-500' : 'text-green-600'
  const remainingVacation = employee.vacationDaysTotal - employee.vacationDaysUsed
  const monthTotalMin = monthLogs.reduce((s, l) => s + (l.totalMinutes ?? 0), 0)
  const expectedMonthMin = Math.round((employee.weeklyHours / 5) * 8 * 60 * monthLogs.length)

  const prevMonth = () => {
    if (logMonth === 1) { setLogMonth(12); setLogYear(y => y - 1) }
    else setLogMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (logMonth === 12) { setLogMonth(1); setLogYear(y => y + 1) }
    else setLogMonth(m => m + 1)
  }

  const downloadCSV = () => {
    const lines = ['Datum,Einstempeln,Ausstempeln,Stunden,Notiz']
    monthLogs.forEach(l => {
      const h = l.totalMinutes ? (l.totalMinutes / 60).toFixed(2) : '–'
      lines.push(`${l.date},${l.clockIn},${l.clockOut ?? '–'},${h},${l.note ?? ''}`)
    })
    lines.push('')
    lines.push(`Gesamt,,,${ (monthTotalMin / 60).toFixed(2) },`)
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `zeitprotokoll_${employee.name.replace(' ', '_')}_${logYear}-${String(logMonth).padStart(2, '0')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadYearlySummary = () => {
    const lines = [`Jahres-Summary ${today.getFullYear()} – ${employee.name}`, '']
    lines.push(`Position: ${employee.position}`)
    lines.push(`Einrichtung: ${location?.name ?? '–'}`)
    lines.push(`Wochenstunden: ${employee.weeklyHours}h`)
    lines.push(`Stundenkonto: ${employee.hoursBalance >= 0 ? '+' : ''}${employee.hoursBalance}h`)
    lines.push(`Urlaub gesamt: ${employee.vacationDaysTotal} Tage`)
    lines.push(`Urlaub genommen: ${employee.vacationDaysUsed} Tage`)
    lines.push(`Resturlaub: ${remainingVacation} Tage`)
    lines.push('')
    lines.push('Monat,Tage gearbeitet,Stunden gesamt')
    for (let m = 1; m <= 12; m++) {
      const mLogs = getTimeLogsByMonth(employee.id, today.getFullYear(), m)
      const mMin = mLogs.reduce((s, l) => s + (l.totalMinutes ?? 0), 0)
      lines.push(`${MONTH_NAMES[m - 1]},${mLogs.length},${(mMin / 60).toFixed(1)}h`)
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `jahressummary_${employee.name.replace(' ', '_')}_${today.getFullYear()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const statusIcon = { approved: CheckCircle, denied: XCircle, pending: AlertCircle }
  const statusColor = { approved: 'text-green-500', denied: 'text-red-500', pending: 'text-amber-500' }
  const statusLabel = { approved: 'Genehmigt', denied: 'Abgelehnt', pending: 'Ausstehend' }

  return (
    <>
      <Header
        title={employee.name}
        subtitle={`${employee.position} · ${location?.name ?? '–'}`}
      />
      <div className="p-4 sm:p-6 space-y-4">

        {/* Back + Quick actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => router.push('/company')}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-navy font-medium transition-colors"
          >
            <ArrowLeft size={16} /> Alle Mitarbeiter
          </button>
          <Button variant="ghost" size="sm" onClick={downloadYearlySummary} className="gap-1.5 border border-gray-200">
            <Download size={14} /> Jahres-Summary
          </Button>
        </div>

        {/* Employee header card */}
        <div className="bg-navy rounded-2xl p-5 text-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-brand flex items-center justify-center font-bold text-navy text-xl flex-shrink-0">
              {employee.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold">{employee.name}</h2>
                {employee.hasChildren && <Baby size={14} className="text-brand opacity-80" />}
              </div>
              <p className="text-navy-100 text-sm">{employee.position} · {location?.name}</p>
              <p className="text-navy-100 text-xs mt-0.5">{employee.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/10">
            {[
              { label: 'Stundenkonto', value: `${employee.hoursBalance >= 0 ? '+' : ''}${employee.hoursBalance}h`, highlight: true },
              { label: 'Wochenstunden', value: `${employee.weeklyHours}h` },
              { label: 'Resturlaub', value: `${remainingVacation}d` },
              { label: 'Dabei seit', value: new Date(employee.joinedAt + 'T00:00:00').toLocaleDateString('de-DE', { month: 'short', year: 'numeric' }) },
            ].map(({ label, value, highlight }) => (
              <div key={label} className="text-center">
                <p className={`text-lg font-bold ${highlight ? (employee.hoursBalance < 0 ? 'text-red-300' : 'text-brand') : 'text-white'}`}>{value}</p>
                <p className="text-[10px] text-white/60 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex bg-white border border-gray-100 rounded-2xl p-1">
          {([
            { key: 'overview' as Tab,  label: 'Übersicht',      badge: undefined as number | undefined },
            { key: 'timelogs' as Tab,  label: 'Zeitprotokoll',  badge: allLogs.length as number | undefined },
            { key: 'shifts' as Tab,    label: 'Dienste',        badge: scheduleEntries.length as number | undefined },
            { key: 'vacation' as Tab,  label: 'Urlaub',         badge: vacationRequests.length as number | undefined },
          ]).map(({ key, label, badge }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-semibold transition-all ${tab === key ? 'bg-navy text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {label}
              {badge !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === key ? 'bg-brand text-navy' : 'bg-gray-100 text-gray-500'}`}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── ÜBERSICHT ──────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Stundenkonto', value: `${employee.hoursBalance >= 0 ? '+' : ''}${employee.hoursBalance}h`, color: balanceColor, icon: TrendingUp },
                { label: 'Wochenstunden', value: `${employee.weeklyHours}h / Woche`, color: 'text-navy', icon: Clock },
                { label: 'Urlaub genommen', value: `${employee.vacationDaysUsed} / ${employee.vacationDaysTotal} Tage`, color: 'text-navy', icon: Palmtree },
                { label: 'Resturlaub', value: `${remainingVacation} Tage`, color: remainingVacation < 5 ? 'text-amber-600' : 'text-green-600', icon: Calendar },
              ].map(({ label, value, color, icon: Icon }) => (
                <div key={label} className="bg-white border border-gray-100 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={14} className="text-gray-400" />
                    <p className="text-xs text-gray-500">{label}</p>
                  </div>
                  <p className={`text-lg font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Urlaubsfortschritt */}
            <Card>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Urlaubskonto</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-100 rounded-full h-3">
                  <div className="h-3 bg-navy rounded-full" style={{ width: `${(employee.vacationDaysUsed / employee.vacationDaysTotal) * 100}%` }} />
                </div>
                <span className="text-sm font-bold text-navy whitespace-nowrap">{employee.vacationDaysUsed} / {employee.vacationDaysTotal}d</span>
              </div>
            </Card>

            {/* Persönliches (Modul 8: Menschliche Dienstplanung) */}
            {humanContext && (humanContext.strengths.length > 0 || humanContext.lifeCircumstances.length > 0 || humanContext.preferredGroups.length > 0 || humanContext.preferredActivities.length > 0 || humanContext.shiftPreferences.length > 0 || humanContext.agreements) && (
              <Card>
                <CardHeader>
                  <CardTitle>Persönliches</CardTitle>
                  <Badge variant="purple">freiwillig angegeben</Badge>
                </CardHeader>
                <div className="space-y-2">
                  {humanContext.strengths.length > 0 && (
                    <p className="text-sm text-gray-600"><span className="font-semibold text-navy">Stärken:</span> {humanContext.strengths.join(', ')}</p>
                  )}
                  {humanContext.lifeCircumstances.length > 0 && (
                    <p className="text-sm text-gray-600"><span className="font-semibold text-navy">Lebenssituation:</span> {humanContext.lifeCircumstances.join(', ')}</p>
                  )}
                  {humanContext.preferredGroups.length > 0 && (
                    <p className="text-sm text-gray-600"><span className="font-semibold text-navy">Bevorzugte Gruppen:</span> {humanContext.preferredGroups.join(', ')}</p>
                  )}
                  {humanContext.preferredActivities.length > 0 && (
                    <p className="text-sm text-gray-600"><span className="font-semibold text-navy">Bevorzugte Tätigkeiten:</span> {humanContext.preferredActivities.join(', ')}</p>
                  )}
                  {humanContext.shiftPreferences.length > 0 && (
                    <p className="text-sm text-gray-600"><span className="font-semibold text-navy">Schicht-Vorlieben:</span> {humanContext.shiftPreferences.join(', ')}</p>
                  )}
                  {humanContext.agreements && (
                    <p className="text-sm text-gray-500 italic">{humanContext.agreements}</p>
                  )}
                </div>
              </Card>
            )}

            {/* Letzte 5 Zeiterfassungen */}
            <Card>
              <CardHeader>
                <CardTitle>Letzte Zeiterfassungen</CardTitle>
                <button onClick={() => setTab('timelogs')} className="text-xs text-brand font-semibold hover:underline">Alle ansehen</button>
              </CardHeader>
              {allLogs.slice(0, 5).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Keine Zeiterfassungen</p>
              ) : (
                <div className="space-y-2">
                  {allLogs.slice(0, 5).map(log => (
                    <div key={log.id} className="flex items-center gap-3 text-sm p-2 rounded-xl bg-gray-50">
                      <div className="w-24 text-xs font-medium text-navy flex-shrink-0">
                        {new Date(log.date + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                      </div>
                      <div className="flex-1 text-xs text-gray-500">
                        {log.clockIn} – {log.clockOut ?? 'läuft'}
                      </div>
                      <div className="text-xs font-semibold text-navy">
                        {log.totalMinutes ? formatHours(log.totalMinutes) : '–'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Letzte Urlaubsanträge */}
            {vacationRequests.slice(0, 3).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Letzte Urlaubsanträge</CardTitle>
                  <button onClick={() => setTab('vacation')} className="text-xs text-brand font-semibold hover:underline">Alle ansehen</button>
                </CardHeader>
                <div className="space-y-2">
                  {vacationRequests.slice(0, 3).map(v => {
                    const StatusIcon = statusIcon[v.status]
                    return (
                      <div key={v.id} className="flex items-center gap-3 p-2 rounded-xl bg-gray-50">
                        <StatusIcon size={16} className={statusColor[v.status]} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-navy">{formatDate(v.startDate)} – {formatDate(v.endDate)}</p>
                          <p className="text-[10px] text-gray-400">{v.days} Tage{v.reason && ` · ${v.reason}`}</p>
                        </div>
                        <Badge variant={v.status === 'approved' ? 'success' : v.status === 'denied' ? 'danger' : 'warning'}>
                          {statusLabel[v.status]}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ── ZEITPROTOKOLL ──────────────────────────────────────────── */}
        {tab === 'timelogs' && (
          <div className="space-y-4">
            {/* Month navigator */}
            <div className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-4 py-3">
              <button onClick={prevMonth} className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
                <ChevronLeft size={18} className="text-gray-500" />
              </button>
              <div className="text-center">
                <p className="font-bold text-navy">{MONTH_NAMES[logMonth - 1]} {logYear}</p>
                <p className="text-xs text-gray-400">{monthLogs.length} Einträge · {formatHours(monthTotalMin)}</p>
              </div>
              <button onClick={nextMonth} className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
                <ChevronRight size={18} className="text-gray-500" />
              </button>
            </div>

            {/* Summary row */}
            {monthLogs.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white border border-gray-100 rounded-2xl p-3 text-center">
                  <p className="text-lg font-bold text-navy">{monthLogs.length}</p>
                  <p className="text-xs text-gray-500">Tage erfasst</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-3 text-center">
                  <p className="text-lg font-bold text-navy">{formatHours(monthTotalMin)}</p>
                  <p className="text-xs text-gray-500">Gesamt</p>
                </div>
                <div className={`rounded-2xl p-3 text-center border ${monthTotalMin >= expectedMonthMin ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
                  <p className={`text-lg font-bold ${monthTotalMin >= expectedMonthMin ? 'text-green-600' : 'text-amber-600'}`}>
                    {monthTotalMin >= expectedMonthMin ? '+' : ''}{formatHours(monthTotalMin - expectedMonthMin)}
                  </p>
                  <p className="text-xs text-gray-500">Differenz</p>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={downloadCSV} className="gap-1.5 border border-gray-200">
                <Download size={14} /> CSV exportieren
              </Button>
            </div>

            {/* Time log table */}
            <Card padding="none">
              {monthLogs.length === 0 ? (
                <div className="text-center py-12">
                  <Clock size={32} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400">Keine Einträge für diesen Monat</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left p-3 text-xs font-semibold text-gray-500">Datum</th>
                        <th className="text-center p-3 text-xs font-semibold text-gray-500">Einstempeln</th>
                        <th className="text-center p-3 text-xs font-semibold text-gray-500">Ausstempeln</th>
                        <th className="text-right p-3 text-xs font-semibold text-gray-500">Stunden</th>
                        <th className="text-right p-3 text-xs font-semibold text-gray-500">Differenz</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthLogs.map((log, idx) => {
                        const expectedMin = Math.round((employee.weeklyHours / 5) * 60)
                        const diff = (log.totalMinutes ?? 0) - expectedMin
                        return (
                          <tr key={log.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                            <td className="p-3 text-sm text-navy font-medium">
                              {new Date(log.date + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                            </td>
                            <td className="p-3 text-center text-sm text-gray-600">{log.clockIn}</td>
                            <td className="p-3 text-center text-sm text-gray-600">{log.clockOut ?? <span className="text-amber-500 text-xs">läuft</span>}</td>
                            <td className="p-3 text-right text-sm font-semibold text-navy">
                              {log.totalMinutes ? formatHours(log.totalMinutes) : '–'}
                            </td>
                            <td className={`p-3 text-right text-xs font-semibold ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {diff >= 0 ? '+' : ''}{formatHours(diff)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-navy/5 border-t-2 border-navy/10">
                        <td colSpan={3} className="p-3 text-xs font-bold text-navy">Gesamt {MONTH_NAMES[logMonth - 1]}</td>
                        <td className="p-3 text-right text-sm font-bold text-navy">{formatHours(monthTotalMin)}</td>
                        <td className={`p-3 text-right text-xs font-bold ${monthTotalMin >= expectedMonthMin ? 'text-green-600' : 'text-red-500'}`}>
                          {monthTotalMin >= expectedMonthMin ? '+' : ''}{formatHours(monthTotalMin - expectedMonthMin)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── DIENSTE ────────────────────────────────────────────────── */}
        {tab === 'shifts' && (
          <Card padding="none">
            {scheduleEntries.length === 0 ? (
              <div className="text-center py-12 p-6">
                <Calendar size={32} className="mx-auto text-gray-200 mb-3" />
                <p className="text-sm text-gray-400">Keine Schichten erfasst</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {scheduleEntries.map(entry => {
                  const shift = locationShifts.find(s => s.id === entry.shiftId)
                  const shiftTypeLabel = { early: 'Frühdienst', late: 'Spätdienst', mid: 'Mitteldienst', night: 'Nachtdienst' }
                  return (
                    <div key={entry.id} className="flex items-center gap-4 p-4">
                      <div className="w-28 text-xs font-medium text-navy flex-shrink-0">
                        {new Date(entry.date + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </div>
                      {shift ? (
                        <div className="flex items-center gap-2 flex-1">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: shift.bgColor, color: shift.color }}>
                            {shiftTypeLabel[shift.type] ?? shift.name}
                          </span>
                          <span className="text-xs text-gray-500">{shift.startTime} – {shift.endTime}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Schicht unbekannt</span>
                      )}
                      <Badge variant={entry.status === 'confirmed' ? 'success' : 'info'}>
                        {entry.status === 'confirmed' ? 'Bestätigt' : 'Geplant'}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        )}

        {/* ── URLAUB ─────────────────────────────────────────────────── */}
        {tab === 'vacation' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Urlaubsanspruch', value: `${employee.vacationDaysTotal}d`, color: 'text-navy' },
                { label: 'Genommen', value: `${employee.vacationDaysUsed}d`, color: 'text-navy' },
                { label: 'Resturlaub', value: `${remainingVacation}d`, color: remainingVacation < 5 ? 'text-amber-600' : 'text-green-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white border border-gray-100 rounded-2xl p-3 text-center">
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>

            <div className="w-full bg-gray-100 rounded-full h-3">
              <div className="h-3 rounded-full bg-navy" style={{ width: `${(employee.vacationDaysUsed / employee.vacationDaysTotal) * 100}%` }} />
            </div>

            <Card padding="none">
              {vacationRequests.length === 0 ? (
                <div className="text-center py-12 p-6">
                  <Palmtree size={32} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400">Keine Urlaubsanträge</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {vacationRequests.map(v => {
                    const StatusIcon = statusIcon[v.status]
                    return (
                      <div key={v.id} className="p-4 flex items-start gap-3">
                        <StatusIcon size={18} className={`${statusColor[v.status]} flex-shrink-0 mt-0.5`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-navy">
                              {formatDate(v.startDate)} – {formatDate(v.endDate)}
                            </p>
                            <Badge variant={v.status === 'approved' ? 'success' : v.status === 'denied' ? 'danger' : 'warning'}>
                              {statusLabel[v.status]}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{v.days} Arbeitstage{v.reason && ` · "${v.reason}"`}</p>
                          <p className="text-xs text-gray-400 mt-0.5">Eingereicht: {formatDate(v.submittedAt)}</p>
                          {v.respondedBy && (
                            <p className="text-xs text-gray-400">Bearbeitet von: {v.respondedBy}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </>
  )
}
