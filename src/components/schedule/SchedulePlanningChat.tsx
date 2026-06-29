'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { AiChatPanel, type ChatMessage, type ChatCompletion } from '@/components/ui/AiChatPanel'
import { CalendarCheck } from 'lucide-react'
import type { SchedulePlanningDraft } from '@/lib/schedule-planning-draft'
import { draftToNoteStrings, draftToPermanentRuleStrings } from '@/lib/schedule-planning-draft'

const opening = (periodLabel: string) =>
  `Lass uns kurz die Besonderheiten für den Zeitraum ${periodLabel} besprechen. Gibt es in diesem Zeitraum besondere Ereignisse, die die Planung beeinflussen, z.B. ein Fest, eine Fortbildung oder ein Schließtag?`

export function SchedulePlanningChat({
  open,
  onClose,
  onSave,
  locationId,
  periodLabel,
}: {
  open: boolean
  onClose: () => void
  onSave: (notes: string[], permanentRules: string[]) => Promise<void>
  locationId: string
  periodLabel: string
}) {
  const openingMessage = opening(periodLabel)
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: openingMessage }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<SchedulePlanningDraft>({})
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
      const res = await fetch('/api/ai/schedule-planning-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, draft, locationId, periodLabel }),
      })
      const json = await res.json()
      if (json.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Entschuldige, da ist etwas schiefgelaufen. Du kannst es gerne erneut versuchen.' }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: json.reply }])
        if (json.draft) setDraft(json.draft as SchedulePlanningDraft)
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Entschuldige, da ist etwas schiefgelaufen. Du kannst es gerne erneut versuchen.' }])
    } finally {
      setSending(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(draftToNoteStrings(draft), draftToPermanentRuleStrings(draft))
      const items = [...notePreview, ...permanentRulePreview]
      setCompletion({ title: 'Planungsbesonderheiten übernommen', items: items.length > 0 ? items : ['Besonderheiten für diesen Zeitraum gespeichert'] })
    } finally {
      setSaving(false)
    }
  }

  function handleCloseCompletion() {
    reset()
    onClose()
  }

  const notePreview = draftToNoteStrings(draft)
  const permanentRulePreview = draftToPermanentRuleStrings(draft)

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Planungsbesonderheiten per KI-Chat erfassen" size="lg">
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
              {notePreview.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {notePreview.map((n, i) => (
                    <span key={i} className="inline-flex items-center bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-1 rounded-full">
                      {n}
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
              {draft.readyToSave && (
                <div className="mb-3">
                  <Button className="w-full gap-2" loading={saving} onClick={handleSave}>
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
