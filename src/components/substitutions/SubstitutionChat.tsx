'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { Send, MessageCircle, Loader2, UserPlus } from 'lucide-react'
import type { SubstitutionDraft } from '@/lib/substitution-draft'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const OPENING = 'Wer fällt aus, und welcher Dienst muss vertreten werden? Erzähl es mir einfach in eigenen Worten, z.B. "Frau Müller ist heute krank, ihr Frühdienst morgen muss vertreten werden".'

export function SubstitutionChat({
  open,
  onClose,
  onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: (draft: SubstitutionDraft) => Promise<void>
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: OPENING }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<SubstitutionDraft>({})

  function reset() {
    setMessages([{ role: 'assistant', content: OPENING }])
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
      const res = await fetch('/api/ai/substitution-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, draft }),
      })
      const json = await res.json()
      if (json.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Entschuldige, da ist etwas schiefgelaufen. Du kannst es gerne erneut versuchen.' }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: json.reply }])
        if (json.draft) setDraft(json.draft as SubstitutionDraft)
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
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Vertretung per KI-Chat melden" size="lg">
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
            <UserPlus size={16} />
            Anfrage erstellen und Mitarbeiter benachrichtigen
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
