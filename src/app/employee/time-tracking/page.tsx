'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/lib/toast-context'
import { OVERTIME_REASONS, type AbsenceType, type Employee, type TimeLog, type ScheduleEntry, type Shift, type OvertimeRequest, type HoursAccountSummary, type MonthlyClosing } from '@/lib/types'
import { OVERTIME_MIN_MINUTES } from '@/lib/workforce-score-constants'
import { PlayCircle, StopCircle, Clock, Timer, TrendingUp, Calendar, Coffee, AlertCircle, FileText, ChevronDown, ChevronUp, Stethoscope } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate, formatTime, getWeekDays, toDateString } from '@/lib/utils'

const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

const ABSENCE_TYPE_LABEL: Record<AbsenceType, string> = {
  krankheit: 'Krankheit',
  fortbildung: 'Fortbildung',
  sonstige: 'Sonstige Abwesenheit',
  entschuldigt: 'Entschuldigte Fehlzeit',
  unentschuldigt: 'Unentschuldigte Fehlzeit',
}

const OVERTIME_STATUS_LABEL: Record<string, { label: string; variant: 'warning' | 'success' | 'danger' | 'info' }> = {
  pending: { label: 'Ausstehend', variant: 'warning' },
  approved: { label: 'Genehmigt', variant: 'success' },
  denied: { label: 'Abgelehnt', variant: 'danger' },
  partial: { label: 'Teilweise genehmigt', variant: 'info' },
}

const CLOSING_STATUS_LABEL: Record<string, { label: string; variant: 'warning' | 'success' | 'info' }> = {
  offen: { label: 'Offen', variant: 'warning' },
  geprueft: { label: 'Geprüft', variant: 'info' },
  freigegeben: { label: 'Freigegeben', variant: 'success' },
}

