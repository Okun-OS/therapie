'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/lib/auth-context'
import { SCHEDULE_ENTRIES, SHIFTS } from '@/lib/mock-data'
import { ChevronLeft, ChevronRight, Sun, Moon, Briefcase, Info, MessageSquare } from 'lucide-react'
import { getWeekDays, toDateString, formatDateShort, getDayName, isToday } from '@/lib/utils'

const SHIFT_ICONS: Record<string, React.ElementType> = { early: Sun, late: Moon, mid: Briefcase, night: Moon }

export default function EmployeeSchedule() {
  const { user } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'week' | 'month'>('week')
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null)
  const [wishModal, setWishModal] = useState(false)
  const [wish, setWish] = useState({ type: '', date: '', note: '' })

  const weekDays = getWeekDays(currentDate)
  const weekStart = toDateString(weekDays[0])
  const weekEnd = toDateString(weekDays[6])

  const myEntries = SCHEDULE_ENTRIES.filter(s => s.employeeId === user?.id)

  const goBack = () => {
    const d = new Date(currentDate)
    view === 'week' ? d.setDate(d.getDate() - 7) : d.setMonth(d.getMonth() - 1)
    setCurrentDate(d)
  }

  const goForward = () => {
    const d = new Date(currentDate)
    view === 'week' ? d.setDate(d.getDate() + 7) : d.setMonth(d.getMonth() + 1)
    setCurrentDate(d)
  }

  const getEntry = (dateStr: string) => myEntries.find(e => e.date === dateStr)
  const getShift = (shiftId: string) => SHIFTS.find(s => s.id === shiftId)

  const selectedEntryData = selectedEntry ? myEntries.find(e => e.id === selectedEntry) : null
  const selectedShift = selectedEntryData ? getShift(selectedEntryData.shiftId) : null

  const totalShifts = myEntries.filter(e => {
    const d = new Date(e.date + 'T00:00:00')
    return d >= weekDays[0] && d <= weekDays[6]
  }).length

  const totalHours = myEntries
    .filter(e => {
      const d = new Date(e.date + 'T00:00:00')
      return d >= weekDays[0] && d <= weekDays[6]
    })
    .reduce((sum, e) => {
      const shift = getShift(e.shiftId)
      if (!shift) return sum
      const [sh, sm] = shift.startTime.split(':').map(Number)
      const [eh, em] = shift.endTime.split(':').map(Number)
      return sum + (eh * 60 + em - (sh * 60 + sm))
    }, 0)

  return (
    <>
      <Header title="Mein Dienstplan" subtitle={`KW ${weekStart}`} />
      <div className="p-4 sm:p-6 space-y-4">

        {/* Controls */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <button onClick={goBack} className="p-2 rounded-xl hover:bg-white border border-gray-200 hover:shadow-sm transition-all">
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
            <span className="px-4 py-2 text-sm font-semibold text-navy min-w-[180px] text-center">
              {view === 'week'
                ? `${formatDateShort(weekStart)} – ${formatDateShort(weekEnd)} ${weekDays[0].getFullYear()}`
                : currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={goForward} className="p-2 rounded-xl hover:bg-white border border-gray-200 hover:shadow-sm transition-all">
              <ChevronRight size={18} className="text-gray-600" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden">
              {(['week', 'month'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-4 py-2 text-xs font-semibold transition-colors ${view === v ? 'bg-navy text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  {v === 'week' ? 'Woche' : 'Monat'}
                </button>
              ))}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setWishModal(true)} className="gap-1 border border-gray-200">
              <MessageSquare size={14} />
              Dienstwunsch
            </Button>
          </div>
        </div>

        {/* Week Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-navy">{totalShifts}</p>
            <p className="text-xs text-gray-500 mt-0.5">Dienste diese Woche</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-navy">{Math.floor(totalHours / 60)}h {totalHours % 60 > 0 ? `${totalHours % 60}min` : ''}</p>
            <p className="text-xs text-gray-500 mt-0.5">Stunden geplant</p>
          </div>
        </div>

        {/* Week View */}
        <div className="space-y-2">
          {weekDays.map(day => {
            const dateStr = toDateString(day)
            const entry = getEntry(dateStr)
            const shift = entry ? getShift(entry.shiftId) : null
            const today = isToday(dateStr)
            const isPast = day < new Date(new Date().setHours(0, 0, 0, 0))
            const Icon = shift ? SHIFT_ICONS[shift.type] : null

            return (
              <div
                key={dateStr}
                onClick={() => entry && setSelectedEntry(entry.id)}
                className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${today ? 'border-brand bg-amber-50' : 'border-gray-100 bg-white hover:border-gray-200'} ${entry ? 'cursor-pointer hover:shadow-sm' : ''} ${isPast && !today ? 'opacity-60' : ''}`}
              >
                <div className={`w-14 text-center flex-shrink-0 ${today ? 'text-navy' : 'text-gray-500'}`}>
                  <p className="text-xs font-medium">{getDayName(dateStr, true)}</p>
                  <p className={`text-xl font-bold ${today ? 'text-navy' : ''}`}>{day.getDate()}</p>
                  {today && <div className="w-1.5 h-1.5 rounded-full bg-brand mx-auto mt-0.5" />}
                </div>

                {shift && Icon ? (
                  <div className="flex-1 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: shift.bgColor }}>
                      <Icon size={18} style={{ color: shift.color }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-navy">{shift.name}</p>
                      <p className="text-xs text-gray-500">{shift.startTime} – {shift.endTime} Uhr</p>
                    </div>
                    <div className="ml-auto">
                      <Badge variant={entry?.status === 'confirmed' ? 'success' : 'default'}>
                        {entry?.status === 'confirmed' ? 'Bestätigt' : 'Geplant'}
                      </Badge>
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
          </div>
        </Card>
      </div>

      {/* Shift Detail Modal */}
      <Modal open={!!selectedEntry} onClose={() => setSelectedEntry(null)} title="Dienstdetails">
        {selectedShift && selectedEntryData && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-2xl" style={{ backgroundColor: selectedShift.bgColor }}>
              <div className="w-14 h-14 rounded-2xl bg-white/50 flex items-center justify-center">
                {(() => { const Icon = SHIFT_ICONS[selectedShift.type]; return <Icon size={28} style={{ color: selectedShift.color }} /> })()}
              </div>
              <div>
                <p className="text-lg font-bold" style={{ color: selectedShift.color }}>{selectedShift.name}</p>
                <p className="text-sm" style={{ color: selectedShift.color }}>{selectedShift.startTime} – {selectedShift.endTime} Uhr</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Datum</span>
                <span className="text-sm font-semibold text-navy">{getDayName(selectedEntryData.date)}, {selectedEntryData.date}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Dauer</span>
                <span className="text-sm font-semibold text-navy">8 Stunden</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-gray-500">Status</span>
                <Badge variant={selectedEntryData.status === 'confirmed' ? 'success' : 'default'}>
                  {selectedEntryData.status === 'confirmed' ? 'Bestätigt' : 'Geplant'}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1 border border-gray-200" onClick={() => setSelectedEntry(null)}>Schließen</Button>
              <Button className="flex-1" onClick={() => { setSelectedEntry(null); setWishModal(true) }}>
                <MessageSquare size={16} />
                Tausch anfragen
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Wish Modal */}
      <Modal open={wishModal} onClose={() => setWishModal(false)} title="Dienstwunsch abgeben">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">Art des Wunsches</label>
            <select
              value={wish.type}
              onChange={e => setWish(w => ({ ...w, type: e.target.value }))}
              className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">Bitte wählen...</option>
              <option value="early">Frühdienst bevorzugt</option>
              <option value="late">Spätdienst bevorzugt</option>
              <option value="mid">Mitteldienst bevorzugt</option>
              <option value="free">Freier Tag gewünscht</option>
              <option value="no_early_after_late">Kein Frühdienst nach Spätdienst</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">Datum (optional)</label>
            <input
              type="date"
              value={wish.date}
              onChange={e => setWish(w => ({ ...w, date: e.target.value }))}
              className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">Notiz</label>
            <textarea
              value={wish.note}
              onChange={e => setWish(w => ({ ...w, note: e.target.value }))}
              rows={3}
              placeholder="z.B. Bitte nur jede zweite Woche Frühdienst..."
              className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1 border border-gray-200" onClick={() => setWishModal(false)}>Abbrechen</Button>
            <Button className="flex-1" onClick={() => { alert('Wunsch gespeichert!'); setWishModal(false) }}>Absenden</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
