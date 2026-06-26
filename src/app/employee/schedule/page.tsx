'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { SwapModal } from '@/components/schedule/SwapModal'
import { SwapList } from '@/components/schedule/SwapList'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/lib/toast-context'
import { useSearchParams } from 'next/navigation'
import {
  SCHEDULE_ENTRIES, SHIFTS,
  getSwapRequestsByEmployee, getWishSubmissionsByEmployee, addWishSubmission,
} from '@/lib/mock-data'
import type { ShiftType, Employee, Location } from '@/lib/types'
import { googleCalendarLink, appleCalendarDownload } from '@/lib/calendar-export'
import {
  ChevronLeft, ChevronRight, Sun, Moon, Briefcase, MessageSquare,
  CalendarPlus, ArrowLeftRight, Info, CheckCircle, XCircle, Clock,
  Download, ExternalLink, Apple, AlertTriangle,
} from 'lucide-react'
import {
  getWeekDays, toDateString, formatDateShort, formatDate,
  getDayName, isToday,
} from '@/lib/utils'
import type { ScheduleEntry } from '@/lib/types'

const SHIFT_ICONS: Record<string, React.ElementType> = { early: Sun, late: Moon, mid: Briefcase }

type Tab = 'schedule' | 'swaps' | 'wishes'

