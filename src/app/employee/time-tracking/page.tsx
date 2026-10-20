'use client'

import Link from 'next/link'
import { ABWEICHUNG_TEXT, type Abweichungsart } from '@/lib/stempelgrund'
import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/lib/toast-context'
import { OVERTIME_REASONS, type AbsenceType, type Employee, type TimeLog, type ScheduleEntry, type Shift, type OvertimeRequest, type HoursAccountSummary, type MonthlyClosing } from '@/lib/types'
import { OVERTIME_MIN_MINUTES } from '@/lib/workforce-score-constants'
import { PlayCircle, StopCircle, Clock, Timer, TrendingUp, Calendar, Coffee, AlertCircle, FileText, ChevronDown, ChevronUp, Stethoscope, Trash2, Loader2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate, formatTime, getWeekDays, toDateString } from '@/lib/utils'

const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

const ABSENCE_TYPE_LABEL: Record<AbsenceType, string> = {
  krankheit: 'Krankheit',
  fortbildung: 'Fortbildung',
  sonstige: 'Sonstige Abwesenheit',
  entschuldigt: 'Entschuldigte Fehlzeit',
  unentschuldigt: 'Unentschuldigte Fehlzeit',
}

const OVERTIME_STATUS_LABEL: Record<string, { label: string; variant: 'warning' | 'success' | 'danger' | 'info' }> = {
  pending: { label: 'Ausstehend', variant: 'warning' },
  approved: { label: 'Genehmigt', variant: 'success' },
  denied: { label: 'Abgelehnt', variant: 'danger' },
  partial: { label: 'Teilweise genehmigt', variant: 'info' },
}

const CLOSING_STATUS_LABEL: Record<string, { label: string; variant: 'warning' | 'success' | 'info' }> = {
  offen: { label: 'Offen', variant: 'warning' },
  geprueft: { label: 'Geprüft', variant: 'info' },
  freigegeben: { label: 'Freigegeben', variant: 'success' },
}

