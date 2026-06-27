'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { AiChatPanel, type ChatMessage } from '@/components/ui/AiChatPanel'
import { ONBOARDING_PHASES } from '@/lib/onboarding-service'

const ORGANIZATION_OPENING = 'Hallo! Ich freue mich, euer Unternehmen kennenzulernen. Gemeinsam richten wir OKUN Workforce so ein, dass später alles möglichst automatisch funktioniert. Wie heißt euer Unternehmen, welche Standorte gehören dazu, und wie ist die Führung grob aufgebaut (z.B. Geschäftsführung, Standortleitungen)?'
const LOCATION_OPENING = (name: string) => `Hallo! Ich freue mich, „${name}” kennenzulernen. Gemeinsam richten wir OKUN Workforce so ein, dass die Dienstplanung später möglichst automatisch funktioniert. Magst du mir zunächst kurz erzählen, um welche Art von Standort es sich handelt und wie die Gruppen/Bereiche dort aufgeteilt sind?`

interface OrgState {
  traegerName: string | null
  rollenmodell: string | null
  unternehmensweiteRegeln: string | null
  completed: boolean
}

interface LocState {
  completedPhases: string[]
  completed: boolean
}

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
  const [state, setState] = useState<OrgState | LocState | null>(null)

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
        if (json.state) {
          onStateUpdate(json.state)
          setState(json.state)
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Entschuldige, da ist etwas schiefgelaufen. Du kannst es gerne erneut versuchen.' }])
    } finally {
      setSending(false)
    }
  }

  const progress = isOrganization
    ? state
      ? { current: [(state as OrgState).traegerName, (state as OrgState).rollenmodell, (state as OrgState).unternehmensweiteRegeln].filter(Boolean).length, total: 3 }
      : { current: 0, total: 3 }
    : { current: (state as LocState | null)?.completedPhases.length ?? 0, total: ONBOARDING_PHASES.length, label: ONBOARDING_PHASES[Math.min((state as LocState | null)?.completedPhases.length ?? 0, ONBOARDING_PHASES.length - 1)].label }

  const completion = state?.completed
    ? isOrganization
      ? {
          title: 'Unternehmens-Onboarding abgeschlossen',
          items: [
            'Unternehmensdaten gespeichert',
            'Rollenmodell hinterlegt',
            'Unternehmensweite Regeln gespeichert',
          ],
        }
      : {
          title: `Standort-Onboarding für „${locationName ?? ''}” abgeschlossen`,
          items: ONBOARDING_PHASES.map(p => `${p.label} erfasst`),
        }
    : undefined

  return (
    <Modal open={open} onClose={onClose} title={isOrganization ? 'KI-Onboarding: Unternehmen' : `KI-Onboarding: ${locationName ?? ''}`} size="lg">
      <AiChatPanel
        messages={messages}
        sending={sending}
        input={input}
        onInputChange={setInput}
        onSend={handleSend}
        placeholder="Deine Antwort…"
        hint="Erzähl mir einfach frei, wie euer Standort arbeitet. Ich frage automatisch nach, falls etwas fehlt oder unklar ist. Du kannst das Gespräch jederzeit unterbrechen und später fortsetzen."
        progress={progress}
        completion={completion}
        onCloseCompletion={onClose}
      />
    </Modal>
  )
}
