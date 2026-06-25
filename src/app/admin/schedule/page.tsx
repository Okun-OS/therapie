'use client'

import { useState, useMemo, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { FairnessReport } from '@/components/schedule/FairnessReport'
import { ShiftEditor } from '@/components/schedule/ShiftEditor'
import { SchedulePlanningChat } from '@/components/schedule/SchedulePlanningChat'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/lib/toast-context'
import {
  EMPLOYEES, SCHEDULE_ENTRIES, SHIFTS, LOCATIONS,
  getAllEntriesForFairness, getWishSubmissionsByLocation,
  setShiftMinStaff, saveScheduleForWeek,
} from '@/lib/mock-data'
import { calculateFairnessData, resolveWishConflict } from '@/lib/fairness'
import { getWeekDays, getWeeksInRange, toDateString, formatDateShort, getDayName, sanitizeAiText } from '@/lib/utils'
import {
  ChevronLeft, ChevronRight, Sparkles, Download, Save, Sun, Moon, Briefcase,
  CheckCircle, Loader, AlertTriangle, Info, Scale, Clock, CalendarOff, X, CalendarRange, MessageCircle,
} from 'lucide-react'

type PeriodMode = 'week' | 'twoWeeks' | 'month' | 'custom'

const PERIOD_OPTIONS: { key: PeriodMode; label: string }[] = [
  { key: 'week', label: 'Diese Woche' },
  { key: 'twoWeeks', label: 'Zwei Wochen' },
  { key: 'month', label: 'Ganzer Monat' },
  { key: 'custom', label: 'Individuell' },
]

interface PlanningRules {
  maxWeeklyHours: number
  restHours: number
  maxConsecutiveDays: number
  fridayLateMax: number
  mondayEarlyMax: number
  fridayEarlyMax: number
  weekendMax: number
  considerWishes: boolean
  balanceHoursAccount: boolean
}

const DEFAULT_RULES: PlanningRules = {
  maxWeeklyHours: 40,
  restHours: 11,
  maxConsecutiveDays: 5,
  fridayLateMax: 2,
  mondayEarlyMax: 3,
  fridayEarlyMax: 3,
  weekendMax: 2,
  considerWishes: true,
  balanceHoursAccount: true,
}

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
  const { showToast } = useToast()
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
  const [aiDecisionQuestion, setAiDecisionQuestion] = useState<string | null>(null)
  const [decisionLoading, setDecisionLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [shiftEditorOpen, setShiftEditorOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [facilityDescription, setFacilityDescription] = useState('')
  const [periodNotes, setPeriodNotes] = useState<{ id: string; note: string }[]>([])
  const [planningChatOpen, setPlanningChatOpen] = useState(false)
  const [shiftTimeOverrides, setShiftTimeOverrides] = useState<Record<string, { startTime: string; endTime: string }>>({})
  const [planningRules, setPlanningRules] = useState<PlanningRules>(DEFAULT_RULES)
  const [rulesDraft, setRulesDraft] = useState<PlanningRules>(DEFAULT_RULES)
  const [minStaffDraft, setMinStaffDraft] = useState<Record<string, number>>({})
  const [periodMode, setPeriodMode] = useState<PeriodMode>('week')
  const [customRange, setCustomRange] = useState<{ start: string; end: string }>({ start: '', end: '' })

  useEffect(() => {
    const saved = localStorage.getItem('facilityDescription')
    if (saved) setFacilityDescription(saved)
    const overrides = localStorage.getItem('shiftTimeOverrides')
    if (overrides) setShiftTimeOverrides(JSON.parse(overrides))
    const rules = localStorage.getItem('planningRules')
    if (rules) {
      const parsed = { ...DEFAULT_RULES, ...JSON.parse(rules) }
      setPlanningRules(parsed)
      setRulesDraft(parsed)
    }
  }, [])


  const periodWeeks = useMemo<Date[][]>(() => {
    if (periodMode === 'custom') {
      if (!customRange.start || !customRange.end) return [getWeekDays(currentDate)]
      const start = new Date(customRange.start + 'T00:00:00')
      const end = new Date(customRange.end + 'T00:00:00')
      return getWeeksInRange(start, end)
    }
    if (periodMode === 'month') {
      const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const last = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
      return getWeeksInRange(first, last)
    }
    const weeksCount = periodMode === 'twoWeeks' ? 2 : 1
    const baseWeek = getWeekDays(currentDate)
    return Array.from({ length: weeksCount }, (_, w) =>
      baseWeek.map(d => { const nd = new Date(d); nd.setDate(d.getDate() + w * 7); return nd })
    )
  }, [periodMode, currentDate, customRange])

  const weekDays = periodWeeks[0]
  const weekStart = toDateString(periodWeeks[0][0])
  const weekEnd = toDateString(periodWeeks[periodWeeks.length - 1][6])
  const periodWeekdayDates = useMemo(
    () => periodWeeks.flatMap(week => week.slice(0, 5).map(toDateString)),
    [periodWeeks]
  )

  const shiftPeriod = (direction: 1 | -1) => {
    const d = new Date(currentDate)
    if (periodMode === 'month') {
      d.setMonth(d.getMonth() + direction)
    } else if (periodMode === 'twoWeeks') {
      d.setDate(d.getDate() + direction * 14)
    } else if (periodMode === 'custom' && customRange.start && customRange.end) {
      const start = new Date(customRange.start + 'T00:00:00')
      const end = new Date(customRange.end + 'T00:00:00')
      const rangeDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
      const newStart = new Date(start); newStart.setDate(newStart.getDate() + direction * rangeDays)
      const newEnd = new Date(end); newEnd.setDate(newEnd.getDate() + direction * rangeDays)
      setCustomRange({ start: toDateString(newStart), end: toDateString(newEnd) })
      d.setDate(d.getDate() + direction * rangeDays)
    } else {
      d.setDate(d.getDate() + direction * 7)
    }
    setCurrentDate(d)
    setGeneratedSchedule(null); setAiDone(false); setAiReasoning(null); setAiDecisions([]); setAiWarnings([]); setAiDecisionQuestion(null); setSaved(false)
  }

  useEffect(() => {
    Promise.all(
      periodWeeks.map(week =>
        fetch(`/api/scheduling-period-notes?locationId=${locationId}&weekStart=${toDateString(week[0])}`)
          .then(r => r.json())
          .then(json => (json.notes ?? []) as { id: string; note: string }[])
          .catch(() => [])
      )
    ).then(results => setPeriodNotes(results.flat()))
  }, [locationId, periodWeeks])

  async function savePlanningChatNotes(notes: string[]) {
    for (const note of notes) {
      const res = await fetch('/api/scheduling-period-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, weekStart, note }),
      })
      const json = await res.json()
      if (json.note) setPeriodNotes(prev => [...prev, json.note])
    }
    showToast(notes.length > 0 ? 'Besonderheiten übernommen' : 'Danke, notiert')
  }

  async function removePeriodNote(id: string) {
    setPeriodNotes(prev => prev.filter(n => n.id !== id))
    await fetch(`/api/scheduling-period-notes?id=${id}`, { method: 'DELETE' })
  }

  const employees = EMPLOYEES.filter(e => e.locationId === locationId && e.role === 'employee')
  const locationShifts = SHIFTS.filter(s => s.locationId === locationId)
  const allHistoricalEntries = useMemo(() => getAllEntriesForFairness(locationId), [locationId])
  const wishSubmissions = getWishSubmissionsByLocation(locationId)

  const fairnessData = useMemo(
    () => calculateFairnessData(employees, allHistoricalEntries, locationShifts, {
      fridayLateMax: planningRules.fridayLateMax,
      mondayEarlyMax: planningRules.mondayEarlyMax,
      fridayEarlyMax: planningRules.fridayEarlyMax,
      weekendMax: planningRules.weekendMax,
    }),
    [employees, allHistoricalEntries, locationShifts, planningRules.fridayLateMax, planningRules.mondayEarlyMax, planningRules.fridayEarlyMax, planningRules.weekendMax]
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

  const effectiveShifts = locationShifts.map(s =>
    shiftTimeOverrides[s.id] ? { ...s, ...shiftTimeOverrides[s.id] } : s
  )

  const existingEntries = SCHEDULE_ENTRIES.filter(e => {
    const d = new Date(e.date + 'T00:00:00')
    return e.locationId === locationId && d >= periodWeeks[0][0] && d <= periodWeeks[periodWeeks.length - 1][6]
  })

  const getDisplayShift = (empId: string, dateStr: string) => {
    if (generatedSchedule) {
      const shiftId = generatedSchedule[empId]?.[dateStr]
      return shiftId ? effectiveShifts.find(s => s.id === shiftId) : null
    }
    const entry = existingEntries.find(e => e.employeeId === empId && e.date === dateStr)
    return entry ? effectiveShifts.find(s => s.id === entry.shiftId) : null
  }

  const runAI = async (confirmedDecisionQuestion?: string) => {
    setAiRunning(true)
    setAiDone(false)
    setAiStep(0)
    setAiError(null)
    setAiReasoning(null)
    setAiDecisions([])
    setAiWarnings([])
    setAiDecisionQuestion(null)

    // Animate progress steps while waiting for the real API
    let step = 0
    const interval = setInterval(() => {
      step = Math.min(step + 1, AI_STEPS.length - 2) // stop one before last
      setAiStep(step)
    }, 900)

    try {
      const weekDates = periodWeekdayDates
      const ruleSummary = `Zusätzliche Planungsregeln des Admins: maximal ${planningRules.maxWeeklyHours}h Wochenarbeitszeit, mindestens ${planningRules.restHours}h Ruhezeit zwischen zwei Diensten, maximal ${planningRules.maxConsecutiveDays} aufeinanderfolgende Arbeitstage, Freitag-Spätdienst max. ${planningRules.fridayLateMax}×/Monat pro Mitarbeiter, Montag-Frühdienst max. ${planningRules.mondayEarlyMax}×/Monat pro Mitarbeiter, Freitag-Frühdienst max. ${planningRules.fridayEarlyMax}×/Monat pro Mitarbeiter. Mitarbeiterwünsche ${planningRules.considerWishes ? 'sollen aktiv berücksichtigt werden' : 'müssen dieses Mal NICHT berücksichtigt werden'}. Stundenkonten ${planningRules.balanceHoursAccount ? 'sollen ausgeglichen werden' : 'müssen dieses Mal nicht ausgeglichen werden'}.`
      const combinedDescription = [facilityDescription.trim(), ruleSummary].filter(Boolean).join('\n\n')

      const res = await fetch('/api/ai/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employees,
          shifts: effectiveShifts,
          fairnessData,
          wishSubmissions: planningRules.considerWishes ? wishSubmissions : [],
          weekDates,
          locationId,
          locationName: location?.name ?? 'Standort',
          facilityDescription: combinedDescription || undefined,
          confirmedDecisionQuestion,
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
      setAiReasoning(data.reasoning ? sanitizeAiText(data.reasoning) : null)
      setAiDecisions((data.decisions ?? []).map((d: { type: string; message: string }) => ({ ...d, message: sanitizeAiText(d.message) })))
      setAiWarnings((data.warnings ?? []).map((w: string) => sanitizeAiText(w)))
      setAiDecisionQuestion(confirmedDecisionQuestion ? null : (data.decisionQuestion ? sanitizeAiText(data.decisionQuestion) : null))
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

  const handleDecisionYes = async () => {
    if (!aiDecisionQuestion) return
    setDecisionLoading(true)
    try {
      await runAI(aiDecisionQuestion)
      showToast('Optimierte Version erstellt')
    } finally {
      setDecisionLoading(false)
    }
  }

  const handleDecisionNo = () => {
    setAiDecisionQuestion(null)
    showToast('Planung bleibt unverändert')
  }

  const unfairCount = fairnessData.filter(d => d.fairnessScore < 60).length
  const pendingWishes = wishSubmissions.filter(w => w.status === 'pending').length

  const openRules = () => {
    setRulesDraft(planningRules)
    const staffByShift: Record<string, number> = {}
    locationShifts.forEach(s => { staffByShift[s.id] = s.minStaff })
    setMinStaffDraft(staffByShift)
    setRulesOpen(true)
  }

  const handleSaveRules = () => {
    setPlanningRules(rulesDraft)
    localStorage.setItem('planningRules', JSON.stringify(rulesDraft))
    Object.entries(minStaffDraft).forEach(([shiftId, minStaff]) => setShiftMinStaff(shiftId, minStaff))
    setRulesOpen(false)
    showToast('Planungsregeln gespeichert')
  }

  const handleSaveSchedule = async () => {
    if (!generatedSchedule) return
    saveScheduleForWeek(locationId, periodWeekdayDates, generatedSchedule)
    setSaved(true)
    showToast('Dienstplan gespeichert – für alle Mitarbeiter sichtbar')

    try {
      await fetch('/api/schedules/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationName: location?.name ?? 'deiner Einrichtung',
          periodLabel: `${formatDateShort(periodWeekdayDates[0])} – ${formatDateShort(periodWeekdayDates[periodWeekdayDates.length - 1])}`,
          assignments: generatedSchedule,
        }),
      })
    } catch {
      // Benachrichtigungen sind ein Zusatznutzen – ein Fehler hier darf das Speichern nicht blockieren.
    }
  }

  const handleExport = () => {
    const rows = [['Mitarbeiter', 'Datum', 'Wochentag', 'Dienst', 'Start', 'Ende']]
    employees.forEach(emp => {
      periodWeekdayDates.forEach(dateStr => {
        const shift = getDisplayShift(emp.id, dateStr)
        if (!shift) return
        rows.push([emp.name, dateStr, getDayName(dateStr), shift.name, shift.startTime, shift.endTime])
      })
    })
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dienstplan_${location?.name ?? 'standort'}_${weekStart}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Export gestartet')
  }

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
            {/* Zeitraum-Auswahl */}
            <div className="flex flex-wrap items-center gap-2">
              <CalendarRange size={14} className="text-gray-400" />
              {PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => { setPeriodMode(opt.key); setGeneratedSchedule(null); setAiDone(false); setAiReasoning(null); setAiDecisions([]); setAiWarnings([]); setAiDecisionQuestion(null); setSaved(false) }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${periodMode === opt.key ? 'bg-navy text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {opt.label}
                </button>
              ))}
              {periodMode === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customRange.start}
                    onChange={e => setCustomRange(r => ({ ...r, start: e.target.value }))}
                    className="px-2 py-1.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                  <span className="text-xs text-gray-400">bis</span>
                  <input
                    type="date"
                    value={customRange.end}
                    onChange={e => setCustomRange(r => ({ ...r, end: e.target.value }))}
                    className="px-2 py-1.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="flex items-center gap-1">
                <button onClick={() => shiftPeriod(-1)} disabled={periodMode === 'custom' && (!customRange.start || !customRange.end)}
                  className="p-2 rounded-xl hover:bg-white border border-gray-200 transition-all disabled:opacity-40">
                  <ChevronLeft size={18} className="text-gray-600" />
                </button>
                <span className="px-4 py-2 text-sm font-semibold text-navy min-w-[200px] text-center">
                  {formatDateShort(weekStart)} – {formatDateShort(weekEnd)} {weekDays[0].getFullYear()}
                </span>
                <button onClick={() => shiftPeriod(1)} disabled={periodMode === 'custom' && (!customRange.start || !customRange.end)}
                  className="p-2 rounded-xl hover:bg-white border border-gray-200 transition-all disabled:opacity-40">
                  <ChevronRight size={18} className="text-gray-600" />
                </button>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={openRules} className="border border-gray-200">Regeln</Button>
                <Button variant="ghost" size="sm" onClick={handleExport} className="gap-1 border border-gray-200"><Download size={14} /> Export</Button>
                {aiDone && (
                  <Button variant="success" size="sm" onClick={handleSaveSchedule} className="gap-1">
                    <Save size={14} />{saved ? 'Gespeichert!' : 'Speichern'}
                  </Button>
                )}
              </div>
            </div>

            {/* AI Panel */}
            <div className={`rounded-2xl p-5 border-2 transition-all ${aiDone ? 'bg-green-50 border-green-200' : 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-100'}`}>
              {!aiRunning && !aiDone ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-purple-600" />
                    <p className="font-bold text-navy">KI-Dienstplan erstellen</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">
                      Einrichtungsbeschreibung (optional)
                    </label>
                    <textarea
                      value={facilityDescription}
                      onChange={e => {
                        setFacilityDescription(e.target.value)
                        localStorage.setItem('facilityDescription', e.target.value)
                      }}
                      placeholder="Beschreibe deine Einrichtung, z.B. Öffnungszeiten, besondere Anforderungen, Gruppenstrukturen... Die KI leitet daraus automatisch Planungsregeln ab."
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-purple-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none placeholder:text-gray-400"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-600">
                        Besonderheiten für diesen Zeitraum (optional)
                      </label>
                      <button onClick={() => setPlanningChatOpen(true)} className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1">
                        <MessageCircle size={12} /> Per KI-Chat erfassen
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-400 mb-1.5">Gilt ausschließlich für {formatDateShort(weekStart)} – {formatDateShort(weekEnd)}, z.B. Ereignisse, zusätzliche Aufgaben oder Mitarbeiterbesonderheiten. Wird nicht in künftige Zeiträume übernommen.</p>
                    {periodNotes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {periodNotes.map(n => (
                          <span key={n.id} className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-1 rounded-full">
                            {n.note}
                            <button onClick={() => removePeriodNote(n.id)} className="hover:text-purple-900">
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
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
                    <div className="flex gap-2 sm:ml-auto">
                      <Button variant="ghost" size="sm" onClick={() => setShiftEditorOpen(true)} className="gap-1.5 border border-purple-200 text-purple-700 hover:bg-purple-50">
                        <Clock size={13} />
                        Dienstzeiten
                      </Button>
                      <Button onClick={() => runAI()} size="sm" className="gap-2 bg-purple-600 hover:bg-purple-700 text-white focus:ring-purple-500 whitespace-nowrap">
                        <Sparkles size={14} />
                        Plan erstellen
                      </Button>
                    </div>
                  </div>
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
                  <Button variant="ghost" size="sm" onClick={() => { setAiDone(false); setGeneratedSchedule(null); setAiReasoning(null); setAiDecisions([]); setAiWarnings([]); setAiDecisionQuestion(null); setSaved(false) }} className="text-gray-500">
                    Zurück
                  </Button>
                </div>
              )}
            </div>

            {/* Schedule Grid */}
            {!generatedSchedule && existingEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-14 px-6 bg-white border border-gray-100 rounded-2xl">
                <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center mb-4">
                  <CalendarOff size={28} className="text-purple-400" />
                </div>
                <p className="text-sm font-semibold text-navy">Noch kein Dienstplan für diese Woche</p>
                <p className="text-xs text-gray-400 mt-1 max-w-sm">
                  Erstelle oben mit einem Klick einen fairness-optimierten KI-Dienstplan, oder trage Dienste manuell ein.
                </p>
              </div>
            ) : (
            <div className="space-y-3">
              {periodWeeks.map((week, weekIdx) => (
              <div key={weekIdx}>
                {periodWeeks.length > 1 && (
                  <p className="text-xs font-semibold text-gray-400 mb-1.5 pl-1">
                    Woche {weekIdx + 1} · {formatDateShort(toDateString(week[0]))} – {formatDateShort(toDateString(week[6]))}
                  </p>
                )}
                <Card padding="none" className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                      <thead>
                        <tr className="bg-navy">
                          <th className="text-left p-3 pl-4 text-white text-xs font-semibold w-36">Mitarbeiter</th>
                          {week.map((day, i) => {
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
                                  {hasIssues && (
                                    <span
                                      className="flex-shrink-0 cursor-help"
                                      title={`Fairness-Hinweis: ${fd!.issues.join(' · ')}`}
                                    >
                                      <AlertTriangle size={10} className="text-red-400" />
                                    </span>
                                  )}
                                  <div className="w-7 h-7 rounded-lg bg-navy flex items-center justify-center text-brand text-[10px] font-bold flex-shrink-0">
                                    {emp.name.split(' ').map(n => n[0]).join('')}
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-navy leading-tight">{emp.name.split(' ')[0]}</p>
                                    <p
                                      className="text-[10px] text-gray-400 underline decoration-dotted cursor-help"
                                      title={fd ? `Fairness-Punktzahl ${fd.fairnessScore}/100 – misst wie gleichmäßig Früh-, Spät- und Mitteldienste sowie Montag/Freitag-Sonderdienste in den letzten 4 Wochen verteilt wurden. Unter 60 = Handlungsbedarf.` : `Vertraglich ${emp.weeklyHours}h/Woche`}
                                    >
                                      {fd ? `Score ${fd.fairnessScore}` : `${emp.weeklyHours}h`}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              {week.map((day, i) => {
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
              </div>
              ))}
            </div>
            )}

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

            {aiDone && aiDecisionQuestion && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Info size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold text-amber-800">{aiDecisionQuestion}</p>
                </div>
                <p className="text-xs text-amber-700">
                  Falls Ja: Die KI erstellt automatisch eine optimierte Version. Falls Nein: Die Planung bleibt unverändert. Weitere Rückfragen erfolgen danach nicht.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" loading={decisionLoading} onClick={handleDecisionYes} className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500">
                    Ja, optimieren
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleDecisionNo} className="border border-amber-200 text-amber-700 hover:bg-amber-100">
                    Nein, danke
                  </Button>
                </div>
              </div>
            )}

            {/* Shift legend */}
            <div className="flex flex-wrap gap-2">
              {effectiveShifts.map(shift => {
                const Icon = SHIFT_ICONS[shift.type]
                return (
                  <div key={shift.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ backgroundColor: shift.bgColor }}>
                    <Icon size={13} style={{ color: shift.color }} />
                    <span className="text-xs font-semibold" style={{ color: shift.color }}>{shift.name} {shift.startTime}–{shift.endTime}</span>
                  </div>
                )
              })}
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 rounded-xl cursor-help"
                title="Montag und Freitag gelten als Sondertage: Frühdienst am Montag und Spätdienst am Freitag werden in der Fairness-Engine besonders streng begrenzt, damit niemand diese unpopulären Dienste überdurchschnittlich oft bekommt."
              >
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                <span className="text-xs text-yellow-700 font-medium">Gelbe Spalten = Montag/Freitag (Sondertage) – begrenzte Häufigkeit pro Mitarbeiter, siehe Fairness-Tab</span>
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

      {/* Planungschat Modal */}
      <SchedulePlanningChat
        key={`${weekStart}_${weekEnd}`}
        open={planningChatOpen}
        onClose={() => setPlanningChatOpen(false)}
        onSave={savePlanningChatNotes}
        periodLabel={`${formatDateShort(weekStart)} – ${formatDateShort(weekEnd)}`}
      />

      {/* Shift Editor Modal */}
      <ShiftEditor
        open={shiftEditorOpen}
        onClose={() => setShiftEditorOpen(false)}
        shifts={locationShifts}
        overrides={shiftTimeOverrides}
        onSave={overrides => {
          setShiftTimeOverrides(overrides)
          localStorage.setItem('shiftTimeOverrides', JSON.stringify(overrides))
        }}
      />

      {/* Rules Modal */}
      <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title="Planungsregeln" size="md">
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Diese Regeln steuern die Mindestbesetzung sowie die KI-Dienstplanung für {location?.name}. Änderungen wirken sich auf den nächsten erstellten Plan aus.
          </p>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mindestbesetzung pro Dienst</p>
            <div className="space-y-2">
              {locationShifts.map(shift => (
                <div key={shift.id} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-gray-700">{shift.name}</span>
                  <input
                    type="number"
                    min={0}
                    value={minStaffDraft[shift.id] ?? shift.minStaff}
                    onChange={e => setMinStaffDraft(d => ({ ...d, [shift.id]: Math.max(0, Number(e.target.value)) }))}
                    className="w-20 px-2 py-1.5 text-sm text-center rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Arbeitszeit & Ruhezeit</p>
            <div className="space-y-2">
              {([
                ['maxWeeklyHours', 'Max. Wochenstunden'],
                ['restHours', 'Ruhezeit zwischen Diensten (h)'],
                ['maxConsecutiveDays', 'Max. aufeinanderfolgende Tage'],
              ] as const).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-gray-700">{label}</span>
                  <input
                    type="number"
                    min={1}
                    value={rulesDraft[key]}
                    onChange={e => setRulesDraft(d => ({ ...d, [key]: Math.max(1, Number(e.target.value)) }))}
                    className="w-20 px-2 py-1.5 text-sm text-center rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sondertage</p>
            <div className="space-y-2">
              {([
                ['fridayLateMax', 'Freitag-Spätdienst je MA (×/Monat)'],
                ['mondayEarlyMax', 'Montag-Frühdienst je MA (×/Monat)'],
                ['fridayEarlyMax', 'Freitag-Frühdienst je MA (×/Monat)'],
                ['weekendMax', 'Wochenenddienste je MA (×/Monat)'],
              ] as const).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-gray-700">{label}</span>
                  <input
                    type="number"
                    min={0}
                    value={rulesDraft[key]}
                    onChange={e => setRulesDraft(d => ({ ...d, [key]: Math.max(0, Number(e.target.value)) }))}
                    className="w-20 px-2 py-1.5 text-sm text-center rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">KI-Verhalten</p>
            <div className="space-y-1">
              {([
                ['considerWishes', 'Mitarbeiterwünsche berücksichtigen'],
                ['balanceHoursAccount', 'Stundenkonten ausgleichen'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between py-1.5 cursor-pointer">
                  <span className="text-sm text-gray-700">{label}</span>
                  <div
                    onClick={() => setRulesDraft(d => ({ ...d, [key]: !d[key] }))}
                    className={`relative w-10 h-5 rounded-full transition-colors ${rulesDraft[key] ? 'bg-brand' : 'bg-gray-300'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${rulesDraft[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </label>
              ))}
              <label className="flex items-center justify-between py-1.5 cursor-pointer">
                <span className="text-sm text-gray-700">Fairness-Engine</span>
                <div
                  onClick={() => setUseFairnessAI(v => !v)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${useFairnessAI ? 'bg-brand' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${useFairnessAI ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" className="flex-1 border border-gray-200" onClick={() => setRulesOpen(false)}>Abbrechen</Button>
            <Button className="flex-1" onClick={handleSaveRules}>Speichern</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
