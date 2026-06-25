'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { Send, MessageCircle, Loader2, CalendarCheck } from 'lucide-react'
import type { SchedulePlanningDraft } from '@/lib/schedule-planning-draft'
import { draftToNoteStrings } from '@/lib/schedule-planning-draft'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const opening = (periodLabel: string) =>
  `Lass uns kurz die Besonderheiten für den Zeitraum ${periodLabel} besprechen. Gibt es in diesem Zeitraum besondere Ereignisse, die die Planung beeinflussen, z.B. ein Fest, eine Fortbildung oder ein Schließtag?`

export function SchedulePlanningChat({
  open,
  onClose,
  onSave,
  periodLabel,
}: {
  open: boolean
  onClose: () => void
  onSave: (notes: string[]) => Promise<void>
  periodLabel: string
}) {
  const openingMessage = opening(periodLabel)
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: openingMessage }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<SchedulePlanningDraft>({})

  function reset() {
    setMessages([{ role: 'assistant', content: openingMessage }])
    setInput('')
    setDraft({})
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
        body: JSON.stringify({ messages: nextMessages, draft, periodLabel }),
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
      await onSave(draftToNoteStrings(draft))
      reset()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const notePreview = draftToNoteStrings(draft)

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Planungsbesonderheiten per KI-Chat erfassen" size="lg">
      <div className="space-y-2 mb-3 max-h-96 overflow-y-auto">
        {messages.map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[85%] rounded-xl px-3 py-2 text-sm',
              m.role === 'user' ? 'bg-brand text-navy' : 'bg-gray-100 text-gray-700'
            )}>
              {m.role === 'assistant' && <MessageCircle size={12} className="inline mr-1 -mt-0.5" />}
              {m.content}
            </div>
          </div>
        ))}
        {sending && <div className="text-xs text-gray-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> KI denkt nach…</div>}
      </div>

      {notePreview.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {notePreview.map((n, i) => (
            <span key={i} className="inline-flex items-center bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-1 rounded-full">
              {n}
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

      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Deine Antwort…"
          className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <Button onClick={handleSend} loading={sending} size="md">
          <Send size={14} />
        </Button>
      </div>
    </Modal>
  )
}
