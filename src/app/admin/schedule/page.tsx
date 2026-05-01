'use client'

import { useState, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { FairnessReport } from '@/components/schedule/FairnessReport'
import { useAuth } from '@/lib/auth-context'
import {
  EMPLOYEES, SCHEDULE_ENTRIES, SHIFTS, LOCATIONS,
  getAllEntriesForFairness, getWishSubmissionsByLocation,
} from '@/lib/mock-data'
import { calculateFairnessData, resolveWishConflict } from '@/lib/fairness'
import { getWeekDays, toDateString, formatDateShort, getDayName } from '@/lib/utils'
import {
  ChevronLeft, ChevronRight, Sparkles, Download, Save, Sun, Moon, Briefcase,
  CheckCircle, Loader, BarChart3, MessageSquare, AlertTriangle, Info, Scale,
} from 'lucide-react'

const SHIFT_ICONS: Record<string, React.ElementType> = { early: Sun, late: Moon, mid: Briefcase }
const AI_STEPS = [
  'Analysiere Verfügbarkeiten...',
  'Berechne Fairness-Scores...',
  'Löse Wunsch-Konflikte auf...',
  'Optimiere Dienstverteilung...',
  'Prüfe Ruhezeiten & Regeln...',
  'Finalisiere Dienstplan...',
]

type Tab = 'plan' | 'fairness' | 'wishes'

export default function AdminSchedule() {
  const { user } = useAuth()
  const locationId = user?.locationId ?? 'loc1'
  const location = LOCATIONS.find(l => l.id === locationId)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [tab, setTab] = useState<Tab>('plan')
  const [aiRunning, setAiRunning] = useState(false)
  const [aiStep, setAiStep] = useState(0)
  const [aiDone, setAiDone] = useState(false)
  const [useFairnessAI, setUseFairnessAI] = useState(true)
  const [generatedSchedule, setGeneratedSchedule] = useState<Record<string, Record<string, string>> | null>(null)
  const [aiReasoning, setAiReasoning] = useState<string | null>(null)
  const [aiDecisions, setAiDecisions] = useState<{ type: string; message: string }[]>([])
  const [aiWarnings, setAiWarnings] = useState<string[]>([])
  const [aiError, setAiError] = useState<string | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [saved, setSaved] = useState(false)

  const weekDays = getWeekDays(currentDate)
  const weekStart = toDateString(weekDays[0])
  const weekEnd = toDateString(weekDays[6])

  const employees = EMPLOYEES.filter(e => e.locationId === locationId && e.role === 'employee')
  const locationShifts = SHIFTS.filter(s => s.locationId === locationId)
  const allHistoricalEntries = useMemo(() => getAllEntriesForFairness(locationId), [locationId])
  const wishSubmissions = getWishSubmissionsByLocation(locationId)

  const fairnessData = useMemo(
    () => calculateFairnessData(employees, allHistoricalEntries, locationShifts),
    [employees, allHistoricalEntries, locationShifts]
  )

  // Resolve wish conflicts for display
  const wishConflicts = useMemo(() => {
    const conflictMap = new Map<string, typeof wishSubmissions>()
    wishSubmissions.forEach(w => {
      const key = `${w.date}::${w.preferredShiftType}`
      if (!conflictMap.has(key)) conflictMap.set(key, [])
      conflictMap.get(key)!.push(w)
    })
    return Array.from(conflictMap.entries())
      .filter(([, ws]) => ws.length > 1)
      .map(([key, ws]) => {
        const resolution = resolveWishConflict(ws, fairnessData)
        return { key, wishes: ws, resolution }
      })
  }, [wishSubmissions, fairnessData])

  const existingEntries = SCHEDULE_ENTRIES.filter(e => {
    const d = new Date(e.date + 'T00:00:00')
    return e.locationId === locationId && d >= weekDays[0] && d <= weekDays[6]
  })

  const getDisplayShift = (empId: string, dateStr: string) => {
    if (generatedSchedule) {
      const shiftId = generatedSchedule[empId]?.[dateStr]
      return shiftId ? locationShifts.find(s => s.id === shiftId) : null
    }
    const entry = existingEntries.find(e => e.employeeId === empId && e.date === dateStr)
    return entry ? locationShifts.find(s => s.id === entry.shiftId) : null
  }

  const runAI = async () => {
    setAiRunning(true)
    setAiDone(false)
    setAiStep(0)
    setAiError(null)
    setAiReasoning(null)
    setAiDecisions([])
    setAiWarnings([])

    // Animate progress steps while waiting for the real API
    let step = 0
    const interval = setInterval(() => {
      step = Math.min(step + 1, AI_STEPS.length - 2) // stop one before last
      setAiStep(step)
    }, 900)

    try {
      const weekDates = weekDays.slice(0, 5).map(toDateString)
      const res = await fetch('/api/ai/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employees,
          shifts: locationShifts,
          fairnessData,
          wishSubmissions,
          weekDates,
          locationName: location?.name ?? 'Standort',
        }),
      })

      clearInterval(interval)
      setAiStep(AI_STEPS.length - 1)

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error ?? 'API-Fehler')
      }

      const data = await res.json()

      // API returns { date: { empId: shiftId } } – transpose to { empId: { date: shiftId } }
      const transposed: Record<string, Record<string, string>> = {}
      if (data.schedule) {
        for (const [date, assignments] of Object.entries(data.schedule as Record<string, Record<string, string>>)) {
          for (const [empId, shiftId] of Object.entries(assignments)) {
            if (!transposed[empId]) transposed[empId] = {}
            transposed[empId][date] = shiftId
          }
        }
      }

      setGeneratedSchedule(transposed)
      setAiReasoning(data.reasoning ?? null)
      setAiDecisions(data.decisions ?? [])
      setAiWarnings(data.warnings ?? [])
      setAiDone(true)
    } catch (err: unknown) {
      clearInterval(interval)
      setAiError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      setAiRunning(false)
      setAiStep(0)
    } finally {
      setAiRunning(false)
    }
  }

  const unfairCount = fairnessData.filter(d => d.fairnessScore < 60).length
  const pendingWishes = wishSubmissions.filter(w => w.status === 'pending').length

  return (
    <>
      <Header title="Dienstplan" subtitle={`${location?.name} · KI-Planung`} />
      <div className="p-4 sm:p-6 space-y-4">

        {/* Tab bar */}
        <div className="flex bg-white border border-gray-100 rounded-2xl p-1">
          {([
            { key: 'plan', label: 'Dienstplan', badge: 0 },
            { key: 'fairness', label: 'Fairness', badge: unfairCount },
            { key: 'wishes', label: 'Wünsche', badge: pendingWishes },
          ] as const).map(({ key, label, badge }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${tab === key ? 'bg-navy text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {label}
              {badge > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === key ? 'bg-brand text-navy' : badge > 2 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── PLAN TAB ─────────────────────────────────────────── */}
        {tab === 'plan' && (
          <>
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="flex items-center gap-1">
                <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); setGeneratedSchedule(null); setAiDone(false); setAiReasoning(null); setAiDecisions([]); setAiWarnings([]) }}
                  className="p-2 rounded-xl hover:bg-white border border-gray-200 transition-all">
                  <ChevronLeft size={18} className="text-gray-600" />
                </button>
                <span className="px-4 py-2 text-sm font-semibold text-navy min-w-[200px] text-center">
                  {formatDateShort(weekStart)} – {formatDateShort(weekEnd)} {weekDays[0].getFullYear()}
                </span>
                <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); setGeneratedSchedule(null); setAiDone(false); setAiReasoning(null); setAiDecisions([]); setAiWarnings([]) }}
                  className="p-2 rounded-xl hover:bg-white border border-gray-200 transition-all">
                  <ChevronRight size={18} className="text-gray-600" />
                </button>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setRulesOpen(true)} className="border border-gray-200">Regeln</Button>
                <Button variant="ghost" size="sm" className="gap-1 border border-gray-200"><Download size={14} /> Export</Button>
                {aiDone && (
                  <Button variant="success" size="sm" onClick={() => setSaved(true)} className="gap-1">
                    <Save size={14} />{saved ? 'Gespeichert!' : 'Speichern'}
                  </Button>
                )}
              </div>
            </div>

            {/* AI Panel */}
            <div className={`rounded-2xl p-5 border-2 transition-all ${aiDone ? 'bg-green-50 border-green-200' : 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-100'}`}>
              {!aiRunning && !aiDone ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles size={18} className="text-purple-600" />
                      <p className="font-bold text-navy">KI-Dienstplan erstellen</p>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Berücksichtigt Verfügbarkeit, Wünsche, Stundenkonto und Fairness-Score.</p>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div
                        onClick={() => setUseFairnessAI(v => !v)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${useFairnessAI ? 'bg-brand' : 'bg-gray-300'}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${useFairnessAI ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </div>
                      <span className="text-xs font-medium text-gray-600 flex items-center gap-1">
                        <Scale size={12} className="text-purple-500" />
                        Fairness-Engine aktiviert
                      </span>
                    </label>
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
              ) : aiError ? (
                <div className="flex items-center gap-3">
                  <AlertTriangle size={24} className="text-red-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-bold text-red-700">KI-Fehler</p>
                    <p className="text-sm text-red-600">{aiError}</p>
                    <p className="text-xs text-gray-500 mt-1">Stelle sicher, dass ANTHROPIC_API_KEY in .env.local konfiguriert ist.</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setAiError(null)} className="text-gray-500">
                    Erneut
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <CheckCircle size={24} className="text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-bold text-green-700">KI-Dienstplan erstellt!</p>
                    <p className="text-sm text-green-600">
                      Fairness-optimiert · Wünsche berücksichtigt · Schulden ausgeglichen.
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setAiDone(false); setGeneratedSchedule(null); setAiReasoning(null); setAiDecisions([]); setAiWarnings([]) }} className="text-gray-500">
                    Zurück
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
                        const isFriday = i === 4
                        const isMonday = i === 0
                        return (
                          <th key={dateStr} className={`text-center p-3 text-xs font-semibold min-w-[90px] ${isWeekend ? 'text-gray-500' : isTodayDay ? 'text-brand' : (isFriday || isMonday) ? 'text-yellow-300' : 'text-white'}`}>
                            <div className="flex flex-col items-center">
                              <span>{getDayName(dateStr, true)}</span>
                              <span className={`text-lg font-bold ${isTodayDay ? 'text-brand' : isWeekend ? 'text-gray-500' : 'text-white'}`}>{day.getDate()}</span>
                              {(isFriday || isMonday) && !isWeekend && (
                                <span className="text-[8px] text-yellow-300 font-bold uppercase tracking-wide">
                                  {isFriday ? 'Freitag' : 'Montag'}
                                </span>
                              )}
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp, empIdx) => {
                      const fd = fairnessData.find(f => f.employeeId === emp.id)
                      const hasIssues = fd && fd.issues.length > 0
                      return (
                        <tr key={emp.id} className={empIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                          <td className="p-3 pl-4">
                            <div className="flex items-center gap-2">
                              {hasIssues && <AlertTriangle size={10} className="text-red-400 flex-shrink-0" />}
                              <div className="w-7 h-7 rounded-lg bg-navy flex items-center justify-center text-brand text-[10px] font-bold flex-shrink-0">
                                {emp.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-navy leading-tight">{emp.name.split(' ')[0]}</p>
                                <p className="text-[10px] text-gray-400">{fd ? `Score ${fd.fairnessScore}` : `${emp.weeklyHours}h`}</p>
                              </div>
                            </div>
                          </td>
                          {weekDays.map((day, i) => {
                            const dateStr = toDateString(day)
                            const shift = getDisplayShift(emp.id, dateStr)
                            const isWeekend = i >= 5
                            const Icon = shift ? SHIFT_ICONS[shift.type] : null
                            return (
                              <td key={dateStr} className="p-1.5 text-center">
                                {isWeekend ? (
                                  <div className="flex items-center justify-center h-9"><span className="text-xs text-gray-300">—</span></div>
                                ) : shift && Icon ? (
                                  <div className="rounded-lg px-2 py-1.5 flex flex-col items-center gap-0.5 cursor-pointer hover:opacity-90 transition-opacity" style={{ backgroundColor: shift.bgColor }}>
                                    <Icon size={12} style={{ color: shift.color }} />
                                    <span className="text-[10px] font-semibold" style={{ color: shift.color }}>{shift.startTime}</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center h-9"><span className="text-xs text-gray-200">—</span></div>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* AI Reasoning Panel */}
            {aiDone && (aiReasoning || aiDecisions.length > 0 || aiWarnings.length > 0) && (
              <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-purple-600" />
                  <p className="text-sm font-bold text-purple-800">KI-Begründung</p>
                </div>
                {aiReasoning && (
                  <p className="text-sm text-purple-700">{aiReasoning}</p>
                )}
                {aiDecisions.length > 0 && (
                  <div className="space-y-1.5">
                    {aiDecisions.map((d, i) => (
                      <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-xl text-xs ${d.type === 'conflict' ? 'bg-red-50 text-red-700' : d.type === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-white text-gray-700'}`}>
                        {d.type === 'conflict' && <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />}
                        {d.type === 'warning' && <Info size={12} className="flex-shrink-0 mt-0.5" />}
                        {d.type === 'assignment' && <CheckCircle size={12} className="flex-shrink-0 mt-0.5 text-green-600" />}
                        <span>{d.message}</span>
                      </div>
                    ))}
                  </div>
                )}
                {aiWarnings.length > 0 && (
                  <div className="space-y-1">
                    {aiWarnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                        <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" /> {w}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Shift legend */}
            <div className="flex flex-wrap gap-2">
              {locationShifts.map(shift => {
                const Icon = SHIFT_ICONS[shift.type]
                return (
                  <div key={shift.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ backgroundColor: shift.bgColor }}>
                    <Icon size={13} style={{ color: shift.color }} />
                    <span className="text-xs font-semibold" style={{ color: shift.color }}>{shift.name} {shift.startTime}–{shift.endTime}</span>
                  </div>
                )
              })}
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 rounded-xl">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                <span className="text-xs text-yellow-700 font-medium">Gelbe Spalten = Montag/Freitag (Sondertage)</span>
              </div>
            </div>
          </>
        )}

        {/* ── FAIRNESS TAB ─────────────────────────────────────── */}
        {tab === 'fairness' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
              <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-800">Fairness-Analyse der letzten 4 Wochen</p>
                <p className="text-xs text-blue-700 mt-0.5">
                  Zeigt wie gleichmäßig Früh-, Spät- und Mitteldienste verteilt sind, inkl. Sondertage (Freitag, Montag). Score unter 60 = Handlungsbedarf.
                </p>
              </div>
            </div>
            <FairnessReport data={fairnessData} />
          </div>
        )}

        {/* ── WISHES TAB ───────────────────────────────────────── */}
        {tab === 'wishes' && (
          <div className="space-y-4">
            {wishConflicts.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={18} className="text-red-500" />
                  <p className="font-bold text-red-700 text-sm">{wishConflicts.length} Wunsch-Konflikte aufgetreten</p>
                </div>
                <div className="space-y-3">
                  {wishConflicts.map(({ key, wishes, resolution }) => (
                    <div key={key} className="bg-white rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-xs font-bold text-navy">
                            {wishes[0].preferredShiftType === 'early' ? 'Frühdienst' : wishes[0].preferredShiftType === 'late' ? 'Spätdienst' : 'Mitteldienst'} am {wishes[0].date}
                          </p>
                          <p className="text-xs text-gray-500">{wishes.length} Personen wollten diesen Dienst</p>
                        </div>
                        <Badge variant="success">Gelöst: {resolution.winnerName.split(' ')[0]}</Badge>
                      </div>
                      {resolution.losers.map(loser => (
                        <div key={loser.id} className="mt-2 p-2 bg-red-50 rounded-lg">
                          <p className="text-xs text-red-700">
                            <span className="font-semibold">{loser.name.split(' ')[0]}</span> nicht erfüllt: {loser.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Card padding="sm">
              <p className="text-sm font-bold text-navy mb-3">Alle Dienstwünsche ({wishSubmissions.length})</p>
              <div className="space-y-2">
                {wishSubmissions.map(w => (
                  <div key={w.id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
                    <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center text-brand text-xs font-bold flex-shrink-0">
                      {w.employeeName.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-navy">{w.employeeName}</p>
                        <Badge variant={w.status === 'fulfilled' ? 'success' : w.status === 'not_fulfilled' ? 'danger' : 'warning'}>
                          {w.status === 'fulfilled' ? 'Erfüllt' : w.status === 'not_fulfilled' ? 'Nicht erfüllt' : 'Ausstehend'}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500">
                        {w.preferredShiftType === 'early' ? 'Frühdienst' : w.preferredShiftType === 'late' ? 'Spätdienst' : 'Mitteldienst'} · {w.date}
                        {w.reason && ` · ${w.reason}`}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${w.importance === 'urgent' ? 'bg-red-100 text-red-600' : w.importance === 'important' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                          {w.importance === 'urgent' ? 'Dringend' : w.importance === 'important' ? 'Wichtig' : 'Normal'}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(w.submittedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 flex gap-3">
              <Scale size={18} className="text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-purple-800">Konfliktstrategie der KI</p>
                <ol className="text-xs text-purple-700 mt-1 space-y-1 list-decimal list-inside">
                  <li>Höchste Dringlichkeit gewinnt (Dringend &gt; Wichtig &gt; Normal)</li>
                  <li>Wer diese Schichtart seltener hatte (Fairness-Schuld)</li>
                  <li>Frühere Einreichzeit gewinnt bei Gleichstand</li>
                  <li>Verlierer wird benachrichtigt + Grund mitgeteilt</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rules Modal */}
      <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title="Planungsregeln">
        <div className="space-y-3">
          {[
            { label: 'Mindestbesetzung Frühdienst', value: '2 Personen' },
            { label: 'Mindestbesetzung Spätdienst', value: '2 Personen' },
            { label: 'Mindestbesetzung Mitteldienst', value: '1 Person' },
            { label: 'Max. Wochenstunden', value: '40h' },
            { label: 'Ruhezeit zwischen Diensten', value: '11 Stunden' },
            { label: 'Max. Folgetage', value: '5 Tage' },
            { label: 'Freitag-Spätdienst je MA', value: 'max. 2×/Monat' },
            { label: 'Montag-Frühdienst je MA', value: 'max. 3×/Monat' },
            { label: 'Wünsche berücksichtigen', value: 'Ja' },
            { label: 'Fairness-Engine', value: useFairnessAI ? 'Aktiv' : 'Inaktiv' },
            { label: 'Stundenkonten ausgleichen', value: 'Ja' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">{label}</span>
              <Badge variant={value === 'Aktiv' ? 'success' : value === 'Inaktiv' ? 'danger' : 'info'}>{value}</Badge>
            </div>
          ))}
          <Button className="w-full mt-2" onClick={() => setRulesOpen(false)}>Schließen</Button>
        </div>
      </Modal>
    </>
  )
}
