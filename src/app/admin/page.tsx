'use client'

import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth-context'
import { EMPLOYEES, VACATION_REQUESTS, SCHEDULE_ENTRIES, SHIFTS, TIME_LOGS } from '@/lib/mock-data'
import { Users, Clock, Palmtree, AlertTriangle, Calendar, CheckCircle, TrendingUp, ChevronRight, UserCheck } from 'lucide-react'
import { formatDate, toDateString } from '@/lib/utils'
import Link from 'next/link'

export default function AdminDashboard() {
  const { user } = useAuth()
  const locationId = user?.locationId || 'loc1'

  const locationEmployees = EMPLOYEES.filter(e => e.locationId === locationId && e.role === 'employee')
  const pendingVacations = VACATION_REQUESTS.filter(v => v.locationId === locationId && v.status === 'pending')
  const today = toDateString(new Date())

  const todaySchedule = SCHEDULE_ENTRIES.filter(e => e.date === today && e.locationId === locationId)
  const presentToday = todaySchedule.length

  const weekLogs = TIME_LOGS.filter(t => t.locationId === locationId)
  const weekHours = weekLogs.reduce((s, t) => s + (t.totalMinutes || 0), 0)

  const locationShifts = SHIFTS.filter(s => s.locationId === locationId)

  // Check understaffing
  const alerts: string[] = []
  locationShifts.forEach(shift => {
    const assigned = todaySchedule.filter(e => e.shiftId === shift.id).length
    if (assigned < shift.minStaff) {
      alerts.push(`${shift.name}: nur ${assigned}/${shift.minStaff} Mitarbeiter`)
    }
  })

  const recentVacations = VACATION_REQUESTS.filter(v => v.locationId === locationId).slice(0, 4)

  return (
    <>
      <Header
        title={`Admin Dashboard`}
        subtitle={`${new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
      />
      <div className="p-4 sm:p-6 space-y-5">

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={18} className="text-red-500" />
              <p className="font-semibold text-red-700 text-sm">Unterbesetzung heute</p>
            </div>
            <ul className="space-y-1">
              {alerts.map((a, i) => (
                <li key={i} className="text-sm text-red-600 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                  {a}
                </li>
              ))}
            </ul>
            <Link href="/admin/schedule">
              <Button size="sm" className="mt-3 gap-1">
                Dienstplan anpassen
              </Button>
            </Link>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Mitarbeiter" value={locationEmployees.length} subtitle="aktiv" icon={Users} iconColor="text-navy" iconBg="bg-navy-50" />
          <StatCard title="Heute anwesend" value={presentToday} subtitle={`von ${locationEmployees.length}`} icon={UserCheck} iconColor="text-green-600" iconBg="bg-green-100" />
          <StatCard title="Urlaubsanträge" value={pendingVacations.length} subtitle="offen" icon={Palmtree} iconColor="text-amber-600" iconBg="bg-amber-100" alert={pendingVacations.length > 2} />
          <StatCard title="Stunden (Woche)" value={`${Math.floor(weekHours / 60)}h`} subtitle="alle MA" icon={TrendingUp} iconColor="text-blue-600" iconBg="bg-blue-100" />
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          {/* Today's Schedule */}
          <Card>
            <CardHeader>
              <CardTitle>Heute im Dienst</CardTitle>
              <Link href="/admin/schedule" className="text-xs text-brand font-semibold flex items-center gap-1 hover:underline">
                Dienstplan <ChevronRight size={12} />
              </Link>
            </CardHeader>
            {locationShifts.map(shift => {
              const assigned = todaySchedule
                .filter(e => e.shiftId === shift.id)
                .map(e => locationEmployees.find(emp => emp.id === e.employeeId)?.name)
                .filter(Boolean)
              const understaffed = assigned.length < shift.minStaff

              return (
                <div key={shift.id} className={`mb-3 p-3 rounded-xl border ${understaffed ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: shift.color }} />
                      <span className="text-sm font-semibold text-navy">{shift.name}</span>
                      <span className="text-xs text-gray-500">{shift.startTime}–{shift.endTime}</span>
                    </div>
                    <Badge variant={understaffed ? 'danger' : 'success'}>
                      {assigned.length}/{shift.minStaff}
                    </Badge>
                  </div>
                  {assigned.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {assigned.map(name => (
                        <span key={name} className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1">{name}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-red-500">Niemand eingeteilt</p>
                  )}
                </div>
              )
            })}
          </Card>

          {/* Vacation Requests */}
          <Card>
            <CardHeader>
              <CardTitle>Urlaubsanträge</CardTitle>
              <Link href="/admin/vacation-requests" className="text-xs text-brand font-semibold flex items-center gap-1 hover:underline">
                Alle <ChevronRight size={12} />
              </Link>
            </CardHeader>
            <div className="space-y-2">
              {recentVacations.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <CheckCircle size={28} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Keine Anträge</p>
                </div>
              ) : (
                recentVacations.map(v => (
                  <div key={v.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                    <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center text-brand text-xs font-bold flex-shrink-0">
                      {v.employeeName.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy">{v.employeeName}</p>
                      <p className="text-xs text-gray-500">{formatDate(v.startDate)} – {formatDate(v.endDate)} ({v.days}T)</p>
                    </div>
                    <Badge variant={v.status === 'approved' ? 'success' : v.status === 'denied' ? 'danger' : 'warning'}>
                      {v.status === 'approved' ? 'Ok' : v.status === 'denied' ? 'Nein' : 'Offen'}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardTitle className="mb-4">Schnellzugriff</CardTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { href: '/admin/employees', icon: Users, label: 'Mitarbeiter', color: 'bg-blue-50 text-blue-600' },
              { href: '/admin/schedule', icon: Calendar, label: 'Dienstplan KI', color: 'bg-purple-50 text-purple-600' },
              { href: '/admin/vacation-requests', icon: Palmtree, label: 'Urlaub prüfen', color: 'bg-amber-50 text-amber-600' },
              { href: '/admin/reports', icon: TrendingUp, label: 'Berichte', color: 'bg-green-50 text-green-600' },
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
