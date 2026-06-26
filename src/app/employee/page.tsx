'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { FeatureIntro } from '@/components/onboarding/FeatureIntro'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth-context'
import {
  SCHEDULE_ENTRIES, SHIFTS, TIME_LOGS, VACATION_REQUESTS
} from '@/lib/mock-data'
import { Clock, Palmtree, Calendar, TrendingUp, PlayCircle, StopCircle, Sun, Moon, Briefcase, ChevronRight, AlertCircle, ListChecks } from 'lucide-react'
import { formatDate, formatTime, toDateString, getDayName, getWeekDays } from '@/lib/utils'
import Link from 'next/link'
import type { Employee } from '@/lib/types'

export default function EmployeeDashboard() {
  const { user } = useAuth()
  const [clockedIn, setClockedIn] = useState(false)
  const [clockInTime, setClockInTime] = useState<Date | null>(null)
  const [EMPLOYEES, setEMPLOYEES] = useState<Employee[]>([])

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => setEMPLOYEES(d.employees))
  }, [])

  const employee = EMPLOYEES.find(e => e.id === user?.id)
  const today = toDateString(new Date())
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend'

  const todayEntries = SCHEDULE_ENTRIES.filter(s => s.employeeId === user?.id && s.date === today)
  const upcomingEntries = SCHEDULE_ENTRIES
    .filter(s => s.employeeId === user?.id && s.date >= today)
    .slice(0, 5)

  const weekDays = getWeekDays(now)
  const weekStart = toDateString(weekDays[0])
  const weekEnd = toDateString(weekDays[6])
  const thisWeekLogs = TIME_LOGS.filter(t => t.employeeId === user?.id && t.date >= weekStart && t.date <= weekEnd)
  const weekMinutes = thisWeekLogs.reduce((sum, l) => sum + (l.totalMinutes || 0), 0)

  const myVacations = VACATION_REQUESTS.filter(v => v.employeeId === user?.id)
  const pendingVacations = myVacations.filter(v => v.status === 'pending')

  const vacationRemaining = (employee?.vacationDaysTotal || 30) - (employee?.vacationDaysUsed || 0)

  const handleClockIn = () => {
    setClockedIn(true)
    setClockInTime(new Date())
  }

  const handleClockOut = () => {
    setClockedIn(false)
    setClockInTime(null)
  }

  const getShiftInfo = (shiftId: string) => SHIFTS.find(s => s.id === shiftId)
  const getShiftIcon = (type: string) => type === 'early' ? Sun : type === 'late' ? Moon : Briefcase

  const todayShift = todayEntries[0] ? getShiftInfo(todayEntries[0].shiftId) : null

  return (
    <>
      <Header
        title={`${greeting}, ${user?.name.split(' ')[0]}!`}
        subtitle={`${now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}`}
      />

      <div className="p-4 sm:p-6 space-y-5">
        <FeatureIntro
          featureKey="employee-dashboard"
          text="Hier siehst du deinen heutigen Dienst, dein Stundenkonto und kannst dich ein- und ausstempeln. Über die Schnellzugriffe erreichst du Dienstplan, Zeiterfassung und Urlaub."
        />
        {/* Clock In/Out Hero */}
        <Card className="bg-gradient-to-br from-navy to-navy-light border-0 shadow-lg" padding="lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-navy-100 text-sm font-medium mb-1">
                {todayShift ? `Heute: ${todayShift.name}` : 'Kein Dienst heute'}
              </p>
              {todayShift && (
                <p className="text-white text-2xl font-bold">
                  {todayShift.startTime} – {todayShift.endTime} Uhr
                </p>
              )}
              {clockedIn && clockInTime && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-green-300 text-sm">Eingestempelt seit {clockInTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              {!clockedIn ? (
                todayShift ? (
                  <Button onClick={handleClockIn} size="lg" className="gap-2 whitespace-nowrap">
                    <PlayCircle size={20} />
                    Einstempeln
                  </Button>
                ) : (
                  <span title="Kein Dienst heute geplant – Einstempeln nicht möglich">
                    <Button disabled size="lg" className="gap-2 whitespace-nowrap">
                      <PlayCircle size={20} />
                      Einstempeln
                    </Button>
                  </span>
                )
              ) : (
                <Button onClick={handleClockOut} variant="danger" size="lg" className="gap-2 whitespace-nowrap">
                  <StopCircle size={20} />
                  Ausstempeln
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Aufgaben innerhalb des heutigen Dienstes – wird automatisch aus dem aktuellen
            Dienstplan und den zugewiesenen Aufgaben abgeleitet, daher immer aktuell. */}
        {todayShift && (employee?.allowedTasks?.length ?? 0) > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Meine Aufgaben heute</CardTitle>
            </CardHeader>
            <div className="flex flex-wrap gap-2">
              {employee!.allowedTasks!.map(task => (
                <span key={task} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-xs font-medium text-navy">
                  <ListChecks size={13} className="text-brand-dark" />
                  {task}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            title="Stundenkonto"
            value={`${employee?.hoursBalance && employee.hoursBalance > 0 ? '+' : ''}${employee?.hoursBalance || 0}h`}
            subtitle="aktueller Stand"
            icon={TrendingUp}
            iconColor={employee?.hoursBalance && employee.hoursBalance >= 0 ? 'text-green-600' : 'text-red-500'}
            iconBg={employee?.hoursBalance && employee.hoursBalance >= 0 ? 'bg-green-100' : 'bg-red-100'}
          />
          <StatCard
            title="Diese Woche"
            value={formatTime(weekMinutes)}
            subtitle={`von ${employee?.weeklyHours || 38}h`}
            icon={Clock}
            iconColor="text-blue-600"
            iconBg="bg-blue-100"
          />
          <StatCard
            title="Resturlaub"
            value={`${vacationRemaining} Tage`}
            subtitle={`von ${employee?.vacationDaysTotal || 30}`}
            icon={Palmtree}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-100"
          />
          <StatCard
            title="Anträge"
            value={pendingVacations.length}
            subtitle="offen"
            icon={Calendar}
            iconColor="text-amber-600"
            iconBg="bg-amber-100"
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          {/* Upcoming Shifts */}
          <Card>
            <CardHeader>
              <CardTitle>Meine nächsten Dienste</CardTitle>
              <Link href="/employee/schedule" className="text-xs text-brand font-semibold flex items-center gap-1 hover:underline">
                Alle <ChevronRight size={12} />
              </Link>
            </CardHeader>
            <div className="space-y-2">
              {upcomingEntries.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Calendar size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Keine Dienste geplant</p>
                </div>
              ) : (
                upcomingEntries.map(entry => {
                  const shift = getShiftInfo(entry.shiftId)
                  if (!shift) return null
                  const Icon = getShiftIcon(shift.type)
                  const isEntryToday = entry.date === today
                  return (
                    <div key={entry.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: shift.bgColor }}>
                        <Icon size={18} style={{ color: shift.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-navy">{shift.name}</p>
                          {isEntryToday && <Badge variant="warning">Heute</Badge>}
                          {entry.status === 'planned' && <Badge variant="default">Geplant</Badge>}
                        </div>
                        <p className="text-xs text-gray-500">{getDayName(entry.date)}, {formatDate(entry.date)} · {shift.startTime}–{shift.endTime} Uhr</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </Card>

          {/* Vacation Status */}
          <Card>
            <CardHeader>
              <CardTitle>Urlaubsanträge</CardTitle>
              <Link href="/employee/vacation" className="text-xs text-brand font-semibold flex items-center gap-1 hover:underline">
                Alle <ChevronRight size={12} />
              </Link>
            </CardHeader>
            <div className="space-y-2 mb-4">
              {myVacations.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <Palmtree size={28} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Keine Anträge</p>
                </div>
              ) : (
                myVacations.slice(0, 3).map(v => (
                  <div key={v.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-navy">{formatDate(v.startDate)} – {formatDate(v.endDate)}</p>
                      <p className="text-xs text-gray-500">{v.days} Arbeitstage</p>
                    </div>
                    <Badge variant={v.status === 'approved' ? 'success' : v.status === 'denied' ? 'danger' : 'warning'}>
                      {v.status === 'approved' ? 'Genehmigt' : v.status === 'denied' ? 'Abgelehnt' : 'Ausstehend'}
                    </Badge>
                  </div>
                ))
              )}
            </div>
            <Link href="/employee/vacation">
              <Button variant="ghost" size="sm" className="w-full border border-dashed border-gray-200 hover:border-brand hover:bg-amber-50">
                + Urlaub beantragen
              </Button>
            </Link>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardTitle className="mb-4">Schnellzugriff</CardTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { href: '/employee/schedule', icon: Calendar, label: 'Dienstplan', color: 'bg-blue-50 text-blue-600' },
              { href: '/employee/time-tracking', icon: Clock, label: 'Zeiterfassung', color: 'bg-emerald-50 text-emerald-600' },
              { href: '/employee/vacation', icon: Palmtree, label: 'Urlaub', color: 'bg-amber-50 text-amber-600' },
              { href: '/employee/profile', icon: AlertCircle, label: 'Einschränkungen', color: 'bg-purple-50 text-purple-600' },
            ].map(({ href, icon: Icon, label, color }) => (
              <Link key={href} href={href}>
                <div className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-gray-50 transition-colors text-center group">
                  <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <Icon size={22} />
                  </div>
                  <span className="text-xs font-semibold text-navy">{label}</span>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}
