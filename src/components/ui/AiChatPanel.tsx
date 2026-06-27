'use client'

import { useEffect, useRef } from 'react'
import { Button } from './Button'
import { Input } from './Input'
import { Logo } from './Logo'
import { cn } from '@/lib/utils'
import { Send, Sparkles, CheckCircle2, X } from 'lucide-react'

function AssistantAvatar({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const box = size === 'md' ? 'w-9 h-9' : 'w-7 h-7'
  const icon = size === 'md' ? 18 : 15
  return (
    <div className={cn(box, 'rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center flex-shrink-0 p-1.5')}>
      <Logo variant="icon" iconSize={icon} />
    </div>
  )
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatCompletion {
  title: string
  items: string[]
}

interface AiChatPanelProps {
  messages: ChatMessage[]
  sending: boolean
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  placeholder?: string
  hint?: React.ReactNode
  assistantName?: string
  progress?: { current: number; total: number; label?: string }
  completion?: ChatCompletion
  onCloseCompletion?: () => void
  footer?: React.ReactNode
  disabled?: boolean
}

export function AiChatPanel({
  messages,
  sending,
  input,
  onInputChange,
  onSend,
  placeholder = 'Deine Antwort…',
  hint,
  assistantName = 'OKUN Assistant',
  progress,
  completion,
  onCloseCompletion,
  footer,
  disabled,
}: AiChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, sending, completion])

  const isDone = !!completion
  const percent = progress ? Math.min(100, Math.round((progress.current / progress.total) * 100)) : 0

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3 pb-3 border-b border-gray-100">
        <AssistantAvatar />
        <div>
          <p className="text-sm font-semibold text-navy leading-tight">{assistantName}</p>
          <p className="text-[11px] text-gray-400 leading-tight flex items-center gap-1">
            {sending && !isDone && <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />}
            {isDone ? 'Gespräch abgeschlossen' : sending ? 'tippt…' : 'aktiv'}
          </p>
        </div>
      </div>

      {progress && !isDone && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Schritt {progress.current} von {progress.total}{progress.label ? ` · ${progress.label}` : ''}</span>
            <span>{percent}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      {hint && !isDone && (
        <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 mb-3">
          <Sparkles size={14} className="flex-shrink-0 mt-0.5 text-brand" />
          <span>{hint}</span>
        </div>
      )}

      <div className="space-y-3 mb-3 max-h-[28rem] overflow-y-auto pr-1">
        {messages.map((m, i) => (
          <div key={i} className={cn('flex gap-2 animate-fade-in', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            {m.role === 'assistant' && <AssistantAvatar size="sm" />}
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
                m.role === 'user'
                  ? 'bg-brand text-navy rounded-br-md shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-100 shadow-sm rounded-bl-md',
              )}
            >
              {m.content}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex gap-2 justify-start animate-fade-in">
            <AssistantAvatar size="sm" />
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-bl-md px-4 py-3.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-bounce" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {isDone ? (
        <div className="rounded-2xl border border-green-100 bg-green-50 p-4 animate-fade-in">
          <p className="font-semibold text-navy mb-2 flex items-center gap-2">
            <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
            {completion.title}
          </p>
          <ul className="space-y-1.5 mb-3">
            {completion.items.map((item, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <CheckCircle2 size={14} className="text-green-600 flex-shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          {onCloseCompletion && (
            <Button variant="secondary" size="sm" onClick={onCloseCompletion} className="gap-2">
              <X size={14} /> Schließen
            </Button>
          )}
        </div>
      ) : (
        <>
          {footer}
          <div className="flex gap-2 items-end">
            <Input
              containerClassName="flex-1"
              value={input}
              onChange={e => onInputChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onSend()
                }
              }}
              placeholder={placeholder}
              disabled={disabled || sending}
              className="rounded-2xl"
            />
            <Button onClick={onSend} loading={sending} size="md" disabled={disabled} className="rounded-2xl flex-shrink-0">
              <Send size={14} />
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
