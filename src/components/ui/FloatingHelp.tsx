'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { HelpCircle, X, Send, Minimize2 } from 'lucide-react'
import { Logo } from './Logo'
import { cn } from '@/lib/utils'

interface HelpMessage {
  role: 'user' | 'assistant'
  content: string
}

const PAGE_LABELS: Record<string, string> = {
  '/admin': 'Dashboard (Standortleitung)',
  '/admin/onboarding': 'KI-Onboarding',
  '/admin/employees': 'Mitarbeiter',
  '/admin/schedule': 'Dienstplan',
  '/admin/calendar': 'Kalender',
  '/admin/tasks': 'Aufgaben',
  '/admin/time-tracking': 'Zeiterfassung',
  '/admin/substitutions': 'Vertretungen',
  '/admin/workforce-score': 'Workforce Score',
  '/admin/reports': 'Berichte',
  '/admin/assistant': 'OKUN Assistent',
  '/employee': 'Dashboard (Mitarbeiter)',
  '/employee/schedule': 'Mein Dienstplan',
  '/employee/time-tracking': 'Zeiterfassung',
  '/employee/vacation': 'Urlaub',
  '/employee/substitutions': 'Vertretungen',
  '/employee/workforce-score': 'Mein Level',
  '/company': 'Unternehmens-Dashboard',
  '/company/locations': 'Standorte',
  '/company/schedule': 'Alle Dienstpläne',
  '/company/vacation-plan': 'Jahresurlaubsplanung',
  '/company/settings': 'Einstellungen',
}

function AssistantAvatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center flex-shrink-0 p-1">
      <Logo variant="icon" iconSize={15} />
    </div>
  )
}

/**
 * §140 Die Hilfe lässt sich auch von außen öffnen.
 *
 * Vorher brachte sie ihren eigenen runden Knopf unten rechts mit — und der
 * Käfer daneben seinen eigenen, in einer anderen Größe, auf einer anderen Höhe
 * und in der anderen Ecke. Zwei Dinge, die dasselbe sind („ich komme hier
 * nicht weiter"), sahen aus wie zwei Systeme. Jetzt trägt `Hilfeknopf` einen
 * einzigen Knopf, und diese beiden Fenster werden von dort gesteuert.
 *
 * Ohne Eigenschaften bleibt der alte Weg bestehen — für den Fall, dass die
 * Hilfe irgendwo allein stehen soll.
 */
export function FloatingHelp({ offen, beiSchliessen }: {
  offen?: boolean
  beiSchliessen?: () => void
} = {}) {
  const gesteuert = offen !== undefined
  const [selbstOffen, setSelbstOffen] = useState(false)
  const open = gesteuert ? offen : selbstOffen
  const setOpen = (wert: boolean | ((v: boolean) => boolean)) => {
    const neu = typeof wert === 'function' ? wert(open) : wert
    if (gesteuert) { if (!neu) beiSchliessen?.() } else setSelbstOffen(neu)
  }
  const [messages, setMessages] = useState<HelpMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pathname = usePathname()

  const pageLabel = PAGE_LABELS[pathname] ?? pathname

  useEffect(() => {
    if (open) {
      if (messages.length === 0) {
        setMessages([{
          role: 'assistant',
          content: `Hallo! Ich bin dein OKUN Hilfe-Assistent. Du bist gerade auf der Seite **${pageLabel}**.\n\nWie kann ich dir helfen?`,
        }])
      }
      setTimeout(() => inputRef.current?.focus(), 100)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, sending])

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    const next: HelpMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setSending(true)
    try {
      const res = await fetch('/api/ai/help-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, currentPage: pageLabel }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? 'Es ist ein Fehler aufgetreten.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Verbindungsfehler. Bitte versuche es erneut.' }])
    } finally {
      setSending(false)
    }
  }

  function renderContent(text: string) {
    return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />')
  }

  return (
    <>
      {/* Eigener Knopf nur, wenn niemand von außen steuert. */}
      {!gesteuert && (
        <button
          onClick={() => setOpen(v => !v)}
          className={cn(
            'fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-40 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200',
            open
              ? 'bg-navy text-white scale-95'
              : 'bg-teal-600 text-white hover:bg-teal-700 hover:scale-110',
          )}
          aria-label="Hilfe öffnen"
        >
          {open ? <Minimize2 className="w-5 h-5" /> : <HelpCircle className="w-5 h-5" />}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-40 right-4 lg:bottom-22 lg:right-6 z-40 w-[calc(100vw-2rem)] max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden animate-fade-in"
          style={{ maxHeight: 'min(480px, calc(100vh - 180px))' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 bg-navy flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center p-1.5">
              <Logo variant="icon" iconSize={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-tight">OKUN Hilfe</p>
              <p className="text-[11px] text-white/60 leading-tight truncate">{pageLabel}</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/60 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex gap-2 animate-fade-in', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                {m.role === 'assistant' && <AssistantAvatar />}
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
                    m.role === 'user'
                      ? 'bg-teal-600 text-white rounded-br-md'
                      : 'bg-gray-50 text-gray-700 border border-gray-100 rounded-bl-md',
                  )}
                  dangerouslySetInnerHTML={{ __html: renderContent(m.content) }}
                />
              </div>
            ))}
            {sending && (
              <div className="flex gap-2 justify-start animate-fade-in">
                <AssistantAvatar />
                <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 pb-3 flex-shrink-0 border-t border-gray-100 pt-2">
            <div className="flex gap-2 items-end">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send() } }}
                placeholder="Stell eine Frage…"
                disabled={sending}
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50 resize-none"
              />
              <button
                onClick={send}
                disabled={sending || !input.trim()}
                className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 disabled:opacity-40 transition-colors flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
