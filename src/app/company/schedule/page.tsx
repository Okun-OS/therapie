'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { getWeekDays, toDateString, formatDateShort, getDayName } from '@/lib/utils'
import { Calendar, ChevronLeft, ChevronRight, AlertTriangle, Building2, Users } from 'lucide-react'
import type { Employee, Location, Shift, ScheduleEntry } from '@/lib/types'

type CalView = 'day' | 'week' | 'month'

const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
const WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

function getMonthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startDow = (first.getDay() + 6) % 7
  const rows: (Date | null)[][] = []
  let row: (Date | null)[] = Array(startDow).fill(null)
  for (let d = 1; d <= last.getDate(); d++) {
    row.push(new Date(year, month, d))
    if (row.length === 7) { rows.push(row); row = [] }
  }
  if (row.length) rows.push([...row, ...Array(7 - row.length).fill(null)])
  return rows
}

export default function CompanySchedule() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [calView, setCalView] = useState<CalView>('week')
  const [EMPLOYEES, setEMPLOYEES] = useState<Employee[]>([])
  const [LOCATIONS, setLOCATIONS] = useState<Location[]>([])
  const [SHIFTS, setSHIFTS] = useState<Shift[]>([])
  const [SCHEDULE_ENTRIES, setSCHEDULE_ENTRIES] = useState<ScheduleEntry[]>([])

  const weekDates = getWeekDays(currentDate).map(toDateString)
  const todayStr = toDateString(new Date())
  const dayStr = toDateString(currentDate)

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => setEMPLOYEES(d.employees ?? []))
    fetch('/api/locations').then(r => r.json()).then(d => setLOCATIONS(d.locations ?? []))
    fetch('/api/shifts').then(r => r.json()).then(d => setSHIFTS(d.shifts ?? []))
    fetch('/api/schedule-entries').then(r => r.json()).then(d => setSCHEDULE_ENTRIES(d.entries ?? []))
  }, [])

  const navigate = (dir: -1 | 1) => {
    const d = new Date(currentDate)
    if (calView === 'day') d.setDate(d.getDate() + dir)
    else if (calView === 'week') d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    setCurrentDate(d)
  }

  const locationOverview = LOCATIONS.map(loc => {
    const locShifts = SHIFTS.filter(s => s.locationId === loc.id)
    const days = weekDates.map(date => {
      const entries = SCHEDULE_ENTRIES.filter(e => e.locationId === loc.id && e.date === date)
      const requiredStaff = locShifts.reduce((s, sh) => s + (sh.minStaff ?? 1), 0)
      return { date, scheduledStaff: entries.length, requiredStaff, understaffed: entries.length < requiredStaff }
    })
    return { ...loc, days, understaffedDays: days.filter(d => d.understaffed).length }
  })

  const navLabel = calView === 'day'
    ? new Date(currentDate).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    : calView === 'week'
    ? `${formatDateShort(weekDates[0])} – ${formatDateShort(weekDates[6])}`
    : `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`

  return (
    <>
      <Header title="Dienstpläne aller Standorte" subtitle="Organisationsweite Übersicht · Bearbeitung erfolgt durch die jeweilige Standortleitung" />
      <div className="p-4 sm:p-6 space-y-5">

        {/* Nav bar */}
        <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ChevronLeft size={18} className="text-gray-500" />
          </button>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-gray-400" />
              <p className="text-sm font-semibold text-navy">{navLabel}</p>
            </div>
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 ml-2">
              {(['day', 'week', 'month'] as CalView[]).map(v => (
                <button
                  key={v}
                  onClick={() => setCalView(v)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${calView === v ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {v === 'day' ? 'Tag' : v === 'week' ? 'Woche' : 'Monat'}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => navigate(1)} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ChevronRight size={18} className="text-gray-500" />
          </button>
        </div>

        {/* ── DAY VIEW ── */}
        {calView === 'day' && (
          <div className="space-y-4">
            {LOCATIONS.map(loc => {
              const locShifts = SHIFTS.filter(s => s.locationId === loc.id)
              const dayEntries = SCHEDULE_ENTRIES.filter(e => e.locationId === loc.id && e.date === dayStr)
              const required = locShifts.reduce((s, sh) => s + (sh.minStaff ?? 1), 0)
              const understaffed = dayEntries.length < required
              return (
                <Card key={loc.id}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-navy flex items-center justify-center flex-shrink-0">
                        <Building2 size={16} className="text-brand" />
                      </div>
                      <div>
                        <CardTitle>{loc.name}</CardTitle>
                        <p className="text-xs text-gray-400 mt-0.5">{dayEntries.length} / {required} Mitarbeiter</p>
                      </div>
                    </div>
                    {understaffed
                      ? <Badge variant="danger" className="gap-1"><AlertTriangle size={10} />Unterbesetzt</Badge>
                      : <Badge variant="success">Besetzt</Badge>}
                  </CardHeader>
                  <div className="space-y-2">
                    {dayEntries.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">Keine Einträge für diesen Tag</p>
                    ) : dayEntries.map(entry => {
                      const emp = EMPLOYEES.find(e => e.id === entry.employeeId)
                      const shift = SHIFTS.find(s => s.id === entry.shiftId)
                      return (
                        <div key={entry.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold flex-shrink-0">
                            {emp?.name.split(' ').map(n => n[0]).join('') ?? '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-navy truncate">{emp?.name ?? '–'}</p>
                            {shift && <p className="text-xs text-gray-500">{shift.name} · {entry.startTime ?? shift.startTime} – {entry.endTime ?? shift.endTime} Uhr</p>}
                          </div>
                          {shift && <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: shift.color }} />}
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {/* ── WEEK VIEW ── */}
        {calView === 'week' && (<>
          <div className="space-y-4">
            {locationOverview.map(loc => (
              <Card key={loc.id}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-navy flex items-center justify-center flex-shrink-0">
                      <Building2 size={16} className="text-brand" />
                    </div>
                    <CardTitle>{loc.name}</CardTitle>
                  </div>
                  {loc.understaffedDays > 0 ? (
                    <Badge variant="danger" className="gap-1">
                      <AlertTriangle size={10} />
                      {loc.understaffedDays} Tage unterbesetzt
                    </Badge>
                  ) : (
                    <Badge variant="success">Vollständig besetzt</Badge>
                  )}
                </CardHeader>
                <div className="grid grid-cols-7 gap-2">
                  {loc.days.map(d => (
                    <div key={d.date} className={`rounded-xl p-2 text-center ${d.understaffed ? 'bg-red-50 border border-red-200' : d.date === todayStr ? 'bg-teal-50 border border-teal-200' : 'bg-gray-50'}`}>
                      <p className="text-[10px] text-gray-400 font-medium uppercase">{getDayName(d.date, true)}</p>
                      <p className="text-xs text-gray-500 mb-1">{formatDateShort(d.date)}</p>
                      <p className={`text-sm font-bold ${d.understaffed ? 'text-red-600' : 'text-navy'}`}>
                        {d.scheduledStaff}/{d.requiredStaff}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Mitarbeiter ohne Einteilung diese Woche</CardTitle>
            </CardHeader>
            <div className="space-y-2">
              {EMPLOYEES.filter(e => e.role === 'employee').filter(emp =>
                !SCHEDULE_ENTRIES.some(en => en.employeeId === emp.id && weekDates.includes(en.date))
              ).map(emp => {
                const loc = LOCATIONS.find(l => l.id === emp.locationId)
                return (
                  <div key={emp.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold">
                      {emp.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-navy">{emp.name}</p>
                      <p className="text-xs text-gray-400">{loc?.name}</p>
                    </div>
                  </div>
                )
              })}
              {EMPLOYEES.filter(e => e.role === 'employee').every(emp =>
                SCHEDULE_ENTRIES.some(en => en.employeeId === emp.id && weekDates.includes(en.date))
              ) && (
                <p className="text-sm text-gray-400 text-center py-4">Alle Mitarbeiter eingeteilt ✓</p>
              )}
            </div>
          </Card>
        </>)}

        {/* ── MONTH VIEW ── */}
        {calView === 'month' && (() => {
          const yr = currentDate.getFullYear()
          const mo = currentDate.getMonth()
          const grid = getMonthGrid(yr, mo)
          const monthStart = toDateString(new Date(yr, mo, 1))
          const monthEnd = toDateString(new Date(yr, mo + 1, 0))
          const monthEntries = SCHEDULE_ENTRIES.filter(e => e.date >= monthStart && e.date <= monthEnd)

          return (
            <div className="space-y-4">
              {/* Summary cards per location */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {LOCATIONS.map(loc => {
                  const locEntries = monthEntries.filter(e => e.locationId === loc.id)
                  const locShifts = SHIFTS.filter(s => s.locationId === loc.id)
                  const daysInMonth = new Date(yr, mo + 1, 0).getDate()
                  const totalRequired = daysInMonth * locShifts.reduce((s, sh) => s + (sh.minStaff ?? 1), 0)
                  const coverage = totalRequired > 0 ? Math.round((locEntries.length / totalRequired) * 100) : 100
                  return (
                    <div key={loc.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 size={14} className="text-navy" />
                        <p className="text-sm font-semibold text-navy truncate">{loc.name}</p>
                      </div>
                      <p className="text-2xl font-bold text-navy">{coverage}%</p>
                      <p className="text-xs text-gray-400 mt-0.5">Besetzung · {locEntries.length} Dienste</p>
                    </div>
                  )
                })}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users size={14} className="text-navy" />
                    <p className="text-sm font-semibold text-navy">Gesamt</p>
                  </div>
                  <p className="text-2xl font-bold text-navy">{monthEntries.length}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Dienste im {MONTH_NAMES[mo]}</p>
                </div>
              </div>

              {/* Monthly calendar grid */}
              <Card>
                <CardHeader><CardTitle>Monatsübersicht</CardTitle></CardHeader>
                <div className="grid grid-cols-7 border-b border-gray-100">
                  {WEEKDAY_SHORT.map(d => (
                    <div key={d} className="py-2 text-center text-[10px] font-semibold text-gray-400">{d}</div>
                  ))}
                </div>
                <div className="p-2 space-y-1">
                  {grid.map((row, ri) => (
                    <div key={ri} className="grid grid-cols-7 gap-1">
                      {row.map((day, ci) => {
                        if (!day) return <div key={ci} className="aspect-square" />
                        const ds = toDateString(day)
                        const dayCount = monthEntries.filter(e => e.date === ds).length
                        const isT = ds === todayStr
                        const locShifts = SHIFTS
                        const required = LOCATIONS.reduce((s, loc) => {
                          const ls = locShifts.filter(sh => sh.locationId === loc.id)
                          return s + ls.reduce((a, sh) => a + (sh.minStaff ?? 1), 0)
                        }, 0)
                        const understaffed = required > 0 && dayCount < required
                        return (
                          <div
                            key={ci}
                            className={`aspect-square rounded-xl flex flex-col items-center justify-center p-0.5 ${
                              isT ? 'bg-teal-50 border-2 border-teal-400' : understaffed ? 'bg-red-50 border border-red-200' : dayCount > 0 ? 'bg-gray-50 border border-gray-100' : ''
                            }`}
                          >
                            <span className={`text-[10px] font-semibold ${isT ? 'text-teal-700' : understaffed ? 'text-red-600' : 'text-gray-600'}`}>{day.getDate()}</span>
                            {dayCount > 0 && (
                              <span className={`text-[8px] font-bold ${understaffed ? 'text-red-500' : 'text-navy'}`}>{dayCount}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-teal-50 border-2 border-teal-400" />Heute</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-50 border border-red-200" />Unterbesetzt</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-gray-50 border border-gray-200" />Besetzt</div>
                </div>
              </Card>
            </div>
          )
        })()}

      </div>
    </>
  )
}