export default function EmployeeSchedule() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') as Tab) || 'schedule'
  const [currentDate, setCurrentDate] = useState(new Date())
  const [tab, setTab] = useState<Tab>(initialTab)
  const [selectedEntry, setSelectedEntry] = useState<ScheduleEntry | null>(null)
  const [swapEntry, setSwapEntry] = useState<ScheduleEntry | null>(null)
  const [wishModal, setWishModal] = useState(false)
  const [wish, setWish] = useState({ type: '', date: '', reason: '', importance: 'normal' })
  const [calendarModal, setCalendarModal] = useState(false)
  const [swaps, setSwaps] = useState(() => getSwapRequestsByEmployee(user?.id ?? ''))
  const [, forceWishRefresh] = useState(0)
  const [EMPLOYEES, setEMPLOYEES] = useState<Employee[]>([])
  const [LOCATIONS, setLOCATIONS] = useState<Location[]>([])

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => setEMPLOYEES(d.employees))
    fetch('/api/locations').then(r => r.json()).then(d => setLOCATIONS(d.locations))
  }, [])

  const weekDays = getWeekDays(currentDate)
  const weekStart = toDateString(weekDays[0])
  const weekEnd = toDateString(weekDays[6])

  const employee = EMPLOYEES.find(e => e.id === user?.id)
  const location = LOCATIONS.find(l => l.id === employee?.locationId)
  const myEntries = SCHEDULE_ENTRIES.filter(s => s.employeeId === user?.id)
  const myWishes = getWishSubmissionsByEmployee(user?.id ?? '')

  const weekEntries = myEntries.filter(e => {
    const d = new Date(e.date + 'T00:00:00')
    return d >= weekDays[0] && d <= weekDays[6]
  })

  // All colleague entries for the same week (for swap)
  const colleagueEntries = SCHEDULE_ENTRIES.filter(e => {
    const d = new Date(e.date + 'T00:00:00')
    return e.locationId === employee?.locationId && e.employeeId !== user?.id && d >= weekDays[0] && d <= weekDays[6]
  })
  const colleagues = EMPLOYEES.filter(e => e.locationId === employee?.locationId && e.id !== user?.id && e.role === 'employee')

  const go = (delta: number) => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + delta * 7)
    setCurrentDate(d)
  }

  const getEntry = (dateStr: string) => myEntries.find(e => e.date === dateStr)
  const getShift = (shiftId: string) => SHIFTS.find(s => s.id === shiftId)

  const selectedShift = selectedEntry ? getShift(selectedEntry.shiftId) : null
  const swapShift = swapEntry ? getShift(swapEntry.shiftId) : null

  const totalHours = weekEntries.reduce((sum, e) => {
    const shift = getShift(e.shiftId)
    if (!shift) return sum
    const [sh, sm] = shift.startTime.split(':').map(Number)
    const [eh, em] = shift.endTime.split(':').map(Number)
    return sum + (eh * 60 + em - sh * 60 - sm)
  }, 0)

  const handleSwapSubmit = (targetEmpId: string, targetDate: string, targetShiftId: string, message: string) => {
    if (!swapEntry || !user) return
    const newSwap = {
      id: `swap_new_${Date.now()}`,
      requesterId: user.id,
      requesterName: user.name,
      requesterDate: swapEntry.date,
      requesterShiftId: swapEntry.shiftId,
      targetEmployeeId: targetEmpId,
      targetEmployeeName: colleagues.find(c => c.id === targetEmpId)?.name ?? '',
      targetDate,
      targetShiftId,
      message,
      status: 'pending' as const,
      submittedAt: new Date().toISOString(),
      locationId: employee?.locationId ?? 'loc1',
    }
    setSwaps(prev => [newSwap, ...prev])
  }

  const handleWishSubmit = () => {
    if (!wish.type || !wish.date) {
      showToast('Bitte Diensttyp und Datum auswählen', 'error')
      return
    }
    if (!user || !employee) return

    const validShiftTypes: ShiftType[] = ['early', 'late', 'mid']
    const preferredShiftType = (validShiftTypes as string[]).includes(wish.type) ? (wish.type as ShiftType) : 'mid'
    const specialNote = wish.type === 'free' ? 'Freier Tag gewünscht. ' : wish.type === 'no_early_after_late' ? 'Kein Frühdienst nach Spätdienst gewünscht. ' : ''

    addWishSubmission({
      employeeId: user.id,
      employeeName: user.name,
      locationId: employee.locationId || 'loc1',
      date: wish.date,
      preferredShiftType,
      reason: `${specialNote}${wish.reason}`.trim() || undefined,
      importance: wish.importance as 'normal' | 'important' | 'urgent',
    })

    showToast('Wunsch gespeichert', 'success')
    setWishModal(false)
    setWish({ type: '', date: '', reason: '', importance: 'normal' })
    forceWishRefresh(n => n + 1)
  }

  const handleAcceptSwap = (id: string) => setSwaps(p => p.map(s => s.id === id ? { ...s, status: 'accepted' as const } : s))
  const handleDeclineSwap = (id: string) => setSwaps(p => p.map(s => s.id === id ? { ...s, status: 'declined' as const } : s))

  const pendingSwapCount = swaps.filter(s => s.targetEmployeeId === user?.id && s.status === 'pending').length
  const unfulfilledWishes = myWishes.filter(w => w.status === 'not_fulfilled')

  return (
    <>
      <Header title="Mein Dienstplan" subtitle={`${formatDateShort(weekStart)} – ${formatDateShort(weekEnd)} ${weekDays[0].getFullYear()}`} />
      <div className="p-4 sm:p-6 space-y-4">

        {/* Tab bar */}
        <div className="flex bg-white border border-gray-100 rounded-2xl p-1">
          {([
            { key: 'schedule', label: 'Dienstplan', badge: 0 },
            { key: 'swaps', label: 'Tauschbörse', badge: pendingSwapCount },
            { key: 'wishes', label: 'Wünsche', badge: unfulfilledWishes.length },
          ] as const).map(({ key, label, badge }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${tab === key ? 'bg-navy text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {label}
              {badge !== undefined && badge > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === key ? 'bg-brand text-navy' : 'bg-red-100 text-red-600'}`}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── SCHEDULE TAB ─────────────────────────────────────── */}
        {tab === 'schedule' && (
          <>
            {/* Navigation + Actions */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1">
                <button onClick={() => go(-1)} className="p-2 rounded-xl hover:bg-white border border-gray-200 transition-all">
                  <ChevronLeft size={18} className="text-gray-600" />
                </button>
                <span className="px-4 py-2 text-sm font-semibold text-navy min-w-[180px] text-center">
                  {formatDateShort(weekStart)} – {formatDateShort(weekEnd)} {weekDays[0].getFullYear()}
                </span>
                <button onClick={() => go(1)} className="p-2 rounded-xl hover:bg-white border border-gray-200 transition-all">
                  <ChevronRight size={18} className="text-gray-600" />
                </button>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setCalendarModal(true)} className="gap-1.5 border border-gray-200">
                  <CalendarPlus size={14} />
                  <span className="hidden sm:inline">Kalender</span>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setWishModal(true)} className="gap-1.5 border border-gray-200">
                  <MessageSquare size={14} />
                  Wunsch
                </Button>
              </div>
            </div>

            {/* Week summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                <p className="text-2xl font-bold text-navy">{weekEntries.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">Dienste diese Woche</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                <p className="text-2xl font-bold text-navy">{Math.floor(totalHours / 60)}h {totalHours % 60 > 0 ? `${totalHours % 60}min` : ''}</p>
                <p className="text-xs text-gray-500 mt-0.5">Stunden geplant</p>
              </div>
            </div>

            {/* Day rows */}
            <div className="space-y-2">
              {weekDays.map(day => {
                const dateStr = toDateString(day)
                const entry = getEntry(dateStr)
                const shift = entry ? getShift(entry.shiftId) : null
                const todayFlag = isToday(dateStr)
                const isPast = day < new Date(new Date().setHours(0, 0, 0, 0))
                const Icon = shift ? SHIFT_ICONS[shift.type] : null

                return (
                  <div
                    key={dateStr}
                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${todayFlag ? 'border-brand bg-amber-50' : 'border-gray-100 bg-white'} ${isPast && !todayFlag ? 'opacity-60' : ''}`}
                  >
                    <div className={`w-14 text-center flex-shrink-0 ${todayFlag ? 'text-navy' : 'text-gray-500'}`}>
                      <p className="text-xs font-medium">{getDayName(dateStr, true)}</p>
                      <p className="text-xl font-bold">{day.getDate()}</p>
                      {todayFlag && <div className="w-1.5 h-1.5 rounded-full bg-brand mx-auto mt-0.5" />}
                    </div>

                    {shift && Icon && entry ? (
                      <div className="flex-1 flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: shift.bgColor }}>
                          <Icon size={18} style={{ color: shift.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-navy">{shift.name}</p>
                          <p className="text-xs text-gray-500">{shift.startTime} – {shift.endTime} Uhr</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant={entry.status === 'confirmed' ? 'success' : 'default'}>
                            {entry.status === 'confirmed' ? '✓' : 'Geplant'}
                          </Badge>
                          <button
                            onClick={() => setSelectedEntry(entry)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                            title="Details"
                          >
                            <Info size={14} className="text-gray-400" />
                          </button>
                          <button
                            onClick={() => setSwapEntry(entry)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                            title="Tauschen"
                          >
                            <ArrowLeftRight size={14} className="text-blue-500" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1">
                        <p className="text-sm text-gray-400 font-medium">Frei</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <Card padding="sm">
              <p className="text-xs font-semibold text-gray-500 mb-2">Legende</p>
              <div className="flex flex-wrap gap-3">
                {[
                  { name: 'Frühdienst', color: '#1D4ED8', bg: '#DBEAFE', icon: Sun },
                  { name: 'Spätdienst', color: '#C2410C', bg: '#FFEDD5', icon: Moon },
                  { name: 'Mitteldienst', color: '#15803D', bg: '#DCFCE7', icon: Briefcase },
                ].map(l => (
                  <div key={l.name} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: l.bg }}>
                      <l.icon size={12} style={{ color: l.color }} />
                    </div>
                    <span className="text-xs text-gray-600">{l.name}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5">
                  <ArrowLeftRight size={14} className="text-blue-500" />
                  <span className="text-xs text-gray-600">Tauschen</span>
                </div>
              </div>
            </Card>
          </>
        )}

        {/* ── SWAPS TAB ────────────────────────────────────────── */}
        {tab === 'swaps' && (
          <Card>
            <CardHeader>
              <CardTitle>Tauschbörse</CardTitle>
              <Button size="sm" onClick={() => setTab('schedule')} className="gap-1">
                <ArrowLeftRight size={14} />
                Tausch starten
              </Button>
            </CardHeader>
            <SwapList
              swaps={swaps}
              currentUserId={user?.id ?? ''}
              shifts={SHIFTS}
              onAccept={handleAcceptSwap}
              onDecline={handleDeclineSwap}
            />
          </Card>
        )}

        {/* ── WISHES TAB ───────────────────────────────────────── */}
        {tab === 'wishes' && (
          <Card>
            <CardHeader>
              <CardTitle>Dienstwünsche</CardTitle>
              <Button size="sm" onClick={() => setWishModal(true)} className="gap-1">
                <MessageSquare size={14} />
                Wunsch
              </Button>
            </CardHeader>

            {unfulfilledWishes.length > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={14} className="text-amber-600" />
                  <p className="text-xs font-bold text-amber-700">{unfulfilledWishes.length} Wunsch nicht erfüllt</p>
                </div>
                <p className="text-xs text-amber-600">Sieh unten warum und kontaktiere ggf. Kollegen.</p>
              </div>
            )}

            <div className="space-y-3">
              {myWishes.map(w => {
                const iconMap = { fulfilled: CheckCircle, not_fulfilled: XCircle, pending: Clock }
                const colorMap = { fulfilled: 'text-green-500 bg-green-100', not_fulfilled: 'text-red-500 bg-red-100', pending: 'text-amber-500 bg-amber-100' }
                const labelMap = { fulfilled: 'Erfüllt', not_fulfilled: 'Nicht erfüllt', pending: 'Ausstehend' }
                const Icon = iconMap[w.status]
                return (
                  <div key={w.id} className={`p-4 rounded-2xl border-2 ${w.status === 'not_fulfilled' ? 'border-red-100 bg-red-50/30' : 'border-gray-100 bg-white'}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${colorMap[w.status]}`}>
                          <Icon size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-navy">
                            {w.preferredShiftType === 'early' ? 'Frühdienst' : w.preferredShiftType === 'late' ? 'Spätdienst' : 'Mitteldienst'}
                            {' '}am {formatDate(w.date)}
                          </p>
                          <p className="text-xs text-gray-500">{getDayName(w.date)}</p>
                        </div>
                      </div>
                      <Badge
                        variant={w.status === 'fulfilled' ? 'success' : w.status === 'not_fulfilled' ? 'danger' : 'warning'}
                      >
                        {labelMap[w.status]}
                      </Badge>
                    </div>

                    {w.reason && (
                      <p className="text-xs text-gray-600 italic mb-2">&bdquo;{w.reason}&ldquo;</p>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-2 py-1 rounded-full font-semibold ${w.importance === 'urgent' ? 'bg-red-100 text-red-600' : w.importance === 'important' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                        {w.importance === 'urgent' ? 'Dringend' : w.importance === 'important' ? 'Wichtig' : 'Normal'}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        Eingereicht: {new Date(w.submittedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {w.status === 'not_fulfilled' && w.conflictInfo && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                        <p className="text-xs font-semibold text-red-700 mb-1 flex items-center gap-1">
                          <Info size={12} />
                          Warum nicht erfüllt?
                        </p>
                        <p className="text-xs text-red-600">{w.conflictInfo.reason}</p>
                        {w.conflictInfo.conflictedWith.length > 0 && (
                          <button
                            onClick={() => window.open(`mailto:?subject=${encodeURIComponent('Dienstwunsch besprechen')}&body=${encodeURIComponent(`Hallo,\nkönnen wir unseren Dienstwunsch für den ${w.date} besprechen?`)}`, '_blank')}
                            className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium"
                          >
                            <MessageSquare size={12} />
                            {w.conflictInfo.conflictedWith[0]} direkt kontaktieren
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {myWishes.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <MessageSquare size={28} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Noch keine Dienstwünsche</p>
                  <Button size="sm" className="mt-3" onClick={() => setWishModal(true)}>Wunsch abgeben</Button>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* ── Shift Detail Modal ─────────────────────────────────── */}
      <Modal open={!!selectedEntry} onClose={() => setSelectedEntry(null)} title="Dienstdetails">
        {selectedShift && selectedEntry && location && employee && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-2xl" style={{ backgroundColor: selectedShift.bgColor }}>
              <div className="w-14 h-14 rounded-2xl bg-white/50 flex items-center justify-center">
                {(() => { const Icon = SHIFT_ICONS[selectedShift.type] || Briefcase; return <Icon size={28} style={{ color: selectedShift.color }} /> })()}
              </div>
              <div>
                <p className="text-lg font-bold" style={{ color: selectedShift.color }}>{selectedShift.name}</p>
                <p className="text-sm" style={{ color: selectedShift.color }}>{selectedShift.startTime} – {selectedShift.endTime} Uhr</p>
              </div>
            </div>

            <div className="space-y-2">
              {[
                { label: 'Datum', value: `${getDayName(selectedEntry.date)}, ${formatDate(selectedEntry.date)}` },
                { label: 'Standort', value: location.name },
                { label: 'Dauer', value: '8 Stunden' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500">{label}</span>
                  <span className="text-sm font-semibold text-navy">{value}</span>
                </div>
              ))}
            </div>

            {/* Calendar export options */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">In Kalender exportieren</p>
              <div className="flex gap-2">
                <a
                  href={googleCalendarLink(selectedEntry, selectedShift, location)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-semibold text-gray-700"
                >
                  <ExternalLink size={14} className="text-blue-500" />
                  Google
                </a>
                <button
                  onClick={() => {
                    appleCalendarDownload([selectedEntry], SHIFTS, location, employee)
                    setSelectedEntry(null)
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-semibold text-gray-700"
                >
                  <Download size={14} className="text-gray-600" />
                  Apple / .ics
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1 border border-gray-200" onClick={() => setSelectedEntry(null)}>Schließen</Button>
              <Button className="flex-1 gap-2" onClick={() => { setSwapEntry(selectedEntry); setSelectedEntry(null) }}>
                <ArrowLeftRight size={16} />
                Tauschen
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Calendar Export Modal ──────────────────────────────── */}
      <Modal open={calendarModal} onClose={() => setCalendarModal(false)} title="Dienstplan exportieren">
        {location && employee && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Exportiere deine Dienste ({myEntries.length} Einträge) in deinen Kalender.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  appleCalendarDownload(myEntries, SHIFTS, location, employee)
                  setCalendarModal(false)
                }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-brand hover:bg-amber-50 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0">
                  <CalendarPlus size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-navy">Apple Kalender / .ics</p>
                  <p className="text-xs text-gray-500">Universell: iPhone, iPad, Mac, Outlook</p>
                </div>
              </button>

              <div className="p-4 rounded-2xl border-2 border-gray-100 bg-gray-50">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <ExternalLink size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-navy">Google Kalender</p>
                    <p className="text-xs text-gray-500">Dienste einzeln hinzufügen</p>
                  </div>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {myEntries.slice(0, 10).map(entry => {
                    const shift = SHIFTS.find(s => s.id === entry.shiftId)
                    if (!shift) return null
                    return (
                      <a
                        key={entry.id}
                        href={googleCalendarLink(entry, shift, location)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-2 bg-white rounded-xl hover:bg-blue-50 transition-colors"
                      >
                        <span className="text-xs font-medium text-navy">{formatDate(entry.date)} · {shift.name}</span>
                        <ExternalLink size={12} className="text-blue-500" />
                      </a>
                    )
                  })}
                </div>
              </div>
            </div>
            <Button variant="ghost" className="w-full border border-gray-200" onClick={() => setCalendarModal(false)}>Schließen</Button>
          </div>
        )}
      </Modal>

      {/* ── Wish Modal ────────────────────────────────────────── */}
      <Modal open={wishModal} onClose={() => setWishModal(false)} title="Dienstwunsch abgeben">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">Gewünschter Dienst</label>
            <select
              value={wish.type}
              onChange={e => setWish(w => ({ ...w, type: e.target.value }))}
              className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">Bitte wählen...</option>
              <option value="early">Frühdienst</option>
              <option value="late">Spätdienst</option>
              <option value="mid">Mitteldienst</option>
              <option value="free">Freier Tag</option>
              <option value="no_early_after_late">Kein Frühdienst nach Spätdienst</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">Datum</label>
            <input
              type="date"
              value={wish.date}
              onChange={e => setWish(w => ({ ...w, date: e.target.value }))}
              className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">Priorität</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'normal', label: 'Normal', color: 'bg-gray-100 text-gray-700' },
                { value: 'important', label: 'Wichtig', color: 'bg-amber-100 text-amber-700' },
                { value: 'urgent', label: 'Dringend', color: 'bg-red-100 text-red-700' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setWish(w => ({ ...w, importance: opt.value }))}
                  className={`py-2.5 rounded-xl text-xs font-semibold border-2 transition-all ${wish.importance === opt.value ? `${opt.color} border-current` : 'border-gray-100 text-gray-400'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">Grund</label>
            <textarea
              value={wish.reason}
              onChange={e => setWish(w => ({ ...w, reason: e.target.value }))}
              rows={2}
              placeholder="z.B. Arzttermin, Familienpflicht..."
              className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
            />
          </div>
          <div className="bg-blue-50 rounded-xl p-3 flex gap-2">
            <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Bei Konflikten entscheidet die KI anhand Priorität, Einreichzeit und bisheriger Schichtverteilung. Du wirst informiert wenn dein Wunsch nicht erfüllt werden kann.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1 border border-gray-200" onClick={() => setWishModal(false)}>Abbrechen</Button>
            <Button className="flex-1" onClick={handleWishSubmit} disabled={!wish.type || !wish.date}>Absenden</Button>
          </div>
        </div>
      </Modal>

      {/* ── Swap Modal ────────────────────────────────────────── */}
      {swapEntry && swapShift && (
        <SwapModal
          open={!!swapEntry}
          onClose={() => setSwapEntry(null)}
          myEntry={swapEntry}
          myShift={swapShift}
          colleagues={colleagues}
          colleagueEntries={colleagueEntries}
          shifts={SHIFTS}
          onSubmit={handleSwapSubmit}
        />
      )}
    </>
  )
}
