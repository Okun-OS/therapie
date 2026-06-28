'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Sun, Moon, Briefcase } from 'lucide-react'
import type { Shift } from '@/lib/types'

const SHIFT_ICONS: Record<string, React.ElementType> = { early: Sun, late: Moon, mid: Briefcase }

interface ShiftTimeOverride {
  startTime: string
  endTime: string
}

interface ShiftEditorProps {
  open: boolean
  onClose: () => void
  shifts: Shift[]
  onSave: (changes: Record<string, ShiftTimeOverride>) => void
}

export function ShiftEditor({ open, onClose, shifts, onSave }: ShiftEditorProps) {
  const [local, setLocal] = useState<Record<string, ShiftTimeOverride>>({})

  const handleChange = (shiftId: string, field: 'startTime' | 'endTime', value: string) => {
    setLocal(prev => ({
      ...prev,
      [shiftId]: {
        startTime: prev[shiftId]?.startTime ?? shifts.find(s => s.id === shiftId)!.startTime,
        endTime: prev[shiftId]?.endTime ?? shifts.find(s => s.id === shiftId)!.endTime,
        [field]: value,
      },
    }))
  }

  const handleReset = (shiftId: string) => {
    setLocal(prev => {
      const next = { ...prev }
      delete next[shiftId]
      return next
    })
  }

  const handleSave = () => {
    onSave(local)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Dienstzeiten anpassen">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Passe die Start- und Endzeiten für jede Schicht an. Die Zeiten werden beim nächsten KI-Plan berücksichtigt.
        </p>
        <div className="space-y-3">
          {shifts.map(shift => {
            const Icon = SHIFT_ICONS[shift.type] ?? Briefcase
            const currentStart = local[shift.id]?.startTime ?? shift.startTime
            const currentEnd = local[shift.id]?.endTime ?? shift.endTime
            const isModified = local[shift.id] !== undefined
            return (
              <div key={shift.id} className="rounded-xl border border-gray-100 p-3" style={{ backgroundColor: shift.bgColor + '60' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={14} style={{ color: shift.color }} />
                  <span className="text-sm font-semibold" style={{ color: shift.color }}>{shift.name}</span>
                  {isModified && (
                    <span className="ml-auto text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">angepasst</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    containerClassName="flex-1"
                    label="Von"
                    type="time"
                    value={currentStart}
                    onChange={e => handleChange(shift.id, 'startTime', e.target.value)}
                  />
                  <Input
                    containerClassName="flex-1"
                    label="Bis"
                    type="time"
                    value={currentEnd}
                    onChange={e => handleChange(shift.id, 'endTime', e.target.value)}
                  />
                  {isModified && (
                    <button
                      onClick={() => handleReset(shift.id)}
                      className="mt-4 text-xs text-gray-400 hover:text-gray-600 underline whitespace-nowrap"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="ghost" className="flex-1" onClick={onClose}>Abbrechen</Button>
          <Button className="flex-1" onClick={handleSave}>Zeiten speichern</Button>
        </div>
      </div>
    </Modal>
  )
}
