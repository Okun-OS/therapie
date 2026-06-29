'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Employee, Location, TimeLog, VacationRequest, Absence } from '@/lib/types'
import { Download, BarChart3, TrendingUp, Users, Clock, Palmtree, Building2, Filter, Stethoscope } from 'lucide-react'

export default function CompanyReports() {
  const [locationFilter, setLocationFilter] = useState('all')
  const [EMPLOYEES, setEMPLOYEES] = useState<Employee[]>([])
  const [LOCATIONS, setLOCATIONS] = useState<Location[]>([])
  const [TIME_LOGS, setTIME_LOGS] = useState<TimeLog[]>([])
  const [VACATION_REQUESTS, setVACATION_REQUESTS] = useState<VacationRequest[]>([])
  const [ABSENCES, setABSENCES] = useState<Absence[]>([])

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => setEMPLOYEES(d.employees))
    fetch('/api/locations').then(r => r.json()).then(d => setLOCATIONS(d.locations))
    fetch('/api/time-logs').then(r => r.json()).then(d => setTIME_LOGS(d.logs))
    fetch('/api/vacation-requests').then(r => r.json()).then(d => setVACATION_REQUESTS(d.requests))
    fetch('/api/absences').then(r => r.json()).then(d => setABSENCES(d.absences))
  }, [])

  const locations = LOCATIONS
  const employees = EMPLOYEES.filter(e => e.role === 'employee')
  const logs = TIME_LOGS

  const getAbsencesByEmployee = (employeeId: string) =>
    ABSENCES.filter(a => a.employeeId === employeeId).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))

  const filteredEmployees = locationFilter === 'all' ? employees : employees.filter(e => e.locationId === locationFilter)

  const totalHours = logs.reduce((s, l) => s + (l.totalMinutes || 0) - (l.breakMinutes || 0), 0)
  const avgHoursPerEmp = employees.length > 0 ? Math.round(totalHours / employees.length / 60) : 0
  const totalVacationDays = employees.reduce((s, e) => s + e.vacationDaysUsed, 0)
  const totalVacationRemaining = employees.reduce((s, e) => s + (e.vacationDaysTotal - e.vacationDaysUsed), 0)

  const currentYear = new Date().getFullYear()
  const employeeAbsences = employees.map(e => ({
    employeeId: e.id,
    locationId: e.locationId,
    absences: getAbsencesByEmployee(e.id).filter(a => a.startDate.startsWith(`${currentYear}`)),
  }))
  const totalSickDays = employeeAbsences.reduce((s, e) => s + e.absences.filter(a => a.type === 'krankheit').reduce((s2, a) => s2 + a.days, 0), 0)
  const totalOtherAbsenceDays = employeeAbsences.reduce((s, e) => s + e.absences.filter(a => a.type !== 'krankheit').reduce((s2, a) => s2 + a.days, 0), 0)

  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

  const locationData = locations.map(loc => {
    const emps = employees.filter(e => e.locationId === loc.id)
    const locLogs = logs.filter(l => l.locationId === loc.id)
    const hours = Math.round(locLogs.reduce((s, l) => s + (l.totalMinutes || 0) - (l.breakMinutes || 0), 0) / 60)
    const vacReqs = VACATION_REQUESTS.filter(v => v.locationId === loc.id)
    const approved = vacReqs.filter(v => v.status === 'approved').reduce((s, v) => s + v.days, 0)
    const pending = vacReqs.filter(v => v.status === 'pending').length
    const avgBalance = emps.length > 0 ? (emps.reduce((s, e) => s + e.hoursBalance, 0) / emps.length).toFixed(1) : '0'
    const locAbsences = employeeAbsences.filter(a => a.locationId === loc.id)
    const sickDays = locAbsences.reduce((s, a) => s + a.absences.filter(x => x.type === 'krankheit').reduce((s2, x) => s2 + x.days, 0), 0)
    return { ...loc, emps: emps.length, hours, vacApproved: approved, vacPending: pending, avgBalance: Number(avgBalance), sickDays }
  })

  return (
    <>
      <Header title="Unternehmensberichte" subtitle="Alle Standorte im Überblick" />
      <div className="p-4 sm:p-6 space-y-5">

        {/* Filter + Export */}
        <div className="flex gap-3 flex-wrap items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-500" />
            <Select value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
              <option value="all">Alle Standorte</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="gap-2 border border-gray-200">
              <Download size={14} />
              PDF
            </Button>
            <Button variant="ghost" size="sm" className="gap-2 border border-gray-200">
              <Download size={14} />
              Excel
            </Button>
          </div>
        </div>

        {/* Global KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Gesamtstunden (Monat)', value: `${Math.round(totalHours / 60)}h`, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100' },
            { label: 'Ø Stunden / MA', value: `${avgHoursPerEmp}h`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-100' },
            { label: 'Urlaub verbraucht', value: `${totalVacationDays}T`, icon: Palmtree, color: 'text-amber-600', bg: 'bg-amber-100' },
            { label: 'Resturlaub gesamt', value: `${totalVacationRemaining}T`, icon: Palmtree, color: 'text-purple-600', bg: 'bg-purple-100' },
            { label: `Krankheitstage (${currentYear})`, value: `${totalSickDays}T`, icon: Stethoscope, color: 'text-red-600', bg: 'bg-red-100' },
            { label: `Fehlzeiten (${currentYear})`, value: `${totalOtherAbsenceDays}T`, icon: Stethoscope, color: 'text-orange-600', bg: 'bg-orange-100' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <Icon size={18} className={color} />
              </div>
              <p className="text-xl font-bold text-navy">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Per-Location Table */}
        <Card>
          <CardHeader>
            <CardTitle>Standort-Vergleich</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-500 pb-3">Standort</th>
                  <th className="text-center text-xs font-semibold text-gray-500 pb-3">MA</th>
                  <th className="text-center text-xs font-semibold text-gray-500 pb-3">Stunden</th>
                  <th className="text-center text-xs font-semibold text-gray-500 pb-3">Urlaub genehmigt</th>
                  <th className="text-center text-xs font-semibold text-gray-500 pb-3">Krankheitstage</th>
                  <th className="text-center text-xs font-semibold text-gray-500 pb-3">Ø Stundenkonto</th>
                </tr>
              </thead>
              <tbody>
                {locationData.map(loc => (
                  <tr key={loc.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-navy flex items-center justify-center">
                          <Building2 size={12} className="text-brand" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-navy">{loc.name}</p>
                          <p className="text-xs text-gray-400">{loc.city}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-center text-sm font-medium text-navy">{loc.emps}</td>
                    <td className="py-3 text-center text-sm font-bold text-navy">{loc.hours}h</td>
                    <td className="py-3 text-center">
                      <span className="text-sm text-gray-600">{loc.vacApproved}T</span>
                      {loc.vacPending > 0 && (
                        <Badge variant="warning" className="ml-2">{loc.vacPending} offen</Badge>
                      )}
                    </td>
                    <td className="py-3 text-center text-sm text-gray-600">{loc.sickDays}T</td>
                    <td className="py-3 text-center">
                      <span className={`text-sm font-bold ${loc.avgBalance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {loc.avgBalance >= 0 ? '+' : ''}{loc.avgBalance}h
                      </span>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-200 bg-gray-50/50">
                  <td className="py-3 text-sm font-bold text-navy">Gesamt</td>
                  <td className="py-3 text-center text-sm font-bold text-navy">{filteredEmployees.length}</td>
                  <td className="py-3 text-center text-sm font-bold text-navy">{Math.round(totalHours / 60)}h</td>
                  <td className="py-3 text-center text-sm font-bold text-navy">{totalVacationDays}T</td>
                  <td className="py-3 text-center text-sm font-bold text-navy">{totalSickDays}T</td>
                  <td className="py-3 text-center text-sm font-bold text-navy">
                    {(employees.reduce((s, e) => s + e.hoursBalance, 0) / employees.length).toFixed(1)}h
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {/* Hours per Location Bar Chart */}
        <Card>
          <CardTitle className="mb-4">Stunden je Standort</CardTitle>
          <div className="space-y-3">
            {locationData.map(loc => {
              const maxH = Math.max(...locationData.map(l => l.hours), 1)
              const pct = (loc.hours / maxH) * 100
              return (
                <div key={loc.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-navy">{loc.name}</span>
                    <span className="font-bold text-navy">{loc.hours}h</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div className="h-3 rounded-full bg-gradient-to-r from-navy to-navy-lighter transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Employee Balance Overview */}
        <Card>
          <CardTitle className="mb-4">Mitarbeiter-Stundenkonten (Alle Standorte)</CardTitle>
          <div className="space-y-2">
            {filteredEmployees.map(emp => {
              const loc = LOCATIONS.find(l => l.id === emp.locationId)
              return (
                <div key={emp.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50">
                  <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center text-brand text-xs font-bold flex-shrink-0">
                    {emp.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-navy truncate">{emp.name}</p>
                    <p className="text-xs text-gray-400">{loc?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${emp.hoursBalance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {emp.hoursBalance >= 0 ? '+' : ''}{emp.hoursBalance}h
                    </p>
                    <p className="text-xs text-gray-400">{emp.vacationDaysTotal - emp.vacationDaysUsed}T Urlaub</p>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </>
  )
}
