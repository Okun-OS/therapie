'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { AiChatPanel, type ChatMessage } from '@/components/ui/AiChatPanel'

interface HumanContext {
  strengths: string[]
  lifeCircumstances: string[]
  preferredActivities: string[]
  agreements: string | null
}

/*
 * §232 Der erste Satz sagt jetzt, wohin die Angaben gehen.
 *
 * Vorher stand hier „ein paar persönliche Dinge FÜR DIE DIENSTPLANUNG
 * festzuhalten". Keines dieser Felder erreicht den Rechendienst — nachgemessen
 * in `rule-model-service.ts`, das sie nicht einmal lädt. Wer darauf vertraut
 * und seine Lebenssituation erzählt, erwartet danach einen Plan, der darauf
 * Rücksicht nimmt. Den gibt es nicht; es gibt eine Leitung, die es liest.
 */
const OPENING_MESSAGE = 'Hallo! Ich helfe dir, ein paar persönliche Dinge festzuhalten – '
  + 'deine Leitung sieht sie dann in deiner Personalakte, und ich kann sie '
  + 'heranziehen, wenn jemand mich etwas dazu fragt. In die Berechnung des '
  + 'Dienstplans gehen sie nicht ein; dafür gibt es die Dienstpräferenzen. '
  + 'Alles hier ist freiwillig, du kannst jederzeit aufhören. Magst du mir '
  + 'erzählen, wo deine Stärken im Arbeitsalltag liegen?'

export function HumanContextChat({
  open,
  onClose,
  employeeId,
  onContextUpdate,
}: {
  open: boolean
  onClose: () => void
  employeeId: string
  onContextUpdate: (context: HumanContext) => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: OPENING_MESSAGE }])
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
      const res = await fetch('/api/ai/human-context-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, messages: nextMessages }),
      })
      const json = await res.json()
      if (json.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Fehler: ${json.error} – bitte Screenshot machen und melden.` }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: json.reply }])
        if (json.context) onContextUpdate(json.context)
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Fehler: ${err instanceof Error ? err.message : 'Netzwerkfehler'} – bitte Screenshot machen und melden.` }])
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="KI-Assistent: Persönliches" size="lg">
      <AiChatPanel
        messages={messages}
        sending={sending}
        input={input}
        onInputChange={setInput}
        onSend={handleSend}
        hint="Alles, was du hier erzählst, ist freiwillig, jederzeit änderbar und nur für die Leitung sichtbar. Du kannst das Gespräch jederzeit schließen."
      />
    </Modal>
  )
}
