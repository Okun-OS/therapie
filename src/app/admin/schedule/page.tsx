'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { FairnessReport } from '@/components/schedule/FairnessReport'
import { SchedulePlanningChat } from '@/components/schedule/SchedulePlanningChat'
import { ScheduleEditChat } from '@/components/schedule/ScheduleEditChat'
import { PlanungslaufPanel } from '@/components/schedule/PlanungslaufPanel'
import type { PlanContext } from '@/components/schedule/PlanungslaufPanel'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/lib/toast-context'
import { calculateFairnessData, resolveWishConflict } from '@/lib/fairness'
import { getWeekDays, getWeeksInRange, toDateString, formatDateShort, getDayName, sanitizeAiText } from '@/lib/utils'
import { getPublicHolidayName } from '@/lib/holidays'
import type { Employee, Location, ScheduleEntry, Shift, VacationRequest, Absence, WishSubmission, PlanningUnit, TaskBlock } from '@/lib/types'
import type { ScheduleEditChange } from '@/lib/schedule-edit-draft'
import {
  ChevronLeft, ChevronRight, Sparkles, Download, Save, Sun, Moon, MoonStar, Briefcase,
  CheckCircle, Loader, AlertTriangle, Info, Scale, CalendarOff, X, CalendarRange, MessageCircle, LayoutGrid, Users, Plus, Trash2,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

type PeriodMode = 'week' | 'twoWeeks' | 'month' | 'custom'

const PERIOD_OPTIONS: { key: PeriodMode; label: string }[] = [
  { key: 'week', label: 'Diese Woche' },
  { key: 'twoWeeks', label: 'Zwei Wochen' },
  { key: 'month', label: 'Ganzer Monat' },
  { key: 'custom', label: 'Individuell' },
]

const MONTH_NAMES = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
const DOW_TO_KUERZEL: Record<number, string> = { 0: 'So', 1: 'Mo', 2: 'Di', 3: 'Mi', 4: 'Do', 5: 'Fr', 6: 'Sa' }

interface ScheduleAssignment {
  shiftId: string
  startTime?: string
  endTime?: string
  gruppe?: string
  funktion?: string
  isSubstitution?: boolean
  substitutionFor?: string
  taskBlocks?: TaskBlock[]
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

function calcShiftHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  let mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins <= 0) mins += 1440
  return Math.round(mins * 10 / 60) / 10
}
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
  const [explainEntry, setExplainEntry] = useState<{ employeeId: string; employeeName: string; shiftName: string; dateStr: string; reason: string | null; gruppe?: string; funktion?: string; isSubstitution?: boolean; substitutionFor?: string; taskBlocks?: TaskBlock[] } | null>(null)
  const [aiWarnings, setAiWarnings] = useState<string[]>([])
  const [aiDecisionQuestion, setAiDecisionQuestion] = useState<string | null>(null)
  const [decisionLoading, setDecisionLoading] = useState(false)
  const [fallback, setFallback] = useState<{ date: string; shiftId: string; message: string } | null>(null)
  const [fallbackLoading, setFallbackLoading] = useState(false)
  const [fallbackHandled, setFallbackHandled] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiErrorCode, setAiErrorCode] = useState<string | null>(null)
  const [surchargeEstimate, setSurchargeEstimate] = useState<{
    employeeId: string
    employeeName: string
    totalMinutes: number
    totalEuros: number
    ruleNames: string[]
  }[] | null>(null)
  const [manualPickerCell, setManualPickerCell] = useState<{ empId: string; dateStr: string } | null>(null)
  const [customTimeShiftId, setCustomTimeShiftId] = useState('')
  const [customStartTime, setCustomStartTime] = useState('')
  const [customEndTime, setCustomEndTime] = useState('')
  const [rulesOpen, setRulesOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [facilityDescription, setFacilityDescription] = useState('')
  const [periodNotes, setPeriodNotes] = useState<{ id: string; note: string }[]>([])
  const [quickEventInput, setQuickEventInput] = useState('')
  const [quickEventSaving, setQuickEventSaving] = useState(false)
  const [planningChatOpen, setPlanningChatOpen] = useState(false)
  const [editChatOpen, setEditChatOpen] = useState(false)
  const [showPlanPanel, setShowPlanPanel] = useState(false)
  const [lastUsedKontext, setLastUsedKontext] = useState('')
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
  const [planningUnits, setPlanningUnits] = useState<PlanningUnit[]>([])
  const [scheduleView, setScheduleView] = useState<'mitarbeiter' | 'einheiten'>('mitarbeiter')
  const [locationArbeitstage, setLocationArbeitstage] = useState<string[]>(['Mo', 'Di', 'Mi', 'Do', 'Fr'])
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear())

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
    fetch(`/api/planning-units?locationId=${locationId}`).then(r => r.json()).then(d => setPlanningUnits(d.units ?? []))
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

  useEffect(() => {
    if (!locationId) return
    fetch('/api/location-model').then(r => r.json()).then(d => {
      const arb = d.model?.schichtmodell?.arbeitstage
      if (Array.isArray(arb) && arb.length > 0) setLocationArbeitstage(arb)
    }).catch(() => {})
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

  // Fix 1a/1b: work-day awareness from location model
  const locationWorkDaySet = useMemo(() => new Set(locationArbeitstage), [locationArbeitstage])
  const isLocationWorkDay = useCallback((date: Date) => locationWorkDaySet.has(DOW_TO_KUERZEL[date.getDay()]), [locationWorkDaySet])

  // For month mode: plan only the exact calendar month, not the full surrounding Mon-Sun weeks
  const monthStart = periodMode === 'month'
    ? toDateString(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1))
    : weekStart
  const monthEnd = periodMode === 'month'
    ? toDateString(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0))
    : weekEnd

  // Solver receives exact month boundaries; other modes use Mon-Sun week boundaries
  const solverFrom = monthStart
  const solverTo = monthEnd

  // Display filter range (existingEntries, editChat period)
  const periodStart = monthStart
  const periodEnd = monthEnd

  // Dates actually available for display/export (location work days within period)
  const periodWeekdayDates = useMemo(
    () => periodWeeks.flatMap(week => week.filter(d => isLocationWorkDay(d) && toDateString(d) >= periodStart && toDateString(d) <= periodEnd).map(toDateString)),
    [periodWeeks, isLocationWorkDay, periodStart, periodEnd]
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
      // Also write into the LocationModel so the solver actually picks them up
      await Promise.allSettled(
        permanentRules.map(text =>
          fetch('/api/location-model/add-rule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          })
        )
      )
    }
    showToast(notes.length > 0 || permanentRules.length > 0 ? 'Besonderheiten übernommen' : 'Danke, notiert')
  }

  async function handleApplyScheduleEdits(changes: ScheduleEditChange[], permanentRules: string[]) {
    if (changes.length > 0) {
      // Fix 2: If there's an unsaved generated plan, persist it first so chat
      // changes don't wipe the whole plan when generatedSchedule is cleared.
      if (generatedSchedule && !saved) {
        await handleSaveSchedule()
      }
      await fetch('/api/schedule-entries/apply-edits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, changes }),
      })
      const refreshed = await fetch(`/api/schedule-entries?locationId=${locationId}`).then(r => r.json())
      setSCHEDULE_ENTRIES(refreshed.entries ?? [])
      setGeneratedSchedule(null)
    }
    if (permanentRules.length > 0) {
      // Save to onboarding context (chat sees these on next turn)
      await fetch('/api/location-onboarding/individuelle-regeln', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, rules: permanentRules }),
      })
      // Also add to LocationModel so the solver actually uses them next run
      await Promise.allSettled(
        permanentRules.map(text =>
          fetch('/api/location-model/add-rule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          })
        )
      )
    }
    showToast(changes.length > 0 || permanentRules.length > 0 ? 'Dienstplan-Änderungen übernommen' : 'Danke, notiert')
  }

  async function handleReplanAfterChat(permanentRules: string[]) {
    // 1. Save permanent rules if any
    if (permanentRules.length > 0) {
      await fetch('/api/location-onboarding/individuelle-regeln', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, rules: permanentRules }),
      })
      await Promise.allSettled(
        permanentRules.map(text =>
          fetch('/api/location-model/add-rule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          })
        )
      )
    }
    // 2. Close the chat modal and trigger a full AI replan for the current period
    setEditChatOpen(false)
    await runAI()
  }

  async function addQuickEvent() {
    const text = quickEventInput.trim()
    if (!text || !locationId || !weekStart || quickEventSaving) return
    setQuickEventSaving(true)
    const note = text.startsWith('Ereignis:') || text.startsWith('Aufgabe:') || text.startsWith('Hinweis:')
      ? text
      : `Ereignis: ${text}`
    const res = await fetch('/api/scheduling-period-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, weekStart, note }),
    })
    const json = await res.json()
    if (json.note) {
      setPeriodNotes(prev => [...prev, json.note])
      setQuickEventInput('')
    }
    setQuickEventSaving(false)
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

  const existingEntries = SCHEDULE_ENTRIES.filter(e =>
    e.locationId === locationId && e.date >= periodStart && e.date <= periodEnd
  )
  const editChatEmployees = useMemo(() => employees.map(e => ({ id: e.id, name: e.name, gruppe: e.gruppe, bereich: e.bereich })), [employees])
  const editChatShifts = useMemo(
    () => locationShifts.map(s => ({ id: s.id, name: s.name, type: s.type, startTime: s.startTime, endTime: s.endTime })),
    [locationShifts]
  )
  const editChatEntries = useMemo(() => {
    if (generatedSchedule) {
      const result: { employeeId: string; employeeName: string; date: string; shiftId: string; shiftName: string }[] = []
      for (const [empId, byDate] of Object.entries(generatedSchedule)) {
        const emp = EMPLOYEES.find(e => e.id === empId)
        for (const [date, assignment] of Object.entries(byDate)) {
          const shift = locationShifts.find(s => s.id === assignment.shiftId)
          if (shift) result.push({ employeeId: empId, employeeName: emp?.name ?? '', date, shiftId: assignment.shiftId, shiftName: shift.name })
        }
      }
      return result
    }
    return existingEntries.map(e => {
      const emp = EMPLOYEES.find(emp => emp.id === e.employeeId)
      const shift = locationShifts.find(s => s.id === e.shiftId)
      return { employeeId: e.employeeId, employeeName: emp?.name ?? '', date: e.date, shiftId: e.shiftId, shiftName: shift?.name ?? '' }
    })
  }, [existingEntries, EMPLOYEES, locationShifts, generatedSchedule])
  const approvedVacations = VACATION_REQUESTS
    .filter(v => v.locationId === locationId && v.status === 'approved' && v.startDate <= periodEnd && v.endDate >= periodStart)
    .map(v => ({ employeeId: v.employeeId, employeeName: v.employeeName, startDate: v.startDate, endDate: v.endDate }))

  const reportedAbsences = ABSENCES
    .filter(a => a.locationId === locationId && a.verificationStatus !== 'abgelehnt' && a.startDate <= periodEnd && a.endDate >= periodStart)
    .map(a => ({ employeeId: a.employeeId, employeeName: a.employeeName, startDate: a.startDate, endDate: a.endDate, type: a.type }))

  const getDisplayAssignment = (empId: string, dateStr: string): { shift: Shift; startTime: string; endTime: string; gruppe?: string; funktion?: string; isSubstitution?: boolean; substitutionFor?: string; taskBlocks?: TaskBlock[] } | null => {
    if (generatedSchedule) {
      const assignment = generatedSchedule[empId]?.[dateStr]
      if (!assignment) return null
      const shift = locationShifts.find(s => s.id === assignment.shiftId)
      if (!shift) return null
      return { shift, startTime: assignment.startTime ?? shift.startTime, endTime: assignment.endTime ?? shift.endTime, gruppe: assignment.gruppe, funktion: assignment.funktion, isSubstitution: assignment.isSubstitution, substitutionFor: assignment.substitutionFor, taskBlocks: assignment.taskBlocks }
    }
    const entry = existingEntries.find(e => e.employeeId === empId && e.date === dateStr)
    if (!entry) return null
    const shift = locationShifts.find(s => s.id === entry.shiftId)
    if (!shift) return null
    return { shift, startTime: entry.startTime ?? shift.startTime, endTime: entry.endTime ?? shift.endTime, gruppe: entry.gruppe, funktion: entry.funktion, isSubstitution: entry.isSubstitution, substitutionFor: entry.substitutionFor, taskBlocks: entry.taskBlocks }
  }

  const getDisplayReason = (empId: string, dateStr: string): string | null => {
    if (generatedSchedule) return aiAssignmentReasons[`${empId}|${dateStr}`] ?? null
    const entry = existingEntries.find(e => e.employeeId === empId && e.date === dateStr)
    return entry?.reason ?? null
  }

  const runAI = async (confirmedDecisionQuestion?: string, kontextOverride?: string) => {
    setAiRunning(true)
    setAiDone(false)
    setAiStep(0)
    setAiError(null)
    setAiErrorCode(null)
    setSurchargeEstimate(null)
    setAiReasoning(null)
    setAiDecisions([])
    setAiAssignmentReasons({})
    setAiWarnings([])
    setAiDecisionQuestion(null)
    setFallback(null)
    setFallbackHandled(false)
    const effectiveKontext = kontextOverride !== undefined ? kontextOverride : lastUsedKontext

    // Animate progress steps while waiting for the real API
    let step = 0
    const interval = setInterval(() => {
      step = Math.min(step + 1, AI_STEPS.length - 2) // stop one before last
      setAiStep(step)
    }, 900)

    try {
      const von = solverFrom
      const bis = solverTo

      // Try new Solver-Evaluator-Orchestrator endpoint first
      const newRes = await fetch('/api/ai/solve-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId,
          von,
          bis,
          kontext: effectiveKontext.trim() || undefined,
        }),
      })

      if (!newRes.ok) {
        const errData = await newRes.json().catch(() => ({ error: newRes.statusText }))
        setAiErrorCode(errData.code ?? null)
        throw new Error(errData.error ?? 'API-Fehler')
      }
      const data: Record<string, unknown> = await newRes.json()

      clearInterval(interval)
      setAiStep(AI_STEPS.length - 1)

      const transposed: Record<string, Record<string, ScheduleAssignment>> = {}
      for (const [empId, dates] of Object.entries(data.week as Record<string, Record<string, ScheduleAssignment>> ?? {})) {
        transposed[empId] = dates
      }

      setGeneratedSchedule(transposed)

      type NewDecision = { typ: string; beschreibung: string; betroffeneMitarbeiter?: string[]; betroffenesDatum?: string }
      type OldDecision = { type: string; message: string; employeeId?: string; date?: string }
      const decisions: OldDecision[] = ((data.decisions ?? []) as NewDecision[]).map(d => ({
        type: d.typ,
        message: d.beschreibung,
        employeeId: d.betroffeneMitarbeiter?.[0],
        date: d.betroffenesDatum,
      }))

      const reasoning = ((data.bewertung as Record<string, unknown>)?.zusammenfassung as string | undefined) ?? null

      setAiReasoning(reasoning ? sanitizeAiText(reasoning) : null)
      setAiDecisions(decisions.map(d => ({ ...d, message: sanitizeAiText(d.message) })))
      const reasonsByEntry: Record<string, string> = {}
      decisions.forEach(d => {
        if (d.type === 'assignment' && d.employeeId && d.date) {
          reasonsByEntry[`${d.employeeId}|${d.date}`] = sanitizeAiText(d.message)
        }
      })
      setAiAssignmentReasons(reasonsByEntry)
      setAiWarnings(((data.warnings ?? []) as string[]).map((w: string) => sanitizeAiText(w)))
      setAiDecisionQuestion(confirmedDecisionQuestion ? null : (data.decisionQuestion ? sanitizeAiText(data.decisionQuestion as string) : null))
      if (data.fallback) {
        const fb = data.fallback as { date: string; shiftId: string; message: string }
        setFallback({ date: fb.date, shiftId: fb.shiftId, message: sanitizeAiText(fb.message) })
      } else {
        setFallback(null)
      }
      setFallbackHandled(false)
      setAiDone(true)

      // Build entries for surcharge estimate
      const empMap = new Map(employees.map(e => [e.id, e.name]))
      const planEntries: { employeeId: string; employeeName: string; date: string; shiftId: string }[] = []
      for (const [empId, days] of Object.entries(transposed)) {
        for (const [date, assignment] of Object.entries(days as Record<string, ScheduleAssignment>)) {
          if (assignment?.shiftId) {
            planEntries.push({
              employeeId: empId,
              employeeName: empMap.get(empId) ?? empId,
              date,
              shiftId: assignment.shiftId,
            })
          }
        }
      }
      if (planEntries.length > 0) {
        fetch('/api/surcharges/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries: planEntries }),
        }).then(r => r.json()).then(d => setSurchargeEstimate(d.rows ?? null)).catch(() => {})
      }
    } catch (err: unknown) {
      clearInterval(interval)
      setAiError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      setAiRunning(false)
      setAiStep(0)
    } finally {
      setAiRunning(false)
    }
  }

  function buildKontext(ctx: PlanContext): string {
    const parts: string[] = []
    const empMap = new Map(employees.map(e => [e.id, e]))
    for (const [empId, decision] of Object.entries(ctx.overtimeDecisions)) {
      const emp = empMap.get(empId)
      if (!emp) continue
      if (decision === 'reduce') {
        parts.push(emp.hoursBalance > 0
          ? `${emp.name}: 1 Dienst weniger diese Woche (${emp.hoursBalance > 0 ? '+' : ''}${emp.hoursBalance.toFixed(1)}h Überstunden abbauen)`
          : `${emp.name}: 1 Dienst mehr diese Woche (${emp.hoursBalance.toFixed(1)}h Minusstunden ausgleichen)`)
      }
    }
    if (ctx.sondernotiz.trim()) parts.push(ctx.sondernotiz.trim())
    return parts.join('. ')
  }

  function handlePlanConfirm(planCtx: PlanContext) {
    const k = buildKontext(planCtx)
    setLastUsedKontext(k)
    setShowPlanPanel(false)
    runAI(undefined, k)
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
        weekDates: (() => {
          const dates: string[] = []
          // Use periodStart/periodEnd (= monthStart/monthEnd for month mode) so we
          // never delete or overwrite entries outside the selected period.
          const [sy, sm, sd] = periodStart.split('-').map(Number)
          const [ey, em, ed] = periodEnd.split('-').map(Number)
          const s = new Date(sy, sm - 1, sd)
          const e = new Date(ey, em - 1, ed)
          for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
            const y = d.getFullYear()
            const mo = String(d.getMonth() + 1).padStart(2, '0')
            const dy = String(d.getDate()).padStart(2, '0')
            dates.push(`${y}-${mo}-${dy}`)
          }
          return dates
        })(),
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
          periodLabel: `${formatDateShort(weekStart)} – ${formatDateShort(weekEnd)}`,
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

  const handlePrint = () => {
    const printData = {
      locationName: location?.name ?? '',
      periodLabel: periodMode === 'month'
        ? `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`
        : `${formatDateShort(periodStart)} – ${formatDateShort(periodEnd)}`,
      exportedAt: new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      employees: employees.map(e => ({ id: e.id, name: e.name, weeklyHours: e.weeklyHours })),
      shifts: locationShifts.map(s => ({ id: s.id, name: s.name, startTime: s.startTime, endTime: s.endTime })),
      weeks: periodWeeks.map(week => ({
        dates: week
          .filter(d => isLocationWorkDay(d) && toDateString(d) >= periodStart && toDateString(d) <= periodEnd)
          .map(toDateString),
      })).filter(w => w.dates.length > 0),
      assignments: (() => {
        const result: Record<string, Record<string, { shiftName: string; startTime: string; endTime: string }>> = {}
        for (const emp of employees) {
          const empA: Record<string, { shiftName: string; startTime: string; endTime: string }> = {}
          for (const week of periodWeeks) {
            for (const day of week) {
              const ds = toDateString(day)
              if (!isLocationWorkDay(day) || ds < periodStart || ds > periodEnd) continue
              const a = getDisplayAssignment(emp.id, ds)
              if (a) empA[ds] = { shiftName: a.shift.name, startTime: a.startTime, endTime: a.endTime }
            }
          }
          if (Object.keys(empA).length > 0) result[emp.id] = empA
        }
        return result
      })(),
    }
    try { localStorage.setItem('schedule-print-v1', JSON.stringify(printData)) } catch { /* quota */ }
    window.open('/admin/schedule/print', '_blank')
  }

  const handleManualAssign = (empId: string, dateStr: string, shiftId: string, startTime?: string, endTime?: string) => {
    setGeneratedSchedule(prev => {
      const base: Record<string, Record<string, ScheduleAssignment>> = prev
        ? { ...prev }
        : (() => {
            const s: Record<string, Record<string, ScheduleAssignment>> = {}
            for (const e of existingEntries) {
              if (!s[e.employeeId]) s[e.employeeId] = {}
              s[e.employeeId][e.date] = { shiftId: e.shiftId }
            }
            return s
          })()
      const assignment: ScheduleAssignment = {
        shiftId,
        ...(startTime ? { startTime } : {}),
        ...(endTime ? { endTime } : {}),
      }
      return { ...base, [empId]: { ...(base[empId] ?? {}), [dateStr]: assignment } }
    })
    setManualPickerCell(null)
    setCustomTimeShiftId('')
    setCustomStartTime('')
    setCustomEndTime('')
  }

  const handleManualRemove = (empId: string, dateStr: string) => {
    setGeneratedSchedule(prev => {
      if (!prev) return prev
      const empSchedule = { ...(prev[empId] ?? {}) }
      delete empSchedule[dateStr]
      return { ...prev, [empId]: empSchedule }
    })
    setExplainEntry(null)
    setManualPickerCell(null)
  }

  if (!locationId) {
    return (
      <>
        
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
                  onClick={() => {
                    setPeriodMode(opt.key)
                    if (opt.key === 'month') { setPickerYear(currentDate.getFullYear()); setMonthPickerOpen(true) }
                    setGeneratedSchedule(null); setAiDone(false); setAiReasoning(null); setAiDecisions([]); setAiWarnings([]); setAiDecisionQuestion(null); setFallback(null); setFallbackHandled(false); setSaved(false)
                  }}
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
              <div className="flex items-center gap-1 relative">
                <button onClick={() => shiftPeriod(-1)} disabled={periodMode === 'custom' && (!customRange.start || !customRange.end)}
                  className="p-2 rounded-xl hover:bg-white border border-gray-200 transition-all disabled:opacity-40">
                  <ChevronLeft size={18} className="text-gray-600" />
                </button>
                {periodMode === 'month' ? (
                  <button
                    onClick={() => { setPickerYear(currentDate.getFullYear()); setMonthPickerOpen(v => !v) }}
                    className="px-4 py-2 text-sm font-semibold text-navy min-w-[200px] text-center hover:bg-white rounded-xl border border-transparent hover:border-gray-200 transition-all"
                  >
                    {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </button>
                ) : (
                  <span className="px-4 py-2 text-sm font-semibold text-navy min-w-[200px] text-center">
                    {formatDateShort(weekStart)} – {formatDateShort(weekEnd)} {weekDays[0].getFullYear()}
                  </span>
                )}
                <button onClick={() => shiftPeriod(1)} disabled={periodMode === 'custom' && (!customRange.start || !customRange.end)}
                  className="p-2 rounded-xl hover:bg-white border border-gray-200 transition-all disabled:opacity-40">
                  <ChevronRight size={18} className="text-gray-600" />
                </button>
                {/* Month picker dropdown */}
                {monthPickerOpen && (
                  <div className="absolute top-full left-0 z-50 mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl p-4 min-w-[240px]">
                    <div className="flex items-center justify-between mb-3">
                      <button onClick={() => setPickerYear(y => y - 1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 font-bold">‹</button>
                      <span className="text-sm font-bold text-navy">{pickerYear}</span>
                      <button onClick={() => setPickerYear(y => y + 1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 font-bold">›</button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {MONTH_NAMES.map((name, i) => {
                        const isSelected = pickerYear === currentDate.getFullYear() && i === currentDate.getMonth()
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              setCurrentDate(new Date(pickerYear, i, 1))
                              setMonthPickerOpen(false)
                              setGeneratedSchedule(null); setAiDone(false); setAiReasoning(null); setAiDecisions([]); setAiWarnings([]); setAiDecisionQuestion(null); setFallback(null); setFallbackHandled(false); setSaved(false)
                            }}
                            className={`py-1.5 rounded-xl text-xs font-semibold transition-all ${isSelected ? 'bg-navy text-white' : 'hover:bg-gray-100 text-gray-700'}`}
                          >
                            {name.slice(0, 3)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {planningUnits.length > 0 && (
                  <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                    <button onClick={() => setScheduleView('mitarbeiter')} className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold transition-all ${scheduleView === 'mitarbeiter' ? 'bg-navy text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                      <Users size={12} /> Mitarbeiter
                    </button>
                    <button onClick={() => setScheduleView('einheiten')} className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold transition-all ${scheduleView === 'einheiten' ? 'bg-navy text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                      <LayoutGrid size={12} /> Einheiten
                    </button>
                  </div>
                )}
                <Button variant="ghost" size="sm" onClick={openRules} className="border border-gray-200">Regeln</Button>
                <Button variant="ghost" size="sm" onClick={handlePrint} className="gap-1 border border-gray-200"><Download size={14} /> PDF</Button>
                <Button variant="ghost" size="sm" onClick={handleExport} className="gap-1 border border-gray-200"><Download size={14} /> CSV</Button>
                {(existingEntries.length > 0 || !!generatedSchedule) && (
                  <Button variant="ghost" size="sm" onClick={() => setEditChatOpen(true)} className="gap-1 border border-gray-200">
                    <MessageCircle size={14} /> Dienstplan bearbeiten
                  </Button>
                )}
                {(aiDone || !!generatedSchedule) && (
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
                      <div className="flex flex-wrap gap-1.5 mb-2">
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
                    <div className="flex gap-2">
                      <input
                        value={quickEventInput}
                        onChange={e => setQuickEventInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addQuickEvent() } }}
                        placeholder="Termin hinzufügen, z.B. Team-Meeting Montag 14h…"
                        disabled={quickEventSaving}
                        className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent disabled:opacity-50"
                      />
                      <button
                        onClick={addQuickEvent}
                        disabled={!quickEventInput.trim() || quickEventSaving}
                        className="px-3 py-1.5 text-xs font-semibold bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-40 transition-colors"
                      >
                        +
                      </button>
                    </div>
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
                      <Button onClick={() => setShowPlanPanel(true)} size="sm" className="gap-2 bg-purple-600 hover:bg-purple-700 text-white focus:ring-purple-500 whitespace-nowrap">
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
                aiErrorCode === 'NO_COMPANY_MODEL' ? (
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={24} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-bold text-amber-800">Unternehmens-Onboarding noch nicht abgeschlossen</p>
                      <p className="text-sm text-amber-700 mt-0.5">
                        Die KI-Dienstplanung benötigt das abgeschlossene Unternehmens-Onboarding, damit sie dein Unternehmen, die Rollen und die grundlegenden Regeln kennt. Bitte schließe es zuerst ab.
                      </p>
                    </div>
                    <Link href="/company/onboarding">
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white whitespace-nowrap flex-shrink-0 focus:ring-amber-500">
                        Zum Onboarding
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={24} className="text-red-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-bold text-red-700">Fehler beim Erstellen</p>
                      <p className="text-sm text-red-600">{aiError}</p>
                      <p className="text-xs text-gray-500 mt-1">Versuche es erneut oder wähle einen kürzeren Zeitraum.</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setAiError(null); setAiErrorCode(null); runAI() }} className="text-gray-500">
                      Erneut
                    </Button>
                  </div>
                )
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
            {scheduleView === 'einheiten' && planningUnits.length > 0 ? (
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
                              <th className="text-left p-3 pl-4 text-white text-xs font-semibold w-36">Einheit</th>
                              {week.filter(d => isLocationWorkDay(d) && toDateString(d) >= periodStart && toDateString(d) <= periodEnd).map((day) => {
                                const dateStr = toDateString(day)
                                const isTodayDay = dateStr === toDateString(new Date())
                                const holiday = getPublicHolidayName(dateStr, location?.bundesland)
                                return (
                                  <th key={dateStr} className={`text-center p-3 text-xs font-semibold min-w-[90px] ${holiday ? 'bg-red-900/30' : ''} ${isTodayDay ? 'text-brand' : 'text-white'}`}>
                                    <div className="flex flex-col items-center">
                                      <span>{getDayName(dateStr, true)}</span>
                                      <span className={`text-lg font-bold ${isTodayDay ? 'text-brand' : holiday ? 'text-red-300' : 'text-white'}`}>{day.getDate()}</span>
                                      {holiday && <span className="text-[8px] text-red-300 font-bold uppercase tracking-wide truncate max-w-[80px]">{holiday}</span>}
                                    </div>
                                  </th>
                                )
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {planningUnits.map((unit, unitIdx) => (
                              <tr key={unit.id} className={unitIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                <td className="p-3 pl-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-navy/10 flex items-center justify-center flex-shrink-0">
                                      <LayoutGrid size={12} className="text-navy" />
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-navy leading-tight">{unit.name}</p>
                                      <p className="text-[10px] text-gray-400">{unit.type}</p>
                                    </div>
                                  </div>
                                </td>
                                {week.filter(d => isLocationWorkDay(d) && toDateString(d) >= periodStart && toDateString(d) <= periodEnd).map((day) => {
                                  const dateStr = toDateString(day)
                                  const assigned = employees.filter(emp => {
                                    const a = getDisplayAssignment(emp.id, dateStr)
                                    return a?.gruppe === unit.name
                                  })
                                  return (
                                    <td key={dateStr} className="p-1.5 align-top">
                                      {assigned.length === 0 ? (
                                        <div className="flex items-center justify-center h-12 text-xs text-gray-200">—</div>
                                      ) : (
                                        <div className="flex flex-col gap-1">
                                          {assigned.map(emp => {
                                            const a = getDisplayAssignment(emp.id, dateStr)!
                                            const Icon = SHIFT_ICONS[a.shift.type] ?? DEFAULT_SHIFT_ICON
                                            return (
                                              <div key={emp.id} className="rounded-lg px-2 py-1 flex flex-col gap-0.5" style={{ backgroundColor: a.shift.bgColor }}>
                                                <div className="flex items-center gap-1.5">
                                                  {a.isSubstitution && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
                                                  <Icon size={10} style={{ color: a.shift.color }} />
                                                  <span className="text-[10px] font-semibold truncate" style={{ color: a.shift.color }}>{emp.name.split(' ')[0]}</span>
                                                </div>
                                                {a.funktion && (
                                                  <span className="text-[8px] leading-tight truncate italic" style={{ color: a.shift.color, opacity: 0.65 }}>{a.funktion}</span>
                                                )}
                                              </div>
                                            )
                                          })}
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
                  </div>
                ))}
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
                            // Fix 1b: use location-configured work days, not hardcoded i>=5
                            const isNonWorkDay = !isLocationWorkDay(day)
                            const isOutsidePeriod = dateStr < periodStart || dateStr > periodEnd
                            const hideCell = isNonWorkDay || isOutsidePeriod
                            const isTodayDay = dateStr === toDateString(new Date())
                            const isFriday = i === 4
                            const isMonday = i === 0
                            const holiday = !hideCell ? getPublicHolidayName(dateStr, location?.bundesland) : undefined
                            return (
                              <th key={dateStr} className={`text-center p-3 text-xs font-semibold min-w-[90px] ${holiday ? 'bg-red-900/30' : ''} ${hideCell ? 'text-gray-500 bg-navy/5' : isTodayDay ? 'text-brand' : (isFriday || isMonday) ? 'text-yellow-300' : 'text-white'}`}>
                                <div className="flex flex-col items-center">
                                  <span>{getDayName(dateStr, true)}</span>
                                  <span className={`text-lg font-bold ${isTodayDay ? 'text-brand' : hideCell ? 'text-gray-500' : holiday ? 'text-red-300' : 'text-white'}`}>{day.getDate()}</span>
                                  {!hideCell && holiday ? (
                                    <span className="text-[8px] text-red-300 font-bold uppercase tracking-wide truncate max-w-[80px]">{holiday}</span>
                                  ) : !hideCell && (isFriday || isMonday) ? (
                                    <span className="text-[8px] text-yellow-300 font-bold uppercase tracking-wide">
                                      {isFriday ? 'Freitag' : 'Montag'}
                                    </span>
                                  ) : null}
                                </div>
                              </th>
                            )
                          })}
                          <th className="text-center p-3 text-white text-xs font-semibold w-20">Std.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const groups = new Map<string, Employee[]>()
                          for (const emp of employees) {
                            const key = emp.gruppe || ''
                            if (!groups.has(key)) groups.set(key, [])
                            groups.get(key)!.push(emp)
                          }
                          const hasGroups = Array.from(groups.keys()).some(k => k !== '')
                          const sortedKeys = Array.from(groups.keys()).sort((a, b) => a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'de'))
                          let rowIdx = 0
                          return sortedKeys.flatMap(groupKey => {
                            const groupEmps = groups.get(groupKey)!
                            const rows = []
                            if (hasGroups) {
                              rows.push(
                                <tr key={`group-${groupKey}`} className="bg-navy/5 border-t border-gray-100">
                                  <td colSpan={week.length + 2} className="px-4 py-1.5">
                                    <span className="text-[10px] font-bold text-navy/60 uppercase tracking-widest">
                                      {groupKey || 'Ohne Bereich'}
                                    </span>
                                  </td>
                                </tr>
                              )
                            }
                            for (const emp of groupEmps) {
                              const empRowIdx = rowIdx++
                              const fd = fairnessData.find(f => f.employeeId === emp.id)
                              const hasIssues = fd && fd.issues.length > 0
                              rows.push(
                                <tr key={emp.id} className={empRowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
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
                                    // Fix 1b: hide cells outside location work days or period bounds
                                    const isNonWorkDay2 = !isLocationWorkDay(day)
                                    const isOutsidePeriod2 = dateStr < periodStart || dateStr > periodEnd
                                    const hideCell2 = isNonWorkDay2 || isOutsidePeriod2
                                    const Icon = assignment ? (SHIFT_ICONS[assignment.shift.type] ?? DEFAULT_SHIFT_ICON) : null
                                    return (
                                      <td key={dateStr} className={`p-1.5 text-center ${hideCell2 ? 'bg-gray-50/50' : ''}`}>
                                        {hideCell2 ? (
                                          <div className="flex items-center justify-center h-9"><span className="text-xs text-gray-200">—</span></div>
                                        ) : assignment && Icon ? (
                                          <div
                                            onClick={() => setManualPickerCell({ empId: emp.id, dateStr })}
                                            className="rounded-lg px-2 py-1.5 flex flex-col items-center gap-0.5 cursor-pointer hover:opacity-90 transition-opacity relative"
                                            style={{ backgroundColor: assignment.shift.bgColor }}
                                            title={[assignment.gruppe, assignment.funktion, assignment.isSubstitution ? `Vertretung${assignment.substitutionFor ? `: ${assignment.substitutionFor}` : ''}` : null].filter(Boolean).join(' · ') || undefined}
                                          >
                                            {assignment.isSubstitution && (
                                              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
                                            )}
                                            <Icon size={12} style={{ color: assignment.shift.color }} />
                                            <span className="text-[10px] font-semibold" style={{ color: assignment.shift.color }}>{assignment.startTime}–{assignment.endTime}</span>
                                            {assignment.gruppe && (
                                              <span className="text-[9px] leading-tight truncate max-w-full" style={{ color: assignment.shift.color, opacity: 0.75 }}>{assignment.gruppe}</span>
                                            )}
                                            {assignment.funktion && (
                                              <span className="text-[9px] leading-tight truncate max-w-full italic" style={{ color: assignment.shift.color, opacity: 0.6 }}>{assignment.funktion}</span>
                                            )}
                                          </div>
                                        ) : (
                                          <button
                                            onClick={() => setManualPickerCell({ empId: emp.id, dateStr })}
                                            className="w-full flex items-center justify-center h-9 rounded-lg transition-colors hover:bg-gray-50 text-gray-200 hover:text-brand group"
                                            title="Schicht manuell zuweisen"
                                          >
                                            <span className="text-xs group-hover:hidden">—</span>
                                            <Plus size={14} className="hidden group-hover:block" />
                                          </button>
                                        )}
                                      </td>
                                )
                              })}
                              <td className="p-2 text-center align-middle">
                                {(() => {
                                  const visibleDays = week.filter(d => {
                                    const ds = toDateString(d)
                                    return isLocationWorkDay(d) && ds >= periodStart && ds <= periodEnd
                                  })
                                  const ist = visibleDays.reduce((sum, d) => {
                                    const a = getDisplayAssignment(emp.id, toDateString(d))
                                    return a ? sum + calcShiftHours(a.startTime, a.endTime) : sum
                                  }, 0)
                                  const soll = emp.weeklyHours
                                  const pct = soll > 0 ? ist / soll : 0
                                  return (
                                    <div className="text-xs font-mono whitespace-nowrap leading-tight">
                                      <span className={pct > 1.05 ? 'text-red-600 font-bold' : pct >= 0.9 ? 'text-green-600' : 'text-blue-500'}>
                                        {ist.toFixed(1)}
                                      </span>
                                      <span className="text-gray-400">/{soll}h</span>
                                    </div>
                                  )
                                })()}
                              </td>
                            </tr>
                          )
                            }
                            return rows
                          })
                        })()}
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

            {surchargeEstimate && surchargeEstimate.length > 0 && user?.role === 'company' && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-700 mb-2">Geschätzte Zuschläge (aus Dienstplan)</p>
                <div className="space-y-1">
                  {surchargeEstimate.map(row => (
                    <div key={row.employeeId} className="flex justify-between text-xs">
                      <span className="text-gray-700">{row.employeeName}</span>
                      <span className="font-mono text-emerald-700">
                        {row.totalEuros > 0
                          ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(row.totalEuros)
                          : '–'}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-amber-600 mt-1.5">Schätzung basierend auf geplanten Schichten. Exakte Berechnung nach Zeiterfassung.</p>
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
        locationId={locationId}
        periodLabel={`${formatDateShort(weekStart)} – ${formatDateShort(weekEnd)}`}
      />

      {/* Dienstplan-Editier-Chat Modal */}
      <ScheduleEditChat
        key={`edit_${periodStart}_${periodEnd}`}
        open={editChatOpen}
        onClose={() => setEditChatOpen(false)}
        onApply={handleApplyScheduleEdits}
        onReplan={handleReplanAfterChat}
        locationId={locationId ?? ''}
        periodLabel={periodMode === 'month' ? `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}` : `${formatDateShort(periodStart)} – ${formatDateShort(periodEnd)}`}
        periodStart={periodStart}
        periodEnd={periodEnd}
        employees={editChatEmployees}
        shifts={editChatShifts}
        entries={editChatEntries}
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
      <Modal open={!!explainEntry} onClose={() => setExplainEntry(null)} title="Zuweisung" size="sm">
        {explainEntry && (
          <div className="space-y-3">
            <div className="text-sm text-gray-700">
              <span className="font-semibold">{explainEntry.employeeName}</span> · {explainEntry.shiftName} · {formatDateShort(explainEntry.dateStr)}
            </div>
            {(explainEntry.gruppe || explainEntry.funktion || explainEntry.isSubstitution) && (
              <div className="flex flex-wrap gap-1.5">
                {explainEntry.gruppe && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-navy/10 text-xs font-medium text-navy">{explainEntry.gruppe}</span>
                )}
                {explainEntry.funktion && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-brand/10 text-xs font-medium text-brand">{explainEntry.funktion}</span>
                )}
                {explainEntry.isSubstitution && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-xs font-medium text-amber-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    {explainEntry.substitutionFor ? `Vertretung: ${explainEntry.substitutionFor}` : 'Vertretung'}
                  </span>
                )}
              </div>
            )}
            {explainEntry.taskBlocks && explainEntry.taskBlocks.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Aufgabenplan</p>
                <div className="space-y-1">
                  {explainEntry.taskBlocks.map((block, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-2 rounded-lg bg-gray-50 border border-gray-100">
                      <span className="text-xs font-mono text-gray-400 flex-shrink-0">{block.start}–{block.end}</span>
                      <span className="text-xs text-navy">{block.aufgabe}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">KI-Begründung</p>
              <p className="text-sm text-gray-600 leading-relaxed">
                {explainEntry.reason ?? 'Für diese Zuweisung liegt keine gespeicherte KI-Begründung vor (z. B. weil sie manuell erstellt oder bearbeitet wurde).'}
              </p>
            </div>
            <div className="pt-1 border-t border-gray-100 flex justify-between items-center">
              <button
                onClick={() => setManualPickerCell({ empId: explainEntry.employeeId, dateStr: explainEntry.dateStr })}
                className="text-xs text-brand font-semibold hover:underline"
              >
                Schicht ändern
              </button>
              <button
                onClick={() => handleManualRemove(explainEntry.employeeId, explainEntry.dateStr)}
                className="flex items-center gap-1 text-xs text-red-500 font-semibold hover:text-red-700"
              >
                <Trash2 size={12} /> Entfernen
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Planungslauf Panel Modal */}
      <Modal open={showPlanPanel} onClose={() => setShowPlanPanel(false)} title="Vor dem Planungslauf" size="md">
        {locationId && (
          <PlanungslaufPanel
            locationId={locationId}
            onConfirm={handlePlanConfirm}
            onCancel={() => setShowPlanPanel(false)}
          />
        )}
      </Modal>

      {/* Manual Shift Picker Modal */}
      <Modal open={!!manualPickerCell} onClose={() => { setManualPickerCell(null); setCustomTimeShiftId(''); setCustomStartTime(''); setCustomEndTime('') }} title="Schicht bearbeiten" size="sm">
        {manualPickerCell && (() => {
          const pickerEmp = employees.find(e => e.id === manualPickerCell.empId)
          const currentAssignment = getDisplayAssignment(manualPickerCell.empId, manualPickerCell.dateStr)
          const reason = getDisplayReason(manualPickerCell.empId, manualPickerCell.dateStr)
          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">{pickerEmp?.name}</span> · {formatDateShort(manualPickerCell.dateStr)}
                </p>
                {currentAssignment && (
                  <button
                    onClick={() => handleManualRemove(manualPickerCell.empId, manualPickerCell.dateStr)}
                    className="flex items-center gap-1 text-xs text-red-500 font-semibold hover:text-red-700 transition-colors"
                  >
                    <X size={12} /> Dienst entfernen
                  </button>
                )}
              </div>

              {locationShifts.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Keine Schichten für diesen Standort angelegt.</p>
              ) : (
                <div className="space-y-2">
                  {locationShifts.map(shift => {
                    const Icon = SHIFT_ICONS[shift.type] ?? DEFAULT_SHIFT_ICON
                    const isActive = currentAssignment?.shift.id === shift.id && !customTimeShiftId
                    return (
                      <button
                        key={shift.id}
                        onClick={() => handleManualAssign(manualPickerCell.empId, manualPickerCell.dateStr, shift.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${isActive ? 'border-navy bg-navy/5' : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'}`}
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: shift.bgColor }}>
                          <Icon size={14} style={{ color: shift.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-navy">{shift.name}</p>
                          <p className="text-xs text-gray-500">{shift.startTime} – {shift.endTime}</p>
                        </div>
                        {isActive && <CheckCircle size={14} className="text-navy flex-shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Custom time section */}
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Individuelle Zeit</p>
                <div className="space-y-2">
                  <select
                    value={customTimeShiftId}
                    onChange={e => {
                      setCustomTimeShiftId(e.target.value)
                      const s = locationShifts.find(s => s.id === e.target.value)
                      if (s) { setCustomStartTime(s.startTime); setCustomEndTime(s.endTime) }
                    }}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy/20"
                  >
                    <option value="">Schichttyp wählen…</option>
                    {locationShifts.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  {customTimeShiftId && (
                    <div className="flex gap-2 items-center">
                      <input
                        type="time"
                        value={customStartTime}
                        onChange={e => setCustomStartTime(e.target.value)}
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy/20"
                      />
                      <span className="text-gray-400 text-xs">–</span>
                      <input
                        type="time"
                        value={customEndTime}
                        onChange={e => setCustomEndTime(e.target.value)}
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy/20"
                      />
                      <button
                        disabled={!customStartTime || !customEndTime}
                        onClick={() => handleManualAssign(manualPickerCell.empId, manualPickerCell.dateStr, customTimeShiftId, customStartTime, customEndTime)}
                        className="px-3 py-2 rounded-lg bg-navy text-white text-xs font-semibold disabled:opacity-40 hover:bg-navy/80 transition-colors"
                      >
                        OK
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {reason && (
                <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 italic">{reason}</p>
              )}
            </div>
          )
        })()}
      </Modal>
    </>
  )
}
