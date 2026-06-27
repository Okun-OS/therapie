'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { Send, MessageCircle, Loader2, Save } from 'lucide-react'
import type { VacationRulesDraft } from '@/lib/vacation-rules-draft'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const OPENING = 'Beschreibe mir deinen Standort und die Regeln für die Urlaubsplanung – z.B. Gruppenstruktur, Mindestbesetzung, wie viele Mitarbeiter maximal gleichzeitig Urlaub haben dürfen, oder besondere Feiertagsregeln. Diese Angaben gelten dauerhaft für alle künftigen Planungen.'

export function VacationRulesChat({
  open,
  onClose,
  initialDraft,
  onSave,
}: {
  open: boolean
  onClose: () => void
  initialDraft?: VacationRulesDraft
  onSave: (draft: VacationRulesDraft) => Promise<void>
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: OPENING }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<VacationRulesDraft>(initialDraft ?? {})

  function reset() {
    setMessages([{ role: 'assistant', content: OPENING }])
    setInput('')
    setDraft(initialDraft ?? {})
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    const nextMessages = [...messages, { role: 'user' as const, content: text }]
    setMessages(nextMessages)
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/ai/vacation-rules-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, draft }),
      })
      const json = await res.json()
      if (json.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Entschuldige, da ist etwas schiefgelaufen. Du kannst es gerne erneut versuchen.' }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: json.reply }])
        if (json.draft) setDraft(json.draft as VacationRulesDraft)
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
      await onSave(draft)
      reset()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const showSaveButton = draft.readyToSave && draft.confirmed

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Urlaubsregeln per KI-Chat erfassen" size="lg">
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

      {showSaveButton && (
        <div className="mb-3">
          <Button className="w-full gap-2" loading={saving} onClick={handleSave}>
            <Save size={16} />
            Regeln speichern
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          containerClassName="flex-1"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Deine Antwort…"
        />
        <Button onClick={handleSend} loading={sending} size="md">
          <Send size={14} />
        </Button>
      </div>
    </Modal>
  )
}