export default function TimeTracking() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [clockedIn, setClockedIn] = useState(false)
  const [clockInTime, setClockInTime] = useState<Date | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null)
  const [activeTimeLogId, setActiveTimeLogId] = useState<string | null>(null)

  const [, forceRender] = useState(0)
  const refresh = () => forceRender(n => n + 1)

  const [overtimeModalOpen, setOvertimeModalOpen] = useState(false)
  const [pendingOvertime, setPendingOvertime] = useState<{ timeLogId: string; date: string; minutes: number } | null>(null)
  const [overtimeReason, setOvertimeReason] = useState('')
  const [overtimeComment, setOvertimeComment] = useState('')

  const [absenceModalOpen, setAbsenceModalOpen] = useState(false)
  const [absenceType, setAbsenceType] = useState<AbsenceType>('krankheit')
  const [absenceStart, setAbsenceStart] = useState('')
  const [absenceEnd, setAbsenceEnd] = useState('')
  const [absenceNote, setAbsenceNote] = useState('')
  const [absenceProof, setAbsenceProof] = useState(false)

  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)
  const [myEmployee, setMyEmployee] = useState<Employee | null>(null)
  const [TIME_LOGS, setTIME_LOGS] = useState<TimeLog[]>([])
  const [SCHEDULE_ENTRIES, setSCHEDULE_ENTRIES] = useState<ScheduleEntry[]>([])
  const [SHIFTS, setSHIFTS] = useState<Shift[]>([])
  const [activeLog, setActiveLog] = useState<TimeLog | null>(null)
  const [account, setAccount] = useState<HoursAccountSummary | null>(null)
  const [myOvertimeRequests, setMyOvertimeRequests] = useState<OvertimeRequest[]>([])
  const [visibleClosings, setVisibleClosings] = useState<MonthlyClosing[]>([])

  useEffect(() => {
    if (!user?.employeeId) return
    fetch(`/api/employees/${user.employeeId}`).then(r => r.json()).then(d => setMyEmployee(d.employee ?? null))
  }, [user?.employeeId])

  useEffect(() => {
    fetch('/api/shifts').then(r => r.json()).then(d => setSHIFTS(d.shifts))
  }, [])

  useEffect(() => {
    if (!user?.employeeId) return
    fetch(`/api/time-logs?employeeId=${user.employeeId}`).then(r => r.json()).then(d => setTIME_LOGS(d.logs))
    fetch(`/api/schedule-entries?employeeId=${user.employeeId}`).then(r => r.json()).then(d => setSCHEDULE_ENTRIES(d.entries))
    fetch(`/api/overtime-requests?employeeId=${user.employeeId}`).then(r => r.json()).then(d => setMyOvertimeRequests(d.requests))
  }, [user?.employeeId])

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
      if (clockedIn && clockInTime) {
        setElapsed(Math.floor((Date.now() - clockInTime.getTime()) / 1000))
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [clockedIn, clockInTime])

  const getShiftById = (shiftId: string) => SHIFTS.find(s => s.id === shiftId)

  const myLogs = TIME_LOGS.filter(t => t.employeeId === user?.employeeId).sort((a, b) => b.date.localeCompare(a.date))

  const netMinutes = (t: TimeLog) => Math.max(0, (t.totalMinutes || 0) - (t.breakMinutes || 0))

  const todayMinutes = myLogs
    .filter(t => t.date === toDateString(new Date()))
    .reduce((s, t) => s + netMinutes(t), 0)

  const weekDays = getWeekDays(new Date())
  const weekStart = toDateString(weekDays[0])
  const weekEnd = toDateString(weekDays[6])
  const weekMinutes = myLogs
    .filter(t => t.date >= weekStart && t.date <= weekEnd)
    .reduce((s, t) => s + netMinutes(t), 0)

  const todayStr = toDateString(new Date())
  const hasShiftToday = SCHEDULE_ENTRIES.some(e => e.employeeId === user?.employeeId && e.date === todayStr)

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const monthPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`
  const monthMinutes = myLogs
    .filter(t => t.date.startsWith(monthPrefix))
    .reduce((s, t) => s + netMinutes(t), 0)

  const onBreak = !!activeLog?.breakStart

  const fetchActiveLog = () => {
    if (!user?.employeeId) return
    fetch(`/api/time-tracking/active?employeeId=${user.employeeId}`).then(r => r.json()).then(d => {
      setActiveLog(d.log ?? null)
      setActiveEntryId(d.entryId ?? null)
    })
  }

  const fetchAccount = () => {
    if (!user?.employeeId) return
    const params = new URLSearchParams({ employeeId: user.employeeId, year: String(currentYear), month: String(currentMonth) })
    if (myEmployee?.weeklyHours) params.set('weeklyHours', String(myEmployee.weeklyHours))
    fetch(`/api/hours-account?${params.toString()}`).then(r => r.json()).then(d => setAccount(d.summary))
  }

  const fetchOvertimeRequests = () => {
    if (!user?.employeeId) return
    fetch(`/api/overtime-requests?employeeId=${user.employeeId}`).then(r => r.json()).then(d => setMyOvertimeRequests(d.requests))
  }

  const fetchTimeLogs = () => {
    if (!user?.employeeId) return
    fetch(`/api/time-logs?employeeId=${user.employeeId}`).then(r => r.json()).then(d => setTIME_LOGS(d.logs))
  }

  const fetchClosings = () => {
    if (!user?.employeeId) return
    fetch(`/api/monthly-closings?employeeId=${user.employeeId}`).then(r => r.json()).then(d => setVisibleClosings(d.closings))
  }

  useEffect(() => {
    fetchActiveLog()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.employeeId])

  useEffect(() => {
    if (activeLog && !activeLog.clockOut) {
      const startInstant = activeLog.clockInAt
        ? new Date(activeLog.clockInAt)
        : new Date(`${activeLog.date}T${activeLog.clockIn}:00`)
      setClockedIn(true)
      setClockInTime(startInstant)
      setActiveTimeLogId(activeLog.id)
      setElapsed(Math.max(0, Math.floor((Date.now() - startInstant.getTime()) / 1000)))
    } else {
      setClockedIn(false)
      setClockInTime(null)
      setActiveTimeLogId(null)
      setElapsed(0)
    }
  }, [activeLog])

  useEffect(() => {
    fetchAccount()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.employeeId, myEmployee?.weeklyHours, currentYear, currentMonth])

  // Ensure the current and previous two months have a (lazily generated) Monatsübersicht to view
  useEffect(() => {
    if (!user?.employeeId || !myEmployee) return
    ;(async () => {
      for (let i = 0; i < 3; i++) {
        const d = new Date(currentYear, currentMonth - 1 - i, 1)
        await fetch('/api/monthly-closings/get-or-create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeId: user.employeeId, year: d.getFullYear(), month: d.getMonth() + 1, employeeInfo: myEmployee }),
        })
      }
      fetchClosings()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.employeeId, myEmployee?.id])

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const handleClockIn = async () => {
    const clockInDate = new Date()
    setClockedIn(true)
    setClockInTime(clockInDate)
    setElapsed(0)

    if (user?.employeeId) {
      const log = await fetch('/api/time-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: user.employeeId,
          date: todayStr,
          clockIn: clockInDate.toTimeString().slice(0, 5),
          locationId: myEmployee?.locationId || user.locationId,
        }),
      }).then(r => r.json()).then(d => d.log)
      setActiveTimeLogId(log.id)
      setTIME_LOGS(prev => [log, ...prev])

      fetch('/api/time-tracking/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: user.employeeId, date: todayStr, locationId: myEmployee?.locationId || user.locationId }),
      })
        .then(res => res.json())
        .then(data => setActiveEntryId(data.entry?.id ?? null))
        .catch(() => {})
    }
    fetchActiveLog()
    refresh()
  }

  const handleClockOut = async () => {
    const clockOutDate = new Date()
    setClockedIn(false)

    if (activeTimeLogId && user?.employeeId && clockInTime) {
      const totalMinutes = Math.max(0, Math.round((clockOutDate.getTime() - clockInTime.getTime()) / 60000))
      const updated = await fetch(`/api/time-logs/${activeTimeLogId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clockOut: clockOutDate.toTimeString().slice(0, 5), totalMinutes }),
      }).then(r => r.json()).then(d => d.log)
      setTIME_LOGS(prev => prev.map(l => l.id === updated.id ? updated : l))

      const scheduleEntry = SCHEDULE_ENTRIES.find(e => e.employeeId === user.employeeId && e.date === todayStr)
      const shift = scheduleEntry ? getShiftById(scheduleEntry.shiftId) : undefined
      if (shift) {
        const [eh, em] = shift.endTime.split(':').map(Number)
        const plannedEnd = eh * 60 + em
        const actualEnd = clockOutDate.getHours() * 60 + clockOutDate.getMinutes()
        const diff = actualEnd - plannedEnd
        if (diff >= OVERTIME_MIN_MINUTES) {
          setPendingOvertime({ timeLogId: activeTimeLogId, date: todayStr, minutes: diff })
          setOvertimeReason('')
          setOvertimeComment('')
          setOvertimeModalOpen(true)
        }
      }
      setActiveTimeLogId(null)
    }

    setClockInTime(null)
    setElapsed(0)

    if (activeEntryId) {
      fetch('/api/time-tracking/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeClockEntryId: activeEntryId }),
      }).catch(() => {})
      setActiveEntryId(null)
    }
    fetchActiveLog()
    fetchAccount()
    refresh()
  }

  const handleStartBreak = async () => {
    if (!user?.employeeId) return
    await fetch('/api/time-tracking/break/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: user.employeeId }),
    })
    fetchActiveLog()
    refresh()
  }

  const handleEndBreak = async () => {
    if (!user?.employeeId) return
    await fetch('/api/time-tracking/break/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: user.employeeId }),
    })
    fetchActiveLog()
    refresh()
  }

  const handleSubmitOvertime = async () => {
    if (!user?.employeeId || !pendingOvertime) return
    if (!overtimeReason) { showToast('Bitte einen Grund auswählen', 'error'); return }
    const locationId = myEmployee?.locationId || user.locationId
    await fetch('/api/overtime-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: user.employeeId,
        employeeName: user.name,
        locationId,
        date: pendingOvertime.date,
        timeLogId: pendingOvertime.timeLogId,
        overtimeMinutes: pendingOvertime.minutes,
        reason: overtimeReason,
        comment: overtimeComment.trim() || undefined,
      }),
    })
    fetch('/api/time-tracking/notify-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeName: user.name, locationId, kind: 'overtime', date: pendingOvertime.date }),
    }).catch(() => {})
    setOvertimeModalOpen(false)
    setPendingOvertime(null)
    showToast('Überstundenantrag wurde erstellt', 'success')
    fetchOvertimeRequests()
    refresh()
  }

  const handleSubmitAbsence = async () => {
    if (!user?.employeeId) return
    if (!absenceStart || !absenceEnd) { showToast('Bitte Zeitraum angeben', 'error'); return }
    const days = Math.max(1, Math.round((new Date(absenceEnd).getTime() - new Date(absenceStart).getTime()) / 86400000) + 1)
    const locationId = myEmployee?.locationId || user.locationId
    await fetch('/api/absences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: user.employeeId,
        employeeName: user.name,
        locationId,
        type: absenceType,
        startDate: absenceStart,
        endDate: absenceEnd,
        days,
        note: absenceNote.trim() || undefined,
        proofProvided: absenceProof,
      }),
    })
    fetch('/api/time-tracking/notify-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeName: user.name, locationId, kind: 'absence', startDate: absenceStart, endDate: absenceEnd }),
    }).catch(() => {})
    fetchAccount()
    setAbsenceModalOpen(false)
    setAbsenceStart('')
    setAbsenceEnd('')
    setAbsenceNote('')
    setAbsenceProof(false)
    showToast('Abwesenheit gemeldet', 'success')
    refresh()
  }

  return (
    <>
      
      <div className="p-4 sm:p-6 space-y-5">

        {/* Main Clock Widget */}
        <Card className="bg-gradient-to-br from-navy to-navy-light border-0 text-center" padding="lg">
          <div className="py-4">
            {/* Digital Clock */}
            <p className="text-6xl sm:text-7xl font-bold text-white font-mono tracking-tight mb-1">
              {currentTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-navy-100 text-sm mb-6">
              {currentTime.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>

            {clockedIn && (
              <div className="mb-6">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${onBreak ? 'bg-amber-400' : 'bg-green-400'} animate-pulse`} />
                  <p className={`text-sm font-medium ${onBreak ? 'text-amber-300' : 'text-green-300'}`}>{onBreak ? 'Pause aktiv' : 'Aktive Session'}</p>
                </div>
                <p className="text-brand text-4xl font-bold font-mono">{formatElapsed(elapsed)}</p>
                <p className="text-navy-100 text-xs mt-1">
                  Start: {clockInTime?.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                  {(activeLog?.breakMinutes ?? 0) > 0 && ` · Pause: ${formatTime(activeLog!.breakMinutes!)}`}
                </p>
              </div>
            )}

            <div className="flex flex-col items-center gap-3">
              <div className="flex justify-center">
                {!clockedIn ? (
                  <button
                    onClick={handleClockIn}
                    disabled={!hasShiftToday}
                    className="w-24 h-24 rounded-full bg-brand hover:bg-brand-dark transition-all shadow-xl hover:shadow-2xl active:scale-95 flex flex-col items-center justify-center gap-1 group disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-xl disabled:active:scale-100"
                  >
                    <PlayCircle size={36} className="text-navy group-hover:scale-110 transition-transform" />
                    <span className="text-navy text-xs font-bold">Starten</span>
                  </button>
                ) : (
                  <button
                    onClick={handleClockOut}
                    className="w-24 h-24 rounded-full bg-red-500 hover:bg-red-600 transition-all shadow-xl hover:shadow-2xl active:scale-95 flex flex-col items-center justify-center gap-1 group"
                  >
                    <StopCircle size={36} className="text-white group-hover:scale-110 transition-transform" />
                    <span className="text-white text-xs font-bold">Stoppen</span>
                  </button>
                )}
              </div>
              {clockedIn && (
                <button
                  onClick={onBreak ? handleEndBreak : handleStartBreak}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${onBreak ? 'bg-amber-400 text-navy hover:bg-amber-500' : 'bg-navy-light text-white hover:bg-navy-light/80'}`}
                >
                  <Coffee size={14} />
                  {onBreak ? 'Pause beenden' : 'Pause starten'}
                </button>
              )}
              {!clockedIn && !hasShiftToday && (
                <p className="text-navy-100 text-xs">Kein Dienst heute geplant – Einstempeln nicht möglich</p>
              )}
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <Clock size={18} className="mx-auto text-blue-500 mb-1" />
            <p className="text-lg font-bold text-navy">{formatTime(todayMinutes)}</p>
            <p className="text-xs text-gray-500">Heute</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <Timer size={18} className="mx-auto text-emerald-500 mb-1" />
            <p className="text-lg font-bold text-navy">{formatTime(weekMinutes)}</p>
            <p className="text-xs text-gray-500">Diese Woche</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <TrendingUp size={18} className="mx-auto text-purple-500 mb-1" />
            <p className="text-lg font-bold text-navy">{formatTime(monthMinutes)}</p>
            <p className="text-xs text-gray-500">Dieser Monat</p>
          </div>
        </div>

        {/* Stundenkonto */}
        {account && (
          <Card>
            <CardHeader>
              <CardTitle>Stundenkonto · {MONTH_NAMES[currentMonth - 1]}</CardTitle>
              <Button variant="secondary" className="gap-1.5 text-xs px-3 py-1.5" onClick={() => setAbsenceModalOpen(true)}>
                <Stethoscope size={13} />
                Abwesenheit melden
              </Button>
            </CardHeader>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Soll</p>
                <p className="text-sm font-bold text-navy">{formatTime(account.sollMinutes)}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Ist</p>
                <p className="text-sm font-bold text-navy">{formatTime(account.istMinutes)}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-xs text-emerald-600">Überstunden</p>
                <p className="text-sm font-bold text-emerald-700">{formatTime(account.overtimeMinutes)}</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3">
                <p className="text-xs text-amber-600">Minusstunden</p>
                <p className="text-sm font-bold text-amber-700">{formatTime(account.undertimeMinutes)}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Urlaub</p>
                <p className="text-sm font-bold text-navy">{account.vacationDays} Tage</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Krankheit</p>
                <p className="text-sm font-bold text-navy">{account.sickDays} Tage</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 col-span-2">
                <p className="text-xs text-gray-500">Sonstige Abwesenheiten</p>
                <p className="text-sm font-bold text-navy">{account.otherAbsenceDays} Tage</p>
              </div>
            </div>
          </Card>
        )}

        {/* Überstundenanträge */}
        {myOvertimeRequests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Meine Überstundenanträge</CardTitle>
              <Badge variant="default">{myOvertimeRequests.length}</Badge>
            </CardHeader>
            <div className="space-y-2">
              {myOvertimeRequests.map(req => {
                const status = OVERTIME_STATUS_LABEL[req.status]
                return (
                  <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <AlertCircle size={16} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy">{formatDate(req.date)} · +{formatTime(req.overtimeMinutes)}</p>
                      <p className="text-xs text-gray-500">{req.reason}{req.adminComment ? ` · ${req.adminComment}` : ''}</p>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* Monatsübersichten */}
        <Card>
          <CardHeader>
            <CardTitle>Monatsübersichten</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {visibleClosings.map(closing => {
              const key = `${closing.year}-${closing.month}`
              const isOpen = expandedMonth === key
              const status = CLOSING_STATUS_LABEL[closing.status]
              return (
                <div key={closing.id} className="rounded-xl bg-gray-50 overflow-hidden">
                  <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpandedMonth(isOpen ? null : key)}>
                    <div className="w-9 h-9 rounded-xl bg-navy flex items-center justify-center flex-shrink-0">
                      <FileText size={16} className="text-brand" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy">{MONTH_NAMES[closing.month - 1]} {closing.year}</p>
                      <p className="text-xs text-gray-500">{closing.arbeitstage} Arbeitstage</p>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                    {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                  {isOpen && (
                    <div className="px-3 pb-3 space-y-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <p>Soll: <span className="font-semibold text-navy">{formatTime(closing.sollMinutes)}</span></p>
                        <p>Ist: <span className="font-semibold text-navy">{formatTime(closing.istMinutes)}</span></p>
                        <p>Pausen: <span className="font-semibold text-navy">{formatTime(closing.breakMinutes)}</span></p>
                        <p>Überstunden: <span className="font-semibold text-navy">{formatTime(closing.overtimeMinutes)}</span></p>
                        <p>Minusstunden: <span className="font-semibold text-navy">{formatTime(closing.undertimeMinutes)}</span></p>
                        <p>Urlaub: <span className="font-semibold text-navy">{closing.vacationDays} Tage</span></p>
                        <p>Krankheit: <span className="font-semibold text-navy">{closing.sickDays} Tage</span></p>
                        <p>Fehlzeiten: <span className="font-semibold text-navy">{closing.otherAbsenceDays} Tage</span></p>
                      </div>
                      {closing.comments.length > 0 && (
                        <div className="space-y-1 pt-1 border-t border-gray-200">
                          {closing.comments.map((c, i) => (
                            <p key={i} className="text-xs text-gray-500"><span className="font-semibold text-navy">{c.author}:</span> {c.text}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>

        {/* Recent Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Zeitnachweise</CardTitle>
            <Badge variant="default">{myLogs.length} Einträge</Badge>
          </CardHeader>
          <div className="space-y-2">
            {myLogs.length === 0 ? (
              <EmptyState icon={Calendar} title="Keine Zeiteinträge vorhanden" />
            ) : (
              myLogs.map(log => {
                const mins = log.totalMinutes || 0
                const scheduleEntry = SCHEDULE_ENTRIES.find(e => e.employeeId === log.employeeId && e.date === log.date)
                const shift = scheduleEntry ? getShiftById(scheduleEntry.shiftId) : undefined
                let plannedMinutes = 480
                if (shift) {
                  const [sh, sm] = shift.startTime.split(':').map(Number)
                  const [eh, em] = shift.endTime.split(':').map(Number)
                  plannedMinutes = (eh * 60 + em) - (sh * 60 + sm)
                }
                const isOver = mins > plannedMinutes
                return (
                  <div key={log.id} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Clock size={18} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy">{formatDate(log.date)}</p>
                      <p className="text-xs text-gray-500">
                        {log.clockIn} Uhr → {log.clockOut ? `${log.clockOut} Uhr` : 'läuft...'}
                        {(log.breakMinutes ?? 0) > 0 && ` · Pause ${formatTime(log.breakMinutes!)}`}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-bold ${isOver ? 'text-amber-600' : 'text-navy'}`}>
                        {formatTime(mins)}
                      </p>
                      {isOver && <p className="text-xs text-amber-500">+{formatTime(mins - plannedMinutes)}</p>}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>
      </div>

      {/* Überstunden-Abfrage */}
      <Modal open={overtimeModalOpen} onClose={() => setOvertimeModalOpen(false)} title="Überstunden erfasst">
        <div className="space-y-4">
          <p className="text-sm text-navy">
            Du hast deine geplante Arbeitszeit um {pendingOvertime ? formatTime(pendingOvertime.minutes) : ''} überschritten. Was war der Grund?
          </p>
          <div className="flex flex-wrap gap-2">
            {OVERTIME_REASONS.map(reason => (
              <button
                key={reason}
                onClick={() => setOvertimeReason(reason)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-colors ${overtimeReason === reason ? 'bg-brand border-brand-dark text-navy' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                {reason}
              </button>
            ))}
          </div>
          <Textarea
            label="Kommentar (optional)"
            value={overtimeComment}
            onChange={e => setOvertimeComment(e.target.value)}
            rows={2}
          />
          <Button className="w-full" onClick={handleSubmitOvertime}>Überstundenantrag senden</Button>
        </div>
      </Modal>

      {/* Abwesenheit melden */}
      <Modal open={absenceModalOpen} onClose={() => setAbsenceModalOpen(false)} title="Abwesenheit melden">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">Art</label>
            <div className="flex flex-wrap gap-2">
              {(['krankheit', 'fortbildung', 'sonstige', 'entschuldigt'] as AbsenceType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setAbsenceType(type)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-colors ${absenceType === type ? 'bg-brand border-brand-dark text-navy' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                >
                  {ABSENCE_TYPE_LABEL[type]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Von" type="date" value={absenceStart} onChange={e => setAbsenceStart(e.target.value)} />
            <Input label="Bis" type="date" value={absenceEnd} onChange={e => setAbsenceEnd(e.target.value)} />
          </div>
          <Textarea label="Notiz (optional)" value={absenceNote} onChange={e => setAbsenceNote(e.target.value)} rows={2} />
          <label className="flex items-center gap-2 text-sm text-navy cursor-pointer">
            <input type="checkbox" checked={absenceProof} onChange={e => setAbsenceProof(e.target.checked)} className="w-4 h-4 rounded accent-brand" />
            Nachweis liegt vor (z.B. Attest)
          </label>
          <Button className="w-full" onClick={handleSubmitAbsence}>Melden</Button>
        </div>
      </Modal>
    </>
  )
}
