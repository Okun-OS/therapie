'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { AiChatPanel, type ChatMessage, type ChatCompletion } from '@/components/ui/AiChatPanel'
import { UserPlus } from 'lucide-react'
import type { SubstitutionDraft } from '@/lib/substitution-draft'

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
  const [completion, setCompletion] = useState<ChatCompletion | undefined>(undefined)

  function reset() {
    setMessages([{ role: 'assistant', content: OPENING }])
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
      const res = await fetch('/api/ai/substitution-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, draft }),
      })
      const json = await res.json()
      if (json.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Fehler: ${json.error} – bitte Screenshot machen und melden.` }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: json.reply }])
        if (json.draft) setDraft(json.draft as SubstitutionDraft)
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Fehler: ${err instanceof Error ? err.message : 'Netzwerkfehler'} – bitte Screenshot machen und melden.` }])
    } finally {
      setSending(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(draft)
      setCompletion({ title: 'Vertretungsanfrage erstellt', items: ['Anfrage im System angelegt', 'Mitarbeiter wurden benachrichtigt'] })
    } finally {
      setSaving(false)
    }
  }

  function handleCloseCompletion() {
    reset()
    onClose()
  }

  const showSaveButton = draft.readyToSave && draft.confirmed

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Vertretung per KI-Chat melden" size="lg">
      <AiChatPanel
        messages={messages}
        sending={sending}
        input={input}
        onInputChange={setInput}
        onSend={handleSend}
        completion={completion}
        onCloseCompletion={handleCloseCompletion}
        footer={
          showSaveButton && !completion ? (
            <div className="mb-3">
              <Button className="w-full gap-2" loading={saving} onClick={handleSave}>
                <UserPlus size={16} />
                Anfrage erstellen und Mitarbeiter benachrichtigen
              </Button>
            </div>
          ) : undefined
        }
      />
    </Modal>
  )
}
