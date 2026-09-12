'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import type { DockItem, PanelItem } from './navData'

interface SearchModalProps {
  items: DockItem[]
  onClose: () => void
}

interface SearchResult {
  href: string
  label: string
  parent: string
  badge?: string
  isGold?: boolean
}

function buildResults(items: DockItem[]): SearchResult[] {
  const out: SearchResult[] = []
  for (const item of items) {
    if (item.href) {
      out.push({ href: item.href, label: item.label, parent: 'Navigation', badge: item.badge?.toString(), isGold: item.isGold })
    }
    if (item.panel) {
      for (const section of item.panel.sections) {
        for (const pi of section.items) {
          out.push({ href: pi.href, label: pi.label, parent: item.panel.title, badge: pi.badge, isGold: pi.isGold })
        }
      }
    }
  }
  return out
}

function match(r: SearchResult, q: string): boolean {
  const lq = q.toLowerCase()
  return r.label.toLowerCase().includes(lq) || r.parent.toLowerCase().includes(lq)
}

export function SearchModal({ items, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const allResults = buildResults(items)
  const results = query.trim() ? allResults.filter(r => match(r, query)) : allResults.slice(0, 8)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setSelected(0)
  }, [query])

  const navigate = (r: SearchResult) => {
    router.push(r.href)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) navigate(results[selected])
    if (e.key === 'Escape') onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(20,23,25,0.96)',
          border: '1px solid rgba(38,198,198,0.2)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
          animation: 'modal-in 0.28s cubic-bezier(.34,1.4,.64,1) forwards',
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.07]">
          <Search size={17} className="text-white/40 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Seite suchen…"
            className="flex-1 bg-transparent text-white/90 text-sm placeholder:text-white/30 outline-none"
          />
          <kbd className="text-[10px] text-white/25 border border-white/15 rounded px-1.5 py-0.5 font-mono">ESC</kbd>
        </div>

        {/* Results */}
        <div className="py-2 max-h-80 overflow-y-auto">
          {results.length === 0 && (
            <p className="text-white/35 text-sm text-center py-8">Keine Ergebnisse für &bdquo;{query}&ldquo;</p>
          )}
          {results.map((r, i) => (
            <button
              key={r.href}
              onClick={() => navigate(r)}
              onMouseEnter={() => setSelected(i)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
              style={{ background: i === selected ? 'rgba(38,198,198,0.1)' : 'transparent' }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${i === selected ? 'text-brand' : 'text-white/80'}`}>
                    {r.label}
                  </span>
                  {r.badge && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${r.isGold ? 'bg-gold/20 text-gold' : 'bg-brand/20 text-brand'}`}>
                      {r.badge}
                    </span>
                  )}
                </div>
                <p className="text-white/30 text-xs truncate">{r.parent}</p>
              </div>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke={i === selected ? 'rgb(38,198,198)' : 'rgba(255,255,255,0.2)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 6h8M6 2.5L9.5 6 6 9.5" />
              </svg>
            </button>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center gap-3 text-[10px] text-white/25">
          <span><kbd className="font-mono border border-white/15 rounded px-1">↑↓</kbd> navigieren</span>
          <span><kbd className="font-mono border border-white/15 rounded px-1">↵</kbd> öffnen</span>
          <span className="ml-auto">⌘K</span>
        </div>
      </div>
    </div>
  )
}
