'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { ChevronLeft, ChevronRight, CalendarDays, List, X } from 'lucide-react'

interface ScheduleEntry {
  id: string
  employeeId: string
  shiftId: string
  date: string
  startTime?: string
  endTime?: string
  gruppe?: string
  funktion?: string
  isSubstitution?: boolean
  status: string
}

interface Shift {
  id: string
  name: string
  type: string
  startTime: string
  endTime: string
  color: string
  bgColor: string
}

interface Employee {
  id: string
  name: string
  gruppe?: string
}

interface DayEntry {
  entry: ScheduleEntry
  shift: Shift
  employee: Employee
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

function isoDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function getMonthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  // Monday = 0
  const startDow = (first.getDay() + 6) % 7
  const rows: (Date | null)[][] = []
  let row: (Date | null)[] = Array(startDow).fill(null)
  for (let d = 1; d <= last.getDate(); d++) {
    row.push(new Date(year, month, d))
    if (row.length === 7) { rows.push(row); row = [] }
  }
  if (row.length > 0) {
    while (row.length < 7) row.push(null)
    rows.push(row)
  }
  return rows
}

export default function CalendarPage() {
  const { user } = useAuth()
  const [today] = useState(new Date())
  const [current, setCurrent] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'month' | 'week'>('month')

  const locationId = (user as any)?.locationId as string | undefined

  const loadData = useCallback(async (year: number, month: number) => {
    if (!locationId) return
    setLoading(true)
    try {
      const dateFrom = isoDate(new Date(year, month, 1))
      const dateTo = isoDate(new Date(year, month + 1, 0))
      const [entriesRes, shiftsRes, employeesRes] = await Promise.all([
        fetch(`/api/schedule-entries?locationId=${locationId}&dateFrom=${dateFrom}&dateTo=${dateTo}`),
        fetch(`/api/shifts?locationId=${locationId}`),
        fetch(`/api/employees?locationId=${locationId}`),
      ])
      if (entriesRes.ok) {
        const d = await entriesRes.json()
        setEntries(d.entries ?? [])
      }
      if (shiftsRes.ok) {
        const d = await shiftsRes.json()
        setShifts(d.shifts ?? [])
      }
      if (employeesRes.ok) {
        const d = await employeesRes.json()
        setEmployees(d.employees ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [locationId])

  useEffect(() => {
    loadData(current.getFullYear(), current.getMonth())
  }, [current, loadData])

  const shiftMap = Object.fromEntries(shifts.map(s => [s.id, s]))
  const employeeMap = Object.fromEntries(employees.map(e => [e.id, e]))

  function dayEntries(dateStr: string): DayEntry[] {
    return entries
      .filter(e => e.date === dateStr)
      .map(e => ({
        entry: e,
        shift: shiftMap[e.shiftId] ?? { id: e.shiftId, name: '?', type: 'mid', startTime: '', endTime: '', color: '#666', bgColor: '#eee' },
        employee: employeeMap[e.employeeId] ?? { id: e.employeeId, name: 'Unbekannt' },
      }))
  }

  function prevMonth() {
    setCurrent(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))
    setSelectedDay(null)
  }
  function nextMonth() {
    setCurrent(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))
    setSelectedDay(null)
  }

  const grid = getMonthGrid(current.getFullYear(), current.getMonth())
  const todayStr = isoDate(today)

  // Week view: current week or week of selected day
  function getWeekStart(ref: Date): Date {
    const d = new Date(ref)
    const dow = (d.getDay() + 6) % 7
    d.setDate(d.getDate() - dow)
    return d
  }
  const weekRef = selectedDay ? new Date(selectedDay) : today
  const weekStart = getWeekStart(weekRef)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  const selectedDayEntries = selectedDay ? dayEntries(selectedDay) : []

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-50">
      {/* Main calendar area */}
      <div className={`flex-1 flex flex-col min-w-0 ${selectedDay ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h1 className="text-lg font-semibold text-gray-900 w-44 text-center">
                {MONTH_NAMES[current.getMonth()]} {current.getFullYear()}
              </h1>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={() => { setCurrent(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDay(todayStr) }}
              className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Heute
            </button>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setView('month')}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors ${view === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <CalendarDays className="w-3.5 h-3.5" /> Monat
            </button>
            <button
              onClick={() => setView('week')}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors ${view === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <List className="w-3.5 h-3.5" /> Woche
            </button>
          </div>
        </div>

        {loading && (
          <div className="h-1 bg-gray-100">
            <div className="h-full bg-teal-500 animate-pulse w-1/2 mx-auto rounded" />
          </div>
        )}

        {/* Month view */}
        {view === 'month' && (
          <div className="flex-1 overflow-auto p-4">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map(d => (
                <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
              ))}
            </div>
            {/* Calendar grid */}
            <div className="space-y-1">
              {grid.map((row, ri) => (
                <div key={ri} className="grid grid-cols-7 gap-1">
                  {row.map((day, ci) => {
                    if (!day) return <div key={ci} className="aspect-[4/3] min-h-[70px]" />
                    const ds = isoDate(day)
                    const dayData = dayEntries(ds)
                    const isToday = ds === todayStr
                    const isSelected = ds === selectedDay
                    const isPast = day < today && !isToday
                    return (
                      <button
                        key={ci}
                        onClick={() => setSelectedDay(ds === selectedDay ? null : ds)}
                        className={`aspect-[4/3] min-h-[70px] rounded-xl border p-1.5 text-left transition-all ${
                          isSelected
                            ? 'border-teal-400 bg-teal-50 shadow-sm'
                            : isToday
                            ? 'border-teal-300 bg-white shadow-sm'
                            : 'border-gray-100 bg-white hover:border-gray-300 hover:shadow-sm'
                        } ${isPast ? 'opacity-60' : ''}`}
                      >
                        <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                          isToday ? 'bg-teal-600 text-white' : isSelected ? 'text-teal-700' : 'text-gray-700'
                        }`}>
                          {day.getDate()}
                        </div>
                        {dayData.length > 0 && (
                          <div className="space-y-0.5">
                            {dayData.slice(0, 3).map((d, i) => (
                              <div
                                key={i}
                                className="text-[9px] leading-tight rounded px-1 py-0.5 truncate font-medium"
                                style={{ backgroundColor: d.shift.bgColor, color: d.shift.color }}
                              >
                                {d.employee.name.split(' ')[0]}
                              </div>
                            ))}
                            {dayData.length > 3 && (
                              <div className="text-[9px] text-gray-400 font-medium pl-1">+{dayData.length - 3}</div>
                            )}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Week view */}
        {view === 'week' && (
          <div className="flex-1 overflow-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setSelectedDay(isoDate(d)) }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600 font-medium">
                {weekDays[0].getDate()}.{weekDays[0].getMonth() + 1}. – {weekDays[6].getDate()}.{weekDays[6].getMonth() + 1}. {weekDays[6].getFullYear()}
              </span>
              <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setSelectedDay(isoDate(d)) }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-7 border-b border-gray-100">
                {weekDays.map((d, i) => {
                  const ds = isoDate(d)
                  const isToday = ds === todayStr
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDay(ds)}
                      className={`py-2 text-center transition-colors ${isToday ? 'bg-teal-50' : 'hover:bg-gray-50'}`}
                    >
                      <div className="text-xs text-gray-400">{WEEKDAYS[i]}</div>
                      <div className={`text-sm font-semibold ${isToday ? 'text-teal-600' : 'text-gray-800'}`}>{d.getDate()}</div>
                      <div className="text-xs text-gray-400">{dayEntries(ds).length || ''}</div>
                    </button>
                  )
                })}
              </div>
              <div className="grid grid-cols-7 divide-x divide-gray-100">
                {weekDays.map((d, i) => {
                  const ds = isoDate(d)
                  const data = dayEntries(ds)
                  return (
                    <div key={i} className="p-1.5 min-h-[200px] space-y-1">
                      {data.map((de, j) => (
                        <button
                          key={j}
                          onClick={() => setSelectedDay(ds)}
                          className="w-full text-left rounded-lg px-1.5 py-1 text-[10px] leading-tight hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: de.shift.bgColor, color: de.shift.color }}
                        >
                          <div className="font-semibold truncate">{de.employee.name.split(' ')[0]}</div>
                          <div className="opacity-75">{de.shift.startTime}–{de.shift.endTime}</div>
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Day detail panel */}
      {selectedDay && (
        <div className="w-full md:w-80 flex flex-col bg-white border-l border-gray-200 shrink-0">
          <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">
                {WEEKDAYS[(new Date(selectedDay).getDay() + 6) % 7]}
              </p>
              <h2 className="text-lg font-bold text-gray-900">
                {new Date(selectedDay).getDate()}. {MONTH_NAMES[new Date(selectedDay).getMonth()]}
              </h2>
            </div>
            <button onClick={() => setSelectedDay(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 md:hidden">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {selectedDayEntries.length === 0 ? (
              <div className="text-center py-12">
                <CalendarDays className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Keine Dienste geplant</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Group by shift */}
                {Object.entries(
                  selectedDayEntries.reduce<Record<string, DayEntry[]>>((acc, de) => {
                    const key = de.shift.id
                    if (!acc[key]) acc[key] = []
                    acc[key].push(de)
                    return acc
                  }, {})
                ).map(([shiftId, items]) => {
                  const shift = shiftMap[shiftId] ?? items[0].shift
                  return (
                    <div key={shiftId} className="rounded-xl overflow-hidden border border-gray-100">
                      <div className="px-3 py-2 flex items-center justify-between" style={{ backgroundColor: shift.bgColor }}>
                        <span className="text-xs font-semibold" style={{ color: shift.color }}>{shift.name}</span>
                        <span className="text-xs font-mono" style={{ color: shift.color, opacity: 0.8 }}>
                          {shift.startTime}–{shift.endTime}
                        </span>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {items.map((de, i) => (
                          <div key={i} className="px-3 py-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-800">{de.employee.name}</span>
                              {de.entry.isSubstitution && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Vertretung</span>
                              )}
                            </div>
                            {(de.entry.gruppe || de.entry.funktion) && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {[de.entry.gruppe, de.entry.funktion].filter(Boolean).join(' · ')}
                              </p>
                            )}
                            {(de.entry.startTime || de.entry.endTime) && (
                              <p className="text-xs text-gray-400 mt-0.5 font-mono">
                                {de.entry.startTime ?? shift.startTime}–{de.entry.endTime ?? shift.endTime}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
                <p className="text-xs text-gray-400 text-center pt-2">
                  {selectedDayEntries.length} {selectedDayEntries.length === 1 ? 'Mitarbeiter' : 'Mitarbeiter'} eingeplant
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
