'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { AiChatPanel, type ChatMessage, type ChatCompletion } from '@/components/ui/AiChatPanel'
import { CalendarCheck } from 'lucide-react'
import type { ScheduleEditDraft, ScheduleEditChange } from '@/lib/schedule-edit-draft'
import { draftToChangeStrings, draftToPermanentRuleStrings } from '@/lib/schedule-edit-draft'

interface EmployeeBrief { id: string; name: string }
interface ShiftBrief { id: string; name: string; type: string; startTime: string; endTime: string }
interface EntryBrief { employeeId: string; employeeName: string; date: string; shiftId: string; shiftName: string }

const opening = (periodLabel: string) =>
  `Was soll am Dienstplan für ${periodLabel} geändert werden? Du kannst z.B. einen Tausch beschreiben ("Tausche Anna und Tom am Freitag") oder jemanden freistellen ("Gib Klaus am Mittwoch frei").`

export function ScheduleEditChat({
  open,
  onClose,
  onApply,
  locationId,
  periodLabel,
  employees,
  shifts,
  entries,
}: {
  open: boolean
  onClose: () => void
  onApply: (changes: ScheduleEditChange[], permanentRules: string[]) => Promise<void>
  locationId: string
  periodLabel: string
  employees: EmployeeBrief[]
  shifts: ShiftBrief[]
  entries: EntryBrief[]
}) {
  const openingMessage = opening(periodLabel)
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: openingMessage }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [applying, setApplying] = useState(false)
  const [draft, setDraft] = useState<ScheduleEditDraft>({})
  const [completion, setCompletion] = useState<ChatCompletion | undefined>(undefined)

  function reset() {
    setMessages([{ role: 'assistant', content: openingMessage }])
    setInput('')
    setDraft({})
    setCompletion(undefined)
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    const nextMessages = [...messages, { role: 'user' as const, content: text }]
    setMessages(nextMessages)
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/ai/schedule-edit-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, draft, locationId, periodLabel, employees, shifts, entries }),
      })
      const json = await res.json()
      if (json.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Entschuldige, da ist etwas schiefgelaufen. Du kannst es gerne erneut versuchen.' }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: json.reply }])
        if (json.draft) setDraft(json.draft as ScheduleEditDraft)
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Entschuldige, da ist etwas schiefgelaufen. Du kannst es gerne erneut versuchen.' }])
    } finally {
      setSending(false)
    }
  }

  async function handleApply() {
    setApplying(true)
    try {
      await onApply(draft.changes ?? [], draft.permanentRules ?? [])
      const items = [...changePreview, ...permanentRulePreview]
      setCompletion({ title: 'Dienstplan-Änderungen übernommen', items: items.length > 0 ? items : ['Änderungen wurden übernommen'] })
    } finally {
      setApplying(false)
    }
  }

  function handleCloseCompletion() {
    reset()
    onClose()
  }

  const changePreview = draftToChangeStrings(draft)
  const permanentRulePreview = draftToPermanentRuleStrings(draft)

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Dienstplan per KI-Chat bearbeiten" size="lg">
      <AiChatPanel
        messages={messages}
        sending={sending}
        input={input}
        onInputChange={setInput}
        onSend={handleSend}
        completion={completion}
        onCloseCompletion={handleCloseCompletion}
        footer={
          !completion ? (
            <>
              {changePreview.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {changePreview.map((c, i) => (
                    <span key={i} className="inline-flex items-center bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-1 rounded-full">
                      {c}
                    </span>
                  ))}
                </div>
              )}
              {permanentRulePreview.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {permanentRulePreview.map((r, i) => (
                    <span key={i} className="inline-flex items-center bg-amber-100 text-amber-800 text-xs font-medium px-2.5 py-1 rounded-full">
                      Dauerhafte Regel: {r}
                    </span>
                  ))}
                </div>
              )}
              {draft.readyToApply && (
                <div className="mb-3">
                  <Button className="w-full gap-2" loading={applying} onClick={handleApply}>
                    <CalendarCheck size={16} />
                    Übernehmen
                  </Button>
                </div>
              )}
            </>
          ) : undefined
        }
      />
    </Modal>
  )
}
