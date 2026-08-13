'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { SwapModal } from '@/components/schedule/SwapModal'
import { SwapList } from '@/components/schedule/SwapList'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/lib/toast-context'
import { useSearchParams } from 'next/navigation'
import type { ShiftType, Employee, Location, Shift, SwapRequest, WishSubmission } from '@/lib/types'
import { googleCalendarLink, appleCalendarDownload } from '@/lib/calendar-export'
import {
  ChevronLeft, ChevronRight, Sun, Moon, Briefcase, MessageSquare,
  CalendarPlus, ArrowLeftRight, Info, CheckCircle, XCircle, Clock,
  Download, ExternalLink, Apple, AlertTriangle,
} from 'lucide-react'
import {
  getWeekDays, toDateString, formatDateShort, formatDate,
  getDayName, isToday,
} from '@/lib/utils'
import { getPublicHolidayName } from '@/lib/holidays'
import type { ScheduleEntry } from '@/lib/types'

const SHIFT_ICONS: Record<string, React.ElementType> = { early: Sun, late: Moon, mid: Briefcase }

type Tab = 'schedule' | 'swaps' | 'wishes' | 'team'
type CalView = 'day' | 'week' | 'month'

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
const MONTH_NAMES_FULL = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
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
  if (row.length > 0) {
    while (row.length < 7) row.push(null)
    rows.push(row)
  }
  return rows
}