export default function TimeTracking() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [clockedIn, setClockedIn] = useState(false)
  const [clockInTime, setClockInTime] = useState<Date | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null)
  const [activeTimeLogId, setActiveTimeLogId] = useState<string | null>(null)

  const [, forceRender] = useState(0)
  const refresh = () => forceRender(n => n + 1)


  // §204 Der Antrag, der gerade zurückgezogen werden soll.
  const [zurueckziehen, setZurueckziehen] = useState<OvertimeRequest | null>(null)
  const [zieht, setZieht] = useState(false)
  const [absenceModalOpen, setAbsenceModalOpen] = useState(false)
  const [absenceType, setAbsenceType] = useState<AbsenceType>('krankheit')
  const [absenceStart, setAbsenceStart] = useState('')
  const [absenceEnd, setAbsenceEnd] = useState('')
  const [absenceNote, setAbsenceNote] = useState('')
  const [absenceProof, setAbsenceProof] = useState(false)

  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)
  const [myEmployee, setMyEmployee] = useState<Employee | null>(null)
  const [TIME_LOGS, setTIME_LOGS] = useState<TimeLog[]>([])
  const [SCHEDULE_ENTRIES, setSCHEDULE_ENTRIES] = useState<ScheduleEntry[]>([])
  const [SHIFTS, setSHIFTS] = useState<Shift[]>([])
  const [activeLog, setActiveLog] = useState<TimeLog | null>(null)
  const [account, setAccount] = useState<HoursAccountSummary | null>(null)
  const [myOvertimeRequests, setMyOvertimeRequests] = useState<OvertimeRequest[]>([])
  const [visibleClosings, setVisibleClosings] = useState<MonthlyClosing[]>([])

  useEffect(() => {
    if (!user?.employeeId) return
    fetch(`/api/employees/${user.employeeId}`).then(r => r.json()).then(d => setMyEmployee(d.employee ?? null))
  }, [user?.employeeId])

  useEffect(() => {
    fetch('/api/shifts').then(r => r.json()).then(d => setSHIFTS(d.shifts))
  }, [])

  useEffect(() => {
    if (!user?.employeeId) return
    fetch(`/api/time-logs?employeeId=${user.employeeId}`).then(r => r.json()).then(d => setTIME_LOGS(d.logs))
    fetch(`/api/schedule-entries?employeeId=${user.employeeId}`).then(r => r.json()).then(d => setSCHEDULE_ENTRIES(d.entries))
    fetch(`/api/overtime-requests?employeeId=${user.employeeId}`).then(r => r.json()).then(d => setMyOvertimeRequests(d.requests))
  }, [user?.employeeId])

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
      if (clockedIn && clockInTime) {
        setElapsed(Math.floor((Date.now() - clockInTime.getTime()) / 1000))
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [clockedIn, clockInTime])

  const getShiftById = (shiftId: string) => SHIFTS.find(s => s.id === shiftId)

  const myLogs = TIME_LOGS.filter(t => t.employeeId === user?.employeeId).sort((a, b) => b.date.localeCompare(a.date))

  const netMinutes = (t: TimeLog) => Math.max(0, (t.totalMinutes || 0) - (t.breakMinutes || 0))

  const todayMinutes = myLogs
    .filter(t => t.date === toDateString(new Date()))
    .reduce((s, t) => s + netMinutes(t), 0)

  const weekDays = getWeekDays(new Date())
  const weekStart = toDateString(weekDays[0])
  const weekEnd = toDateString(weekDays[6])
  const weekMinutes = myLogs
    .filter(t => t.date >= weekStart && t.date <= weekEnd)
    .reduce((s, t) => s + netMinutes(t), 0)

  const todayStr = toDateString(new Date())
  const hasShiftToday = SCHEDULE_ENTRIES.some(e => e.employeeId === user?.employeeId && e.date === todayStr)

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const monthPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`
  const monthMinutes = myLogs
    .filter(t => t.date.startsWith(monthPrefix))
    .reduce((s, t) => s + netMinutes(t), 0)

  const onBreak = !!activeLog?.breakStart

  const fetchActiveLog = () => {
    if (!user?.employeeId) return
    fetch(`/api/time-tracking/active?employeeId=${user.employeeId}`).then(r => r.json()).then(d => {
      setActiveLog(d.log ?? null)
      setActiveEntryId(d.entryId ?? null)
    })
  }

  const fetchAccount = () => {
    if (!user?.employeeId) return
    const params = new URLSearchParams({ employeeId: user.employeeId, year: String(currentYear), month: String(currentMonth) })
    if (myEmployee?.weeklyHours) params.set('weeklyHours', String(myEmployee.weeklyHours))
    fetch(`/api/hours-account?${params.toString()}`).then(r => r.json()).then(d => setAccount(d.summary))
  }

  const fetchOvertimeRequests = () => {
    if (!user?.employeeId) return
    fetch(`/api/overtime-requests?employeeId=${user.employeeId}`).then(r => r.json()).then(d => setMyOvertimeRequests(d.requests))
  }

  const fetchTimeLogs = () => {
    if (!user?.employeeId) return
    fetch(`/api/time-logs?employeeId=${user.employeeId}`).then(r => r.json()).then(d => setTIME_LOGS(d.logs))
  }

  const fetchClosings = () => {
    if (!user?.employeeId) return
    fetch(`/api/monthly-closings?employeeId=${user.employeeId}`).then(r => r.json()).then(d => setVisibleClosings(d.closings))
  }

  useEffect(() => {
    fetchActiveLog()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.employeeId])

  useEffect(() => {
    if (activeLog && !activeLog.clockOut) {
      const startInstant = activeLog.clockInAt
        ? new Date(activeLog.clockInAt)
        : new Date(`${activeLog.date}T${activeLog.clockIn}:00`)
      setClockedIn(true)
      setClockInTime(startInstant)
      setActiveTimeLogId(activeLog.id)
      setElapsed(Math.max(0, Math.floor((Date.now() - startInstant.getTime()) / 1000)))
    } else {
      setClockedIn(false)
      setClockInTime(null)
      setActiveTimeLogId(null)
      setElapsed(0)
    }
  }, [activeLog])

  useEffect(() => {
    fetchAccount()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.employeeId, myEmployee?.weeklyHours, currentYear, currentMonth])

  // Ensure the current and previous two months have a (lazily generated) Monatsübersicht to view
  useEffect(() => {
    if (!user?.employeeId || !myEmployee) return
    ;(async () => {
      for (let i = 0; i < 3; i++) {
        const d = new Date(currentYear, currentMonth - 1 - i, 1)
        await fetch('/api/monthly-closings/get-or-create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeId: user.employeeId, year: d.getFullYear(), month: d.getMonth() + 1, employeeInfo: myEmployee }),
        })
      }
      fetchClosings()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.employeeId, myEmployee?.id])

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  /*
   * §137 Gestempelt wird ueber EINEN Aufruf.
   *
   * Vorher legte diese Seite die Zeitbuchung selbst an, startete danach die
   * Erfassung und merkte sich beide Kennungen im Browser. Brach einer der
   * Aufrufe ab, stimmte der Zustand nicht mehr — und auf der Startseite gab es
   * daneben noch einen dritten Weg, der ueberhaupt nichts gespeichert hat.
   *
   * Jetzt entscheidet der Server, was erlaubt ist, und antwortet mit dem neuen
   * Zustand. Diese Seite zeigt ihn nur noch an.
   */
  /*
   * §203 Hier standen `handleClockIn`, `handleClockOut` und die beiden
   * Pausen-Handgriffe — die zweite Stempeluhr dieser App.
   *
   * Sie sind weg, weil die Uhr weg ist. Mit ihnen geht die eigene
   * Überstunden-Rückfrage, die `handleClockOut` auslöste: Sie verglich die
   * UHRZEIT des Gehens mit dem Dienstende und rechnete dabei in der Zeitzone
   * des Browsers gegen Daten aus `SCHEDULE_ENTRIES`. Wer später kam und
   * später ging, bekam eine Überstundenfrage für Stunden, die er nicht
   * gearbeitet hatte.
   *
   * Gefragt wird jetzt an einer Stelle und nach der DAUER, auf dem Server:
   * `src/lib/stempelgrund.ts`. Der Überstundenantrag entsteht aus derselben
   * Begründung in `/api/time-tracking/begruendung`.
   */


  /**
   * §204 Den eigenen Antrag zurückziehen.
   *
   * Gefragt wird vorher — das Löschen lässt sich nicht rückgängig machen, und
   * ein Mülltonnensymbol trifft man auf dem Telefon schneller, als einem lieb
   * ist. Was wirklich passiert ist, bleibt am Zeiteintrag stehen (§203); weg
   * ist nur der offene Posten bei der Leitung.
   */
  const antragZurueckziehen = async () => {
    if (!zurueckziehen) return
    setZieht(true)
    try {
      const r = await fetch(`/api/overtime-requests/${zurueckziehen.id}`, { method: 'DELETE' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { showToast(d.error ?? 'Das hat nicht geklappt', 'error'); return }
      setZurueckziehen(null)
      showToast('Antrag zurückgezogen', 'success')
      fetchOvertimeRequests()
    } catch {
      showToast('Keine Verbindung — bitte noch einmal versuchen', 'error')
    } finally {
      setZieht(false)
    }
  }

  const handleSubmitAbsence = async () => {
    if (!user?.employeeId) return
    if (!absenceStart || !absenceEnd) { showToast('Bitte Zeitraum angeben', 'error'); return }
    const days = Math.max(1, Math.round((new Date(absenceEnd).getTime() - new Date(absenceStart).getTime()) / 86400000) + 1)
    const locationId = myEmployee?.locationId || user.locationId
    await fetch('/api/absences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: user.employeeId,
        employeeName: user.name,
        locationId,
        type: absenceType,
        startDate: absenceStart,
        endDate: absenceEnd,
        days,
        note: absenceNote.trim() || undefined,
        proofProvided: absenceProof,
      }),
    })
    fetch('/api/time-tracking/notify-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeName: user.name, locationId, kind: 'absence', startDate: absenceStart, endDate: absenceEnd }),
    }).catch(() => {})
    fetchAccount()
    setAbsenceModalOpen(false)
    setAbsenceStart('')
    setAbsenceEnd('')
    setAbsenceNote('')
    setAbsenceProof(false)
    showToast('Abwesenheit gemeldet', 'success')
    refresh()
  }

  return (
    <>
      
      <div className="p-4 sm:p-6 space-y-5">

        {/*
          §203 Hier stand eine zweite Stempeluhr.

          Gestempelt wurde an zwei Stellen: hier und auf „Mein Tag". Zwei
          Uhren für denselben Handgriff sind nicht doppelt bequem, sondern
          doppelt unsicher — jede hatte ihre eigene Logik, und die hier
          sperrte sogar das Einstempeln ohne geplanten Dienst („Einstempeln
          nicht möglich"), während die andere es zuließ. Wer am Monatsende
          eine Lücke sucht, findet zwei Wege, auf denen sie entstehen kann.

          Diese Seite zeigt jetzt nur noch an, was läuft. Gestempelt wird auf
          „Mein Tag" — dort, wo die App morgens ohnehin geöffnet wird.
        */}
        {clockedIn && (
          <Card className="bg-gradient-to-br from-navy to-navy-light border-0" padding="lg">
            <div className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${onBreak ? 'bg-amber-400' : 'bg-green-400'} animate-pulse`} />
                  <p className={`text-xs font-medium ${onBreak ? 'text-amber-300' : 'text-green-300'}`}>
                    {onBreak ? 'Pause aktiv' : 'Läuft gerade'}
                  </p>
                </div>
                <p className="text-brand text-3xl font-bold font-mono mt-0.5">{formatElapsed(elapsed)}</p>
                <p className="text-navy-100 text-xs mt-1">
                  seit {activeLog?.clockIn} Uhr
                  {(activeLog?.breakMinutes ?? 0) > 0 && ` · Pause: ${formatTime(activeLog!.breakMinutes!)}`}
                </p>
              </div>
              <Link
                href="/employee"
                className="shrink-0 px-4 py-3 rounded-2xl bg-white/15 text-white text-sm font-semibold"
              >
                Stempeln
              </Link>
            </div>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <Clock size={18} className="mx-auto text-blue-500 mb-1" />
            <p className="text-lg font-bold text-navy">{formatTime(todayMinutes)}</p>
            <p className="text-xs text-gray-500">Heute</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <Timer size={18} className="mx-auto text-emerald-500 mb-1" />
            <p className="text-lg font-bold text-navy">{formatTime(weekMinutes)}</p>
            <p className="text-xs text-gray-500">Diese Woche</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <TrendingUp size={18} className="mx-auto text-purple-500 mb-1" />
            <p className="text-lg font-bold text-navy">{formatTime(monthMinutes)}</p>
            <p className="text-xs text-gray-500">Dieser Monat</p>
          </div>
        </div>

        {/* Stundenkonto */}
        {account && (
          <Card>
            <CardHeader>
              <CardTitle>Stundenkonto · {MONTH_NAMES[currentMonth - 1]}</CardTitle>
              <Button variant="secondary" className="gap-1.5 text-xs px-3 py-1.5" onClick={() => setAbsenceModalOpen(true)}>
                <Stethoscope size={13} />
                Abwesenheit melden
              </Button>
            </CardHeader>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Soll</p>
                <p className="text-sm font-bold text-navy">{formatTime(account.sollMinutes)}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Ist</p>
                <p className="text-sm font-bold text-navy">{formatTime(account.istMinutes)}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-xs text-emerald-600">Überstunden</p>
                <p className="text-sm font-bold text-emerald-700">{formatTime(account.overtimeMinutes)}</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3">
                <p className="text-xs text-amber-600">Minusstunden</p>
                <p className="text-sm font-bold text-amber-700">{formatTime(account.undertimeMinutes)}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Urlaub</p>
                <p className="text-sm font-bold text-navy">{account.vacationDays} Tage</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Krankheit</p>
                <p className="text-sm font-bold text-navy">{account.sickDays} Tage</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 col-span-2">
                <p className="text-xs text-gray-500">Sonstige Abwesenheiten</p>
                <p className="text-sm font-bold text-navy">{account.otherAbsenceDays} Tage</p>
              </div>
            </div>
          </Card>
        )}

        {/* Überstundenanträge */}
        {myOvertimeRequests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Meine Überstundenanträge</CardTitle>
              <Badge variant="default">{myOvertimeRequests.length}</Badge>
            </CardHeader>
            <div className="space-y-2">
              {myOvertimeRequests.map(req => {
                const status = OVERTIME_STATUS_LABEL[req.status]
                return (
                  <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <AlertCircle size={16} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy">{formatDate(req.date)} · +{formatTime(req.overtimeMinutes)}</p>
                      <p className="text-xs text-gray-500">{req.reason}{req.adminComment ? ` · ${req.adminComment}` : ''}</p>
                    </div>
                    {/*
                      §204 Zurückziehen gibt es nur, solange nichts entschieden
                      ist. Ein Knopf, der bei einem genehmigten Antrag
                      danebensteht und dann „geht nicht" sagt, ist eine Frage,
                      die niemand gestellt hat.
                    */}
                    {req.status === 'pending' && (
                      <button
                        onClick={() => setZurueckziehen(req)}
                        aria-label="Antrag zurückziehen"
                        className="shrink-0 p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* Monatsübersichten */}
        <Card>
          <CardHeader>
            <CardTitle>Monatsübersichten</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {visibleClosings.map(closing => {
              const key = `${closing.year}-${closing.month}`
              const isOpen = expandedMonth === key
              const status = CLOSING_STATUS_LABEL[closing.status]
              return (
                <div key={closing.id} className="rounded-xl bg-gray-50 overflow-hidden">
                  <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpandedMonth(isOpen ? null : key)}>
                    <div className="w-9 h-9 rounded-xl bg-navy flex items-center justify-center flex-shrink-0">
                      <FileText size={16} className="text-brand" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy">{MONTH_NAMES[closing.month - 1]} {closing.year}</p>
                      <p className="text-xs text-gray-500">{closing.arbeitstage} Arbeitstage</p>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                    {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                  {isOpen && (
                    <div className="px-3 pb-3 space-y-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <p>Soll: <span className="font-semibold text-navy">{formatTime(closing.sollMinutes)}</span></p>
                        <p>Ist: <span className="font-semibold text-navy">{formatTime(closing.istMinutes)}</span></p>
                        <p>Pausen: <span className="font-semibold text-navy">{formatTime(closing.breakMinutes)}</span></p>
                        <p>Überstunden: <span className="font-semibold text-navy">{formatTime(closing.overtimeMinutes)}</span></p>
                        <p>Minusstunden: <span className="font-semibold text-navy">{formatTime(closing.undertimeMinutes)}</span></p>
                        <p>Urlaub: <span className="font-semibold text-navy">{closing.vacationDays} Tage</span></p>
                        <p>Krankheit: <span className="font-semibold text-navy">{closing.sickDays} Tage</span></p>
                        <p>Fehlzeiten: <span className="font-semibold text-navy">{closing.otherAbsenceDays} Tage</span></p>
                      </div>
                      {closing.comments.length > 0 && (
                        <div className="space-y-1 pt-1 border-t border-gray-200">
                          {closing.comments.map((c, i) => (
                            <p key={i} className="text-xs text-gray-500"><span className="font-semibold text-navy">{c.author}:</span> {c.text}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>

        {/* Recent Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Zeitnachweise</CardTitle>
            <Badge variant="default">{myLogs.length} Einträge</Badge>
          </CardHeader>
          <div className="space-y-2">
            {myLogs.length === 0 ? (
              <EmptyState icon={Calendar} title="Keine Zeiteinträge vorhanden" />
            ) : (
              myLogs.map(log => {
                const mins = log.totalMinutes || 0
                const scheduleEntry = SCHEDULE_ENTRIES.find(e => e.employeeId === log.employeeId && e.date === log.date)
                const shift = scheduleEntry ? getShiftById(scheduleEntry.shiftId) : undefined
                let plannedMinutes = 480
                if (shift) {
                  const [sh, sm] = shift.startTime.split(':').map(Number)
                  const [eh, em] = shift.endTime.split(':').map(Number)
                  plannedMinutes = (eh * 60 + em) - (sh * 60 + sm)
                }
                const isOver = mins > plannedMinutes
                return (
                  <div key={log.id} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Clock size={18} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy">{formatDate(log.date)}</p>
                      <p className="text-xs text-gray-500">
                        {log.clockIn} Uhr → {log.clockOut ? `${log.clockOut} Uhr` : 'läuft...'}
                        {(log.breakMinutes ?? 0) > 0 && ` · Pause ${formatTime(log.breakMinutes!)}`}
                      </p>
                      {/*
                        §204 Was man selbst angegeben hat, soll man auch
                        wiederfinden — sonst schreibt man es in ein Loch.
                      */}
                      {log.abweichung && (
                        <p className="text-[11px] text-amber-700 mt-0.5 truncate">
                          {ABWEICHUNG_TEXT[log.abweichung as Abweichungsart] ?? log.abweichung}
                          {(log.grundGehen || log.grundKommen)
                            ? ` — ${log.grundGehen || log.grundKommen}`
                            : ' — ohne Angabe'}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-bold ${isOver ? 'text-amber-600' : 'text-navy'}`}>
                        {formatTime(mins)}
                      </p>
                      {isOver && <p className="text-xs text-amber-500">+{formatTime(mins - plannedMinutes)}</p>}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>
      </div>

      {/*
        §203 Hier stand die Überstunden-Abfrage. Ausgelöst wurde sie von der
        zweiten Stempeluhr dieser Seite — die ist weg, also war die Maske nur
        noch unerreichbar. Gefragt wird jetzt dort, wo gestempelt wird, und
        der Antrag entsteht aus derselben Begründung
        (`/api/time-tracking/begruendung`).
      */}

      {/* §204 Zurückziehen — mit Rückfrage, weil es nicht umkehrbar ist. */}
      <Modal
        open={Boolean(zurueckziehen)}
        onClose={() => setZurueckziehen(null)}
        title="Antrag zurückziehen?"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {zurueckziehen && (
              <>
                Der Antrag über <strong>{formatTime(zurueckziehen.overtimeMinutes)}</strong>{' '}
                vom {formatDate(zurueckziehen.date)} verschwindet aus der Liste deiner
                Leitung. Deine erfasste Arbeitszeit und die Begründung bleiben
                unverändert stehen.
              </>
            )}
          </p>
          <div className="flex gap-2.5">
            <button
              onClick={() => setZurueckziehen(null)}
              disabled={zieht}
              className="flex-1 h-12 rounded-2xl bg-gray-100 text-gray-700 font-semibold text-sm disabled:opacity-50"
            >
              Behalten
            </button>
            <button
              onClick={antragZurueckziehen}
              disabled={zieht}
              className="flex-1 h-12 rounded-2xl bg-red-600 text-white font-bold text-sm
                         flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {zieht && <Loader2 size={16} className="animate-spin" />}
              Zurückziehen
            </button>
          </div>
        </div>
      </Modal>

      {/* Abwesenheit melden */}
      <Modal open={absenceModalOpen} onClose={() => setAbsenceModalOpen(false)} title="Abwesenheit melden">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">Art</label>
            <div className="flex flex-wrap gap-2">
              {(['krankheit', 'fortbildung', 'sonstige', 'entschuldigt'] as AbsenceType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setAbsenceType(type)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-colors ${absenceType === type ? 'bg-brand border-brand-dark text-navy' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                >
                  {ABSENCE_TYPE_LABEL[type]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Von" type="date" value={absenceStart} onChange={e => setAbsenceStart(e.target.value)} />
            <Input label="Bis" type="date" value={absenceEnd} onChange={e => setAbsenceEnd(e.target.value)} />
          </div>
          <Textarea label="Notiz (optional)" value={absenceNote} onChange={e => setAbsenceNote(e.target.value)} rows={2} />
          <label className="flex items-center gap-2 text-sm text-navy cursor-pointer">
            <input type="checkbox" checked={absenceProof} onChange={e => setAbsenceProof(e.target.checked)} className="w-4 h-4 rounded accent-brand" />
            Nachweis liegt vor (z.B. Attest)
          </label>
          <Button className="w-full" onClick={handleSubmitAbsence}>Melden</Button>
        </div>
      </Modal>
    </>
  )
}
