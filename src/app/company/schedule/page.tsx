'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { getWeekDays, toDateString, formatDateShort, getDayName } from '@/lib/utils'
import { Calendar, ChevronLeft, ChevronRight, AlertTriangle, Building2 } from 'lucide-react'
import type { Employee, Location, Shift, ScheduleEntry } from '@/lib/types'

export default function CompanySchedule() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [EMPLOYEES, setEMPLOYEES] = useState<Employee[]>([])
  const [LOCATIONS, setLOCATIONS] = useState<Location[]>([])
  const [SHIFTS, setSHIFTS] = useState<Shift[]>([])
  const [SCHEDULE_ENTRIES, setSCHEDULE_ENTRIES] = useState<ScheduleEntry[]>([])
  const weekDates = getWeekDays(currentDate).map(toDateString)

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => setEMPLOYEES(d.employees))
    fetch('/api/locations').then(r => r.json()).then(d => setLOCATIONS(d.locations))
    fetch('/api/shifts').then(r => r.json()).then(d => setSHIFTS(d.shifts))
    fetch('/api/schedule-entries').then(r => r.json()).then(d => setSCHEDULE_ENTRIES(d.entries))
  }, [])

  const navigate = (dir: -1 | 1) => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + dir * 7)
    setCurrentDate(d)
  }

  const locationOverview = LOCATIONS.map(loc => {
    const locShifts = SHIFTS.filter(s => s.locationId === loc.id)
    const days = weekDates.map(date => {
      const entries = SCHEDULE_ENTRIES.filter(e => e.locationId === loc.id && e.date === date)
      const requiredStaff = locShifts.reduce((s, sh) => s + sh.minStaff, 0)
      const scheduledStaff = entries.length
      return { date, scheduledStaff, requiredStaff, understaffed: scheduledStaff < requiredStaff }
    })
    const understaffedDays = days.filter(d => d.understaffed).length
    return { ...loc, days, understaffedDays }
  })

  return (
    <>
      <Header title="Dienstpläne aller Einrichtungen" subtitle="Organisationsweite Übersicht · Bearbeitung erfolgt durch die jeweilige Einrichtungsleitung" />
      <div className="p-4 sm:p-6 space-y-5">

        <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ChevronLeft size={18} className="text-gray-500" />
          </button>
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-gray-400" />
            <p className="text-sm font-semibold text-navy">
              {formatDateShort(weekDates[0])} – {formatDateShort(weekDates[6])}
            </p>
          </div>
          <button onClick={() => navigate(1)} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ChevronRight size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          {locationOverview.map(loc => (
            <Card key={loc.id}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-navy flex items-center justify-center flex-shrink-0">
                    <Building2 size={16} className="text-brand" />
                  </div>
                  <CardTitle>{loc.name}</CardTitle>
                </div>
                {loc.understaffedDays > 0 ? (
                  <Badge variant="danger" className="gap-1">
                    <AlertTriangle size={10} />
                    {loc.understaffedDays} Tage unterbesetzt
                  </Badge>
                ) : (
                  <Badge variant="success">Vollständig besetzt</Badge>
                )}
              </CardHeader>
              <div className="grid grid-cols-7 gap-2">
                {loc.days.map(d => (
                  <div key={d.date} className={`rounded-xl p-2 text-center ${d.understaffed ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                    <p className="text-[10px] text-gray-400 font-medium uppercase">{getDayName(d.date, true)}</p>
                    <p className="text-xs text-gray-500 mb-1">{formatDateShort(d.date)}</p>
                    <p className={`text-sm font-bold ${d.understaffed ? 'text-red-600' : 'text-navy'}`}>
                      {d.scheduledStaff}/{d.requiredStaff}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Mitarbeiter ohne Einteilung diese Woche</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {EMPLOYEES.filter(e => e.role === 'employee').filter(emp =>
              !SCHEDULE_ENTRIES.some(en => en.employeeId === emp.id && weekDates.includes(en.date))
            ).map(emp => {
              const loc = LOCATIONS.find(l => l.id === emp.locationId)
              return (
                <div key={emp.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold">
                    {emp.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-navy">{emp.name}</p>
                    <p className="text-xs text-gray-400">{loc?.name}</p>
                  </div>
                </div>
              )
            })}
            {EMPLOYEES.filter(e => e.role === 'employee').every(emp =>
              SCHEDULE_ENTRIES.some(en => en.employeeId === emp.id && weekDates.includes(en.date))
            ) && (
              <p className="text-sm text-gray-400 text-center py-4">Alle Mitarbeiter eingeteilt ✓</p>
            )}
          </div>
        </Card>
      </div>
    </>
  )
}
