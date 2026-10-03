'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { AiChatPanel, type ChatMessage, type ChatCompletion } from '@/components/ui/AiChatPanel'
import { Save } from 'lucide-react'
import type { VacationRulesDraft } from '@/lib/vacation-rules-draft'

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
  const [completion, setCompletion] = useState<ChatCompletion | undefined>(undefined)

  function reset() {
    setMessages([{ role: 'assistant', content: OPENING }])
    setInput('')
    setDraft(initialDraft ?? {})
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
      const res = await fetch('/api/ai/vacation-rules-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, draft }),
      })
      const json = await res.json()
      if (json.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Fehler: ${json.error} – bitte Screenshot machen und melden.` }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: json.reply }])
        if (json.draft) setDraft(json.draft as VacationRulesDraft)
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
      setCompletion({ title: 'Urlaubsregeln gespeichert', items: ['Standortregeln für die Urlaubsplanung übernommen', 'Gilt automatisch für alle künftigen Urlaubspläne'] })
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
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Urlaubsregeln per KI-Chat erfassen" size="lg">
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
                <Save size={16} />
                Regeln speichern
              </Button>
            </div>
          ) : undefined
        }
      />
    </Modal>
  )
}
