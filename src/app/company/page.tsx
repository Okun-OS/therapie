'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { FeatureIntro } from '@/components/onboarding/FeatureIntro'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { VACATION_REQUESTS, TIME_LOGS } from '@/lib/mock-data'
import {
  Users, Palmtree, TrendingUp, MapPin, AlertTriangle, Building2,
  ChevronRight, Clock, Search, Filter, Baby,
} from 'lucide-react'
import Link from 'next/link'
import type { Employee, Location } from '@/lib/types'

type Tab = 'overview' | 'employees' | 'locations'

export default function CompanyDashboard() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('overview')
  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState('all')
  const [EMPLOYEES, setEMPLOYEES] = useState<Employee[]>([])
  const [LOCATIONS, setLOCATIONS] = useState<Location[]>([])

  // Beim ersten Login eines neuen Trägers ist das KI-Onboarding (Modul 02) noch
  // nicht abgeschlossen – dann startet es automatisch statt des Dashboards,
  // statt sich hinter einem Sidebar-Link zu verstecken.
  useEffect(() => {
    fetch('/api/onboarding')
      .then(r => r.json())
      .then(json => {
        if (!json.organization?.completed) router.replace('/company/onboarding')
      })
      .catch(() => {})
  }, [router])

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => setEMPLOYEES(d.employees))
    fetch('/api/locations').then(r => r.json()).then(d => setLOCATIONS(d.locations))
  }, [])

  const totalEmployees = EMPLOYEES.filter(e => e.role === 'employee').length
  const pendingVacations = VACATION_REQUESTS.filter(v => v.status === 'pending')
  const monthHours = TIME_LOGS.reduce((s, l) => s + (l.totalMinutes || 0), 0)

  const locationStats = LOCATIONS.map(loc => {
    const emps = EMPLOYEES.filter(e => e.locationId === loc.id && e.role === 'employee')
    const locLogs = TIME_LOGS.filter(t => t.locationId === loc.id)
    const locHours = Math.round(locLogs.reduce((s, l) => s + (l.totalMinutes || 0), 0) / 60)
    const pending = VACATION_REQUESTS.filter(v => v.locationId === loc.id && v.status === 'pending')
    const admin = EMPLOYEES.find(e => e.id === loc.adminId)
    return { ...loc, empCount: emps.length, locHours, pendingVacations: pending.length, adminName: admin?.name ?? '–' }
  })

  const alerts = [
    pendingVacations.length > 3 && `${pendingVacations.length} offene Urlaubsanträge warten auf Genehmigung`,
    EMPLOYEES.some(e => e.hoursBalance < -5) && 'Mitarbeiter mit negativem Stundenkonto (> -5h) vorhanden',
  ].filter(Boolean) as string[]

  const allEmployees = EMPLOYEES.filter(e => e.role === 'employee')
  const filteredEmployees = allEmployees.filter(emp => {
    const loc = LOCATIONS.find(l => l.id === emp.locationId)
    const matchSearch = emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.position.toLowerCase().includes(search.toLowerCase()) ||
      (loc?.name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchLoc = locationFilter === 'all' || emp.locationId === locationFilter
    return matchSearch && matchLoc
  })

  return (
    <>
      <Header title="Unternehmens-Übersicht" subtitle="BrightCare GmbH · Alle Standorte" />
      <div className="p-4 sm:p-6 space-y-4">
        <FeatureIntro
          featureKey="company-overview"
          text="Hier sehen Sie alle Einrichtungen Ihres Trägers im Überblick: Mitarbeiterzahlen, Stundenkonten und offene Urlaubsanträge je Standort."
        />

        {/* Tab bar */}
        <div className="flex bg-white border border-gray-100 rounded-2xl p-1">
          {([
            { key: 'overview' as Tab,   label: 'Übersicht',       badge: undefined as number | undefined },
            { key: 'employees' as Tab,  label: 'Mitarbeiter',     badge: totalEmployees as number | undefined },
            { key: 'locations' as Tab,  label: 'Einrichtungen',   badge: LOCATIONS.length as number | undefined },
          ]).map(({ key, label, badge }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${tab === key ? 'bg-navy text-white' : 'text-gray-500 hover:bg-gray-50'}`}
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
          <>
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

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard title="Mitarbeiter gesamt" value={totalEmployees} subtitle={`${LOCATIONS.length} Standorte`} icon={Users} iconColor="text-navy" iconBg="bg-navy-50" />
              <StatCard title="Standorte" value={LOCATIONS.length} subtitle="aktiv" icon={MapPin} iconColor="text-blue-600" iconBg="bg-blue-100" />
              <StatCard title="Offene Anträge" value={pendingVacations.length} subtitle="Urlaub" icon={Palmtree} iconColor="text-amber-600" iconBg="bg-amber-100" alert={pendingVacations.length > 2} />
              <StatCard title="Std. erfasst" value={`${Math.round(monthHours / 60)}h`} subtitle="gesamt alle MA" icon={TrendingUp} iconColor="text-green-600" iconBg="bg-green-100" />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Stundenkonto – alle Standorte</CardTitle>
              </CardHeader>
              <div className="space-y-2">
                {allEmployees.map(emp => {
                  const loc = LOCATIONS.find(l => l.id === emp.locationId)
                  const isNeg = emp.hoursBalance < 0
                  return (
                    <div key={emp.id} className="flex items-center gap-3">
                      <div className="w-24 text-xs text-gray-600 font-medium truncate flex-shrink-0">{emp.name.split(' ')[0]}</div>
                      <div className="w-24 text-xs text-gray-400 truncate flex-shrink-0">{loc?.name.replace('Kita ', '')}</div>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className={`h-2 rounded-full ${isNeg ? 'bg-red-400' : 'bg-green-400'}`}
                          style={{ width: `${Math.min(Math.abs(emp.hoursBalance) * 6, 100)}%` }} />
                      </div>
                      <button
                        onClick={() => router.push(`/company/employees/${emp.id}`)}
                        className={`text-xs font-bold w-10 text-right flex-shrink-0 hover:underline ${isNeg ? 'text-red-500' : 'text-green-600'}`}
                      >
                        {emp.hoursBalance >= 0 ? '+' : ''}{emp.hoursBalance}h
                      </button>
                    </div>
                  )
                })}
              </div>
            </Card>

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
                    <button key={v.id} onClick={() => router.push(`/company/employees/${v.employeeId}`)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-left">
                      <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center text-brand text-xs font-bold flex-shrink-0">
                        {v.employeeName.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-navy">{v.employeeName}</p>
                        <p className="text-xs text-gray-500">{v.locationName} · {v.days} Tage</p>
                      </div>
                      <Badge variant="warning">Offen</Badge>
                    </button>
                  ))
                )}
              </div>
            </Card>
          </>
        )}

        {/* ── MITARBEITER ────────────────────────────────────────────── */}
        {tab === 'employees' && (
          <>
            <div className="flex gap-2 flex-wrap">
              <div className="flex-1 min-w-[180px] relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Name, Position, Einrichtung..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white" />
              </div>
              <div className="relative">
                <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
                  className="pl-8 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
                  <option value="all">Alle Einrichtungen</option>
                  {LOCATIONS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Mitarbeiter', value: filteredEmployees.length, color: 'text-navy' },
                { label: 'Positives Konto', value: filteredEmployees.filter(e => e.hoursBalance >= 0).length, color: 'text-green-600' },
                { label: 'Resturlaub ges.', value: filteredEmployees.reduce((s, e) => s + e.vacationDaysTotal - e.vacationDaysUsed, 0), color: 'text-amber-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {filteredEmployees.map(emp => {
                const loc = LOCATIONS.find(l => l.id === emp.locationId)
                const isNeg = emp.hoursBalance < 0
                return (
                  <button key={emp.id} onClick={() => router.push(`/company/employees/${emp.id}`)}
                    className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 hover:shadow-md hover:border-gray-200 transition-all text-left group">
                    <div className="w-11 h-11 rounded-2xl bg-navy flex items-center justify-center font-bold text-brand text-sm flex-shrink-0">
                      {emp.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-navy">{emp.name}</p>
                        {emp.hasChildren && <Baby size={12} className="text-blue-400" />}
                        <Badge variant="default">{emp.position}</Badge>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{loc?.name}</p>
                      <div className="flex gap-4 mt-1 flex-wrap">
                        <span className="text-xs text-gray-500 flex items-center gap-1"><Clock size={10} />{emp.weeklyHours}h/Wo</span>
                        <span className={`text-xs font-semibold flex items-center gap-1 ${isNeg ? 'text-red-500' : 'text-green-600'}`}>
                          <TrendingUp size={10} />{emp.hoursBalance >= 0 ? '+' : ''}{emp.hoursBalance}h
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Palmtree size={10} />{emp.vacationDaysTotal - emp.vacationDaysUsed} Urlaubstage
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-brand transition-colors flex-shrink-0" />
                  </button>
                )
              })}
              {filteredEmployees.length === 0 && (
                <div className="text-center py-12">
                  <Users size={36} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-sm text-gray-500">Keine Mitarbeiter gefunden</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── EINRICHTUNGEN ──────────────────────────────────────────── */}
        {tab === 'locations' && (
          <div className="space-y-3">
            {locationStats.map(loc => (
              <div key={loc.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-navy flex items-center justify-center flex-shrink-0">
                      <Building2 size={18} className="text-brand" />
                    </div>
                    <div>
                      <p className="font-bold text-navy">{loc.name}</p>
                      <p className="text-xs text-gray-500">{loc.address}, {loc.city}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Leitung: {loc.adminName}</p>
                    </div>
                  </div>
                  <Badge variant={loc.active ? 'success' : 'danger'}>{loc.active ? 'Aktiv' : 'Inaktiv'}</Badge>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'Mitarbeiter', value: loc.empCount, color: 'text-navy' },
                    { label: 'Std. erfasst', value: `${loc.locHours}h`, color: 'text-navy' },
                    { label: 'Offen Urlaub', value: loc.pendingVacations, color: loc.pendingVacations > 0 ? 'text-amber-600' : 'text-gray-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className={`text-xl font-bold ${color}`}>{value}</p>
                      <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5 mb-4">
                  {EMPLOYEES.filter(e => e.locationId === loc.id && e.role === 'employee').map(emp => {
                    const isNeg = emp.hoursBalance < 0
                    return (
                      <button key={emp.id} onClick={() => router.push(`/company/employees/${emp.id}`)}
                        className="w-full flex items-center gap-2 text-left hover:opacity-80 transition-opacity">
                        <span className="text-xs text-gray-500 w-20 truncate flex-shrink-0">{emp.name.split(' ')[0]}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${isNeg ? 'bg-red-400' : 'bg-green-400'}`}
                            style={{ width: `${Math.min(Math.abs(emp.hoursBalance) * 6, 100)}%` }} />
                        </div>
                        <span className={`text-xs font-bold w-9 text-right flex-shrink-0 ${isNeg ? 'text-red-500' : 'text-green-600'}`}>
                          {emp.hoursBalance >= 0 ? '+' : ''}{emp.hoursBalance}h
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="pt-3 border-t border-gray-100">
                  <Link href="/company/locations" className="text-xs text-brand font-semibold flex items-center gap-1 hover:underline">
                    Standort verwalten <ChevronRight size={12} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
