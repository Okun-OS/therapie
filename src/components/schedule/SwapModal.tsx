'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Textarea } from '@/components/ui/Textarea'
import { ArrowLeftRight, Sun, Moon, Briefcase, User, Send } from 'lucide-react'
import type { ScheduleEntry, Shift, Employee } from '@/lib/types'
import { getDayName, formatDate } from '@/lib/utils'

interface SwapModalProps {
  open: boolean
  onClose: () => void
  myEntry: ScheduleEntry
  myShift: Shift
  colleagues: Employee[]
  colleagueEntries: ScheduleEntry[]
  shifts: Shift[]
  onSubmit: (targetEmployeeId: string, targetDate: string, targetShiftId: string, message: string) => void
}

const SHIFT_ICONS: Record<string, React.ElementType> = { early: Sun, late: Moon, mid: Briefcase }

export function SwapModal({ open, onClose, myEntry, myShift, colleagues, colleagueEntries, shifts, onSubmit }: SwapModalProps) {
  const [step, setStep] = useState<'select' | 'message'>('select')
  const [selected, setSelected] = useState<{ empId: string; date: string; shiftId: string } | null>(null)
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  const selectedColleague = selected ? colleagues.find(c => c.id === selected.empId) : null
  const selectedShift = selected ? shifts.find(s => s.id === selected.shiftId) : null

  const colleagueOptions = colleagues.flatMap(emp =>
    colleagueEntries
      .filter(e => e.employeeId === emp.id)
      .map(e => ({ emp, entry: e, shift: shifts.find(s => s.id === e.shiftId) }))
      .filter(x => x.shift)
  )

  const handleSend = () => {
    if (!selected) return
    onSubmit(selected.empId, selected.date, selected.shiftId, message)
    setSent(true)
  }

  const handleClose = () => {
    setStep('select')
    setSelected(null)
    setMessage('')
    setSent(false)
    onClose()
  }

  const MyIcon = SHIFT_ICONS[myShift.type] || Briefcase

  return (
    <Modal open={open} onClose={handleClose} title="Dienst tauschen" size="md">
      {sent ? (
        <div className="text-center py-6">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Send size={28} className="text-green-600" />
          </div>
          <p className="text-lg font-bold text-navy mb-2">Tausch-Anfrage gesendet!</p>
          <p className="text-sm text-gray-500 mb-1">
            {selectedColleague?.name} wird benachrichtigt und kann die Anfrage annehmen oder ablehnen.
          </p>
          <p className="text-xs text-gray-400 mt-2">Du wirst informiert, sobald {selectedColleague?.name} antwortet.</p>
          <Button className="mt-6 w-full" onClick={handleClose}>Schließen</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* My shift */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mein Dienst</p>
            <div className="flex items-center gap-3 p-3 rounded-2xl border-2 border-brand bg-amber-50">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: myShift.bgColor }}>
                <MyIcon size={18} style={{ color: myShift.color }} />
              </div>
              <div>
                <p className="text-sm font-bold text-navy">{myShift.name}</p>
                <p className="text-xs text-gray-500">{getDayName(myEntry.date)}, {formatDate(myEntry.date)} · {myShift.startTime}–{myShift.endTime} Uhr</p>
              </div>
              <Badge variant="warning" className="ml-auto">Abgeben</Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-200" />
            <ArrowLeftRight size={16} className="text-gray-400" />
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {step === 'select' ? (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Kollegen-Dienst auswählen</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {colleagueOptions.length === 0 ? (
                  <div className="text-center py-6 text-gray-400">
                    <User size={28} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Keine Kollegen mit Diensten in dieser Woche</p>
                  </div>
                ) : (
                  colleagueOptions.map(({ emp, entry, shift }) => {
                    if (!shift) return null
                    const Icon = SHIFT_ICONS[shift.type] || Briefcase
                    const isSelected = selected?.empId === emp.id && selected?.date === entry.date
                    return (
                      <button
                        key={`${emp.id}-${entry.date}`}
                        onClick={() => setSelected({ empId: emp.id, date: entry.date, shiftId: shift.id })}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${isSelected ? 'border-brand bg-amber-50' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center text-brand text-xs font-bold flex-shrink-0">
                          {emp.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-navy">{emp.name}</p>
                          <p className="text-xs text-gray-500">{getDayName(entry.date, true)}, {formatDate(entry.date)}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: shift.bgColor }}>
                            <Icon size={14} style={{ color: shift.color }} />
                          </div>
                          <span className="text-xs font-medium text-gray-600">{shift.startTime}</span>
                        </div>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-brand flex-shrink-0" />}
                      </button>
                    )
                  })
                )}
              </div>

              <Button
                className="w-full mt-4"
                disabled={!selected}
                onClick={() => setStep('message')}
              >
                Weiter → Nachricht
              </Button>
            </div>
          ) : (
            <div>
              {selectedColleague && selectedShift && (
                <div className="bg-gray-50 rounded-xl p-3 mb-4">
                  <p className="text-xs text-gray-500 mb-1">Tausch mit:</p>
                  <p className="text-sm font-bold text-navy">{selectedColleague.name} · {selectedShift.name}</p>
                  <p className="text-xs text-gray-500">{getDayName(selected!.date)}, {formatDate(selected!.date)} · {selectedShift.startTime}–{selectedShift.endTime} Uhr</p>
                </div>
              )}

              <Textarea
                label={`Nachricht an ${selectedColleague?.name.split(' ')[0]}`}
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={3}
                placeholder={`Hallo ${selectedColleague?.name.split(' ')[0]}, könntest du meinen Dienst am ${myEntry.date} tauschen? ...`}
              />

              <div className="flex gap-2 mt-4">
                <Button variant="ghost" className="border border-gray-200" onClick={() => setStep('select')}>
                  Zurück
                </Button>
                <Button className="flex-1 gap-2" onClick={handleSend}>
                  <Send size={16} />
                  Anfrage senden
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
