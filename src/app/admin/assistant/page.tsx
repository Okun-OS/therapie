'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Sparkles, Loader2, CheckCircle2, ChevronDown, RefreshCw } from 'lucide-react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  actions?: { tool: string; summary: string }[]
  isLoading?: boolean
}

// Minimal-Markdown: fett, kursiv, Code, Listen, Zeilenumbrüche
function renderMarkdown(text: string) {
  const lines = text.split('\n')
  const result: React.ReactNode[] = []
  let key = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Heading
    if (line.startsWith('## ')) {
      result.push(<h2 key={key++} className="text-sm font-semibold text-gray-800 mt-3 mb-1">{line.slice(3)}</h2>)
      continue
    }
    if (line.startsWith('# ')) {
      result.push(<h1 key={key++} className="text-sm font-bold text-gray-900 mt-3 mb-1">{line.slice(2)}</h1>)
      continue
    }

    // List item
    if (line.startsWith('- ') || line.startsWith('* ')) {
      result.push(
        <li key={key++} className="ml-4 list-disc text-sm text-gray-700">
          {renderInline(line.slice(2))}
        </li>
      )
      continue
    }
    if (/^\d+\.\s/.test(line)) {
      result.push(
        <li key={key++} className="ml-4 list-decimal text-sm text-gray-700">
          {renderInline(line.replace(/^\d+\.\s/, ''))}
        </li>
      )
      continue
    }

    // Leerzeile
    if (line.trim() === '') {
      result.push(<div key={key++} className="h-2" />)
      continue
    }

    // Normal
    result.push(
      <p key={key++} className="text-sm text-gray-700 leading-relaxed">
        {renderInline(line)}
      </p>
    )
  }

  return result
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  // **bold**, *italic*, `code`
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    if (match[2]) {
      parts.push(<strong key={match.index} className="font-semibold">{match[2]}</strong>)
    } else if (match[3]) {
      parts.push(<em key={match.index}>{match[3]}</em>)
    } else if (match[4]) {
      parts.push(<code key={match.index} className="bg-gray-100 text-rose-600 px-1 rounded text-xs font-mono">{match[4]}</code>)
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts.length === 1 ? parts[0] : parts
}

const TOOL_LABELS: Record<string, string> = {
  list_employees: 'Mitarbeiterdaten geladen',
  get_schedule: 'Dienstplan abgerufen',
  list_shifts: 'Schichten geladen',
  get_location_config: 'Standort-Konfiguration geladen',
  get_organization_config: 'Unternehmens-Konfiguration geladen',
  list_vacation_requests: 'Urlaubsanträge geladen',
  list_absences: 'Abwesenheiten geladen',
  list_substitutions: 'Vertretungen geladen',
  get_employee_details: 'Mitarbeiterprofil geladen',
  assign_shift: 'Schicht eingeplant',
  remove_from_schedule: 'Eintrag entfernt',
  swap_employees: 'Tausch durchgeführt',
  update_planning_rule: 'Planungsregel gespeichert',
  upsert_planning_unit: 'Planungseinheit gespeichert',
  approve_vacation_request: 'Urlaubsantrag genehmigt',
  deny_vacation_request: 'Urlaubsantrag abgelehnt',
  update_employee_field: 'Mitarbeiterdaten aktualisiert',
  save_location_rule: 'Standortregel gespeichert',
}

const WRITE_TOOLS = new Set([
  'assign_shift', 'remove_from_schedule', 'swap_employees',
  'update_planning_rule', 'upsert_planning_unit',
  'approve_vacation_request', 'deny_vacation_request',
  'update_employee_field', 'save_location_rule',
])

const EXAMPLE_PROMPTS = [
  'Wie viele Mitarbeiter haben wir und welche Gruppen gibt es?',
  'Zeige mir den aktuellen Dienstplan für diese Woche.',
  'Welche Urlaubsanträge sind noch offen?',
  'Welche Planungsregeln gelten aktuell?',
  'Wer ist diese Woche krank oder abwesend?',
]

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  // Raw API messages for conversation context
  const [apiMessages, setApiMessages] = useState<{ role: 'user' | 'assistant'; content: any }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return

    const userMsg: ChatMessage = { role: 'user', content: text.trim() }
    const loadingMsg: ChatMessage = { role: 'assistant', content: '', isLoading: true }

    setMessages(prev => [...prev, userMsg, loadingMsg])
    setInput('')
    setLoading(true)

    const newApiMessages = [
      ...apiMessages,
      { role: 'user' as const, content: text.trim() },
    ]

    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newApiMessages }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }

      const data: { reply: string; actions: { tool: string; summary: string }[]; messages: any[] } = await res.json()

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.reply,
        actions: data.actions,
      }

      setMessages(prev => [...prev.slice(0, -1), assistantMsg])
      setApiMessages(data.messages)
    } catch (err) {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: `Fehler: ${String(err)}. Bitte versuche es erneut.`,
      }
      setMessages(prev => [...prev.slice(0, -1), errorMsg])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function resetChat() {
    setMessages([])
    setApiMessages([])
    setInput('')
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">OKUN Assistent</h1>
            <p className="text-xs text-gray-500">Vollzugriff auf alle Systemdaten · Aktionen in Echtzeit</p>
          </div>
        </div>
        {!isEmpty && (
          <button
            onClick={resetChat}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Neu starten
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {isEmpty ? (
          <div className="max-w-2xl mx-auto">
            {/* Welcome */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Wie kann ich helfen?</h2>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                Ich habe Zugriff auf alle Systemdaten und kann direkt Änderungen vornehmen – Dienstplan, Mitarbeiter, Urlaubsanträge, Planungsregeln und mehr.
              </p>
            </div>

            {/* Example prompts */}
            <div className="grid gap-2">
              {EXAMPLE_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(prompt)}
                  className="w-full text-left px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-violet-300 hover:bg-violet-50 transition-all group"
                >
                  <span className="flex items-center gap-2">
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-violet-500 -rotate-90 transition-colors" />
                    {prompt}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-6">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                )}

                <div className={`max-w-[85%] ${msg.role === 'user' ? '' : ''}`}>
                  {msg.role === 'user' ? (
                    <div className="bg-violet-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5">
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  ) : msg.isLoading ? (
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
                        <span className="text-sm text-gray-500">Denke nach…</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Action chips */}
                      {msg.actions && msg.actions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {msg.actions.map((action, j) => (
                            <span
                              key={j}
                              className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${
                                WRITE_TOOLS.has(action.tool)
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-blue-50 text-blue-600 border border-blue-200'
                              }`}
                            >
                              {WRITE_TOOLS.has(action.tool) && <CheckCircle2 className="w-3 h-3" />}
                              {action.summary || TOOL_LABELS[action.tool] || action.tool}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Message content */}
                      {msg.content && (
                        <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                          <div className="space-y-0.5">
                            {renderMarkdown(msg.content)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-4 py-4 shrink-0">
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Frage stellen oder Aktion anweisen…"
              rows={1}
              disabled={loading}
              className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-60 max-h-32 overflow-y-auto"
              style={{ minHeight: '42px' }}
              onInput={e => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 128) + 'px'
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="h-10 w-10 rounded-xl bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Enter zum Senden · Shift+Enter für Zeilenumbruch
          </p>
        </div>
      </div>
    </div>
  )
}
