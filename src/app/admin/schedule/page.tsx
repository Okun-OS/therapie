'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/lib/auth-context'
import { EMPLOYEES, SCHEDULE_ENTRIES, SHIFTS } from '@/lib/mock-data'
import { getWeekDays, toDateString, formatDateShort, getDayName } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Sparkles, Download, Save, Sun, Moon, Briefcase, CheckCircle, Loader } from 'lucide-react'
import type { ScheduleEntry } from '@/lib/types'

const SHIFT_ICONS: Record<string, React.ElementType> = { early: Sun, late: Moon, mid: Briefcase }
const AI_STEPS = ['Analysiere Verfügbarkeiten...', 'Prüfe Einschränkungen...', 'Berechne optimale Planung...', 'Finalisiere Dienstplan...']

type GeneratedSchedule = Record<string, Record<string, string>>

function generateAISchedule(employees: typeof EMPLOYEES, shifts: typeof SHIFTS, weekDays: Date[]): GeneratedSchedule {
  const result: GeneratedSchedule = {}
  const empShiftCount: Record<string, number> = {}

  employees.forEach(emp => {
    result[emp.id] = {}
    empShiftCount[emp.id] = 0
  })

  weekDays.forEach((day, dayIdx) => {
    if (dayIdx >= 5) return // Skip weekends
    const dateStr = toDateString(day)

    shifts.forEach(shift => {
      let assigned = 0
      employees.forEach(emp => {
        if (assigned >= shift.minStaff + 1) return
        if (result[emp.id][dateStr]) return

        const prefersShift = emp.preferences?.preferredShifts?.includes(shift.type) ?? true
        const notAvailable = emp.preferences?.unavailableDays?.includes(day.getDay()) ?? false
        if (notAvailable) return

        const targetPerWeek = Math.floor(emp.weeklyHours / 8)
        if (empShiftCount[emp.id] >= targetPerWeek) return

        if (prefersShift || assigned < shift.minStaff) {
          result[emp.id][dateStr] = shift.id
          empShiftCount[emp.id]++
          assigned++
        }
      })
    })
  })

  return result
}

