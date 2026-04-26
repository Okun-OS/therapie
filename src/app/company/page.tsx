'use client'

import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EMPLOYEES, LOCATIONS, VACATION_REQUESTS, TIME_LOGS } from '@/lib/mock-data'
import { Users, Palmtree, TrendingUp, MapPin, AlertTriangle, Building2, ChevronRight, Clock } from 'lucide-react'
import Link from 'next/link'

export default function CompanyDashboard() {
  const totalEmployees = EMPLOYEES.filter(e => e.role === 'employee').length
  const pendingVacations = VACATION_REQUESTS.filter(v => v.status === 'pending')
  const allLogs = TIME_LOGS
  const monthHours = allLogs.reduce((s, l) => s + (l.totalMinutes || 0), 0)

  const locationStats = LOCATIONS.map(loc => {
    const emps = EMPLOYEES.filter(e => e.locationId === loc.id && e.role === 'employee')
    const locLogs = TIME_LOGS.filter(t => t.locationId === loc.id)
    const locHours = Math.round(locLogs.reduce((s, l) => s + (l.totalMinutes || 0), 0) / 60)
    const pending = VACATION_REQUESTS.filter(v => v.locationId === loc.id && v.status === 'pending')
    const hoursBalance = emps.reduce((s, e) => s + e.hoursBalance, 0).toFixed(1)
    return { ...loc, empCount: emps.length, locHours, pendingVacations: pending.length, hoursBalance: Number(hoursBalance) }
  })

  const alerts = [
    pendingVacations.length > 3 && `${pendingVacations.length} offene Urlaubsanträge warten auf Genehmigung`,
    EMPLOYEES.some(e => e.hoursBalance < -5) && 'Mitarbeiter mit negativem Stundenkonto (> -5h) vorhanden',
  ].filter(Boolean) as string[]

  return (
    <>
      <Header title="Unternehmens-Übersicht" subtitle="BrightCare GmbH · Alle Standorte" />
      <div className="p-4 sm:p-6 space-y-5">

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={18} className="text-amber-500" />
              <p className="font-semibold text-amber-700 text-sm">Handlungsbedarf</p>
            </div>
            <ul className="space-y-1">
              {alerts.map((a, i) => (
                <li key={i} className="text-sm text-amber-700 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Global Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Mitarbeiter gesamt" value={totalEmployees} subtitle={`${LOCATIONS.length} Standorte`} icon={Users} iconColor="text-navy" iconBg="bg-navy-50" />
          <StatCard title="Standorte" value={LOCATIONS.length} subtitle="aktiv" icon={MapPin} iconColor="text-blue-600" iconBg="bg-blue-100" />
          <StatCard title="Offene Anträge" value={pendingVacations.length} subtitle="Urlaub" icon={Palmtree} iconColor="text-amber-600" iconBg="bg-amber-100" alert={pendingVacations.length > 2} />
          <StatCard title="Std. diesen Monat" value={`${Math.round(monthHours / 60)}h`} subtitle="alle MA" icon={TrendingUp} iconColor="text-green-600" iconBg="bg-green-100" />
        </div>

        {/* Location Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Standort-Übersicht</CardTitle>
            <Link href="/company/locations" className="text-xs text-brand font-semibold flex items-center gap-1 hover:underline">
              Verwalten <ChevronRight size={12} />
            </Link>
          </CardHeader>
          <div className="space-y-3">
            {locationStats.map(loc => (
              <div key={loc.id} className="p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-navy flex items-center justify-center flex-shrink-0">
                      <Building2 size={18} className="text-brand" />
                    </div>
                    <div>
                      <p className="font-semibold text-navy text-sm">{loc.name}</p>
                      <p className="text-xs text-gray-500">{loc.address}, {loc.city}</p>
                    </div>
                  </div>
                  <Badge variant={loc.active ? 'success' : 'danger'}>
                    {loc.active ? 'Aktiv' : 'Inaktiv'}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-navy">{loc.empCount}</p>
                    <p className="text-[10px] text-gray-500">Mitarbeiter</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-navy">{loc.locHours}h</p>
                    <p className="text-[10px] text-gray-500">Stunden/Monat</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-lg font-bold ${loc.pendingVacations > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                      {loc.pendingVacations}
                    </p>
                    <p className="text-[10px] text-gray-500">Offene Anträge</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Pending Vacations */}
        <Card>
          <CardHeader>
            <CardTitle>Offene Urlaubsanträge</CardTitle>
            <Badge variant="warning">{pendingVacations.length} offen</Badge>
          </CardHeader>
          <div className="space-y-2">
            {pendingVacations.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Alle Anträge bearbeitet ✓</p>
            ) : (
              pendingVacations.map(v => (
                <div key={v.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                  <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center text-brand text-xs font-bold flex-shrink-0">
                    {v.employeeName.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-navy">{v.employeeName}</p>
                    <p className="text-xs text-gray-500">{v.locationName} · {v.days} Tage</p>
                  </div>
                  <Badge variant="warning">Offen</Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Stunden-Balance Heatmap */}
        <Card>
          <CardTitle className="mb-4">Stundenkonto – Alle Standorte</CardTitle>
          <div className="space-y-2">
            {EMPLOYEES.filter(e => e.role === 'employee').map(emp => {
              const loc = LOCATIONS.find(l => l.id === emp.locationId)
              const isNeg = emp.hoursBalance < 0
              return (
                <div key={emp.id} className="flex items-center gap-3">
                  <div className="w-28 text-xs text-gray-500 truncate flex-shrink-0">{emp.name.split(' ')[0]}</div>
                  <div className="w-20 text-xs text-gray-400 truncate flex-shrink-0">{loc?.name.replace('Kita ', '')}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 relative">
                    <div
                      className={`h-2 rounded-full ${isNeg ? 'bg-red-400' : 'bg-green-400'}`}
                      style={{ width: `${Math.min(Math.abs(emp.hoursBalance) * 5, 100)}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold w-10 text-right flex-shrink-0 ${isNeg ? 'text-red-500' : 'text-green-600'}`}>
                    {emp.hoursBalance >= 0 ? '+' : ''}{emp.hoursBalance}h
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </>
  )
}
