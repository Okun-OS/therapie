'use client'

import { useState, useEffect, useCallback } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { AiChatPanel, type ChatMessage, type ChatCompletion } from '@/components/ui/AiChatPanel'
import { CalendarCheck, ShieldCheck, Clock, RotateCcw } from 'lucide-react'
import type { ScheduleEditDraft, ScheduleEditChange } from '@/lib/schedule-edit-draft'
import { draftToChangeStrings, draftToPermanentRuleStrings } from '@/lib/schedule-edit-draft'

interface EmployeeBrief { id: string; name: string; gruppe?: string; bereich?: string }
interface ShiftBrief { id: string; name: string; type: string; startTime: string; endTime: string }
interface EntryBrief { employeeId: string; employeeName: string; date: string; shiftId: string; shiftName: string }

const opening = (periodLabel: string) =>
  `Was soll am Dienstplan für ${periodLabel} geändert werden? Du kannst z.B. einen Tausch beschreiben ("Tausche Anna und Tom am Freitag") oder jemanden freistellen ("Gib Klaus am Mittwoch frei").`

function storageKey(locationId: string, periodLabel: string) {
  return `schedule-edit-chat:${locationId}:${periodLabel}`
}

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
  const key = storageKey(locationId, periodLabel)

  // Initialise from localStorage so chat survives accidental modal close
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem(key) : null
      if (saved) {
        const parsed = JSON.parse(saved) as { messages?: ChatMessage[]; draft?: ScheduleEditDraft }
        if (parsed.messages?.length) return parsed.messages
      }
    } catch { /* ignore parse errors */ }
    return [{ role: 'assistant', content: openingMessage }]
  })
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [applying, setApplying] = useState(false)
  const [draft, setDraft] = useState<ScheduleEditDraft>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem(key) : null
      if (saved) {
        const parsed = JSON.parse(saved) as { messages?: ChatMessage[]; draft?: ScheduleEditDraft }
        if (parsed.draft) return parsed.draft
      }
    } catch { /* ignore */ }
    return {}
  })
  const [completion, setCompletion] = useState<ChatCompletion | undefined>(undefined)

  // Persist messages + draft to localStorage whenever they change
  const persist = useCallback((msgs: ChatMessage[], dr: ScheduleEditDraft) => {
    try { localStorage.setItem(key, JSON.stringify({ messages: msgs, draft: dr })) } catch { /* quota */ }
  }, [key])

  useEffect(() => { persist(messages, draft) }, [messages, draft, persist])

  function reset() {
    setMessages([{ role: 'assistant', content: openingMessage }])
    setInput('')
    setDraft({})
    setCompletion(undefined)
    try { localStorage.removeItem(key) } catch { /* ignore */ }
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
        setMessages(prev => {
          const next = [...prev, { role: 'assistant' as const, content: `Fehler: ${json.error} – bitte Screenshot machen und melden.` }]
          persist(next, draft)
          return next
        })
      } else {
        const newDraft = json.draft ? (json.draft as ScheduleEditDraft) : draft
        setMessages(prev => {
          const next = [...prev, { role: 'assistant' as const, content: json.reply }]
          persist(next, newDraft)
          return next
        })
        if (json.draft) setDraft(newDraft)
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Fehler: ${err instanceof Error ? err.message : 'Netzwerkfehler'} – bitte Screenshot machen und melden.` }])
    } finally {
      setSending(false)
    }
  }

  async function apply(withPermanentRules: boolean) {
    setApplying(true)
    try {
      await onApply(draft.changes ?? [], withPermanentRules ? (draft.permanentRules ?? []) : [])
      const items = [...changePreview, ...(withPermanentRules ? permanentRulePreview.map(r => `Dauerhafte Regel: ${r}`) : [])]
      setCompletion({
        title: 'Dienstplan-Änderungen übernommen',
        items: items.length > 0 ? items : ['Änderungen wurden übernommen'],
      })
    } finally {
      setApplying(false)
    }
  }

  function handleCloseCompletion() {
    reset()   // clears localStorage + state
    onClose()
  }

  const changePreview = draftToChangeStrings(draft)
  const permanentRulePreview = draftToPermanentRuleStrings(draft)
  const hasPermanentRules = permanentRulePreview.length > 0

  const isRestored = messages.length > 1

  return (
    <Modal open={open} onClose={onClose} title="Dienstplan per KI-Chat bearbeiten" size="lg">
      {isRestored && !completion && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between gap-2 text-xs text-blue-700">
          <span>Chat-Verlauf wiederhergestellt.</span>
          <button onClick={reset} className="flex items-center gap-1 font-medium hover:text-blue-900 transition-colors">
            <RotateCcw size={11} />
            Neuen Chat starten
          </button>
        </div>
      )}
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
              {/* Change preview chips */}
              {changePreview.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {changePreview.map((c, i) => (
                    <span key={i} className="inline-flex items-center bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-1 rounded-full">
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {/* Decision card — only when readyToApply AND permanent rules exist */}
              {draft.readyToApply && hasPermanentRules && (
                <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
                  <div className="px-4 pt-3 pb-2 border-b border-amber-100">
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1.5">
                      Dauerhafte Regeln erkannt
                    </p>
                    <div className="space-y-1">
                      {permanentRulePreview.map((r, i) => (
                        <p key={i} className="text-sm text-amber-900 flex items-start gap-1.5">
                          <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-amber-200 flex items-center justify-center text-[10px] font-bold text-amber-700">{i + 1}</span>
                          {r}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-xs text-amber-700 mb-2.5">
                      Sollen diese Regeln dauerhaft ins Planungsmodell übernommen werden — oder nur für diesen Dienstplan gelten?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => apply(true)}
                        disabled={applying}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold py-2.5 px-3 transition-colors disabled:opacity-50"
                      >
                        <ShieldCheck size={15} />
                        Dauerhaft speichern
                      </button>
                      <button
                        onClick={() => apply(false)}
                        disabled={applying}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-white border border-amber-200 hover:bg-amber-50 text-amber-800 text-sm font-medium py-2.5 px-3 transition-colors disabled:opacity-50"
                      >
                        <Clock size={15} />
                        Nur für diesen Plan
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Simple apply — when readyToApply but no permanent rules */}
              {draft.readyToApply && !hasPermanentRules && (
                <div className="mb-3">
                  <Button className="w-full gap-2" loading={applying} onClick={() => apply(false)}>
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
