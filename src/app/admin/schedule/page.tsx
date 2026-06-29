'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { FairnessReport } from '@/components/schedule/FairnessReport'
import { SchedulePlanningChat } from '@/components/schedule/SchedulePlanningChat'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/lib/toast-context'
import { calculateFairnessData, resolveWishConflict } from '@/lib/fairness'
import { getWeekDays, getWeeksInRange, toDateString, formatDateShort, getDayName, sanitizeAiText } from '@/lib/utils'
import type { Employee, Location, ScheduleEntry, Shift, VacationRequest, Absence, WishSubmission } from '@/lib/types'
import {
  ChevronLeft, ChevronRight, Sparkles, Download, Save, Sun, Moon, MoonStar, Briefcase,
  CheckCircle, Loader, AlertTriangle, Info, Scale, CalendarOff, X, CalendarRange, MessageCircle,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

type PeriodMode = 'week' | 'twoWeeks' | 'month' | 'custom'

const PERIOD_OPTIONS: { key: PeriodMode; label: string }[] = [
  { key: 'week', label: 'Diese Woche' },
  { key: 'twoWeeks', label: 'Zwei Wochen' },
  { key: 'month', label: 'Ganzer Monat' },
  { key: 'custom', label: 'Individuell' },
]

interface ScheduleAssignment {
  shiftId: string
  startTime?: string
  endTime?: string
}

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

const SHIFT_ICONS: Record<string, React.ElementType> = { early: Sun, late: Moon, mid: Briefcase, night: MoonStar }
const DEFAULT_SHIFT_ICON = Briefcase
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
  const [EMPLOYEES, setEMPLOYEES] = useState<Employee[]>([])
  const [LOCATIONS, setLOCATIONS] = useState<Location[]>([])
  const locationId = user?.locationId
  const location = LOCATIONS.find(l => l.id === locationId)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [tab, setTab] = useState<Tab>('plan')
  const [aiRunning, setAiRunning] = useState(false)
  const [aiStep, setAiStep] = useState(0)
  const [aiDone, setAiDone] = useState(false)
  const [useFairnessAI, setUseFairnessAI] = useState(true)
  const [generatedSchedule, setGeneratedSchedule] = useState<Record<string, Record<string, ScheduleAssignment>> | null>(null)
  const [aiReasoning, setAiReasoning] = useState<string | null>(null)
  const [aiDecisions, setAiDecisions] = useState<{ type: string; message: string }[]>([])
  const [aiAssignmentReasons, setAiAssignmentReasons] = useState<Record<string, string>>({})
  const [explainEntry, setExplainEntry] = useState<{ employeeName: string; shiftName: string; dateStr: string; reason: string | null } | null>(null)
  const [aiWarnings, setAiWarnings] = useState<string[]>([])
  const [aiDecisionQuestion, setAiDecisionQuestion] = useState<string | null>(null)
  const [decisionLoading, setDecisionLoading] = useState(false)
  const [fallback, setFallback] = useState<{ date: string; shiftId: string; message: string } | null>(null)
  const [fallbackLoading, setFallbackLoading] = useState(false)
  const [fallbackHandled, setFallbackHandled] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [facilityDescription, setFacilityDescription] = useState('')
  const [periodNotes, setPeriodNotes] = useState<{ id: string; note: string }[]>([])
  const [planningChatOpen, setPlanningChatOpen] = useState(false)
  const [planningRules, setPlanningRules] = useState<PlanningRules>(DEFAULT_RULES)
  const [rulesDraft, setRulesDraft] = useState<PlanningRules>(DEFAULT_RULES)
  const [minStaffDraft, setMinStaffDraft] = useState<Record<string, number>>({})
  const [periodMode, setPeriodMode] = useState<PeriodMode>('week')
  const [customRange, setCustomRange] = useState<{ start: string; end: string }>({ start: '', end: '' })
  const [SCHEDULE_ENTRIES, setSCHEDULE_ENTRIES] = useState<ScheduleEntry[]>([])
  const [SHIFTS, setSHIFTS] = useState<Shift[]>([])
  const [VACATION_REQUESTS, setVACATION_REQUESTS] = useState<VacationRequest[]>([])
  const [ABSENCES, setABSENCES] = useState<Absence[]>([])
  const [allHistoricalEntries, setAllHistoricalEntries] = useState<ScheduleEntry[]>([])
  const [wishSubmissions, setWishSubmissions] = useState<WishSubmission[]>([])

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => setEMPLOYEES(d.employees))
    fetch('/api/locations').then(r => r.json()).then(d => setLOCATIONS(d.locations))
  }, [])

  const loadScheduleEntries = () => {
    fetch(`/api/schedule-entries?locationId=${locationId}`).then(r => r.json()).then(d => setSCHEDULE_ENTRIES(d.entries ?? []))
  }

  useEffect(() => {
    if (!locationId) return
    loadScheduleEntries()
    fetch(`/api/shifts?locationId=${locationId}`).then(r => r.json()).then(d => setSHIFTS(d.shifts ?? []))
    fetch(`/api/vacation-requests?locationId=${locationId}`).then(r => r.json()).then(d => setVACATION_REQUESTS(d.requests ?? []))
    fetch(`/api/absences?locationId=${locationId}`).then(r => r.json()).then(d => setABSENCES(d.absences ?? []))
    fetch(`/api/wish-submissions?locationId=${locationId}`).then(r => r.json()).then(d => setWishSubmissions(d.submissions ?? []))
  }, [locationId])

  // getAllEntriesForFairness(locationId) im mock-data kombinierte historische
  // Seed-Einträge mit den aktuellen SCHEDULE_ENTRIES für den Standort. Die
  // API liefert dieselbe Kombination bereits serverseitig (Postgres enthält
  // die historischen Einträge), daher reicht ein einzelner Fetch.
  useEffect(() => {
    if (!locationId) return
    fetch(`/api/schedule-entries?locationId=${locationId}`).then(r => r.json()).then(d => setAllHistoricalEntries(d.entries ?? []))
  }, [locationId])

  useEffect(() => {
    const saved = localStorage.getItem('facilityDescription')
    if (saved) setFacilityDescription(saved)
  }, [])

  useEffect(() => {
    if (!locationId) return
    fetch(`/api/planning-rules?locationId=${locationId}`).then(r => r.json()).then(d => {
      if (!d.rules) return
      const parsed = { ...DEFAULT_RULES, ...d.rules }
      setPlanningRules(parsed)
      setRulesDraft(parsed)
    })
  }, [locationId])


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
    setGeneratedSchedule(null); setAiDone(false); setAiReasoning(null); setAiDecisions([]); setAiWarnings([]); setAiDecisionQuestion(null); setFallback(null); setFallbackHandled(false); setSaved(false)
  }

  useEffect(() => {
    if (!locationId) return
    Promise.all(
      periodWeeks.map(week =>
        fetch(`/api/scheduling-period-notes?locationId=${locationId}&weekStart=${toDateString(week[0])}`)
          .then(r => r.json())
          .then(json => (json.notes ?? []) as { id: string; note: string }[])
          .catch(() => [])
      )
    ).then(results => setPeriodNotes(results.flat()))
  }, [locationId, periodWeeks])

  async function savePlanningChatNotes(notes: string[], permanentRules: string[]) {
    for (const note of notes) {
      const res = await fetch('/api/scheduling-period-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, weekStart, note }),
      })
      const json = await res.json()
      if (json.note) setPeriodNotes(prev => [...prev, json.note])
    }
    if (permanentRules.length > 0) {
      await fetch('/api/location-onboarding/individuelle-regeln', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, rules: permanentRules }),
      })
    }
    showToast(notes.length > 0 || permanentRules.length > 0 ? 'Besonderheiten übernommen' : 'Danke, notiert')
  }

  async function removePeriodNote(id: string) {
    setPeriodNotes(prev => prev.filter(n => n.id !== id))
    await fetch(`/api/scheduling-period-notes?id=${id}`, { method: 'DELETE' })
  }

  const employees = EMPLOYEES.filter(e => e.locationId === locationId && e.role === 'employee')
  const locationShifts = SHIFTS.filter(s => s.locationId === locationId)

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

  const periodStart = periodWeekdayDates[0]
  const periodEnd = periodWeekdayDates[periodWeekdayDates.length - 1]

  const existingEntries = SCHEDULE_ENTRIES.filter(e =>
    e.locationId === locationId && e.date >= periodStart && e.date <= periodEnd
  )
  const approvedVacations = VACATION_REQUESTS
    .filter(v => v.locationId === locationId && v.status === 'approved' && v.startDate <= periodEnd && v.endDate >= periodStart)
    .map(v => ({ employeeId: v.employeeId, employeeName: v.employeeName, startDate: v.startDate, endDate: v.endDate }))

  const reportedAbsences = ABSENCES
    .filter(a => a.locationId === locationId && a.verificationStatus !== 'abgelehnt' && a.startDate <= periodEnd && a.endDate >= periodStart)
    .map(a => ({ employeeId: a.employeeId, employeeName: a.employeeName, startDate: a.startDate, endDate: a.endDate, type: a.type }))

  const getDisplayAssignment = (empId: string, dateStr: string): { shift: Shift; startTime: string; endTime: string } | null => {
    if (generatedSchedule) {
      const assignment = generatedSchedule[empId]?.[dateStr]
      if (!assignment) return null
      const shift = locationShifts.find(s => s.id === assignment.shiftId)
      if (!shift) return null
      return { shift, startTime: assignment.startTime ?? shift.startTime, endTime: assignment.endTime ?? shift.endTime }
    }
    const entry = existingEntries.find(e => e.employeeId === empId && e.date === dateStr)
    if (!entry) return null
    const shift = locationShifts.find(s => s.id === entry.shiftId)
    if (!shift) return null
    return { shift, startTime: entry.startTime ?? shift.startTime, endTime: entry.endTime ?? shift.endTime }
  }

  const getDisplayReason = (empId: string, dateStr: string): string | null => {
    if (generatedSchedule) return aiAssignmentReasons[`${empId}|${dateStr}`] ?? null
    const entry = existingEntries.find(e => e.employeeId === empId && e.date === dateStr)
    return entry?.reason ?? null
  }

  const runAI = async (confirmedDecisionQuestion?: string) => {
    setAiRunning(true)
    setAiDone(false)
    setAiStep(0)
    setAiError(null)
    setAiReasoning(null)
    setAiDecisions([])
    setAiAssignmentReasons({})
    setAiWarnings([])
    setAiDecisionQuestion(null)
    setFallback(null)
    setFallbackHandled(false)

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
          shifts: locationShifts,
          fairnessData,
          wishSubmissions: planningRules.considerWishes ? wishSubmissions : [],
          weekDates,
          locationId,
          locationName: location?.name ?? 'Standort',
          facilityDescription: combinedDescription || undefined,
          confirmedDecisionQuestion,
          approvedVacations,
          reportedAbsences,
        }),
      })

      clearInterval(interval)
      setAiStep(AI_STEPS.length - 1)

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error ?? 'API-Fehler')
      }

      const data = await res.json()

      // API returns { date: { empId: { shiftId, startTime, endTime } } } – transpose to { empId: { date: assignment } }
      const transposed: Record<string, Record<string, ScheduleAssignment>> = {}
      if (data.schedule) {
        for (const [date, assignments] of Object.entries(data.schedule as Record<string, Record<string, ScheduleAssignment>>)) {
          for (const [empId, assignment] of Object.entries(assignments)) {
            if (!transposed[empId]) transposed[empId] = {}
            transposed[empId][date] = assignment
          }
        }
      }

      setGeneratedSchedule(transposed)
      setAiReasoning(data.reasoning ? sanitizeAiText(data.reasoning) : null)
      const decisions = (data.decisions ?? []) as { type: string; message: string; employeeId?: string; date?: string }[]
      setAiDecisions(decisions.map(d => ({ ...d, message: sanitizeAiText(d.message) })))
      const reasonsByEntry: Record<string, string> = {}
      decisions.forEach(d => {
        if (d.type === 'assignment' && d.employeeId && d.date) {
          reasonsByEntry[`${d.employeeId}|${d.date}`] = sanitizeAiText(d.message)
        }
      })
      setAiAssignmentReasons(reasonsByEntry)
      setAiWarnings((data.warnings ?? []).map((w: string) => sanitizeAiText(w)))
      setAiDecisionQuestion(confirmedDecisionQuestion ? null : (data.decisionQuestion ? sanitizeAiText(data.decisionQuestion) : null))
      setFallback(data.fallback ? { ...data.fallback, message: sanitizeAiText(data.fallback.message) } : null)
      setFallbackHandled(false)
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

  const handleCreateSubstitution = async () => {
    if (!fallback) return
    const shift = locationShifts.find(s => s.id === fallback.shiftId)
    setFallbackLoading(true)
    try {
      await fetch('/api/substitutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId,
          date: fallback.date,
          startTime: shift?.startTime ?? '08:00',
          endTime: shift?.endTime ?? '16:00',
          priority: 'high',
          note: `Unterbesetzung durch genehmigten Urlaub${shift ? ` (${shift.name})` : ''}.`,
          createdBy: user?.name ?? 'Admin',
        }),
      })
      setFallbackHandled(true)
      showToast('Vertretungsanfrage erstellt')
    } catch {
      showToast('Vertretungsanfrage konnte nicht erstellt werden', 'error')
    } finally {
      setFallbackLoading(false)
    }
  }

  const handleSkipSubstitution = () => {
    setFallback(null)
    showToast('Keine Vertretungsanfrage erstellt')
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

  const handleSaveRules = async () => {
    setPlanningRules(rulesDraft)
    await Promise.all([
      fetch('/api/planning-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, ...rulesDraft }),
      }),
      ...Object.entries(minStaffDraft).map(([shiftId, minStaff]) =>
        fetch(`/api/shifts/${shiftId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ minStaff }),
        })
      ),
    ])
    fetch(`/api/shifts?locationId=${locationId}`).then(r => r.json()).then(d => setSHIFTS(d.shifts ?? []))
    setRulesOpen(false)
    showToast('Planungsregeln gespeichert')
  }

  const handleSaveSchedule = async () => {
    if (!generatedSchedule) return
    await fetch('/api/schedule-entries/save-week', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locationId,
        weekDates: periodWeekdayDates,
        assignments: generatedSchedule,
        reasons: aiAssignmentReasons,
      }),
    })
    loadScheduleEntries()
    setSaved(true)
    showToast('Dienstplan gespeichert – für alle Mitarbeiter sichtbar')

    try {
      await fetch('/api/schedules/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationName: location?.name ?? 'deinem Standort',
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
        const assignment = getDisplayAssignment(emp.id, dateStr)
        if (!assignment) return
        rows.push([emp.name, dateStr, getDayName(dateStr), assignment.shift.name, assignment.startTime, assignment.endTime])
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

  if (!locationId) {
    return (
      <>
        <Header title="Dienstplan" subtitle="Kein Standort zugeordnet" />
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={AlertTriangle}
            title="Dein Account ist noch keinem Standort zugeordnet"
            description="Ein OKUN-Administrator muss deinen Account einmalig einem Standort zuordnen, bevor hier ein Dienstplan erstellt werden kann. Bitte wende dich an die OKUN-Plattformverwaltung."
          />
        </div>
      </>
    )
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
                  onClick={() => { setPeriodMode(opt.key); setGeneratedSchedule(null); setAiDone(false); setAiReasoning(null); setAiDecisions([]); setAiWarnings([]); setAiDecisionQuestion(null); setFallback(null); setFallbackHandled(false); setSaved(false) }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${periodMode === opt.key ? 'bg-navy text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {opt.label}
                </button>
              ))}
              {periodMode === 'custom' && (
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={customRange.start}
                    onChange={e => setCustomRange(r => ({ ...r, start: e.target.value }))}
                  />
                  <span className="text-xs text-gray-400">bis</span>
                  <Input
                    type="date"
                    value={customRange.end}
                    onChange={e => setCustomRange(r => ({ ...r, end: e.target.value }))}
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
              {locationShifts.length === 0 ? (
                <div className="flex items-center gap-3">
                  <AlertTriangle size={24} className="text-amber-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-bold text-navy">Noch keine Schichten für diesen Standort angelegt</p>
                    <p className="text-sm text-gray-600">Schließe das Standort-Onboarding ab, um Dienstzeiten und Schichten automatisch anzulegen – erst danach kann ein Dienstplan erstellt werden.</p>
                  </div>
                  <Link href="/admin/onboarding">
                    <Button size="sm" className="gap-2 bg-purple-600 hover:bg-purple-700 text-white focus:ring-purple-500 whitespace-nowrap">
                      Zum Standort-Onboarding
                    </Button>
                  </Link>
                </div>
              ) : !aiRunning && !aiDone && !aiError ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-purple-600" />
                    <p className="font-bold text-navy">KI-Dienstplan erstellen</p>
                  </div>
                  <div>
                    <Textarea
                      label="Zusätzlicher Hinweis für diesen Plan (optional)"
                      value={facilityDescription}
                      onChange={e => {
                        setFacilityDescription(e.target.value)
                        localStorage.setItem('facilityDescription', e.target.value)
                      }}
                      placeholder="Nur für diese Planung – die dauerhafte Standortbeschreibung aus dem Standort-Onboarding wird bereits automatisch berücksichtigt."
                      rows={3}
                      hint="Die Angaben aus dem Standort-Onboarding (Dienstzeiten, Schichten, Regeln, Besonderheiten) fließen automatisch und dauerhaft in jede Planung ein. Hier kannst du zusätzlich etwas ergänzen, das nur für diesen einen Plan gilt."
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
                    <p className="text-xs text-gray-500 mt-1">Versuche es erneut oder wähle einen kürzeren Zeitraum.</p>
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
                  <Button variant="ghost" size="sm" onClick={() => { setAiDone(false); setGeneratedSchedule(null); setAiReasoning(null); setAiDecisions([]); setAiWarnings([]); setAiDecisionQuestion(null); setFallback(null); setFallbackHandled(false); setSaved(false) }} className="text-gray-500">
                    Zurück
                  </Button>
                </div>
              )}
            </div>

            {/* Schedule Grid */}
            {!generatedSchedule && existingEntries.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl">
                <EmptyState
                  icon={CalendarOff}
                  title="Noch kein Dienstplan für diese Woche"
                  description="Erstelle oben mit einem Klick einen fairness-optimierten KI-Dienstplan, oder trage Dienste manuell ein."
                />
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
                                const assignment = getDisplayAssignment(emp.id, dateStr)
                                const isWeekend = i >= 5
                                const Icon = assignment ? (SHIFT_ICONS[assignment.shift.type] ?? DEFAULT_SHIFT_ICON) : null
                                return (
                                  <td key={dateStr} className="p-1.5 text-center">
                                    {isWeekend ? (
                                      <div className="flex items-center justify-center h-9"><span className="text-xs text-gray-300">—</span></div>
                                    ) : assignment && Icon ? (
                                      <div
                                        onClick={() => setExplainEntry({
                                          employeeName: emp.name,
                                          shiftName: assignment.shift.name,
                                          dateStr,
                                          reason: getDisplayReason(emp.id, dateStr),
                                        })}
                                        className="rounded-lg px-2 py-1.5 flex flex-col items-center gap-0.5 cursor-pointer hover:opacity-90 transition-opacity"
                                        style={{ backgroundColor: assignment.shift.bgColor }}
                                      >
                                        <Icon size={12} style={{ color: assignment.shift.color }} />
                                        <span className="text-[10px] font-semibold" style={{ color: assignment.shift.color }}>{assignment.startTime}–{assignment.endTime}</span>
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

            {aiDone && fallback && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-orange-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold text-orange-800">{fallback.message}</p>
                </div>
                {fallbackHandled ? (
                  <p className="text-xs text-orange-700 flex items-center gap-1.5">
                    <CheckCircle size={13} />Vertretungsanfrage wurde erstellt.
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" loading={fallbackLoading} onClick={handleCreateSubstitution} className="gap-1.5 bg-orange-600 hover:bg-orange-700 text-white focus:ring-orange-500">
                      Ja, Vertretungsanfrage erstellen
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleSkipSubstitution} className="border border-orange-200 text-orange-700 hover:bg-orange-100">
                      Nein, danke
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Shift legend */}
            <div className="flex flex-wrap gap-2">
              {locationShifts.map(shift => {
                const Icon = SHIFT_ICONS[shift.type] ?? DEFAULT_SHIFT_ICON
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
                  <Input
                    type="number"
                    min={0}
                    value={minStaffDraft[shift.id] ?? shift.minStaff}
                    onChange={e => setMinStaffDraft(d => ({ ...d, [shift.id]: Math.max(0, Number(e.target.value)) }))}
                    containerClassName="w-20"
                    className="text-center"
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
                  <Input
                    type="number"
                    min={1}
                    value={rulesDraft[key]}
                    onChange={e => setRulesDraft(d => ({ ...d, [key]: Math.max(1, Number(e.target.value)) }))}
                    containerClassName="w-20"
                    className="text-center"
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
                  <Input
                    type="number"
                    min={0}
                    value={rulesDraft[key]}
                    onChange={e => setRulesDraft(d => ({ ...d, [key]: Math.max(0, Number(e.target.value)) }))}
                    containerClassName="w-20"
                    className="text-center"
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

      {/* Explain Assignment Modal */}
      <Modal open={!!explainEntry} onClose={() => setExplainEntry(null)} title="Warum diese Zuweisung?" size="sm">
        {explainEntry && (
          <div className="space-y-3">
            <div className="text-sm text-gray-700">
              <span className="font-semibold">{explainEntry.employeeName}</span> · {explainEntry.shiftName} · {formatDateShort(explainEntry.dateStr)}
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              {explainEntry.reason ?? 'Für diese Zuweisung liegt keine gespeicherte KI-Begründung vor (z. B. weil sie manuell erstellt oder bearbeitet wurde).'}
            </p>
          </div>
        )}
      </Modal>
    </>
  )
}
