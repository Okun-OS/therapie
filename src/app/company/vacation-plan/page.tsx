'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { SCHOOL_HOLIDAYS_2026 } from '@/lib/school-holidays'
import { Employee, Location, VacationRequest, VacationPlanPreference } from '@/lib/types'
import { Palmtree, Building2, Filter, CalendarDays } from 'lucide-react'

export default function CompanyVacationPlan() {
  const [locationFilter, setLocationFilter] = useState('all')
  const [EMPLOYEES, setEMPLOYEES] = useState<Employee[]>([])
  const [LOCATIONS, setLOCATIONS] = useState<Location[]>([])
  const [VACATION_REQUESTS, setVACATION_REQUESTS] = useState<VacationRequest[]>([])
  const [VACATION_PREFERENCES, setVACATION_PREFERENCES] = useState<VacationPlanPreference[]>([])

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => setEMPLOYEES(d.employees))
    fetch('/api/locations').then(r => r.json()).then(d => setLOCATIONS(d.locations))
    fetch('/api/vacation-requests').then(r => r.json()).then(d => setVACATION_REQUESTS(d.requests))
    fetch('/api/vacation-preferences').then(r => r.json()).then(d => setVACATION_PREFERENCES(d.preferences))
  }, [])

  const employees = EMPLOYEES.filter(e => e.role === 'employee' && (locationFilter === 'all' || e.locationId === locationFilter))
  const requests = VACATION_REQUESTS.filter(v => locationFilter === 'all' || v.locationId === locationFilter)

  const approvedDays = requests.filter(v => v.status === 'approved').reduce((s, v) => s + v.days, 0)
  const pendingRequests = requests.filter(v => v.status === 'pending')
  const totalRemaining = employees.reduce((s, e) => s + (e.vacationDaysTotal - e.vacationDaysUsed), 0)
  const withChildrenPriority = VACATION_PREFERENCES.filter(p => p.hasChildren && employees.some(e => e.id === p.employeeId)).length

  const locationStats = LOCATIONS.map(loc => {
    const locReqs = VACATION_REQUESTS.filter(v => v.locationId === loc.id)
    const approved = locReqs.filter(v => v.status === 'approved').reduce((s, v) => s + v.days, 0)
    const pending = locReqs.filter(v => v.status === 'pending').length
    return { ...loc, approved, pending }
  })

  const upcomingHolidays = SCHOOL_HOLIDAYS_2026.slice(0, 6)

  return (
    <>
      <Header title="Jahresurlaubsplanung" subtitle="Organisationsweite Übersicht aller Standorte" />
      <div className="p-4 sm:p-6 space-y-5">

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-500" />
          <Select value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
            <option value="all">Alle Standorte</option>
            {LOCATIONS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
              <Palmtree size={18} className="text-amber-600" />
            </div>
            <p className="text-xl font-bold text-navy">{approvedDays}T</p>
            <p className="text-xs text-gray-500 mt-0.5">Genehmigter Urlaub (Jahr)</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center mb-3">
              <Palmtree size={18} className="text-red-600" />
            </div>
            <p className="text-xl font-bold text-navy">{pendingRequests.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Offene Anträge</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center mb-3">
              <Palmtree size={18} className="text-green-600" />
            </div>
            <p className="text-xl font-bold text-navy">{totalRemaining}T</p>
            <p className="text-xs text-gray-500 mt-0.5">Resturlaub gesamt</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
              <CalendarDays size={18} className="text-blue-600" />
            </div>
            <p className="text-xl font-bold text-navy">{withChildrenPriority}</p>
            <p className="text-xs text-gray-500 mt-0.5">Mit Schulferien-Priorität</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Urlaub je Standort</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {locationStats.map(loc => (
              <div key={loc.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                <div className="w-9 h-9 rounded-xl bg-navy flex items-center justify-center flex-shrink-0">
                  <Building2 size={16} className="text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy">{loc.name}</p>
                  <p className="text-xs text-gray-500">{loc.approved} Tage genehmigt</p>
                </div>
                {loc.pending > 0 && <Badge variant="warning">{loc.pending} offen</Badge>}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Anstehende Schulferien</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {upcomingHolidays.map((h, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-navy">{h.name}</p>
                  <p className="text-xs text-gray-400">{h.state}</p>
                </div>
                <p className="text-xs text-gray-500">{h.startDate} – {h.endDate}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}