export default function EmployeeSchedule() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') as Tab) || 'schedule'
  const [currentDate, setCurrentDate] = useState(new Date())
  const [tab, setTab] = useState<Tab>(initialTab)
  const [selectedEntry, setSelectedEntry] = useState<ScheduleEntry | null>(null)
  const [swapEntry, setSwapEntry] = useState<ScheduleEntry | null>(null)
  const [wishModal, setWishModal] = useState(false)
  const [wish, setWish] = useState({ type: '', date: '', dateFrom: '', dateTo: '', reason: '', importance: 'normal', mode: 'single' as 'single' | 'range' })
  const [planningProfile, setPlanningProfile] = useState<{ shiftPreference: string } | null>(null)
  const [prefSaving, setPrefSaving] = useState(false)
  const [calendarModal, setCalendarModal] = useState(false)
  const [calView, setCalView] = useState<CalView>('week')
  const [swaps, setSwaps] = useState<SwapRequest[]>([])
  const [myWishes, setMyWishes] = useState<WishSubmission[]>([])
  const [EMPLOYEES, setEMPLOYEES] = useState<Employee[]>([])
  const [LOCATIONS, setLOCATIONS] = useState<Location[]>([])
  const [SHIFTS, setSHIFTS] = useState<Shift[]>([])
  const [SCHEDULE_ENTRIES, setSCHEDULE_ENTRIES] = useState<ScheduleEntry[]>([])

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => setEMPLOYEES(d.employees))
    fetch('/api/locations').then(r => r.json()).then(d => setLOCATIONS(d.locations))
    fetch('/api/shifts').then(r => r.json()).then(d => setSHIFTS(d.shifts))
  }, [])

  useEffect(() => {
    if (!user?.employeeId) return
    fetch(`/api/swap-requests?employeeId=${user.employeeId}`).then(r => r.json()).then(d => setSwaps(d.requests))
    fetch(`/api/wish-submissions?employeeId=${user.employeeId}`).then(r => r.json()).then(d => setMyWishes(d.wishes))
    // §61: load persistent planning profile
    fetch(`/api/employee-planning-profile?employeeId=${user.employeeId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.profile) setPlanningProfile({ shiftPreference: d.profile.shiftPreference ?? 'keine' }) })
      .catch(() => {})
  }, [user?.employeeId])

  const employee = EMPLOYEES.find(e => e.id === user?.employeeId)
  const location = LOCATIONS.find(l => l.id === employee?.locationId)

  useEffect(() => {
    if (!employee?.locationId) return
    fetch(`/api/schedule-entries?locationId=${employee.locationId}`).then(r => r.json()).then(d => setSCHEDULE_ENTRIES(d.entries))
  }, [employee?.locationId])

  const myEntries = SCHEDULE_ENTRIES.filter(s => s.employeeId === user?.employeeId)

  const weekDays = getWeekDays(currentDate)
  const weekStart = toDateString(weekDays[0])
  const weekEnd = toDateString(weekDays[6])

  const weekEntries = myEntries.filter(e => e.date >= weekStart && e.date <= weekEnd)

  // All colleague entries for the same week (for swap)
  const colleagueEntries = SCHEDULE_ENTRIES.filter(e =>
    e.locationId === employee?.locationId && e.employeeId !== user?.employeeId && e.date >= weekStart && e.date <= weekEnd
  )
  const colleagues = EMPLOYEES.filter(e => e.locationId === employee?.locationId && e.id !== user?.employeeId && e.role === 'employee')

  const go = (delta: number) => {
    const d = new Date(currentDate)
    if (calView === 'day') d.setDate(d.getDate() + delta)
    else if (calView === 'month') d.setMonth(d.getMonth() + delta)
    else d.setDate(d.getDate() + delta * 7)
    setCurrentDate(d)
  }

  const getEntry = (dateStr: string) => myEntries.find(e => e.date === dateStr)
  const getShift = (shiftId: string) => SHIFTS.find(s => s.id === shiftId)

  const selectedShift = selectedEntry ? getShift(selectedEntry.shiftId) : null
  const swapShift = swapEntry ? getShift(swapEntry.shiftId) : null

  const totalHours = weekEntries.reduce((sum, e) => {
    const shift = getShift(e.shiftId)
    if (!shift) return sum
    const [sh, sm] = shift.startTime.split(':').map(Number)
    const [eh, em] = shift.endTime.split(':').map(Number)
    return sum + (eh * 60 + em - sh * 60 - sm)
  }, 0)

  const handleSwapSubmit = async (targetEmpId: string, targetDate: string, targetShiftId: string, message: string) => {
    if (!swapEntry || !employee) return
    const newSwap = await fetch('/api/swap-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesterId: employee.id,
        requesterName: employee.name,
        requesterDate: swapEntry.date,
        requesterShiftId: swapEntry.shiftId,
        targetEmployeeId: targetEmpId,
        targetEmployeeName: colleagues.find(c => c.id === targetEmpId)?.name ?? '',
        targetDate,
        targetShiftId,
        message,
        locationId: employee.locationId,
      }),
    }).then(r => r.json()).then(d => d.request)
    setSwaps(prev => [newSwap, ...prev])
  }

  const handleWishSubmit = async () => {
    if (!wish.type) {
      showToast('Bitte Diensttyp auswählen', 'error')
      return
    }
    if (wish.mode === 'single' && !wish.date) {
      showToast('Bitte Datum auswählen', 'error')
      return
    }
    if (wish.mode === 'range' && (!wish.dateFrom || !wish.dateTo)) {
      showToast('Bitte Zeitraum (Von – Bis) auswählen', 'error')
      return
    }
    if (!employee?.locationId) return

    // §59: range wishes → EmployeeRequest with dateFrom/dateTo
    if (wish.mode === 'range') {
      await fetch('/api/employee-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employee.id,
          locationId: employee.locationId,
          customerId: employee.customerId ?? '',
          type: wish.type === 'free' || wish.type === 'no_early_after_late' ? 'day_off_wish' : 'shift_wish',
          dateFrom: wish.dateFrom,
          dateTo: wish.dateTo,
          reason: wish.reason || undefined,
          priority: wish.importance === 'urgent' ? 'critical' : wish.importance === 'important' ? 'high' : 'normal',
        }),
      })
      showToast('Wunsch gespeichert', 'success')
      setWishModal(false)
      setWish({ type: '', date: '', dateFrom: '', dateTo: '', reason: '', importance: 'normal', mode: 'single' })
      return
    }

    const validShiftTypes: ShiftType[] = ['early', 'late', 'mid', 'frei']
    const preferredShiftType = wish.type === 'free' ? 'frei'
      : (validShiftTypes as string[]).includes(wish.type) ? (wish.type as ShiftType)
      : 'mid'
    const specialNote = wish.type === 'no_early_after_late' ? 'Kein Frühdienst nach Spätdienst gewünscht. ' : ''

    const submission = await fetch('/api/wish-submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: employee.id,
        employeeName: employee.name,
        locationId: employee.locationId,
        date: wish.date,
        preferredShiftType,
        reason: `${specialNote}${wish.reason}`.trim() || undefined,
        importance: wish.importance as 'normal' | 'important' | 'urgent',
      }),
    }).then(r => r.json()).then(d => d.wish)

    showToast('Wunsch gespeichert', 'success')
    setWishModal(false)
    setWish({ type: '', date: '', dateFrom: '', dateTo: '', reason: '', importance: 'normal', mode: 'single' })
    setMyWishes(prev => [submission, ...prev])
  }

  const handleSavePref = async (shiftPreference: string) => {
    if (!user?.employeeId || prefSaving) return
    setPrefSaving(true)
    try {
      await fetch('/api/employee-planning-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: user.employeeId, shiftPreference }),
      })
      setPlanningProfile(p => p ? { ...p, shiftPreference } : { shiftPreference })
      showToast('Präferenz gespeichert', 'success')
    } finally {
      setPrefSaving(false)
    }
  }

  const handleAcceptSwap = async (id: string) => {
    await fetch(`/api/swap-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'accepted' }),
    })
    setSwaps(p => p.map(s => s.id === id ? { ...s, status: 'accepted' as const } : s))
  }

  const handleDeclineSwap = async (id: string) => {
    await fetch(`/api/swap-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'declined' }),
    })
    setSwaps(p => p.map(s => s.id === id ? { ...s, status: 'declined' as const } : s))
  }

  const pendingSwapCount = swaps.filter(s => s.targetEmployeeId === user?.employeeId && s.status === 'pending').length
  const unfulfilledWishes = myWishes.filter(w => w.status === 'not_fulfilled')

  return (
    <>
      
      <div className="p-4 sm:p-6 space-y-4">

        {/* Tab bar */}
        <div className="flex bg-white border border-gray-100 rounded-2xl p-1">
          {([
            { key: 'schedule', label: 'Dienstplan', badge: 0 },
            { key: 'team',     label: 'Team',        badge: 0 },
            { key: 'swaps',    label: 'Tauschbörse', badge: pendingSwapCount },
            { key: 'wishes',   label: 'Wünsche',     badge: unfulfilledWishes.length },
          ] as const).map(({ key, label, badge }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${tab === key ? 'bg-navy text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {label}
              {badge !== undefined && badge > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === key ? 'bg-brand text-navy' : 'bg-red-100 text-red-600'}`}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── SCHEDULE TAB ─────────────────────────────────────── */}
        {tab === 'schedule' && (
          <>
            {/* Navigation + View toggle + Actions */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1">
                <button onClick={() => go(-1)} className="p-2 rounded-xl hover:bg-white border border-gray-200 transition-all">
                  <ChevronLeft size={18} className="text-gray-600" />
                </button>
                <span className="px-3 py-2 text-sm font-semibold text-navy min-w-[150px] text-center">
                  {calView === 'day'
                    ? `${formatDateShort(toDateString(currentDate))}`
                    : calView === 'month'
                    ? `${MONTH_NAMES_FULL[currentDate.getMonth()]} ${currentDate.getFullYear()}`
                    : `${formatDateShort(weekStart)} – ${formatDateShort(weekEnd)}`}
                </span>
                <button onClick={() => go(1)} className="p-2 rounded-xl hover:bg-white border border-gray-200 transition-all">
                  <ChevronRight size={18} className="text-gray-600" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                {/* View toggle */}
                <div className="flex items-center gap-0.5 bg-gray-100 rounded-xl p-0.5">
                  {(['day', 'week', 'month'] as CalView[]).map(v => (
                    <button
                      key={v}
                      onClick={() => setCalView(v)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${calView === v ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {v === 'day' ? 'Tag' : v === 'week' ? 'Woche' : 'Monat'}
                    </button>
                  ))}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setCalendarModal(true)} className="gap-1.5 border border-gray-200">
                  <CalendarPlus size={14} />
                  <span className="hidden sm:inline">Export</span>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setWishModal(true)} className="gap-1.5 border border-gray-200">
                  <MessageSquare size={14} />
                  Wunsch
                </Button>
              </div>
            </div>

            {/* Day view */}
            {calView === 'day' && (() => {
              const dateStr = toDateString(currentDate)
              const entry = myEntries.find(e => e.date === dateStr)
              const shift = entry ? getShift(entry.shiftId) : null
              const todayFlag = isToday(dateStr)
              const holiday = getPublicHolidayName(dateStr, undefined)
              return (
                <div className="space-y-3">
                  <div className={`rounded-2xl border-2 p-5 ${todayFlag ? 'border-teal-400 bg-teal-50' : 'border-gray-100 bg-white'}`}>
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-2">
                      {WEEKDAY_SHORT[(currentDate.getDay() + 6) % 7]} · {formatDate(dateStr)}
                      {todayFlag && <span className="ml-2 bg-teal-600 text-white text-[10px] rounded-full px-1.5 py-0.5">Heute</span>}
                    </p>
                    {holiday && <p className="text-xs text-red-600 font-medium mb-2">🏖 {holiday}</p>}
                    {entry && shift ? (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: shift.color }} />
                          <p className="text-lg font-bold text-navy">{shift.name}</p>
                        </div>
                        <p className="text-sm text-gray-600 font-mono">{shift.startTime} – {shift.endTime}</p>
                        {(entry.gruppe || entry.funktion) && (
                          <p className="text-xs text-gray-400 mt-1">{[entry.gruppe, entry.funktion].filter(Boolean).join(' · ')}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm">{holiday ? 'Feiertag – kein Dienst' : 'Kein Dienst geplant'}</p>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Month view */}
            {calView === 'month' && (() => {
              const grid = getMonthGrid(currentDate.getFullYear(), currentDate.getMonth())
              const todayStr = toDateString(new Date())
              return (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
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
                          const entry = myEntries.find(e => e.date === ds)
                          const shift = entry ? getShift(entry.shiftId) : null
                          const isT = ds === todayStr
                          const isPast = day < new Date() && !isT
                          return (
                            <div
                              key={ci}
                              className={`aspect-square rounded-xl flex flex-col items-center justify-center p-0.5 ${
                                isT ? 'bg-teal-50 border-2 border-teal-400' : entry ? 'bg-gray-50 border border-gray-100' : ''
                              } ${isPast ? 'opacity-50' : ''}`}
                            >
                              <span className={`text-[10px] font-semibold ${isT ? 'text-teal-700' : 'text-gray-600'}`}>{day.getDate()}</span>
                              {shift && (
                                <span
                                  className="text-[8px] rounded-full px-1 font-medium mt-0.5 leading-tight text-center"
                                  style={{ backgroundColor: shift.bgColor, color: shift.color }}
                                >
                                  {shift.name.slice(0, 3)}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                  {/* Legend */}
                  <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap gap-3">
                    {SHIFTS.filter(s => myEntries.some(e => e.shiftId === s.id && {
                      gte: toDateString(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)),
                      lte: toDateString(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)),
                    }.gte <= e.date && e.date <= ({
                      gte: toDateString(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)),
                      lte: toDateString(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)),
                    } as { gte: string; lte: string }).lte)).map(s => (
                      <div key={s.id} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-xs text-gray-600">{s.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {calView === 'week' && (<>
            {/* Week summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                <p className="text-2xl font-bold text-navy">{weekEntries.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">Dienste diese Woche</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                <p className="text-2xl font-bold text-navy">{Math.floor(totalHours / 60)}h {totalHours % 60 > 0 ? `${totalHours % 60}min` : ''}</p>
                <p className="text-xs text-gray-500 mt-0.5">Stunden geplant</p>
              </div>
            </div>

            {/* Day rows */}
            <div className="space-y-2">
              {weekDays.map(day => {
                const dateStr = toDateString(day)
                const entry = getEntry(dateStr)
                const shift = entry ? getShift(entry.shiftId) : null
                const todayFlag = isToday(dateStr)
                const isPast = day < new Date(new Date().setHours(0, 0, 0, 0))
                const Icon = shift ? SHIFT_ICONS[shift.type] : null
                const holiday = getPublicHolidayName(dateStr, location?.bundesland)

                return (
                  <div
                    key={dateStr}
                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${todayFlag ? 'border-brand bg-amber-50' : holiday ? 'border-red-200 bg-red-50/40' : 'border-gray-100 bg-white'} ${isPast && !todayFlag ? 'opacity-60' : ''}`}
                  >
                    <div className={`w-14 text-center flex-shrink-0 ${todayFlag ? 'text-navy' : holiday ? 'text-red-600' : 'text-gray-500'}`}>
                      <p className="text-xs font-medium">{getDayName(dateStr, true)}</p>
                      <p className="text-xl font-bold">{day.getDate()}</p>
                      {todayFlag && <div className="w-1.5 h-1.5 rounded-full bg-brand mx-auto mt-0.5" />}
                      {holiday && <p className="text-[8px] font-bold text-red-500 leading-tight mt-0.5 truncate">{holiday}</p>}
                    </div>

                    {shift && Icon && entry ? (
                      <div className="flex-1 flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 relative" style={{ backgroundColor: shift.bgColor }}>
                          <Icon size={18} style={{ color: shift.color }} />
                          {entry.isSubstitution && (
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 border border-white" title={`Vertretung${entry.substitutionFor ? `: ${entry.substitutionFor}` : ''}`} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-navy">{shift.name}</p>
                          <p className="text-xs text-gray-500">{entry.startTime ?? shift.startTime} – {entry.endTime ?? shift.endTime} Uhr</p>
                          {(entry.gruppe || entry.funktion) && (
                            <p className="text-xs text-gray-400 truncate">{[entry.gruppe, entry.funktion].filter(Boolean).join(' · ')}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant={entry.status === 'confirmed' ? 'success' : 'default'}>
                            {entry.status === 'confirmed' ? '✓' : 'Geplant'}
                          </Badge>
                          <button
                            onClick={() => setSelectedEntry(entry)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                            title="Details"
                          >
                            <Info size={14} className="text-gray-400" />
                          </button>
                          <button
                            onClick={() => setSwapEntry(entry)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                            title="Tauschen"
                          >
                            <ArrowLeftRight size={14} className="text-blue-500" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1">
                        <p className="text-sm text-gray-400 font-medium">Frei</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <Card padding="sm">
              <p className="text-xs font-semibold text-gray-500 mb-2">Legende</p>
              <div className="flex flex-wrap gap-3">
                {[
                  { name: 'Frühdienst', color: '#1D4ED8', bg: '#DBEAFE', icon: Sun },
                  { name: 'Spätdienst', color: '#C2410C', bg: '#FFEDD5', icon: Moon },
                  { name: 'Mitteldienst', color: '#15803D', bg: '#DCFCE7', icon: Briefcase },
                ].map(l => (
                  <div key={l.name} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: l.bg }}>
                      <l.icon size={12} style={{ color: l.color }} />
                    </div>
                    <span className="text-xs text-gray-600">{l.name}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5">
                  <ArrowLeftRight size={14} className="text-blue-500" />
                  <span className="text-xs text-gray-600">Tauschen</span>
                </div>
              </div>
            </Card>
            </>)}
          </>
        )}

        {/* ── TEAM TAB ─────────────────────────────────────────── */}
        {tab === 'team' && (
          <div className="space-y-3">
            {/* Navigation */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button onClick={() => go(-1)} className="p-2 rounded-xl hover:bg-white border border-gray-200 transition-all">
                  <ChevronLeft size={18} className="text-gray-600" />
                </button>
                <span className="px-3 py-2 text-sm font-semibold text-navy min-w-[150px] text-center">
                  {formatDateShort(weekStart)} &ndash; {formatDateShort(weekEnd)}
                </span>
                <button onClick={() => go(1)} className="p-2 rounded-xl hover:bg-white border border-gray-200 transition-all">
                  <ChevronRight size={18} className="text-gray-600" />
                </button>
              </div>
            </div>

            {/* Team grid */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-navy text-white">
                      <th className="px-3 py-2.5 text-left font-semibold w-28">Mitarbeiter</th>
                      {weekDays.map(day => {
                        const ds = toDateString(day)
                        const isT = isToday(ds)
                        return (
                          <th key={ds} className={`px-2 py-2.5 text-center font-semibold ${isT ? 'bg-brand/80' : ''}`}>
                            <div className="text-[10px] opacity-70">{WEEKDAY_SHORT[(day.getDay() + 6) % 7]}</div>
                            <div>{day.getDate()}</div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {[employee, ...colleagues].filter(Boolean).map((emp, i) => {
                      if (!emp) return null
                      const isMe = emp.id === user?.employeeId
                      return (
                        <tr key={emp.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className={`px-3 py-2 font-semibold truncate max-w-[7rem] ${isMe ? 'text-brand' : 'text-navy'}`}>
                            {emp.name.split(' ')[0]}
                            {isMe && <span className="ml-1 text-[9px] text-brand opacity-70">Du</span>}
                          </td>
                          {weekDays.map(day => {
                            const ds = toDateString(day)
                            const entry = SCHEDULE_ENTRIES.find(e => e.employeeId === emp.id && e.date === ds)
                            const shift = entry ? getShift(entry.shiftId) : null
                            const isT = isToday(ds)
                            return (
                              <td key={ds} className={`px-1 py-1.5 text-center ${isT ? 'bg-amber-50' : ''}`}>
                                {shift ? (
                                  <div className="rounded px-1 py-0.5 leading-tight" style={{ backgroundColor: shift.bgColor }}>
                                    <div className="font-bold" style={{ color: shift.color }}>{shift.name.slice(0, 3)}</div>
                                    <div className="text-[9px]" style={{ color: shift.color, opacity: 0.8 }}>
                                      {(entry?.startTime ?? shift.startTime).slice(0, 5)}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-gray-200">&mdash;</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap gap-3">
                {SHIFTS.filter(s => SCHEDULE_ENTRIES.some(e => e.shiftId === s.id && e.date >= weekStart && e.date <= weekEnd)).map(s => (
                  <div key={s.id} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-xs text-gray-600">{s.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── SWAPS TAB ────────────────────────────────────────── */}
        {tab === 'swaps' && (
          <Card>
            <CardHeader>
              <CardTitle>Tauschbörse</CardTitle>
              <Button size="sm" onClick={() => setTab('schedule')} className="gap-1">
                <ArrowLeftRight size={14} />
                Tausch starten
              </Button>
            </CardHeader>
            <SwapList
              swaps={swaps}
              currentUserId={user?.employeeId ?? ''}
              shifts={SHIFTS}
              onAccept={handleAcceptSwap}
              onDecline={handleDeclineSwap}
            />
          </Card>
        )}

        {/* ── WISHES TAB ───────────────────────────────────────── */}
        {tab === 'wishes' && (
          <>
          {/* §61: Persistent shift preference */}
          <Card>
            <CardHeader>
              <CardTitle>Dauerhafte Schichtpräferenz</CardTitle>
            </CardHeader>
            <p className="text-xs text-gray-500 mb-3">Diese Präferenz gilt für alle zukünftigen Planungsläufe als weicher Wunsch (Priorität: niedrig).</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: 'keine', label: 'Keine' },
                { value: 'frueh', label: 'Frühdienst' },
                { value: 'spaet', label: 'Spätdienst' },
                { value: 'nacht', label: 'Nachtdienst' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleSavePref(opt.value)}
                  disabled={prefSaving}
                  className={`py-2.5 rounded-xl text-xs font-semibold border-2 transition-all ${(planningProfile?.shiftPreference ?? 'keine') === opt.value ? 'bg-navy text-white border-navy' : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dienstwünsche</CardTitle>
              <Button size="sm" onClick={() => setWishModal(true)} className="gap-1">
                <MessageSquare size={14} />
                Wunsch
              </Button>
            </CardHeader>

            {unfulfilledWishes.length > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={14} className="text-amber-600" />
                  <p className="text-xs font-bold text-amber-700">{unfulfilledWishes.length} Wunsch nicht erfüllt</p>
                </div>
                <p className="text-xs text-amber-600">Sieh unten warum und kontaktiere ggf. Kollegen.</p>
              </div>
            )}

            <div className="space-y-3">
              {myWishes.map(w => {
                const iconMap = { fulfilled: CheckCircle, not_fulfilled: XCircle, pending: Clock }
                const colorMap = { fulfilled: 'text-green-500 bg-green-100', not_fulfilled: 'text-red-500 bg-red-100', pending: 'text-amber-500 bg-amber-100' }
                const labelMap = { fulfilled: 'Erfüllt', not_fulfilled: 'Nicht erfüllt', pending: 'Ausstehend' }
                const Icon = iconMap[w.status]
                return (
                  <div key={w.id} className={`p-4 rounded-2xl border-2 ${w.status === 'not_fulfilled' ? 'border-red-100 bg-red-50/30' : 'border-gray-100 bg-white'}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${colorMap[w.status]}`}>
                          <Icon size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-navy">
                            {w.preferredShiftType === 'early' ? 'Frühdienst' : w.preferredShiftType === 'late' ? 'Spätdienst' : w.preferredShiftType === 'frei' ? 'Freier Tag' : 'Mitteldienst'}
                            {' '}am {formatDate(w.date)}
                          </p>
                          <p className="text-xs text-gray-500">{getDayName(w.date)}</p>
                        </div>
                      </div>
                      <Badge
                        variant={w.status === 'fulfilled' ? 'success' : w.status === 'not_fulfilled' ? 'danger' : 'warning'}
                      >
                        {labelMap[w.status]}
                      </Badge>
                    </div>

                    {w.reason && (
                      <p className="text-xs text-gray-600 italic mb-2">&bdquo;{w.reason}&ldquo;</p>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-2 py-1 rounded-full font-semibold ${w.importance === 'urgent' ? 'bg-red-100 text-red-600' : w.importance === 'important' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                        {w.importance === 'urgent' ? 'Dringend' : w.importance === 'important' ? 'Wichtig' : 'Normal'}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        Eingereicht: {new Date(w.submittedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {w.status === 'not_fulfilled' && w.conflictInfo && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                        <p className="text-xs font-semibold text-red-700 mb-1 flex items-center gap-1">
                          <Info size={12} />
                          Warum nicht erfüllt?
                        </p>
                        <p className="text-xs text-red-600">{w.conflictInfo.reason}</p>
                        {w.conflictInfo.conflictedWith.length > 0 && (
                          <button
                            onClick={() => window.open(`mailto:?subject=${encodeURIComponent('Dienstwunsch besprechen')}&body=${encodeURIComponent(`Hallo,\nkönnen wir unseren Dienstwunsch für den ${w.date} besprechen?`)}`, '_blank')}
                            className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium"
                          >
                            <MessageSquare size={12} />
                            {w.conflictInfo.conflictedWith[0]} direkt kontaktieren
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {myWishes.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <MessageSquare size={28} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Noch keine Dienstwünsche</p>
                  <Button size="sm" className="mt-3" onClick={() => setWishModal(true)}>Wunsch abgeben</Button>
                </div>
              )}
            </div>
          </Card>
          </>
        )}
      </div>

      {/* ── Shift Detail Modal ─────────────────────────────────── */}
      <Modal open={!!selectedEntry} onClose={() => setSelectedEntry(null)} title="Dienstdetails">
        {selectedShift && selectedEntry && location && employee && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-2xl" style={{ backgroundColor: selectedShift.bgColor }}>
              <div className="w-14 h-14 rounded-2xl bg-white/50 flex items-center justify-center">
                {(() => { const Icon = SHIFT_ICONS[selectedShift.type] || Briefcase; return <Icon size={28} style={{ color: selectedShift.color }} /> })()}
              </div>
              <div>
                <p className="text-lg font-bold" style={{ color: selectedShift.color }}>{selectedShift.name}</p>
                <p className="text-sm" style={{ color: selectedShift.color }}>{selectedShift.startTime} – {selectedShift.endTime} Uhr</p>
              </div>
            </div>

            <div className="space-y-2">
              {([
                { label: 'Datum', value: `${getDayName(selectedEntry.date)}, ${formatDate(selectedEntry.date)}` },
                { label: 'Standort', value: location.name },
                selectedEntry.gruppe ? { label: 'Gruppe/Bereich', value: selectedEntry.gruppe } : null,
                selectedEntry.funktion ? { label: 'Funktion', value: selectedEntry.funktion } : null,
                selectedEntry.isSubstitution ? { label: 'Vertretung', value: selectedEntry.substitutionFor ?? 'Ja' } : null,
              ] as ({ label: string; value: string } | null)[]).filter((x): x is { label: string; value: string } => x !== null).map(({ label, value }) => (
                <div key={label} className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500">{label}</span>
                  <span className="text-sm font-semibold text-navy">{value}</span>
                </div>
              ))}
            </div>

            {selectedEntry.taskBlocks && selectedEntry.taskBlocks.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Aufgabenplan</p>
                <div className="space-y-1.5">
                  {selectedEntry.taskBlocks.map((block, i) => (
                    <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                      <span className="text-xs font-mono text-gray-500 flex-shrink-0 mt-0.5">{block.start}–{block.end}</span>
                      <span className="text-xs text-navy">{block.aufgabe}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Calendar export options */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">In Kalender exportieren</p>
              <div className="flex gap-2">
                <a
                  href={googleCalendarLink(selectedEntry, selectedShift, location)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-semibold text-gray-700"
                >
                  <ExternalLink size={14} className="text-blue-500" />
                  Google
                </a>
                <button
                  onClick={() => {
                    appleCalendarDownload([selectedEntry], SHIFTS, location, employee)
                    setSelectedEntry(null)
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-semibold text-gray-700"
                >
                  <Download size={14} className="text-gray-600" />
                  Apple / .ics
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1 border border-gray-200" onClick={() => setSelectedEntry(null)}>Schließen</Button>
              <Button className="flex-1 gap-2" onClick={() => { setSwapEntry(selectedEntry); setSelectedEntry(null) }}>
                <ArrowLeftRight size={16} />
                Tauschen
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Calendar Export Modal ──────────────────────────────── */}
      <Modal open={calendarModal} onClose={() => setCalendarModal(false)} title="Dienstplan exportieren">
        {location && employee && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Exportiere deine Dienste ({myEntries.length} Einträge) in deinen Kalender.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  appleCalendarDownload(myEntries, SHIFTS, location, employee)
                  setCalendarModal(false)
                }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-brand hover:bg-amber-50 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0">
                  <CalendarPlus size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-navy">Apple Kalender / .ics</p>
                  <p className="text-xs text-gray-500">Universell: iPhone, iPad, Mac, Outlook</p>
                </div>
              </button>

              <div className="p-4 rounded-2xl border-2 border-gray-100 bg-gray-50">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <ExternalLink size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-navy">Google Kalender</p>
                    <p className="text-xs text-gray-500">Dienste einzeln hinzufügen</p>
                  </div>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {myEntries.slice(0, 10).map(entry => {
                    const shift = SHIFTS.find(s => s.id === entry.shiftId)
                    if (!shift) return null
                    return (
                      <a
                        key={entry.id}
                        href={googleCalendarLink(entry, shift, location)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-2 bg-white rounded-xl hover:bg-blue-50 transition-colors"
                      >
                        <span className="text-xs font-medium text-navy">{formatDate(entry.date)} · {shift.name}</span>
                        <ExternalLink size={12} className="text-blue-500" />
                      </a>
                    )
                  })}
                </div>
              </div>
            </div>
            <Button variant="ghost" className="w-full border border-gray-200" onClick={() => setCalendarModal(false)}>Schließen</Button>
          </div>
        )}
      </Modal>

      {/* ── Wish Modal ────────────────────────────────────────── */}
      <Modal open={wishModal} onClose={() => setWishModal(false)} title="Dienstwunsch abgeben">
        <div className="space-y-4">
          {/* §59: single-date vs date-range toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => setWish(w => ({ ...w, mode: 'single' }))}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${wish.mode === 'single' ? 'bg-white text-navy shadow-sm' : 'text-gray-500'}`}
            >
              Einzelner Tag
            </button>
            <button
              onClick={() => setWish(w => ({ ...w, mode: 'range' }))}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${wish.mode === 'range' ? 'bg-white text-navy shadow-sm' : 'text-gray-500'}`}
            >
              Zeitraum
            </button>
          </div>
          <Select
            label="Gewünschter Dienst"
            value={wish.type}
            onChange={e => setWish(w => ({ ...w, type: e.target.value }))}
          >
            <option value="">Bitte wählen...</option>
            <option value="early">Frühdienst</option>
            <option value="late">Spätdienst</option>
            <option value="mid">Mitteldienst</option>
            <option value="free">Freier Tag</option>
            <option value="no_early_after_late">Kein Frühdienst nach Spätdienst</option>
          </Select>
          {wish.mode === 'single' ? (
            <Input
              label="Datum"
              type="date"
              value={wish.date}
              onChange={e => setWish(w => ({ ...w, date: e.target.value }))}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Von"
                type="date"
                value={wish.dateFrom}
                onChange={e => setWish(w => ({ ...w, dateFrom: e.target.value }))}
              />
              <Input
                label="Bis"
                type="date"
                value={wish.dateTo}
                onChange={e => setWish(w => ({ ...w, dateTo: e.target.value }))}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">Priorität</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'normal', label: 'Normal', color: 'bg-gray-100 text-gray-700' },
                { value: 'important', label: 'Wichtig', color: 'bg-amber-100 text-amber-700' },
                { value: 'urgent', label: 'Dringend', color: 'bg-red-100 text-red-700' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setWish(w => ({ ...w, importance: opt.value }))}
                  className={`py-2.5 rounded-xl text-xs font-semibold border-2 transition-all ${wish.importance === opt.value ? `${opt.color} border-current` : 'border-gray-100 text-gray-400'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <Textarea
            label="Grund"
            value={wish.reason}
            onChange={e => setWish(w => ({ ...w, reason: e.target.value }))}
            rows={2}
            placeholder="z.B. Arzttermin, Familienpflicht..."
          />
          <div className="bg-blue-50 rounded-xl p-3 flex gap-2">
            <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Bei Konflikten entscheidet die KI anhand Priorität, Einreichzeit und bisheriger Schichtverteilung. Du wirst informiert wenn dein Wunsch nicht erfüllt werden kann.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1 border border-gray-200" onClick={() => setWishModal(false)}>Abbrechen</Button>
            <Button
              className="flex-1"
              onClick={handleWishSubmit}
              disabled={!wish.type || (wish.mode === 'single' ? !wish.date : !wish.dateFrom || !wish.dateTo)}
            >
              Absenden
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Swap Modal ────────────────────────────────────────── */}
      {swapEntry && swapShift && (
        <SwapModal
          open={!!swapEntry}
          onClose={() => setSwapEntry(null)}
          myEntry={swapEntry}
          myShift={swapShift}
          colleagues={colleagues}
          colleagueEntries={colleagueEntries}
          shifts={SHIFTS}
          onSubmit={handleSwapSubmit}
        />
      )}
    </>
  )
}