export default function AdminSchedule() {
  const { user } = useAuth()
  const locationId = user?.locationId || 'loc1'
  const [currentDate, setCurrentDate] = useState(new Date())
  const [aiRunning, setAiRunning] = useState(false)
  const [aiStep, setAiStep] = useState(0)
  const [aiDone, setAiDone] = useState(false)
  const [generatedSchedule, setGeneratedSchedule] = useState<GeneratedSchedule | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [saved, setSaved] = useState(false)

  const weekDays = getWeekDays(currentDate)
  const weekStart = toDateString(weekDays[0])
  const weekEnd = toDateString(weekDays[6])

  const employees = EMPLOYEES.filter(e => e.locationId === locationId && e.role === 'employee')
  const locationShifts = SHIFTS.filter(s => s.locationId === locationId)

  const existingEntries = SCHEDULE_ENTRIES.filter(e => {
    const d = new Date(e.date + 'T00:00:00')
    return e.locationId === locationId && d >= weekDays[0] && d <= weekDays[6]
  })

  const getExistingShift = (empId: string, dateStr: string) => {
    const entry = existingEntries.find(e => e.employeeId === empId && e.date === dateStr)
    return entry ? locationShifts.find(s => s.id === entry.shiftId) : null
  }

  const getGeneratedShift = (empId: string, dateStr: string) => {
    if (!generatedSchedule?.[empId]?.[dateStr]) return null
    return locationShifts.find(s => s.id === generatedSchedule[empId][dateStr])
  }

  const getShift = (empId: string, dateStr: string) =>
    generatedSchedule ? getGeneratedShift(empId, dateStr) : getExistingShift(empId, dateStr)

  const runAI = () => {
    setAiRunning(true)
    setAiDone(false)
    setAiStep(0)

    let step = 0
    const interval = setInterval(() => {
      step++
      setAiStep(step)
      if (step >= AI_STEPS.length) {
        clearInterval(interval)
        const schedule = generateAISchedule(employees, locationShifts, weekDays)
        setGeneratedSchedule(schedule)
        setAiRunning(false)
        setAiDone(true)
      }
    }, 900)
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <>
      <Header title="Dienstplan" subtitle="KI-gestützte Planung" />
      <div className="p-4 sm:p-6 space-y-4">

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-1">
            <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); setGeneratedSchedule(null); setAiDone(false) }}
              className="p-2 rounded-xl hover:bg-white border border-gray-200 transition-all">
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
            <span className="px-4 py-2 text-sm font-semibold text-navy min-w-[200px] text-center">
              {formatDateShort(weekStart)} – {formatDateShort(weekEnd)} {weekDays[0].getFullYear()}
            </span>
            <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); setGeneratedSchedule(null); setAiDone(false) }}
              className="p-2 rounded-xl hover:bg-white border border-gray-200 transition-all">
              <ChevronRight size={18} className="text-gray-600" />
            </button>
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setRulesOpen(true)} className="border border-gray-200">
              Regeln
            </Button>
            <Button variant="ghost" size="sm" className="gap-1 border border-gray-200">
              <Download size={14} />
              Export
            </Button>
            {aiDone && (
              <Button variant="success" size="sm" onClick={handleSave} className="gap-1">
                <Save size={14} />
                {saved ? 'Gespeichert!' : 'Speichern'}
              </Button>
            )}
          </div>
        </div>

        {/* AI Button */}
        <div className={`rounded-2xl p-5 border-2 transition-all ${aiDone ? 'bg-green-50 border-green-200' : 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-100'}`}>
          {!aiRunning && !aiDone ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={18} className="text-purple-600" />
                  <p className="font-bold text-navy">KI-Dienstplan erstellen</p>
                </div>
                <p className="text-sm text-gray-600">Basierend auf Verfügbarkeiten, Präferenzen, Stundenkonto und definierten Regeln.</p>
              </div>
              <Button onClick={runAI} size="lg" className="gap-2 bg-purple-600 hover:bg-purple-700 text-white focus:ring-purple-500 whitespace-nowrap">
                <Sparkles size={18} />
                Plan erstellen
              </Button>
            </div>
          ) : aiRunning ? (
            <div className="text-center py-2">
              <Loader size={28} className="mx-auto text-purple-600 animate-spin mb-3" />
              <p className="text-sm font-semibold text-purple-700">{AI_STEPS[Math.min(aiStep, AI_STEPS.length - 1)]}</p>
              <div className="flex justify-center gap-1 mt-3">
                {AI_STEPS.map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all ${i <= aiStep ? 'w-8 bg-purple-500' : 'w-3 bg-purple-200'}`} />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <CheckCircle size={24} className="text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-bold text-green-700">Dienstplan erfolgreich erstellt!</p>
                <p className="text-sm text-green-600">Alle Präferenzen und Regeln wurden berücksichtigt. Bitte prüfen und speichern.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setAiDone(false); setGeneratedSchedule(null) }} className="text-gray-500">
                Zurücksetzen
              </Button>
            </div>
          )}
        </div>

        {/* Schedule Grid */}
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="bg-navy">
                  <th className="text-left p-3 pl-4 text-white text-xs font-semibold w-36">Mitarbeiter</th>
                  {weekDays.map((day, i) => {
                    const dateStr = toDateString(day)
                    const isWeekend = i >= 5
                    const isTodayDay = dateStr === toDateString(new Date())
                    return (
                      <th key={dateStr} className={`text-center p-3 text-xs font-semibold min-w-[90px] ${isWeekend ? 'text-gray-400' : isTodayDay ? 'text-brand' : 'text-white'}`}>
                        <div>{getDayName(dateStr, true)}</div>
                        <div className={`text-lg font-bold ${isTodayDay ? 'text-brand' : isWeekend ? 'text-gray-500' : 'text-white'}`}>
                          {day.getDate()}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, empIdx) => (
                  <tr key={emp.id} className={empIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="p-3 pl-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-navy flex items-center justify-center text-brand text-[10px] font-bold flex-shrink-0">
                          {emp.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-navy leading-tight">{emp.name.split(' ')[0]}</p>
                          <p className="text-[10px] text-gray-400">{emp.weeklyHours}h</p>
                        </div>
                      </div>
                    </td>
                    {weekDays.map((day, i) => {
                      const dateStr = toDateString(day)
                      const shift = getShift(emp.id, dateStr)
                      const isWeekend = i >= 5
                      const Icon = shift ? SHIFT_ICONS[shift.type] : null

                      return (
                        <td key={dateStr} className="p-1.5 text-center">
                          {isWeekend ? (
                            <div className="flex items-center justify-center h-9">
                              <span className="text-xs text-gray-300">—</span>
                            </div>
                          ) : shift && Icon ? (
                            <div
                              className="rounded-lg px-2 py-1.5 flex flex-col items-center gap-0.5 cursor-pointer hover:opacity-90 transition-opacity"
                              style={{ backgroundColor: shift.bgColor }}
                            >
                              <Icon size={12} style={{ color: shift.color }} />
                              <span className="text-[10px] font-semibold" style={{ color: shift.color }}>
                                {shift.startTime}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-9">
                              <span className="text-xs text-gray-200">—</span>
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Legend */}
        <div className="flex flex-wrap gap-3">
          {locationShifts.map(shift => {
            const Icon = SHIFT_ICONS[shift.type]
            return (
              <div key={shift.id} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: shift.bgColor }}>
                <Icon size={14} style={{ color: shift.color }} />
                <span className="text-xs font-semibold" style={{ color: shift.color }}>
                  {shift.name} {shift.startTime}–{shift.endTime}
                </span>
                <span className="text-[10px] opacity-70" style={{ color: shift.color }}>
                  min {shift.minStaff}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Rules Modal */}
      <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title="Planungsregeln">
        <div className="space-y-4">
          {[
            { label: 'Mindestbesetzung Frühdienst', value: '2 Personen' },
            { label: 'Mindestbesetzung Spätdienst', value: '2 Personen' },
            { label: 'Mindestbesetzung Mitteldienst', value: '1 Person' },
            { label: 'Max. Wochenstunden', value: '40h' },
            { label: 'Ruhezeit zwischen Diensten', value: '11 Stunden' },
            { label: 'Max. Folgetage', value: '5 Tage' },
            { label: 'Wünsche berücksichtigen', value: 'Ja' },
            { label: 'Stundenkonten ausgleichen', value: 'Ja' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">{label}</span>
              <Badge variant="info">{value}</Badge>
            </div>
          ))}
          <Button className="w-full" onClick={() => setRulesOpen(false)}>Schließen</Button>
        </div>
      </Modal>
    </>
  )
}
