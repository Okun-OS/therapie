'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { AiChatPanel, type ChatMessage, type ChatCompletion } from '@/components/ui/AiChatPanel'
import { UserPlus } from 'lucide-react'
import type { EmployeeDraft } from '@/lib/employee-draft'

const CREATE_OPENING = 'Super, dann legen wir jetzt gemeinsam einen neuen Mitarbeiter an. Erzähl mir einfach in einem Satz oder zwei das Wichtigste – Name, E-Mail, Position und Wochenstunden reichen mir zum Start, alles andere frage ich gezielt nach.'
const editOpening = (name: string) => `Klar, was möchtest du an ${name}s Profil ändern oder ergänzen? Du kannst mir einfach frei erzählen, was sich geändert hat.`

export function EmployeeCreationChat({
  open,
  onClose,
  onSave,
  onDraftSync,
  initialDraft,
  employeeName,
}: {
  open: boolean
  onClose: () => void
  onSave: (draft: EmployeeDraft, employeeId: string | null) => Promise<void>
  onDraftSync?: (draft: EmployeeDraft, employeeId: string | null) => Promise<string | null>
  initialDraft?: EmployeeDraft
  employeeName?: string
}) {
  const isEditMode = !!initialDraft
  const openingMessage = isEditMode ? editOpening(employeeName ?? 'des Mitarbeiters') : CREATE_OPENING

  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: openingMessage }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<EmployeeDraft>(initialDraft ?? {})
  const [completion, setCompletion] = useState<ChatCompletion | undefined>(undefined)
  const [employeeId, setEmployeeId] = useState<string | null>(null)

  function reset() {
    setMessages([{ role: 'assistant', content: openingMessage }])
    setInput('')
    setDraft(initialDraft ?? {})
    setCompletion(undefined)
    setEmployeeId(null)
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    const nextMessages = [...messages, { role: 'user' as const, content: text }]
    setMessages(nextMessages)
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/ai/employee-creation-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, draft }),
      })
      const json = await res.json()
      if (json.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Entschuldige, da ist etwas schiefgelaufen. Du kannst es gerne erneut versuchen.' }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: json.reply }])
        if (json.draft) {
          const nextDraft = json.draft as EmployeeDraft
          setDraft(nextDraft)
          if (!isEditMode && onDraftSync && nextDraft.name?.trim() && nextDraft.email?.trim()) {
            try {
              const id = await onDraftSync(nextDraft, employeeId)
              if (id) setEmployeeId(id)
            } catch {
              // Inkrementelles Anlegen ist best-effort – die finale Bestätigung legt den Mitarbeiter notfalls vollständig an.
            }
          }
        }
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
      await onSave(draft, employeeId)
      setCompletion(
        isEditMode
          ? { title: 'Profil aktualisiert', items: ['Änderungen am Mitarbeiterprofil gespeichert'] }
          : { title: 'Mitarbeiter angelegt', items: [`${draft.name ?? 'Mitarbeiter'} wurde im System angelegt`, 'Einladung per E-Mail wird versendet'] },
      )
    } finally {
      setSaving(false)
    }
  }

  function handleCloseCompletion() {
    reset()
    onClose()
  }

  const showSaveButton = isEditMode ? Object.keys(draft).length > 0 : draft.readyToSave

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title={isEditMode ? 'Profil per KI-Chat aktualisieren' : 'Mitarbeiter per KI-Chat anlegen'} size="lg">
      <AiChatPanel
        messages={messages}
        sending={sending}
        input={input}
        onInputChange={setInput}
        onSend={handleSend}
        hint={!isEditMode && employeeId ? 'Der Mitarbeiter ist bereits im System angelegt und wird laufend aktualisiert.' : undefined}
        completion={completion}
        onCloseCompletion={handleCloseCompletion}
        footer={
          showSaveButton && !completion ? (
            <div className="mb-3">
              <Button className="w-full gap-2" loading={saving} onClick={handleSave}>
                <UserPlus size={16} />
                {isEditMode ? 'Änderungen speichern' : 'Mitarbeiter jetzt anlegen'}
              </Button>
            </div>
          ) : undefined
        }
      />
    </Modal>
  )
}
