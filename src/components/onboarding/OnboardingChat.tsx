'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { AiChatPanel, type ChatMessage } from '@/components/ui/AiChatPanel'
import { Button } from '@/components/ui/Button'
import { ONBOARDING_PHASES } from '@/lib/onboarding-service'
import { CheckCircle2, RotateCcw, FileText, Settings, Bookmark, Check, List } from 'lucide-react'

const ORGANIZATION_OPENING = 'Hallo! Ich freue mich, euer Unternehmen kennenzulernen. Gemeinsam richten wir OKUN Workforce so ein, dass später alles möglichst automatisch funktioniert. Wie heißt euer Unternehmen, welche Standorte gehören dazu, und wie ist die Führung grob aufgebaut (z.B. Geschäftsführung, Standortleitungen)?'
const LOCATION_OPENING = (name: string) => `Hallo! Ich freue mich, „${name}" kennenzulernen. Gemeinsam richten wir OKUN Workforce so ein, dass die Dienstplanung später möglichst automatisch funktioniert. Magst du mir zunächst kurz erzählen, um welche Art von Standort es sich handelt und wie die Gruppen/Bereiche dort aufgeteilt sind?`

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

interface SavedChat {
  messages: ChatMessage[]
  completed: boolean
}

export function OnboardingChat({
  open,
  onClose,
  scope,
  locationName,
  locationId,
  onStateUpdate,
}: {
  open: boolean
  onClose: () => void
  scope: string
  locationName?: string
  locationId?: string
  onStateUpdate: (state: unknown) => void
}) {
  const isOrganization = scope === 'organization'
  const opening = isOrganization ? ORGANIZATION_OPENING : LOCATION_OPENING(locationName ?? 'euren Standort')

  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: opening }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [state, setState] = useState<OrgState | LocState | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [hasSavedHistory, setHasSavedHistory] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [savedLoading, setSavedLoading] = useState(false)
  const [completedView, setCompletedView] = useState<'options' | 'chat' | 'summary'>('chat')
  const [showSaved, setShowSaved] = useState(false)

  // Load saved messages when modal opens
  useEffect(() => {
    if (!open || loaded) return
    setLoaded(true)
    loadHistory()
  }, [open])

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setLoaded(false)
    }
  }, [open])

  async function loadHistory() {
    setSavedLoading(true)
    try {
      const url = isOrganization
        ? '/api/ai/onboarding-chat/history?scope=organization'
        : `/api/ai/onboarding-chat/history?scope=location&locationId=${locationId ?? ''}`
      const res = await fetch(url)
      if (!res.ok) return
      const data: SavedChat = await res.json()
      if (data.messages && data.messages.length > 1) {
        setMessages(data.messages)
        setHasSavedHistory(true)
        if (data.completed) {
          setState(prev => ({ ...(prev ?? {}), completed: true } as OrgState))
          setCompletedView('options')
        }
      }
      if ((data as { savedAt?: string }).savedAt) {
        setSavedAt((data as { savedAt?: string }).savedAt ?? null)
      }
    } catch {
      // ignore – start fresh
    } finally {
      setSavedLoading(false)
    }
  }

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
        body: JSON.stringify({ scope, messages: nextMessages, locationId }),
      })
      const json = await res.json()
      if (json.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Fehler: ' + (json.error || 'Unbekannt') + ' – bitte Screenshot machen und melden.' }])
      } else {
        const newMessages = [...nextMessages, { role: 'assistant' as const, content: json.reply }]
        setMessages(newMessages)
        if (json.state) {
          onStateUpdate(json.state)
          setState(json.state)
          if (json.state.completed) setCompletedView('options')
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Netzwerkfehler'
      setMessages(prev => [...prev, { role: 'assistant', content: `Fehler: ${msg} – bitte Screenshot machen und melden.` }])
    } finally {
      setSending(false)
    }
  }

  function handleSaveAndClose() {
    setShowSaved(true)
    setTimeout(() => {
      setShowSaved(false)
      onClose()
    }, 1200)
  }

  async function handleRestart() {
    try {
      await fetch('/api/ai/onboarding-chat/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, locationId }),
      })
    } catch {}
    setMessages([{ role: 'assistant', content: opening }])
    setState(null)
    setHasSavedHistory(false)
    setCompletedView('chat')
  }

  const isCompleted = (state as OrgState | null)?.completed === true

  const progress = isOrganization
    ? state
      ? { current: [(state as OrgState).traegerName, (state as OrgState).rollenmodell, (state as OrgState).unternehmensweiteRegeln].filter(Boolean).length, total: 3 }
      : { current: 0, total: 3 }
    : { current: (state as LocState | null)?.completedPhases.length ?? 0, total: ONBOARDING_PHASES.length, label: ONBOARDING_PHASES[Math.min((state as LocState | null)?.completedPhases.length ?? 0, ONBOARDING_PHASES.length - 1)].label }

  const completion = isCompleted
    ? isOrganization
      ? {
          title: 'Unternehmens-Onboarding abgeschlossen',
          items: ['Unternehmensdaten gespeichert', 'Rollenmodell hinterlegt', 'Unternehmensweite Regeln gespeichert'],
        }
      : {
          title: `Standort-Onboarding für „${locationName ?? ''}" abgeschlossen`,
          items: ONBOARDING_PHASES.map(p => `${p.label} erfasst`),
        }
    : undefined

  const title = isOrganization ? 'KI-Onboarding: Unternehmen' : `KI-Onboarding: ${locationName ?? ''}`

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      {savedLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Verlauf wird geladen…</div>
      ) : isCompleted && completedView === 'options' ? (
        /* ── Abgeschlossen: Options-Screen ─────────────────────────── */
        <div className="py-2 space-y-4">
          <div className="flex items-center gap-3 p-4 bg-green-50 rounded-2xl border border-green-100">
            <CheckCircle2 size={24} className="text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-800 text-sm">
                {isOrganization ? 'Unternehmens-Onboarding abgeschlossen' : `Onboarding für „${locationName ?? ''}" abgeschlossen`}
              </p>
              <p className="text-xs text-green-600 mt-0.5">Alle Daten wurden gespeichert und sind aktiv.</p>
            </div>
          </div>

          <div className="grid gap-2">
            <button
              onClick={() => setCompletedView('summary')}
              className="flex items-center gap-3 p-4 rounded-2xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors text-left"
            >
              <List size={18} className="text-brand flex-shrink-0" />
              <div>
                <p className="font-semibold text-navy text-sm">Zusammenfassung</p>
                <p className="text-xs text-gray-500">Überblick über alle erfassten Bereiche</p>
              </div>
            </button>

            <button
              onClick={() => setCompletedView('chat')}
              className="flex items-center gap-3 p-4 rounded-2xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors text-left"
            >
              <FileText size={18} className="text-brand flex-shrink-0" />
              <div>
                <p className="font-semibold text-navy text-sm">Gespräch ansehen</p>
                <p className="text-xs text-gray-500">Vollständigen Chatverlauf lesen</p>
              </div>
            </button>

            <button
              onClick={() => setCompletedView('chat')}
              className="flex items-center gap-3 p-4 rounded-2xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors text-left"
            >
              <Settings size={18} className="text-brand flex-shrink-0" />
              <div>
                <p className="font-semibold text-navy text-sm">Änderungen vornehmen</p>
                <p className="text-xs text-gray-500">Das Gespräch wieder öffnen und Angaben anpassen</p>
              </div>
            </button>

            <button
              onClick={handleRestart}
              className="flex items-center gap-3 p-4 rounded-2xl border border-gray-100 bg-white hover:bg-red-50 hover:border-red-100 transition-colors text-left"
            >
              <RotateCcw size={18} className="text-red-400 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-600 text-sm">Onboarding neu starten</p>
                <p className="text-xs text-gray-500">Alle bisherigen Angaben löschen und von vorne beginnen</p>
              </div>
            </button>
          </div>
        </div>
      ) : isCompleted && completedView === 'summary' ? (
        /* ── Zusammenfassung: erfasste Bereiche ────────────────────── */
        <div className="py-2 space-y-3">
          <button
            onClick={() => setCompletedView('options')}
            className="text-xs text-brand hover:underline flex items-center gap-1"
          >
            ← Zurück
          </button>
          <p className="text-sm font-semibold text-navy">Erfasste Bereiche</p>
          {isOrganization ? (
            <div className="space-y-2">
              {[
                { label: 'Unternehmensname', done: true },
                { label: 'Rollenmodell & Hierarchie', done: true },
                { label: 'Unternehmensweite Regeln', done: true },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white">
                  <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
                  <span className="text-sm text-navy">{item.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {ONBOARDING_PHASES.map(phase => {
                const done = (state as LocState | null)?.completedPhases.includes(phase.key) ?? false
                return (
                  <div key={phase.key} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white">
                    {done
                      ? <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
                      : <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                    }
                    <span className={`text-sm ${done ? 'text-navy' : 'text-gray-400'}`}>{phase.label}</span>
                  </div>
                )
              })}
            </div>
          )}
          <p className="text-xs text-gray-400 pt-1">
            Die erfassten Regeln sind aktiv und werden bei der Dienstplanung automatisch angewendet.
          </p>
        </div>
      ) : (
        /* ── Chat view ──────────────────────────────────────────────── */
        <>
          {hasSavedHistory && !isCompleted && (
            <div className="flex items-start gap-2 px-3 py-2 bg-brand/5 rounded-xl border border-brand/10 mb-3 text-xs text-brand">
              <Bookmark size={12} className="flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-medium">Gespräch fortgesetzt</span>
                {savedAt && <span className="text-brand/70"> · zuletzt gespeichert {new Date(savedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
                {!isOrganization && (state as LocState | null)?.completedPhases && (state as LocState | null)!.completedPhases.length > 0 && (
                  <p className="text-brand/70 mt-0.5">
                    {(state as LocState).completedPhases.length} von {ONBOARDING_PHASES.length} Bereichen erfasst · noch offen: {ONBOARDING_PHASES.filter(p => !(state as LocState).completedPhases.includes(p.key)).map(p => p.label).join(', ') || 'keine'}
                  </p>
                )}
              </div>
            </div>
          )}
          <AiChatPanel
            messages={messages}
            sending={sending}
            input={input}
            onInputChange={setInput}
            onSend={handleSend}
            placeholder="Deine Antwort…"
            hint="Erzähl mir einfach frei, wie euer Standort arbeitet. Ich frage automatisch nach, falls etwas fehlt oder unklar ist."
            progress={progress}
            completion={completion}
            onCloseCompletion={() => setCompletedView('options')}
          />
          <div className="mt-3 flex justify-end">
            {showSaved ? (
              <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium px-3 py-1.5">
                <Check size={14} />
                Gespeichert
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveAndClose}
                className="flex items-center gap-1.5 text-gray-500"
              >
                <Bookmark size={13} />
                Speichern und später fortsetzen
              </Button>
            )}
          </div>
        </>
      )}
    </Modal>
  )
}
