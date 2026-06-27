'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { Send, MessageCircle, Loader2, Sparkles } from 'lucide-react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const ORGANIZATION_OPENING = 'Hallo! Ich freue mich, euer Unternehmen kennenzulernen. Gemeinsam richten wir OKUN Workforce so ein, dass später alles möglichst automatisch funktioniert. Wie heißt euer Unternehmen, und welche Standorte gehören dazu?'
const LOCATION_OPENING = (name: string) => `Hallo! Ich freue mich, „${name}” kennenzulernen. Gemeinsam richten wir OKUN Workforce so ein, dass die Dienstplanung später möglichst automatisch funktioniert. Magst du mir zunächst kurz erzählen, um welche Art von Standort es sich handelt?`

export function OnboardingChat({
  open,
  onClose,
  scope,
  locationName,
  onStateUpdate,
}: {
  open: boolean
  onClose: () => void
  scope: string
  locationName?: string
  onStateUpdate: (state: unknown) => void
}) {
  const isOrganization = scope === 'organization'
  const opening = isOrganization ? ORGANIZATION_OPENING : LOCATION_OPENING(locationName ?? 'euren Standort')
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: opening }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    const nextMessages = [...messages, { role: 'user' as const, content: text }]
    setMessages(nextMessages)
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/ai/onboarding-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, messages: nextMessages }),
      })
      const json = await res.json()
      if (json.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Entschuldige, da ist etwas schiefgelaufen. Du kannst es gerne erneut versuchen.' }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: json.reply }])
        if (json.state) onStateUpdate(json.state)
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Entschuldige, da ist etwas schiefgelaufen. Du kannst es gerne erneut versuchen.' }])
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isOrganization ? 'KI-Onboarding: Unternehmen' : `KI-Onboarding: ${locationName ?? ''}`} size="lg">
      <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 mb-3">
        <Sparkles size={14} className="flex-shrink-0 mt-0.5 text-brand" />
        <span>Erzähl mir einfach frei, wie euer Standort arbeitet. Ich frage automatisch nach, falls etwas fehlt oder unklar ist. Du kannst das Gespräch jederzeit unterbrechen und später fortsetzen.</span>
      </div>

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
