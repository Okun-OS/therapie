'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/lib/auth-context'
import { TIME_LOGS, SCHEDULE_ENTRIES } from '@/lib/mock-data'
import { PlayCircle, StopCircle, Clock, Timer, TrendingUp, Calendar } from 'lucide-react'
import { formatDate, formatTime, getWeekDays, toDateString } from '@/lib/utils'

export default function TimeTracking() {
  const { user } = useAuth()
  const [clockedIn, setClockedIn] = useState(false)
  const [clockInTime, setClockInTime] = useState<Date | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
      if (clockedIn && clockInTime) {
        setElapsed(Math.floor((Date.now() - clockInTime.getTime()) / 1000))
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [clockedIn, clockInTime])

  const myLogs = TIME_LOGS.filter(t => t.employeeId === user?.id).sort((a, b) => b.date.localeCompare(a.date))

  const todayMinutes = myLogs
    .filter(t => t.date === new Date().toISOString().split('T')[0])
    .reduce((s, t) => s + (t.totalMinutes || 0), 0)

  const weekDays = getWeekDays(new Date())
  const weekStart = toDateString(weekDays[0])
  const weekEnd = toDateString(weekDays[6])
  const weekMinutes = myLogs
    .filter(t => t.date >= weekStart && t.date <= weekEnd)
    .reduce((s, t) => s + (t.totalMinutes || 0), 0)

  const todayStr = toDateString(new Date())
  const hasShiftToday = SCHEDULE_ENTRIES.some(e => e.employeeId === user?.id && e.date === todayStr)

  const monthMinutes = myLogs
    .filter(t => {
      const d = new Date(t.date + 'T00:00:00')
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((s, t) => s + (t.totalMinutes || 0), 0)

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const handleClockIn = () => {
    setClockedIn(true)
    setClockInTime(new Date())
    setElapsed(0)

    if (user) {
      fetch('/api/time-tracking/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: user.id, date: todayStr, locationId: user.locationId }),
      })
        .then(res => res.json())
        .then(data => setActiveEntryId(data.entry?.id ?? null))
        .catch(() => {})
    }
  }

  const handleClockOut = () => {
    setClockedIn(false)
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
  }

  return (
    <>
      <Header title="Zeiterfassung" subtitle={currentTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} />
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
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-green-300 text-sm font-medium">Aktive Session</p>
                </div>
                <p className="text-brand text-4xl font-bold font-mono">{formatElapsed(elapsed)}</p>
                <p className="text-navy-100 text-xs mt-1">
                  Start: {clockInTime?.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                </p>
              </div>
            )}

            <div className="flex flex-col items-center gap-2">
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

        {/* Recent Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Zeitnachweise</CardTitle>
            <Badge variant="default">{myLogs.length} Einträge</Badge>
          </CardHeader>
          <div className="space-y-2">
            {myLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Calendar size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Keine Zeiteinträge vorhanden</p>
              </div>
            ) : (
              myLogs.map(log => {
                const mins = log.totalMinutes || 0
                const isOver = mins > 480
                return (
                  <div key={log.id} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Clock size={18} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy">{formatDate(log.date)}</p>
                      <p className="text-xs text-gray-500">
                        {log.clockIn} Uhr → {log.clockOut ? `${log.clockOut} Uhr` : 'läuft...'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-bold ${isOver ? 'text-amber-600' : 'text-navy'}`}>
                        {formatTime(mins)}
                      </p>
                      {isOver && <p className="text-xs text-amber-500">+{formatTime(mins - 480)}</p>}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>
      </div>
    </>
  )
}
